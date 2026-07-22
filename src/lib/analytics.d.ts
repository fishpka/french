export type AnalyticsEventName =
  | 'analysis_started'
  | 'analysis_completed'
  | 'analysis_failed'
  | 'login_clicked'
  | 'signup_clicked'
  | 'history_viewed'
  | 'save_analysis_clicked'
  | 'save_analysis_failed'
  | 'top100_logged_out_view'
  | 'top100_preview_view'
  | 'top100_login_click'
  | 'top100_signup_click'
  | 'top100_auth_success'
  | 'top100_data_loaded'
  | 'top100_empty_state'
  | 'top100_load_error'
  | 'top_vocabulary_copy'
  | 'global_top_vocabulary_copy'
  | 'top_100_banner_click'
  | 'export_csv_click';

export type UserStatus = 'anonymous' | 'logged_in';
export type AuthState = 'logged_out' | 'authenticated';
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'Unknown';
export type WordRange = '1-100' | '101-300' | '301-500' | '501-1000' | '1000+';
export type SentenceRange = '1-10' | '11-30' | '31-60' | '61+';
export type UniqueWordRange = '1-50' | '51-150' | '151-300' | '301+';
export type SafeErrorType =
  | 'auth_required'
  | 'network_error'
  | 'quota_error'
  | 'storage_error'
  | 'missing_data'
  | 'unknown_error';

export interface AnalysisCompletedEventData {
  word_range: WordRange;
  sentence_range: SentenceRange;
  unique_word_range: UniqueWordRange;
  user_status: UserStatus;
  dominant_cefr: CefrLevel;
}

export interface AnalyticsEventDataMap {
  analysis_started: Record<string, never>;
  analysis_completed: AnalysisCompletedEventData;
  analysis_failed: { error_type: SafeErrorType | string; user_status?: UserStatus };
  login_clicked: { source_section?: string; auth_state?: AuthState };
  signup_clicked: { source_section?: string; auth_state?: AuthState };
  history_viewed: { user_status: 'logged_in'; record_range?: string };
  save_analysis_clicked: { user_status: 'logged_in' };
  save_analysis_failed: { error_type: SafeErrorType | string; user_status: 'logged_in' };
  top100_logged_out_view: { page_path: string; auth_state: 'logged_out' };
  top100_preview_view: { page_path: string; auth_state: 'logged_out' };
  top100_login_click: { page_path: string; source_section: string; auth_state: AuthState };
  top100_signup_click: { page_path: string; source_section: string; auth_state: AuthState };
  top100_auth_success: { page_path: string; auth_state: 'authenticated' };
  top100_data_loaded: { page_path: string; auth_state: 'authenticated'; word_count: number };
  top100_empty_state: { page_path: string; auth_state: 'authenticated'; word_count: number };
  top100_load_error: { page_path: string; auth_state: 'authenticated'; error_type?: SafeErrorType | string };
  top_vocabulary_copy: { count: number };
  global_top_vocabulary_copy: { count: number };
  top_100_banner_click: { page_path?: string };
  export_csv_click: { user_status?: UserStatus };
}

export const ANALYTICS_EVENTS: Readonly<Record<string, AnalyticsEventName>>;

export function sanitizeEventData<T extends AnalyticsEventName>(
  eventName: T,
  eventData?: Partial<AnalyticsEventDataMap[T]>
): Partial<AnalyticsEventDataMap[T]>;

export function trackEvent<T extends AnalyticsEventName>(
  eventName: T,
  eventData?: Partial<AnalyticsEventDataMap[T]>
): void;

export function getAnalysisCompletedEventData(
  snapshot: unknown,
  userStatus: UserStatus
): AnalysisCompletedEventData;

export function getRecordRange(count: number): string;

export function getSafeErrorType(error: unknown, fallback?: SafeErrorType): SafeErrorType | string;
