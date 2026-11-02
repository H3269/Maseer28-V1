/**
 * Minimal, consent-gated context contract for the experimental assistant.
 * This module deliberately excludes free text, identity fields, clinical labels,
 * risk history, raw answers, and archived journey records.
 */
export const ASSISTANT_CONTEXT_VERSION = '1.0.0';
export const ASSISTANT_CONTEXT_TTL_MS = 24 * 60 * 60 * 1000;

const GOALS = Object.freeze(['understand', 'practical_steps', 'reflection', 'professional_support']);
const DETAILS = Object.freeze(['concise', 'balanced', 'detailed']);
const STYLES = Object.freeze(['direct', 'supportive', 'neutral']);
const EXAMPLES = Object.freeze(['practical', 'conceptual', 'mixed']);

function consentGranted(consentState, purpose) {
  return consentState?.purposes?.[purpose]?.granted === true;
}

function iso(value, label) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid ${label} timestamp.`);
  return date.toISOString();
}

function entry(key, value, source, observedAt, expiresAt, consentPurpose) {
  return Object.freeze({ key, value, source, observed_at: observedAt, expires_at: expiresAt, consent_purpose: consentPurpose });
}

export function buildAssistantContext({
  journey = {},
  preferences = {},
  consentState = {},
  now = new Date().toISOString(),
} = {}) {
  const observedAt = iso(now, 'now');
  const expiresAt = new Date(new Date(observedAt).getTime() + ASSISTANT_CONTEXT_TTL_MS).toISOString();
  const entries = [];

  if (consentGranted(consentState, 'journey_context')) {
    if (Number.isInteger(journey.active_day) && journey.active_day >= 1 && journey.active_day <= 28) {
      entries.push(entry('active_day', journey.active_day, 'app_journey_state', observedAt, expiresAt, 'journey_context'));
    }
    if (Number.isInteger(journey.completed_days_count) && journey.completed_days_count >= 0 && journey.completed_days_count <= 28) {
      entries.push(entry('completed_days_count', journey.completed_days_count, 'app_journey_state', observedAt, expiresAt, 'journey_context'));
    }
    if (GOALS.includes(journey.current_goal)) {
      entries.push(entry('current_goal', journey.current_goal, 'user_selected_app_goal', observedAt, expiresAt, 'journey_context'));
    }
  }

  if (consentGranted(consentState, 'long_term_ai_memory')) {
    if (DETAILS.includes(preferences.response_detail)) {
      entries.push(entry('response_detail', preferences.response_detail, 'saved_interaction_preference', observedAt, expiresAt, 'long_term_ai_memory'));
    }
    if (STYLES.includes(preferences.communication_style)) {
      entries.push(entry('communication_style', preferences.communication_style, 'saved_interaction_preference', observedAt, expiresAt, 'long_term_ai_memory'));
    }
    if (EXAMPLES.includes(preferences.example_style)) {
      entries.push(entry('example_style', preferences.example_style, 'saved_interaction_preference', observedAt, expiresAt, 'long_term_ai_memory'));
    }
  }

  return Object.freeze({
    schema_version: ASSISTANT_CONTEXT_VERSION,
    created_at: observedAt,
    expires_at: expiresAt,
    processing: 'local_ephemeral_only',
    entries: Object.freeze(entries),
  });
}

export function validateAssistantContext(context, { now = new Date().toISOString() } = {}) {
  const errors = [];
  const allowedRoot = ['schema_version', 'created_at', 'expires_at', 'processing', 'entries'];
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return { valid: false, errors: ['context must be an object'] };
  }
  for (const key of Object.keys(context)) if (!allowedRoot.includes(key)) errors.push(`unknown context field: ${key}`);
  if (context.schema_version !== ASSISTANT_CONTEXT_VERSION) errors.push('unsupported context schema version');
  if (context.processing !== 'local_ephemeral_only') errors.push('context processing must remain local and ephemeral');
  const createdAt = Date.parse(context.created_at);
  const expiresAt = Date.parse(context.expires_at);
  const current = Date.parse(now);
  if (![createdAt, expiresAt, current].every(Number.isFinite)) errors.push('context timestamps must be valid');
  else {
    if (expiresAt <= createdAt) errors.push('context expiry must be after creation');
    if (expiresAt - createdAt > ASSISTANT_CONTEXT_TTL_MS) errors.push('context retention exceeds the 24-hour maximum');
    if (current >= expiresAt) errors.push('context has expired');
  }
  if (!Array.isArray(context.entries)) errors.push('context entries must be an array');
  else {
    const seen = new Set();
    const allowed = {
      active_day: { values: null, source: 'app_journey_state', purpose: 'journey_context' },
      completed_days_count: { values: null, source: 'app_journey_state', purpose: 'journey_context' },
      current_goal: { values: GOALS, source: 'user_selected_app_goal', purpose: 'journey_context' },
      response_detail: { values: DETAILS, source: 'saved_interaction_preference', purpose: 'long_term_ai_memory' },
      communication_style: { values: STYLES, source: 'saved_interaction_preference', purpose: 'long_term_ai_memory' },
      example_style: { values: EXAMPLES, source: 'saved_interaction_preference', purpose: 'long_term_ai_memory' },
    };
    for (const item of context.entries) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) { errors.push('entry must be an object'); continue; }
      const keys = ['key', 'value', 'source', 'observed_at', 'expires_at', 'consent_purpose'];
      for (const key of Object.keys(item)) if (!keys.includes(key)) errors.push(`unknown entry field: ${key}`);
      const spec = allowed[item.key];
      if (!spec) { errors.push(`context key is not allowlisted: ${item.key}`); continue; }
      if (seen.has(item.key)) errors.push(`duplicate context key: ${item.key}`);
      seen.add(item.key);
      if (item.source !== spec.source || item.consent_purpose !== spec.purpose) errors.push(`invalid provenance or consent purpose for ${item.key}`);
      if (spec.values && !spec.values.includes(item.value)) errors.push(`invalid value for ${item.key}`);
      if (item.key === 'active_day' && (!Number.isInteger(item.value) || item.value < 1 || item.value > 28)) errors.push('active_day must be an integer from 1 to 28');
      if (item.key === 'completed_days_count' && (!Number.isInteger(item.value) || item.value < 0 || item.value > 28)) errors.push('completed_days_count must be an integer from 0 to 28');
      if (Date.parse(item.observed_at) !== createdAt || Date.parse(item.expires_at) !== expiresAt) errors.push(`entry timestamps must match context envelope for ${item.key}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
