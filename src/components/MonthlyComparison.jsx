import { useMemo } from 'react';

function getMonthKey(value) {
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
  }).format(new Date(value));
}

function buildMonthlyRows(history) {
  const months = new Map();

  history.forEach((session) => {
    const key = getMonthKey(session.created_at);
    const current = months.get(key) || {
      key,
      sessions: 0,
      contentWords: 0,
      uniqueWords: 0,
      cefr: new Map(),
      words: new Map(),
    };

    current.sessions += 1;
    current.contentWords += session.content_words || 0;
    current.uniqueWords += session.unique_words || 0;

    (session.cefr_summary || []).forEach((level) => {
      current.cefr.set(level.level, (current.cefr.get(level.level) || 0) + (level.totalCount || 0));
    });

    (session.word_frequencies || []).forEach((word) => {
      current.words.set(word.word, (current.words.get(word.word) || 0) + word.count);
    });

    months.set(key, current);
  });

  return [...months.values()]
    .map((month) => {
      const topWords = [...month.words.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 6);

      return {
        ...month,
        averageUniqueWords: month.sessions ? Math.round(month.uniqueWords / month.sessions) : 0,
        topWords,
      };
    })
    .sort((a, b) => b.key.localeCompare(a.key));
}

export default function MonthlyComparison({ history, isAuthenticated, onRequireAuth }) {
  const rows = useMemo(() => buildMonthlyRows(history), [history]);

  return (
    <section className="monthly-panel" id="monthly-comparison">
      <div className="section-title">
        <div>
          <p className="eyebrow">Monthly</p>
          <h2>每月比較</h2>
        </div>
      </div>
      {!isAuthenticated ? (
        <div className="auth-gate">
          <p>每月比較需要讀取你的歷史分析紀錄。登入後即可比較不同月份的詞彙量、CEFR 分布與常用詞變化。</p>
          <button type="button" onClick={onRequireAuth}>
            登入比較歷史紀錄
          </button>
        </div>
      ) : rows.length ? (
        <div className="monthly-table" role="table" aria-label="每月分析比較">
          <div className="monthly-table__head" role="row">
            <span role="columnheader">月份</span>
            <span role="columnheader">分析</span>
            <span role="columnheader">內容詞</span>
            <span role="columnheader">平均不重複詞</span>
            <span role="columnheader">常用詞</span>
          </div>
          {rows.map((row) => (
            <div className="monthly-table__row" role="row" key={row.key}>
              <strong role="cell">{row.key}</strong>
              <span role="cell">{row.sessions}</span>
              <span role="cell">{row.contentWords}</span>
              <span role="cell">{row.averageUniqueWords}</span>
              <span role="cell">
                {row.topWords.map(([word, count]) => `${word} ${count}`).join(' · ')}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">儲存多次分析後，這裡會顯示每月趨勢。</p>
      )}
    </section>
  );
}
