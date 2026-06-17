import { Save } from 'lucide-react';
import { useState } from 'react';
import { saveAnalysisSession } from '../lib/analysisPersistence.js';

export default function SaveAnalysisButton({ disabled, session, snapshot, onSaved }) {
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const saveAnalysis = async () => {
    if (!session?.user?.id || !snapshot) return;

    setIsSaving(true);
    setStatus('');

    try {
      await saveAnalysisSession(session.user.id, snapshot);
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
      <button type="button" onClick={saveAnalysis} disabled={disabled || isSaving}>
        <Save size={16} />
        {isSaving ? '儲存中' : '儲存分析結果'}
      </button>
      <p>原文只在瀏覽器中分析；雲端只保存詞語、詞頻、CEFR 與統計。</p>
      {status ? <small>{status}</small> : null}
    </div>
  );
}
