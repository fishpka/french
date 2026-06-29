import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { deleteAnalysisSession } from '../lib/analysisPersistence.js';
import { trackEvent } from '../lib/analytics.js';

let hasTrackedHistoryView = false;

function formatDate(value) {
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function HistoryDashboard({
  history,
  isAuthenticated,
  isLoading,
  onChanged,
  onRequireAuth,
}) {
  const [deleteStatus, setDeleteStatus] = useState('');
  const [deletingSessionId, setDeletingSessionId] = useState('');

  useEffect(() => {
    if (hasTrackedHistoryView) return;
    hasTrackedHistoryView = true;
    trackEvent('history_view');
  }, []);

  const removeSession = async (sessionId) => {
    setDeletingSessionId(sessionId);
    setDeleteStatus('');

    try {
      await deleteAnalysisSession(sessionId);
      setDeleteStatus('已刪除分析紀錄。');
      onChanged?.();
    } catch (error) {
      setDeleteStatus(error.message || '刪除失敗。');
    } finally {
      setDeletingSessionId('');
    }
  };

  return (
    <section className="history-panel" id="history" data-reveal>
      <div className="section-title">
        <div>
          <p className="eyebrow">History</p>
          <h2>分析紀錄</h2>
        </div>
      </div>
      {!isAuthenticated ? (
        <div className="auth-gate">
          <p>分析功能不需要登入。若要查看已儲存的歷史紀錄、刪除紀錄或進行長期比較，請先登入。</p>
          <button type="button" onClick={onRequireAuth}>
            登入查看歷史紀錄
          </button>
        </div>
      ) : isLoading ? (
        <p className="empty-state">載入分析紀錄中...</p>
      ) : history.length ? (
        <div className="history-list">
          {deleteStatus ? <p className="empty-state">{deleteStatus}</p> : null}
          {history.map((item) => (
            <article className="history-card" key={item.id}>
              <div className="history-card__heading">
                <div>
                  <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
                  <strong>{item.unique_words} 個不重複詞</strong>
                </div>
                <button
                  type="button"
                  onClick={() => removeSession(item.id)}
                  disabled={deletingSessionId === item.id}
                  aria-label="刪除分析紀錄"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <dl className="history-stats">
                <div>
                  <dt>總詞數</dt>
                  <dd>{item.total_words}</dd>
                </div>
                <div>
                  <dt>內容詞</dt>
                  <dd>{item.content_words}</dd>
                </div>
                <div>
                  <dt>句數</dt>
                  <dd>{item.sentence_count}</dd>
                </div>
                <div>
                  <dt>Unknown</dt>
                  <dd>{(item.word_frequencies || []).filter((word) => word.cefr_level === 'Unknown').length}</dd>
                </div>
              </dl>
              <div className="history-cefr">
                {(item.cefr_summary || []).map((level) => (
                  <span key={level.level}>{level.level} {Number(level.percentage || 0).toFixed(0)}%</span>
                ))}
              </div>
              <div className="history-words">
                {(item.word_frequencies || [])
                  .slice()
                  .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
                  .slice(0, 10)
                  .map((word) => (
                    <span key={word.id}>{word.word} <small>{word.count}</small></span>
                  ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">登入並儲存分析後，這裡會顯示你的歷史紀錄。</p>
      )}
    </section>
  );
}
