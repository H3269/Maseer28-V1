import { normalizeDigits } from '../../shared/utils.js';

export const JOURNEY_KEY = 'maseer28_state';
export const PROFILE_KEY = 'maseer28_user_profile_v1';
export const COPYRIGHT_KEY = 'maseer28_copyright_v60';

export const APP_CONFIG = {
  TEST_MODE: false,
  TIME_LOCK_ENABLED: true,
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
    pathId: null,
    startedAt: null,
    lastView: 'home',
  };
}

export function validScore(value) {
  const n = Number(normalizeDigits(value));
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
      motivation: finalAnswers ? finalAnswers[4] : raw.final.motivation,
      scaleMax: finalAnswers ? 4 : raw.final.scaleMax,
      version: finalAnswers ? 2 : raw.final.version,
      f1: String(raw.final.f1 || '').slice(0, 2000),
      f2: String(raw.final.f2 || '').slice(0, 2000),
      f3: String(raw.final.f3 || '').slice(0, 2000),
      f4: String(raw.final.f4 || '').slice(0, 2000),
      completedAt: String(raw.final.completedAt || ''),
    };
  } else out.final = null;

  out.archive = Array.isArray(raw.archive) ? raw.archive.filter((x) => x && typeof x === 'object').slice(0, 20) : [];
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

export function loadUserProfile() {
  try {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    return profile && typeof profile === 'object' ? profile : null;
  } catch { return null; }
}

export function saveUserProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
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

export function isDayUnlocked(state, day) {
  if (APP_CONFIG.TEST_MODE || !APP_CONFIG.TIME_LOCK_ENABLED) return true;
  const n = Number(day);
  if ((state.completed || []).includes(n) || n === 1) return true;
  if (!state.startedAt) return n === 1;
  const started = new Date(state.startedAt);
  if (Number.isNaN(started.getTime())) return n === 1;
  const startDay = new Date(started.getFullYear(), started.getMonth(), started.getDate()).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const unlocked = Math.max(1, Math.floor((today - startDay) / 86400000) + 1);
  return n <= Math.min(28, unlocked);
}

export function cloneForArchive(state) {
  return JSON.parse(JSON.stringify({
    pathId: state.pathId,
    startedAt: state.startedAt,
    archivedAt: new Date().toISOString(),
    profileData: state.profileData,
    assessmentData: state.assessmentData,
    completed: state.completed,
    answers: state.answers,
    daily: state.daily,
    final: state.final,
  }));
}
