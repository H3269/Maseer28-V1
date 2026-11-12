import assert from 'node:assert/strict';
import test from 'node:test';
import { getInterpersonalPrivacyNotice, getRelationshipSafetyGate } from '../src/features/journey/relationshipSafetyGate.js';

test('T08 interpersonal days require a mutual-choice check', () => {
  for (const day of [6, 11, 15, 24]) {
    const record = { id: 'وابستگی عاطفی-' + day, topic_id: 'T08', day };
    const gate = getRelationshipSafetyGate(record);
    assert.ok(gate, 'T08 day ' + day + ' must require the relationship safety check');
    assert.match(gate.question, /هر دو نفر/);
    assert.match(gate.disclaimer, /آزادی انتخاب هر یک از دو نفر/);
  }
  for (const day of [1, 5, 12, 18, 20, 25, 28]) {
    assert.equal(getRelationshipSafetyGate({ id: 'وابستگی عاطفی-' + day, topic_id: 'T08', day }), null);
  }
});

test('T08 support-seeking days 12, 18 and coercive-control day 25 show the device privacy notice', () => {
  for (const day of [12, 18, 25]) {
    const notice = getInterpersonalPrivacyNotice({ id: 'وابستگی عاطفی-' + day, topic_id: 'T08', day });
    assert.match(notice, /حافظه محلی مرورگر/);
    assert.match(notice, /رمزگذاری نمی‌کند/);
    assert.match(notice, /نظارت/);
  }
  for (const day of [6, 11, 15, 24]) {
    assert.equal(getInterpersonalPrivacyNotice({ id: 'وابستگی عاطفی-' + day, topic_id: 'T08', day }), null);
  }
});
