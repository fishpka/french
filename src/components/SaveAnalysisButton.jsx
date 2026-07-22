import { Save, Search } from 'lucide-react';
import { useState } from 'react';
import { saveAnalysisSession } from '../lib/analysisPersistence.js';
import {
  ANALYTICS_EVENTS,
  getSafeErrorType,
  trackEvent,
} from '../lib/analytics.js';

export default function SaveAnalysisButton({ disabled, session, snapshot, onAnalyze, onSaved }) {
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const userId = session?.user?.id;

  const analyzeNow = () => {
    const didAnalyze = onAnalyze?.();
    setStatus(didAnalyze === false ? '分析失敗，請稍後再試。' : '已更新分析結果。');
    window.setTimeout(() => setStatus(''), 1800);
  };

  const saveAnalysis = async () => {
    if (!snapshot || !userId) return;

    trackEvent(ANALYTICS_EVENTS.SAVE_ANALYSIS_CLICKED, {
      user_status: 'logged_in',
    });
    setIsSaving(true);
    setStatus('');

    try {
      await saveAnalysisSession(userId, snapshot);
      setStatus('已儲存分析結果。');
      onSaved?.();
    } catch (error) {
      trackEvent(ANALYTICS_EVENTS.SAVE_ANALYSIS_FAILED, {
        error_type: getSafeErrorType(error),
        user_status: 'logged_in',
      });
      setStatus(error.message || '儲存失敗。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="save-analysis">
      <div className="save-analysis__actions">
        <button type="button" onClick={analyzeNow} disabled={disabled}>
          <Search size={16} />
          立即分析
        </button>
        {userId ? (
          <button type="button" onClick={saveAnalysis} disabled={disabled || isSaving}>
            <Save size={16} />
            {isSaving ? '儲存中' : '儲存分析結果'}
          </button>
        ) : null}
      </div>
      {status ? <small>{status}</small> : null}
    </div>
  );
}
