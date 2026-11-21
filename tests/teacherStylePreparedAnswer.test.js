import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanPreparedAssistantTopicText } from '../src/features/assistant/teacherStylePreparedAnswer.js';

const topics = [
  ['T01', 'خشم'], ['T02', 'اضطراب'], ['T03', 'ترس'], ['T04', 'نفرت'],
  ['T05', 'حسادت'], ['T06', 'غم و سوگ'], ['T07', 'احساس گناه'],
  ['T08', 'وابستگی عاطفی'], ['T09', 'اهمال‌کاری'],
  ['T10', 'بی‌خوابی و مشکلات خواب'], ['T11', 'عادت‌های تکراری'],
  ['T12', 'مرزبندی و نه گفتن'], ['T13', 'تنهایی'], ['T14', 'کمبود انگیزه'],
];

test('all T01-T14 internal topic IDs are rendered as their actual topic names', () => {
  for (const [id, label] of topics) {
    assert.equal(cleanPreparedAssistantTopicText('موضوع ' + id), 'موضوع ' + label, id);
    assert.equal(cleanPreparedAssistantTopicText('بسته ' + id + '-S01'), 'موضوع ' + label, id + ' subtopic package');
    assert.equal(cleanPreparedAssistantTopicText('راهنمای ' + id), 'راهنمای ' + label, id + ' inline ID');
  }
});
