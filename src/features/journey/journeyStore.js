import { normalizeDigits } from '../../shared/utils.js';

export const JOURNEY_KEY = 'maseer28_state';
export const PROFILE_KEY = 'maseer28_user_profile_v1';
export const PROFILE_V2_KEY = 'maseer28_user_profile_v2';
export const PROFILE_V2_MIGRATION_KEY = 'maseer28_profile_v2_migration_v1';
export const ONBOARDING_COMPLETE_KEY = 'maseer28_onboarding_complete_v1';
export const COPYRIGHT_KEY = 'maseer28_copyright_v60';
export const CLOCK_GUARD_KEY = 'maseer28_trusted_clock_guard_v2';
export const START_GUARD_KEY = 'maseer28_start_guard_v2';

// A short in-memory anchor avoids repeated server-time round trips while a user
// opens a day and submits its result. Elapsed time uses performance.now(), not device clock.
const TRUSTED_TIME_CACHE_MS = 120000;
let trustedTimeAnchor = null;

export const APP_CONFIG = {
  TEST_MODE: true,
  TIME_LOCK_ENABLED: false,
  // Calendar days are evaluated in a fixed timezone so changing the phone
  // timezone cannot unlock the next day early.
  TIME_ZONE: 'Asia/Tehran',
};

export function defaultJourneyState() {
  return {
    schema: 7,
    started: false,
    profile: false,
    assessment: false,
    completed: [],
    answers: {},
    daily: {},
    final: null,
    profileData: null,
    assessmentData: null,
    archive: [],
    archiveCleanupReady: false,
    pathId: null,
    startedAt: null,
    lastView: 'home',
  };
}

export function validScore(value) {
  if (value === null || value === undefined) return false;
  const normalized = normalizeDigits(value).trim();
  if (!/^\d+$/.test(normalized)) return false;
  const n = Number(normalized);
  return Number.isInteger(n) && n >= 0 && n <= 10;
}

export function safeText(value, max = 3000) {
  const text = String(value ?? '').trim();
  return text.length > 0 && text.length <= max && !/[<>]/.test(text);
}

export function validPersianText(value) {
  const text = String(value ?? '').trim();
  if (text.length < 1 || text.length > 3000) return false;
  if (/[<>]/.test(text)) return false;
  if (/(.)\1{5,}/u.test(text)) return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/u.test(text);
}

export function validDailyAnswer(value) {
  return safeText(value, 3000);
}

export function validName(value) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  return text.length >= 2 && text.length <= 80 && /^[\u0600-\u06FF\u200c\s.-]+$/u.test(text);
}

export function validPhone(value) {
  const text = normalizeDigits(String(value ?? '').replace(/\s+/g, ''));
  return /^09\d{9}$/.test(text);
}

function cleanScale(value) {
  if (!Array.isArray(value) || value.length !== 5) return null;
  const rows = value.map(Number);
  return rows.every((n) => Number.isInteger(n) && n >= 0 && n <= 4) ? rows : null;
}

export function sanitizeJourneyState(raw) {
  const base = defaultJourneyState();
  if (!raw || typeof raw !== 'object') return base;
  const out = { ...base, ...raw, schema: 7 };
  out.started = Boolean(raw.started);
  out.profile = Boolean(raw.profile);
  out.assessment = Boolean(raw.assessment);

  out.completed = [];
  if (Array.isArray(raw.completed)) {
    const nums = [...new Set(raw.completed.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 28))].sort((a, b) => a - b);
    for (let index = 0; index < nums.length; index += 1) {
      if (nums[index] !== index + 1) break;
      out.completed.push(nums[index]);
    }
  }

  out.answers = {};
  if (raw.answers && typeof raw.answers === 'object') {
    for (const [key, value] of Object.entries(raw.answers)) {
      const n = Number(key);
      if (Number.isInteger(n) && n >= 1 && n <= 28 && typeof value === 'string') out.answers[n] = value.slice(0, 3000);
    }
  }

  out.daily = {};
  if (raw.daily && typeof raw.daily === 'object') {
    for (const [key, value] of Object.entries(raw.daily)) {
      const n = Number(key);
      if (!Number.isInteger(n) || n < 1 || n > 28 || !value || typeof value !== 'object') continue;
      const rec = {};
      if (validScore(value.score)) rec.score = Number(normalizeDigits(value.score));
      if (['better', 'same', 'worse', 'hard'].includes(value.feedback)) rec.feedback = value.feedback;
      if (typeof value.feedbackText === 'string') rec.feedbackText = value.feedbackText.slice(0, 1000);
      if (typeof value.exerciseId === 'string') rec.exerciseId = value.exerciseId.slice(0, 200);
      if (typeof value.updatedAt === 'string') rec.updatedAt = value.updatedAt;
      if (value.bookRec && typeof value.bookRec === 'object') {
        const bookId = Number(value.bookRec.bookId), page = Number(value.bookRec.page);
        if (Number.isInteger(bookId) && bookId >= 1 && bookId <= 5 && Number.isInteger(page) && page >= 1) {
          rec.bookRec = { bookId, page, reason: String(value.bookRec.reason || '').slice(0, 500) };
        }
      }
      if (Object.keys(rec).length) out.daily[n] = rec;
    }
  }

  if (raw.profileData && typeof raw.profileData === 'object') {
    const p = raw.profileData;
    const age = Number(normalizeDigits(p.age));
    const years = Number(normalizeDigits(p.durationYears));
    const months = Number(normalizeDigits(p.durationMonths));
    out.profileData = {
      name: validName(p.name) ? String(p.name).trim().replace(/\s+/g, ' ') : String(p.name || '').slice(0, 80),
      age: Number.isInteger(age) && age >= 12 && age <= 100 ? age : '',
      gender: ['زن', 'مرد', 'ترجیح می‌دهم نگویم'].includes(p.gender) ? p.gender : '',
      phone: validPhone(p.phone) ? normalizeDigits(p.phone) : String(p.phone || '').slice(0, 11),
      medical: ['none', 'epilepsy', 'seizure', 'panic', 'bipolar', 'speech_hearing', 'other'].includes(p.medical) ? p.medical : '',
      medicalNote: String(p.medicalNote || '').slice(0, 1000),
      medication: ['no', 'yes_fixed', 'yes_flexible'].includes(p.medication) ? p.medication : '',
      medicationRisk: ['no', 'yes', 'unknown'].includes(p.medicationRisk) ? p.medicationRisk : '',
      problem: String(p.problem || '').slice(0, 200),
      durationYears: Number.isInteger(years) && years >= 0 && years <= 100 ? years : 0,
      durationMonths: Number.isInteger(months) && months >= 0 && months <= 11 ? months : 0,
      goal: String(p.goal || '').slice(0, 1000),
      code: String(p.code || '').slice(0, 50),
    };
  } else out.profileData = null;

  const assessmentAnswers = cleanScale(raw.assessmentData?.answers || raw.assessmentData?.scaleAnswers);
  if (assessmentAnswers) {
    const score = burdenScoreFromAnswers(assessmentAnswers);
    out.assessmentData = {
      ...(raw.assessmentData || {}),
      answers: assessmentAnswers,
      total: assessmentAnswers.slice(0, 4).reduce((sum, n) => sum + n, 0),
      score,
      motivation: assessmentAnswers[4],
      scaleMax: 4,
      version: 2,
    };
    out.assessment = true;
  } else if (raw.assessmentData && validScore(raw.assessmentData.score)) {
    out.assessmentData = { ...raw.assessmentData, score: Number(normalizeDigits(raw.assessmentData.score)) };
    // V61 compatibility: an old V60 path that never entered day 1 must take the restored five-question baseline.
    if (out.assessment && out.completed.length === 0) out.assessment = false;
  } else {
    out.assessmentData = null;
    if (out.assessment && out.completed.length === 0) out.assessment = false;
  }

  const finalAnswers = cleanScale(raw.final?.answers || raw.final?.scaleAnswers);
  if (raw.final && typeof raw.final === 'object' && (finalAnswers || validScore(raw.final.score))) {
    const score = finalAnswers ? burdenScoreFromAnswers(finalAnswers) : Number(raw.final.score);
    out.final = {
      ...raw.final,
      score,
      answers: finalAnswers || undefined,
      total: finalAnswers ? finalAnswers.slice(0, 4).reduce((sum, n) => sum + n, 0) : raw.final.total,
      motivation: finalAnswers && Number(raw.final.version || 2) < 3 ? finalAnswers[4] : raw.final.motivation,
      progress: finalAnswers && Number(raw.final.version || 2) >= 3 && Number.isInteger(Number(raw.final.progress)) && Number(raw.final.progress) >= 0 && Number(raw.final.progress) <= 4 ? Number(raw.final.progress) : undefined,
      progressScaleMax: finalAnswers && Number(raw.final.version || 2) >= 3 ? 4 : raw.final.progressScaleMax,
      scaleMax: finalAnswers ? 4 : raw.final.scaleMax,
      version: finalAnswers ? (Number(raw.final.version || 2) >= 3 ? 3 : 2) : raw.final.version,
      f1: String(raw.final.f1 || '').slice(0, 2000),
      f2: String(raw.final.f2 || '').slice(0, 2000),
      f3: String(raw.final.f3 || '').slice(0, 2000),
      f4: String(raw.final.f4 || '').slice(0, 2000),
      completedAt: String(raw.final.completedAt || ''),
    };
  } else out.final = null;

  out.archive = Array.isArray(raw.archive) ? raw.archive.filter((x) => x && typeof x === 'object').slice(0, 20) : [];
  out.archiveCleanupReady = Boolean(raw.archiveCleanupReady);
  out.pathId = typeof raw.pathId === 'string' ? raw.pathId.slice(0, 60) : null;
  out.startedAt = typeof raw.startedAt === 'string' ? raw.startedAt : null;
  const views = ['home', 'howWorks', 'profile', 'pathSetup', 'assessment', 'dashboard', 'day', 'dailyResult', 'books', 'support', 'final', 'done', 'report', 'bookReader', 'archive'];
  out.lastView = views.includes(raw.lastView) ? raw.lastView : 'home';
  return out;
}

export function loadJourneyState() {
  try { return sanitizeJourneyState(JSON.parse(localStorage.getItem(JOURNEY_KEY) || 'null')); }
  catch { return defaultJourneyState(); }
}

export function saveJourneyState(state) {
  localStorage.setItem(JOURNEY_KEY, JSON.stringify(sanitizeJourneyState(state)));
}

function readProfileRecord(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

const PROFILE_FIELDS = [
  'name', 'age', 'gender', 'phone',
  'medical', 'medicalNote', 'medication', 'medicationRisk',
];

function normalizeProfileRecord(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const result = {};
  for (const field of PROFILE_FIELDS) {
    const value = source[field];
    if (value === undefined || value === null) continue;
    if (field === 'name') {
      if (validName(value)) result.name = String(value).trim().replace(/\s+/g, ' ').slice(0, 80);
    } else if (field === 'age') {
      const age = Number(normalizeDigits(value));
      if (Number.isInteger(age) && age >= 12 && age <= 100) result.age = age;
    } else if (field === 'gender') {
      if (['زن', 'مرد', 'ترجیح می‌دهم نگویم'].includes(value)) result.gender = value;
    } else if (field === 'phone') {
      if (validPhone(value)) result.phone = normalizeDigits(value);
    } else if (field === 'medical') {
      if (['none', 'epilepsy', 'seizure', 'panic', 'bipolar', 'speech_hearing', 'other'].includes(value)) result.medical = value;
    } else if (field === 'medicalNote') {
      if (typeof value === 'string') result.medicalNote = value.trim().slice(0, 1000);
    } else if (field === 'medication') {
      if (['no', 'yes_fixed', 'yes_flexible'].includes(value)) result.medication = value;
    } else if (field === 'medicationRisk') {
      if (['no', 'yes', 'unknown'].includes(value)) result.medicationRisk = value;
    }
  }
  return Object.keys(result).length ? result : null;
}

function isEmptyProfileValue(value) {
  return value === undefined || value === null || value === '';
}

function sameProfileRecord(left, right) {
  return Boolean(left && right) && PROFILE_FIELDS.every((field) => Object.is(left[field], right[field]));
}

export function loadUserProfile() {
  return normalizeProfileRecord(readProfileRecord(PROFILE_V2_KEY))
    || normalizeProfileRecord(readProfileRecord(PROFILE_KEY));
}

export function saveUserProfile(profile) {
  const normalized = normalizeProfileRecord(profile);
  if (!normalized) throw new Error('Invalid user profile');
  localStorage.setItem(PROFILE_V2_KEY, JSON.stringify(normalized));
  const verified = normalizeProfileRecord(readProfileRecord(PROFILE_V2_KEY));
  if (!sameProfileRecord(verified, normalized)) {
    throw new Error('User profile write verification failed');
  }
}

/**
 * Additive, verified migration. Existing v2 values win; only missing v2
 * fields are filled from v1 and then from the legacy journey snapshot.
 * Legacy records are intentionally retained for a later, separately tested cleanup.
 */
export function migrateUserProfileToV2(state = loadJourneyState()) {
  const currentRecord = normalizeProfileRecord(readProfileRecord(PROFILE_V2_KEY));
  try {
    if (localStorage.getItem(PROFILE_V2_MIGRATION_KEY) === '1') {
      return currentRecord
        ? { migrated: true, profile: currentRecord, reason: 'already_verified' }
        : { migrated: false, profile: null, reason: 'canonical_missing' };
    }
  } catch {
    return { migrated: false, profile: null, reason: 'storage_failure' };
  }
  const current = currentRecord || {};
  const legacyIndependent = normalizeProfileRecord(readProfileRecord(PROFILE_KEY)) || {};
  const legacyJourney = normalizeProfileRecord(state?.profileData) || {};
  const merged = { ...current };

  for (const field of PROFILE_FIELDS) {
    if (isEmptyProfileValue(merged[field]) && !isEmptyProfileValue(legacyIndependent[field])) {
      merged[field] = legacyIndependent[field];
    }
    if (isEmptyProfileValue(merged[field]) && !isEmptyProfileValue(legacyJourney[field])) {
      merged[field] = legacyJourney[field];
    }
  }

  if (!Object.keys(merged).length) return { migrated: false, profile: null, reason: 'no_source_data' };

  try {
    localStorage.setItem(PROFILE_V2_KEY, JSON.stringify(merged));
    const verified = normalizeProfileRecord(readProfileRecord(PROFILE_V2_KEY));
    if (!sameProfileRecord(verified, merged)) {
      return { migrated: false, profile: null, reason: 'readback_mismatch' };
    }
    localStorage.setItem(PROFILE_V2_MIGRATION_KEY, '1');
    if (localStorage.getItem(PROFILE_V2_MIGRATION_KEY) !== '1') {
      return { migrated: false, profile: verified, reason: 'marker_verification_failed' };
    }
    return { migrated: true, profile: verified, reason: 'verified' };
  } catch {
    return { migrated: false, profile: null, reason: 'storage_failure' };
  }
}

export const JOURNEY_PRIVACY_MIGRATION_VERSION = 1;
const LEGACY_SENSITIVE_PROFILE_FIELDS = [
  'name', 'age', 'gender', 'phone',
  'medical', 'medicalNote', 'medication', 'medicationRisk',
];

function hasProfileValue(value) {
  return value !== undefined && value !== null && value !== '';
}

/**
 * Prepare (but do not persist) a loss-minimizing migration of legacy identity
 * and health fields out of journey and archive snapshots. The caller must first
 * verify that the current journey's sensitive values exist in the canonical
 * profile. Archive identity is intentionally not copied to the current profile.
 */
export function prepareJourneyPrivacyMigration(rawState, canonicalProfile) {
  if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
    return { ready: false, reason: 'invalid_journey_state', missingCanonicalFields: [], state: null };
  }
  const legacyProfile = rawState.profileData && typeof rawState.profileData === 'object'
    ? rawState.profileData : {};
  const canonical = normalizeProfileRecord(canonicalProfile) || {};
  const missingCanonicalFields = LEGACY_SENSITIVE_PROFILE_FIELDS.filter((field) =>
    hasProfileValue(legacyProfile[field]) && !hasProfileValue(canonical[field])
  );
  if (missingCanonicalFields.length) {
    return { ready: false, reason: 'canonical_profile_incomplete', missingCanonicalFields, state: null };
  }

  const keepPathFields = (profile) => {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return null;
    const years = Number(normalizeDigits(profile.durationYears));
    const months = Number(normalizeDigits(profile.durationMonths));
    return {
      problem: typeof profile.problem === 'string' ? profile.problem.slice(0, 200) : '',
      durationYears: Number.isInteger(years) && years >= 0 && years <= 100 ? years : 0,
      durationMonths: Number.isInteger(months) && months >= 0 && months <= 11 ? months : 0,
      goal: typeof profile.goal === 'string' ? profile.goal.slice(0, 1000) : '',
    };
  };

  const migrated = {
    ...rawState,
    profileData: keepPathFields(rawState.profileData),
    archive: Array.isArray(rawState.archive) ? rawState.archive.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
      return { ...entry, profileData: keepPathFields(entry.profileData) };
    }) : rawState.archive,
    privacyMigrationVersion: JOURNEY_PRIVACY_MIGRATION_VERSION,
  };
  return { ready: true, reason: 'preflight_passed', missingCanonicalFields: [], state: migrated };
}
/** Execute the versioned legacy privacy migration with read-back and guarded compensation. */
export function executeJourneyPrivacyMigration({
  storage = globalThis.localStorage,
  canonicalProfile = loadUserProfile(),
} = {}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    return { migrated: false, reason: 'storage_unavailable' };
  }
  let originalRaw;
  let rawState;
  try {
    originalRaw = storage.getItem(JOURNEY_KEY);
    if (originalRaw == null) return { migrated: false, reason: 'no_source_data' };
    rawState = JSON.parse(originalRaw);
  } catch {
    return { migrated: false, reason: 'source_read_or_parse_failed' };
  }
  if (rawState?.privacyMigrationVersion >= JOURNEY_PRIVACY_MIGRATION_VERSION) {
    return { migrated: true, reason: 'already_verified' };
  }
  const plan = prepareJourneyPrivacyMigration(rawState, canonicalProfile);
  if (!plan.ready) return { migrated: false, reason: plan.reason, missingCanonicalFields: plan.missingCanonicalFields };

  const hasArchivedSensitiveData = Array.isArray(rawState.archive) && rawState.archive.some((entry) =>
    LEGACY_SENSITIVE_PROFILE_FIELDS.some((field) => hasProfileValue(entry?.profileData?.[field]))
  );
  if (hasArchivedSensitiveData && !normalizeProfileRecord(canonicalProfile)) {
    return { migrated: false, reason: 'canonical_profile_required_for_archive_cleanup' };
  }

  const migratedRaw = JSON.stringify(plan.state);
  try {
    // Avoid overwriting a journey that changed between preflight and commit.
    if (storage.getItem(JOURNEY_KEY) !== originalRaw) {
      return { migrated: false, reason: 'source_changed_during_preflight' };
    }
    storage.setItem(JOURNEY_KEY, migratedRaw);
    const verifiedRaw = storage.getItem(JOURNEY_KEY);
    const verified = verifiedRaw == null ? null : JSON.parse(verifiedRaw);
    if (verifiedRaw !== migratedRaw || JSON.stringify(verified) !== migratedRaw) {
      throw new Error('privacy migration read-back mismatch');
    }
    return { migrated: true, reason: 'verified', version: JOURNEY_PRIVACY_MIGRATION_VERSION };
  } catch {
    // Compensate only if our own candidate is still present; never overwrite
    // a concurrent update from another tab or process.
    try {
      const currentRaw = storage.getItem(JOURNEY_KEY);
      if (currentRaw === originalRaw) {
        return { migrated: false, reason: 'write_failed_unchanged' };
      }
      if (currentRaw === migratedRaw) {
        storage.setItem(JOURNEY_KEY, originalRaw);
        if (storage.getItem(JOURNEY_KEY) === originalRaw) {
          return { migrated: false, reason: 'write_failed_rolled_back' };
        }
      }
    } catch {
      // The source may require manual recovery; report this explicitly below.
    }
    return { migrated: false, reason: 'recovery_required' };
  }
}

export function saveOnboardingComplete() {
  try {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

export function loadOnboardingComplete(state, userProfile) {
  if (!userProfile || typeof userProfile !== 'object') return false;

  try {
    if (localStorage.getItem(ONBOARDING_COMPLETE_KEY) === '1') return true;
  } catch {
    // Fall through to the legacy-state check when storage cannot be read.
  }

  // Migrate existing users only when their saved journey proves that the
  // profile and baseline assessment were both completed before this update.
  const completedCurrentPath = Boolean(
    state?.profile &&
    state?.assessment &&
    state?.assessmentData &&
    validScore(state.assessmentData.score)
  );
  // A user affected by the old reset bug may now have an empty fresh path,
  // while their completed baseline remains safely stored in the archive.
  const completedArchivedPath = Array.isArray(state?.archive) && state.archive.some((path) => (
    path?.profileData &&
    path?.assessmentData &&
    validScore(path.assessmentData.score)
  ));
  const legacyComplete = completedCurrentPath || completedArchivedPath;
  if (!legacyComplete) return false;

  saveOnboardingComplete();
  return true;
}

export function migrateUserProfileFromJourney(state = loadJourneyState()) {
  if (loadUserProfile() || !state.profileData?.name) return loadUserProfile();
  const p = state.profileData;
  const user = {
    name: p.name || '', age: p.age || '', gender: p.gender || '', phone: p.phone || '',
    medical: p.medical || '', medicalNote: p.medicalNote || '', medication: p.medication || '', medicationRisk: p.medicationRisk || '',
  };
  saveUserProfile(user);
  return user;
}

export function createPathId() {
  return `M28-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function createClientCode() {
  return `M28-${String(Date.now()).slice(-6)}`;
}

export function nextRequiredDay(state) {
  for (let day = 1; day <= 28; day += 1) if (!(state.completed || []).includes(day)) return day;
  return 29;
}

export function burdenScoreFromAnswers(answers) {
  if (!Array.isArray(answers) || answers.length < 4) return null;
  const total = answers.slice(0, 4).reduce((sum, value) => sum + Number(value || 0), 0);
  return Math.round((total / 16) * 10);
}

const DAY_MS = 86400000;
const SERVER_CLOCK_BACKWARD_TOLERANCE_MS = 5 * 60 * 1000;

function readJsonStorage(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function writeJsonStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { /* Storage may be unavailable. */ }
}

async function fetchServerDateMs(method = 'HEAD') {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return null;
  const url = new URL(window.location.href);
  url.hash = '';
  // Cache-busting must not depend on the device clock.
  url.searchParams.set('_m28_time', Math.random().toString(36).slice(2));

  const response = await fetch(url.toString(), {
    method,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) return null;

  const header = response.headers.get('date');
  const value = header ? Date.parse(header) : NaN;
  if (method === 'GET' && response.body?.cancel) {
    try { await response.body.cancel(); } catch { /* no-op */ }
  }
  return Number.isFinite(value) ? value : null;
}

/**
 * Returns time supplied by the same web server that serves the app.
 * Device Date/Time and timezone are never used as the authority.
 * A new day stays locked if a trusted server time cannot be obtained.
 */
export async function getTrustedNowMs() {
  if (APP_CONFIG.TEST_MODE || !APP_CONFIG.TIME_LOCK_ENABLED) return Date.now();

  // Reuse a recent server-supplied anchor for at most two minutes. The device's
  // wall clock is never consulted, and the monotonic clock prevents rollback.
  if (trustedTimeAnchor && typeof performance !== 'undefined') {
    const elapsed = performance.now() - trustedTimeAnchor.performanceMs;
    if (elapsed >= 0 && elapsed <= TRUSTED_TIME_CACHE_MS) {
      const estimatedServerMs = Math.floor(trustedTimeAnchor.serverMs + elapsed);
      const guard = readJsonStorage(CLOCK_GUARD_KEY);
      const lastServerMs = Number(guard?.serverMs || 0);
      if (!Number.isFinite(lastServerMs) || lastServerMs <= 0 || estimatedServerMs + SERVER_CLOCK_BACKWARD_TOLERANCE_MS >= lastServerMs) {
        const serverMs = Math.max(estimatedServerMs, Number.isFinite(lastServerMs) ? lastServerMs : 0);
        writeJsonStorage(CLOCK_GUARD_KEY, { serverMs });
        trustedTimeAnchor = { serverMs, performanceMs: performance.now() };
        return serverMs;
      }
    }
  }

  let serverMs = null;
  try { serverMs = await fetchServerDateMs('HEAD'); }
  catch { /* try GET below */ }
  if (!Number.isFinite(serverMs)) {
    try { serverMs = await fetchServerDateMs('GET'); }
    catch { serverMs = null; }
  }
  if (!Number.isFinite(serverMs)) return null;

  const guard = readJsonStorage(CLOCK_GUARD_KEY);
  const lastServerMs = Number(guard?.serverMs || 0);
  if (Number.isFinite(lastServerMs) && lastServerMs > 0) {
    // A server/proxy moving backwards materially is suspicious. Small clock
    // corrections are tolerated while keeping the local trusted clock monotonic.
    if (serverMs + SERVER_CLOCK_BACKWARD_TOLERANCE_MS < lastServerMs) return null;
    serverMs = Math.max(serverMs, lastServerMs);
  }

  writeJsonStorage(CLOCK_GUARD_KEY, { serverMs });
  if (typeof performance !== 'undefined') trustedTimeAnchor = { serverMs, performanceMs: performance.now() };
  return serverMs;
}

export function recordTrustedStart(pathId, serverMs) {
  const ms = Number(serverMs);
  if (!pathId || !Number.isFinite(ms) || ms <= 0) return false;
  writeJsonStorage(START_GUARD_KEY, {
    pathId: String(pathId),
    startedAt: new Date(ms).toISOString(),
  });
  return true;
}

function trustedStartedAtMs(state) {
  const stateMs = Date.parse(state?.startedAt || '');
  if (!Number.isFinite(stateMs)) return null;

  const guard = readJsonStorage(START_GUARD_KEY);
  if (!guard || guard.pathId !== state?.pathId) {
    // Legacy migration / first run of this hardened version. Mirror the existing
    // start time into the secondary guard. This detects later single-field edits.
    if (state?.pathId) {
      writeJsonStorage(START_GUARD_KEY, {
        pathId: String(state.pathId),
        startedAt: new Date(stateMs).toISOString(),
      });
    }
    return stateMs;
  }

  const guardMs = Date.parse(guard.startedAt || '');
  if (!Number.isFinite(guardMs)) return null;
  // Both values must represent the same start instant.
  if (Math.abs(guardMs - stateMs) > 1000) return null;
  return guardMs;
}

function calendarDayNumber(ms, timeZone = APP_CONFIG.TIME_ZONE) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(ms));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const year = Number(values.year);
    const month = Number(values.month);
    const day = Number(values.day);
    if (![year, month, day].every(Number.isInteger)) return null;
    return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
  } catch {
    return null;
  }
}

export function isDayUnlockedAt(state, day, trustedNowMs) {
  if (APP_CONFIG.TEST_MODE || !APP_CONFIG.TIME_LOCK_ENABLED) return true;
  const n = Number(day);
  const completed = state.completed || [];
  if (completed.includes(n)) return true;

  // Only the single next required day may be opened.
  const required = nextRequiredDay(state);
  if (n !== required || n > 28 || n < 1) return false;

  const nowMs = Number(trustedNowMs);
  if (!Number.isFinite(nowMs) || nowMs <= 0) return false;
  const today = calendarDayNumber(nowMs);
  if (!Number.isInteger(today)) return false;

  const startMs = trustedStartedAtMs(state);
  if (!Number.isFinite(startMs) || startMs > nowMs) return false;
  const startDay = calendarDayNumber(startMs);
  if (!Number.isInteger(startDay) || today < startDay) return false;

  // Day 1 may be completed on the trusted calendar day the path starts.
  if (n === 1) return true;

  // From day 2 onward, the previous day must have been completed on an
  // earlier trusted calendar day. This enforces at most one NEW day per day,
  // even when the user skipped several days before returning to the app.
  const previousDay = n - 1;
  if (!completed.includes(previousDay)) return false;
  let previousCompletionMs = Date.parse(state.daily?.[previousDay]?.updatedAt || '');

  // Compatibility for old saved journeys that did not have a usable daily
  // timestamp. They may advance once; the newly completed day is stamped with
  // trusted server time, so every following day is strictly one-per-day.
  if (!Number.isFinite(previousCompletionMs)) previousCompletionMs = startMs;
  if (!Number.isFinite(previousCompletionMs) || previousCompletionMs > nowMs) return false;

  const previousCalendarDay = calendarDayNumber(previousCompletionMs);
  if (!Number.isInteger(previousCalendarDay)) return false;
  return today > previousCalendarDay;
}

export async function isDayUnlocked(state, day) {
  if (APP_CONFIG.TEST_MODE || !APP_CONFIG.TIME_LOCK_ENABLED) return true;
  const n = Number(day);
  if ((state.completed || []).includes(n)) return true;
  const nowMs = await getTrustedNowMs();
  if (nowMs == null) return false;
  return isDayUnlockedAt(state, n, nowMs);
}

export function cloneForArchive(state) {
  const profile = state.profileData || {};
  const archiveProfile = {
    // Archive snapshots retain only path-specific display data. Identity and
    // contact/health data belong to the canonical profile, not a path archive.
    problem: typeof profile.problem === 'string' ? profile.problem.slice(0, 200) : '',
    durationYears: Number.isInteger(Number(profile.durationYears)) ? Number(profile.durationYears) : 0,
    durationMonths: Number.isInteger(Number(profile.durationMonths)) ? Number(profile.durationMonths) : 0,
    goal: typeof profile.goal === 'string' ? profile.goal.slice(0, 1000) : '',
  };
  return JSON.parse(JSON.stringify({
    pathId: state.pathId,
    startedAt: state.startedAt,
    archivedAt: new Date().toISOString(),
    profileData: archiveProfile,
    assessmentData: state.assessmentData,
    completed: state.completed,
    answers: state.answers,
    daily: state.daily,
    final: state.final,
  }));
}
