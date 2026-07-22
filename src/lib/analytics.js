export const ANALYTICS_EVENTS = Object.freeze({
  ANALYSIS_STARTED: 'analysis_started',
  ANALYSIS_COMPLETED: 'analysis_completed',
  ANALYSIS_FAILED: 'analysis_failed',
  LOGIN_CLICKED: 'login_clicked',
  SIGNUP_CLICKED: 'signup_clicked',
  HISTORY_VIEWED: 'history_viewed',
  SAVE_ANALYSIS_CLICKED: 'save_analysis_clicked',
  SAVE_ANALYSIS_FAILED: 'save_analysis_failed',
  TOP100_LOGGED_OUT_VIEW: 'top100_logged_out_view',
  TOP100_PREVIEW_VIEW: 'top100_preview_view',
  TOP100_LOGIN_CLICK: 'top100_login_click',
  TOP100_SIGNUP_CLICK: 'top100_signup_click',
  TOP100_AUTH_SUCCESS: 'top100_auth_success',
  TOP100_DATA_LOADED: 'top100_data_loaded',
  TOP100_EMPTY_STATE: 'top100_empty_state',
  TOP100_LOAD_ERROR: 'top100_load_error',
  TOP_VOCABULARY_COPY: 'top_vocabulary_copy',
  GLOBAL_TOP_VOCABULARY_COPY: 'global_top_vocabulary_copy',
  TOP_100_BANNER_CLICK: 'top_100_banner_click',
  EXPORT_CSV_CLICK: 'export_csv_click',
});

const allowedEventProperties = Object.freeze({
  [ANALYTICS_EVENTS.ANALYSIS_COMPLETED]: new Set([
    'word_range',
    'sentence_range',
    'unique_word_range',
    'user_status',
    'dominant_cefr',
  ]),
  [ANALYTICS_EVENTS.ANALYSIS_FAILED]: new Set(['error_type', 'user_status']),
  [ANALYTICS_EVENTS.LOGIN_CLICKED]: new Set(['source_section', 'auth_state']),
  [ANALYTICS_EVENTS.SIGNUP_CLICKED]: new Set(['source_section', 'auth_state']),
  [ANALYTICS_EVENTS.HISTORY_VIEWED]: new Set(['user_status', 'record_range']),
  [ANALYTICS_EVENTS.SAVE_ANALYSIS_CLICKED]: new Set(['user_status']),
  [ANALYTICS_EVENTS.SAVE_ANALYSIS_FAILED]: new Set(['error_type', 'user_status']),
  [ANALYTICS_EVENTS.TOP100_LOGGED_OUT_VIEW]: new Set(['page_path', 'auth_state']),
  [ANALYTICS_EVENTS.TOP100_PREVIEW_VIEW]: new Set(['page_path', 'auth_state']),
  [ANALYTICS_EVENTS.TOP100_LOGIN_CLICK]: new Set(['page_path', 'source_section', 'auth_state']),
  [ANALYTICS_EVENTS.TOP100_SIGNUP_CLICK]: new Set(['page_path', 'source_section', 'auth_state']),
  [ANALYTICS_EVENTS.TOP100_AUTH_SUCCESS]: new Set(['page_path', 'auth_state']),
  [ANALYTICS_EVENTS.TOP100_DATA_LOADED]: new Set(['page_path', 'auth_state', 'word_count']),
  [ANALYTICS_EVENTS.TOP100_EMPTY_STATE]: new Set(['page_path', 'auth_state', 'word_count']),
  [ANALYTICS_EVENTS.TOP100_LOAD_ERROR]: new Set(['page_path', 'auth_state', 'error_type']),
  [ANALYTICS_EVENTS.TOP_VOCABULARY_COPY]: new Set(['count']),
  [ANALYTICS_EVENTS.GLOBAL_TOP_VOCABULARY_COPY]: new Set(['count']),
  [ANALYTICS_EVENTS.TOP_100_BANNER_CLICK]: new Set(['page_path']),
  [ANALYTICS_EVENTS.EXPORT_CSV_CLICK]: new Set(['user_status']),
});

const sensitiveKeyPattern = /email|mail|user.?id|uuid|token|secret|password|ip|address|content|text|article|raw|session/i;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const jwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const cefrLevels = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Unknown']);
const userStatuses = new Set(['anonymous', 'logged_in']);
const authStates = new Set(['logged_out', 'authenticated']);

function isDevelopmentAnalyticsConsoleEnabled() {
  if (!import.meta.env.DEV) return false;
  return import.meta.env.VITE_ANALYTICS_DEBUG !== 'false';
}

function isSensitiveValue(value) {
  if (typeof value !== 'string') return false;
  return emailPattern.test(value) || uuidPattern.test(value) || jwtPattern.test(value);
}

function normalizeEventValue(key, value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  if (isSensitiveValue(value)) return undefined;

  if (key === 'user_status' && !userStatuses.has(value)) return undefined;
  if (key === 'auth_state' && !authStates.has(value)) return undefined;
  if (key === 'dominant_cefr' && !cefrLevels.has(value)) return undefined;
  if (key === 'error_type') return value.replace(/[^a-z0-9_:-]/gi, '').slice(0, 60) || 'unknown_error';
  if (key === 'page_path') return value.slice(0, 120);
  if (key === 'source_section') return value.replace(/[^a-z0-9_:-]/gi, '').slice(0, 60);

  return value.slice(0, 120);
}

export function sanitizeEventData(eventName, eventData = {}) {
  const allowedKeys = allowedEventProperties[eventName];
  if (!allowedKeys || !eventData || typeof eventData !== 'object') return {};

  return Object.entries(eventData).reduce((safeData, [key, value]) => {
    if (!allowedKeys.has(key) || sensitiveKeyPattern.test(key)) return safeData;

    const normalizedValue = normalizeEventValue(key, value);
    if (normalizedValue !== undefined) safeData[key] = normalizedValue;
    return safeData;
  }, {});
}

export function trackEvent(eventName, eventData) {
  if (typeof window === 'undefined') return;
  if (!Object.values(ANALYTICS_EVENTS).includes(eventName)) return;

  const safeData = sanitizeEventData(eventName, eventData);

  if (isDevelopmentAnalyticsConsoleEnabled()) {
    console.debug('[analytics]', eventName, safeData);
    return;
  }

  if (import.meta.env.DEV) return;
  window.umami?.track?.(eventName, safeData);
}

function getRange(value, ranges, fallback) {
  const numericValue = Number(value || 0);
  const match = ranges.find((range) => numericValue >= range.min && numericValue <= range.max);
  return match?.label || fallback;
}

export function getAnalysisCompletedEventData(snapshot, userStatus) {
  const dominantCefr = (snapshot?.cefrSummary || [])
    .filter((item) => cefrLevels.has(item.level))
    .slice()
    .sort((a, b) => Number(b.totalCount || 0) - Number(a.totalCount || 0))[0]?.level || 'Unknown';

  return {
    word_range: getRange(snapshot?.totalWords, [
      { min: 1, max: 100, label: '1-100' },
      { min: 101, max: 300, label: '101-300' },
      { min: 301, max: 500, label: '301-500' },
      { min: 501, max: 1000, label: '501-1000' },
    ], '1000+'),
    sentence_range: getRange(snapshot?.sentenceCount, [
      { min: 1, max: 10, label: '1-10' },
      { min: 11, max: 30, label: '11-30' },
      { min: 31, max: 60, label: '31-60' },
    ], '61+'),
    unique_word_range: getRange(snapshot?.uniqueWords, [
      { min: 1, max: 50, label: '1-50' },
      { min: 51, max: 150, label: '51-150' },
      { min: 151, max: 300, label: '151-300' },
    ], '301+'),
    user_status: userStatus,
    dominant_cefr: dominantCefr,
  };
}

export function getRecordRange(count) {
  return getRange(count, [
    { min: 0, max: 0, label: '0' },
    { min: 1, max: 5, label: '1-5' },
    { min: 6, max: 20, label: '6-20' },
    { min: 21, max: 50, label: '21-50' },
  ], '51+');
}

export function getSafeErrorType(error, fallback = 'unknown_error') {
  const message = String(error?.code || error?.name || error?.message || fallback).toLowerCase();
  if (message.includes('auth') || message.includes('login')) return 'auth_required';
  if (message.includes('network') || message.includes('fetch')) return 'network_error';
  if (message.includes('quota') || message.includes('limit')) return 'quota_error';
  if (message.includes('supabase') || message.includes('rpc') || message.includes('database')) return 'storage_error';
  if (message.includes('missing') || message.includes('empty')) return 'missing_data';
  return fallback;
}
