import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { saveAnalysisSession } from '../lib/analysisPersistence.js';

export default function SaveAnalysisButton({ disabled, session, snapshot, onRequireAuth, onSaved }) {
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [shouldSaveAfterAuth, setShouldSaveAfterAuth] = useState(false);

  const persistAnalysis = async (userId) => {
    if (!userId || !snapshot) return;

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

  const saveAnalysis = async () => {
    if (!snapshot) return;

    if (!session?.user?.id) {
      setShouldSaveAfterAuth(true);
      setStatus('登入後會自動儲存這次分析。');
      onRequireAuth?.();
      return;
    }

    await persistAnalysis(session.user.id);
  };

  useEffect(() => {
    if (!shouldSaveAfterAuth || !session?.user?.id) return;
    setShouldSaveAfterAuth(false);
    persistAnalysis(session.user.id);
  }, [session?.user?.id, shouldSaveAfterAuth]);

  return (
    <div className="save-analysis">
      <button type="button" onClick={saveAnalysis} disabled={disabled || isSaving}>
        <Save size={16} />
        {isSaving ? 'Saving' : 'Save My Progress'}
      </button>
      <p>原文只在瀏覽器中分析；雲端只保存詞語、詞頻、CEFR 與統計。</p>
      {status ? <small>{status}</small> : null}
    </div>
  );
}
