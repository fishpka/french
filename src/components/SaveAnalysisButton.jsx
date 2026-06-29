import { Save, Search } from 'lucide-react';
import { useState } from 'react';
import { saveAnalysisSession } from '../lib/analysisPersistence.js';
import { trackEvent } from '../lib/analytics.js';

export default function SaveAnalysisButton({ disabled, session, snapshot, onSaved }) {
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const userId = session?.user?.id;

  const analyzeNow = () => {
    if (!snapshot) return;

    trackEvent('analyze_click');
    setStatus('已更新分析結果。');
    document.getElementById('charts')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => setStatus(''), 1800);
  };

  const saveAnalysis = async () => {
    if (!snapshot || !userId) return;

    trackEvent('save_analysis_click');
    setIsSaving(true);
    setStatus('');

    try {
      await saveAnalysisSession(userId, snapshot);
      setStatus('已儲存分析結果。');
      onSaved?.();
    } catch (error) {
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
