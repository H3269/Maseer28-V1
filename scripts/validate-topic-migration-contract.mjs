import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateMigrationContract({ crosswalk, aliases, manifest, fixture, topics, subtopics }) {
  const errors = [];
  const topicIds = new Set(topics.map(x => x.topic_id));
  const subtopicIds = new Set(subtopics.map(x => x.subtopic_id));
  const seenMappings = new Set();
  if (crosswalk.contract_version !== '1.0.0' || crosswalk.contract_id !== 'maseer28-topic-crosswalk') errors.push('Crosswalk identity/version is invalid.');
  if (aliases.contract_version !== '1.0.0' || aliases.alias_registry_id !== 'maseer28-topic-aliases') errors.push('Alias registry identity/version is invalid.');
  if (crosswalk.status !== 'draft_no_runtime_use') errors.push('Crosswalk must remain non-runtime.');
  if (aliases.status !== 'draft_no_runtime_use') errors.push('Aliases must remain non-runtime.');
  if (manifest.status !== 'design_only_not_executable' || manifest.execution_allowed !== false || manifest.execution_mode !== 'dry_run_fixture_only') errors.push('Manifest must be non-executable dry-run only.');
  if (crosswalk.topic_mappings.length !== topics.length) errors.push('Every legacy category must have exactly one candidate mapping record.');
  for (const m of [...crosswalk.topic_mappings, ...crosswalk.subtopic_mappings]) {
    if (seenMappings.has(m.mapping_id)) errors.push('Duplicate mapping_id: ' + m.mapping_id);
    seenMappings.add(m.mapping_id);
    if (!Array.isArray(m.targets)) errors.push('Targets must be an array: ' + m.mapping_id);
    if (!m.requires_human_review || !m.preserve_source) errors.push('Mappings must require review and preserve source: ' + m.mapping_id);
    const targetIds = (m.targets || []).map(x => x.id);
    if (m.mapping_type === 'one_to_one' && targetIds.length !== 1) errors.push('one_to_one requires one target: ' + m.mapping_id);
    if (m.mapping_type === 'many_to_one' && targetIds.length !== 1) errors.push('many_to_one requires one target: ' + m.mapping_id);
    if (m.mapping_type === 'one_to_many' && targetIds.length < 2) errors.push('one_to_many requires at least two targets: ' + m.mapping_id);
    if (m.mapping_type.startsWith('unmapped') && targetIds.length !== 0) errors.push('Unmapped entries cannot have targets: ' + m.mapping_id);
    for (const t of m.targets || []) {
      if (t.entity_type === 'topic' && !topicIds.has(t.id)) errors.push('Unknown topic target: ' + t.id);
      if (t.entity_type === 'subtopic' && !subtopicIds.has(t.id)) errors.push('Unknown subtopic target: ' + t.id);
    }
  }
  const aliasKeys = new Set();
  for (const a of aliases.aliases) {
    const key = a.namespace + '::' + a.value;
    if (aliasKeys.has(key)) errors.push('Duplicate alias: ' + key);
    aliasKeys.add(key);
    if (!topicIds.has(a.target_topic_id)) errors.push('Alias target is unknown: ' + a.target_topic_id);
    if (a.requires_human_review !== true) errors.push('Aliases must require human review: ' + a.alias_id);
  }
  if (aliases.aliases.length !== topics.length) errors.push('Alias count must match current legacy topic count.');
  for (const c of fixture.cases) {
    const n = c.target_ids.length;
    if (c.mapping_type === 'one_to_one' && n !== 1) errors.push('Invalid one_to_one fixture: ' + c.case_id);
    if (c.mapping_type === 'many_to_one' && n !== 1) errors.push('Invalid many_to_one fixture: ' + c.case_id);
    if (c.mapping_type === 'one_to_many' && n < 2) errors.push('Invalid one_to_many fixture: ' + c.case_id);
    if (c.mapping_type.startsWith('unmapped') && n !== 0) errors.push('Invalid unmapped fixture: ' + c.case_id);
  }
  if (!manifest.contracts.crosswalk_schema_path || !manifest.contracts.alias_schema_path) errors.push('Manifest must link both crosswalk and alias schemas.');
  if (manifest.rollout_gates && Object.values(manifest.rollout_gates).some(v => v !== false)) errors.push('All rollout gates must remain closed.');
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
  const result = validateMigrationContract({
    crosswalk: read('public/assistant/migrations/topic-crosswalk.v1.json'),
    aliases: read('public/assistant/migrations/topic-aliases.v1.json'),
    manifest: read('public/assistant/migrations/topic-migration-manifest.v1.json'),
    fixture: read('public/assistant/migrations/topic-migration-fixtures.v1.json'),
    topics: read('public/assistant/knowledge/topics.v1.json').topics,
    subtopics: read('public/assistant/knowledge/subtopics.v1.json').subtopics
  });
  if (result.length) { console.error('Migration contract validation failed:\n' + result.map(x => '- ' + x).join('\n')); process.exitCode = 1; }
  else console.log('Migration contract valid: candidate mappings only; 34 aliases; fixture cases cover 1:1, many:1, 1:many, unmapped, and quarantine; all rollout gates closed.');
}
