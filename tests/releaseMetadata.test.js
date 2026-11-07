import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createReleaseMetadata,
  formatPublishedAtFa,
  isValidReleaseMetadata,
  nextReleaseVersion,
  toPersianDigits,
} from '../src/shared/releaseMetadata.js';

test('uses package version for the first published release', () => {
  assert.equal(nextReleaseVersion('1.0.0', null), '1.0.0');
});

test('increments patch version for each later publication', () => {
  assert.equal(nextReleaseVersion('1.0.0', '1.0.0'), '1.0.1');
  assert.equal(nextReleaseVersion('1.0.0', '1.0.9'), '1.0.10');
});

test('respects a newer package version without an extra patch bump', () => {
  assert.equal(nextReleaseVersion('1.2.0', '1.0.9'), '1.2.0');
});

test('rejects malformed version and timestamp values', () => {
  assert.throws(() => nextReleaseVersion('v1.0', null), /semver/);
  assert.throws(() => createReleaseMetadata({
    packageVersion: '1.0.0',
    previousMetadata: null,
    publishedAt: 'not-a-date',
  }), /published_at/);
});

test('creates production metadata with a normalized UTC timestamp', () => {
  const metadata = createReleaseMetadata({
    packageVersion: '1.0.0',
    previousMetadata: null,
    publishedAt: '2026-11-07T12:44:47Z',
    sourceCommit: 'abc123',
  });
  assert.deepEqual(metadata, {
    version: '1.0.0',
    publishedAt: '2026-11-07T12:44:47.000Z',
    channel: 'production',
    sourceCommit: 'abc123',
  });
  assert.equal(isValidReleaseMetadata(metadata), true);
});

test('accepts preview metadata without inventing a release date', () => {
  assert.equal(isValidReleaseMetadata({
    version: '1.0.0',
    publishedAt: null,
    channel: 'preview',
  }), true);
  assert.equal(isValidReleaseMetadata({
    version: '1.0.0',
    publishedAt: null,
    channel: 'production',
  }), false);
});

test('formats the publication date with the Persian calendar and Tehran timezone', () => {
  assert.equal(formatPublishedAtFa('2026-11-07T12:44:47Z'), '۱۶ آبان ۱۴۰۵');
  assert.equal(formatPublishedAtFa('invalid'), '');
});

test('converts version digits to Persian numerals', () => {
  assert.equal(toPersianDigits('1.20.3'), '۱.۲۰.۳');
});
