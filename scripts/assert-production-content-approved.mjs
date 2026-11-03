import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProductionContent } from '../src/features/content/productionContentGate.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(
  fs.readFileSync(path.join(root, relativePath), 'utf8')
);
const errors = validateProductionContent({
  content: readJson('public/content/path-content.json'),
  topicsRegistry: readJson('public/assistant/knowledge/topics.v1.json'),
  subtopicsRegistry: readJson('public/assistant/knowledge/subtopics.v1.json'),
  evidenceRegistry: readJson('public/assistant/evidence/sources.v1.json'),
});
if (errors.length) {
  console.error(`انتشار تولید متوقف شد: ${errors.length} مورد از محتوای روزانه هنوز تأیید تخصصی کامل ندارند.`);
  errors.slice(0, 30).forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log('Production content approval gate passed for all daily units.');
}
