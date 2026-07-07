import { Eye, Trash2 } from 'lucide-react';
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
  const [openSessionId, setOpenSessionId] = useState('');

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
    <section className="history-panel" id="history">
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
                <div className="history-card__actions">
                  <button
                    type="button"
                    onClick={() => setOpenSessionId((current) => (current === item.id ? '' : item.id))}
                    aria-expanded={openSessionId === item.id}
                    aria-label={openSessionId === item.id ? '收合分析結果' : '查看分析結果'}
                  >
                    <Eye size={15} />
                    <span>{openSessionId === item.id ? '收合' : '查看結果'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSession(item.id)}
                    disabled={deletingSessionId === item.id}
                    aria-label="刪除分析紀錄"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
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
              {openSessionId === item.id ? (
                <div className="history-card__details">
                  <div>
                    <h3>CEFR 分布</h3>
                    <div className="history-detail-list">
                      {(item.cefr_summary || []).map((level) => (
                        <span key={level.level}>
                          <strong>{level.level}</strong>
                          {Number(level.percentage || 0).toFixed(1)}%
                          {' / '}
                          {level.totalCount || 0}
                          {' 次'}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3>Top words</h3>
                    <div className="history-detail-list history-detail-list--words">
                      {(item.word_frequencies || [])
                        .slice()
                        .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
                        .slice(0, 30)
                        .map((word) => (
                          <span key={`detail-${word.id}`}>
                            <strong>{word.word}</strong>
                            {word.cefr_level || 'Unknown'}
                            {' · '}
                            {word.count}
                          </span>
                        ))}
                    </div>
                  </div>
                  <div>
                    <h3>Unknown words</h3>
                    <div className="history-detail-list history-detail-list--words">
                      {(item.word_frequencies || [])
                        .filter((word) => word.cefr_level === 'Unknown')
                        .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
                        .slice(0, 30)
                        .map((word) => (
                          <span key={`unknown-${word.id}`}>
                            <strong>{word.word}</strong>
                            {word.count}
                          </span>
                        ))}
                      {(item.word_frequencies || []).some((word) => word.cefr_level === 'Unknown') ? null : (
                        <span>沒有 Unknown 詞。</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">登入並儲存分析後，這裡會顯示你的歷史紀錄。</p>
      )}
    </section>
  );
}
