const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function parseVersion(value) {
  if (typeof value !== 'string') return null;
  const match = SEMVER.exec(value);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

export function nextReleaseVersion(packageVersion, previousVersion) {
  const base = parseVersion(packageVersion);
  if (!base) throw new TypeError('package_version_must_be_semver');
  const previous = parseVersion(previousVersion);
  if (!previous || compareVersions(base, previous) >= 0) return packageVersion;
  return `${previous[0]}.${previous[1]}.${previous[2] + 1}`;
}

export function createReleaseMetadata({ packageVersion, previousMetadata, publishedAt, sourceCommit }) {
  const timestamp = new Date(publishedAt);
  if (!Number.isFinite(timestamp.getTime())) throw new TypeError('published_at_must_be_valid');
  const previousVersion = previousMetadata?.version;
  return {
    version: nextReleaseVersion(packageVersion, previousVersion),
    publishedAt: timestamp.toISOString(),
    channel: 'production',
    sourceCommit: typeof sourceCommit === 'string' ? sourceCommit : '',
  };
}

export function isValidReleaseMetadata(value) {
  if (!value || typeof value !== 'object' || !parseVersion(value.version)) return false;
  if (value.channel === 'preview') return value.publishedAt === null;
  if (value.channel !== 'production' || typeof value.publishedAt !== 'string') return false;
  return Number.isFinite(Date.parse(value.publishedAt));
}

export function formatPublishedAtFa(publishedAt) {
  const date = new Date(publishedAt);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Tehran',
  }).format(date);
}

export function toPersianDigits(value) {
  return String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
}
