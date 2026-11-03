const VALID_REVIEWER_ROLES = new Set([
  'qualified_clinician',
  'evidence_reviewer',
  'safety_reviewer',
]);
const VALID_EVIDENCE_GRADES = new Set(['very_low', 'low', 'moderate', 'high']);
const VALID_RISK_LEVELS = new Set(['routine', 'caution', 'human_review_required']);

export function validateProductionContent({
  content,
  topicsRegistry,
  subtopicsRegistry,
  evidenceRegistry,
  expectedTopics = 34,
  expectedDays = 28,
} = {}) {
  const errors = [];
  const categories = Object.entries(content?.categories || {});
  const topicByName = new Map((topicsRegistry?.topics || []).map((item) => [item.name, item]));
  const topicById = new Map((topicsRegistry?.topics || []).map((item) => [item.topic_id, item]));
  const subtopicById = new Map((subtopicsRegistry?.subtopics || []).map((item) => [item.subtopic_id, item]));
  const sourceIds = new Set((evidenceRegistry?.sources || []).map((item) => item.source_id));
  const dayById = new Map();

  if (categories.length !== expectedTopics) {
    errors.push(`Expected ${expectedTopics} topics; found ${categories.length}.`);
  }

  for (const [topicName, category] of categories) {
    const topicRecord = topicByName.get(topicName);
    const days = Array.isArray(category?.days) ? category.days : [];
    if (days.length !== expectedDays) {
      errors.push(`Topic "${topicName}" must contain ${expectedDays} days; found ${days.length}.`);
    }

    for (let index = 0; index < days.length; index += 1) {
      const day = days[index];
      const label = `${topicName} / day ${index + 1}`;
      if (day?.id) dayById.set(day.id, { topicName, day });
      if (day?.review_status !== 'approved') {
        errors.push(`${label}: content is not expert-approved.`);
      }

      const requiredText = [
        'topic_id', 'learning_objective', 'target_skill', 'teaching_point',
        'exercise_type', 'instructions', 'reflection_prompt', 'success_criterion',
        'when_to_seek_human_support', 'review_record_id', 'reviewer_name', 'reviewed_at',
      ];
      for (const field of requiredText) {
        if (typeof day?.[field] !== 'string' || !day[field].trim()) {
          errors.push(`${label}: required field ${field} is missing.`);
        }
      }

      if (!Number.isInteger(day?.duration_minutes) || day.duration_minutes < 1 || day.duration_minutes > 60) {
        errors.push(`${label}: duration_minutes is invalid.`);
      }
      if (!Array.isArray(day?.subtopic_ids) || day.subtopic_ids.length === 0) {
        errors.push(`${label}: subtopic_ids are missing.`);
      }
      if (!Array.isArray(day?.source_ids) || day.source_ids.length === 0
        || day.source_ids.some((sourceId) => !sourceIds.has(sourceId))) {
        errors.push(`${label}: source_ids are missing or not registered.`);
      }
      if (!Array.isArray(day?.stop_conditions) || day.stop_conditions.length === 0
        || !Array.isArray(day?.contraindications) || day.contraindications.length === 0) {
        errors.push(`${label}: stop conditions or contraindications are missing.`);
      }
      if (!VALID_EVIDENCE_GRADES.has(day?.evidence_grade)) {
        errors.push(`${label}: evidence_grade has not been assessed.`);
      }
      if (!VALID_RISK_LEVELS.has(day?.risk_level)) {
        errors.push(`${label}: risk_level is invalid.`);
      }
      if (!VALID_REVIEWER_ROLES.has(day?.reviewer_role)) {
        errors.push(`${label}: reviewer_role is not an allowed qualified role.`);
      }
      if (!Number.isFinite(Date.parse(day?.reviewed_at || ''))) {
        errors.push(`${label}: reviewed_at is invalid.`);
      }

      const expectedTopic = topicByName.get(topicName);
      if (!expectedTopic || day?.topic_id !== expectedTopic.topic_id) {
        errors.push(`${label}: topic_id does not match the topic registry.`);
      }
      if (topicRecord && (!Array.isArray(topicRecord.content_ids) || !topicRecord.content_ids.includes(day.id))) {
        errors.push(`${label}: approved topic content link is missing.`);
      }
      if (topicRecord?.draft_content_ids?.includes(day.id)) {
        errors.push(`${label}: approved content still appears in draft_content_ids.`);
      }

      for (const subtopicId of day?.subtopic_ids || []) {
        const subtopic = subtopicById.get(subtopicId);
        if (!subtopic || subtopic.topic_id !== day.topic_id) {
          errors.push(`${label}: subtopic ${subtopicId} is invalid or belongs to another topic.`);
          continue;
        }
        if (!Array.isArray(subtopic.content_ids) || !subtopic.content_ids.includes(day.id)) {
          errors.push(`${label}: approved subtopic content link is missing for ${subtopicId}.`);
        }
        if (subtopic.draft_content_ids?.includes(day.id)) {
          errors.push(`${label}: approved content still appears in draft links for ${subtopicId}.`);
        }
      }
    }
  }

  for (const topic of topicsRegistry?.topics || []) {
    for (const id of topic.content_ids || []) {
      const linked = dayById.get(id);
      if (!linked || linked.day.review_status !== 'approved' || linked.day.topic_id !== topic.topic_id) {
        errors.push(`Topic ${topic.topic_id} has an orphaned or unapproved content link: ${id}.`);
      }
    }
  }
  for (const subtopic of subtopicsRegistry?.subtopics || []) {
    for (const id of subtopic.content_ids || []) {
      const linked = dayById.get(id);
      if (!linked || linked.day.review_status !== 'approved'
        || !linked.day.subtopic_ids?.includes(subtopic.subtopic_id)) {
        errors.push(`Subtopic ${subtopic.subtopic_id} has an orphaned or unapproved content link: ${id}.`);
      }
    }
  }

  return errors;
}
