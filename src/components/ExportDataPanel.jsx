import { Download } from 'lucide-react';
import { useState } from 'react';
import { getAnalysisExportData } from '../lib/analysisPersistence.js';
import { trackEvent } from '../lib/analytics.js';

function getExportDate() {
  return new Date().toISOString().slice(0, 10);
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function buildExport(records, userEmail) {
  const aggregate = new Map();

  records.forEach((session) => {
    (session.word_frequencies || []).forEach((item) => {
      const key = `${item.normalized_word || item.word}|${item.cefr_level || 'Unknown'}`;
      const current = aggregate.get(key) || {
        word: item.word,
        normalizedWord: item.normalized_word || item.word,
        cefrLevel: item.cefr_level || 'Unknown',
        totalCount: 0,
        sessions: 0,
        lastSeenAt: session.created_at,
      };

      current.totalCount += item.count || 0;
      current.sessions += 1;
      current.lastSeenAt = session.created_at;
      aggregate.set(key, current);
    });
  });

  const wordFrequency = [...aggregate.values()]
    .sort((a, b) => b.totalCount - a.totalCount || a.normalizedWord.localeCompare(b.normalizedWord));

  const sessions = records.map((session) => ({
    date: session.created_at,
    totalWords: session.total_words,
    uniqueWords: session.unique_words,
    topWords: session.top_words || [],
    cefrSummary: session.cefr_summary || [],
    unknownWords: (session.word_frequencies || [])
      .filter((item) => item.cefr_level === 'Unknown')
      .map((item) => ({
        word: item.word,
        normalizedWord: item.normalized_word,
        count: item.count,
      })),
  }));

  return {
    exportedAt: new Date().toISOString(),
    user: userEmail,
    privacy: 'No pasted source text is stored or exported. This file contains analysis statistics only.',
    sessions,
    wordFrequency,
    unknownWords: wordFrequency.filter((item) => item.cefrLevel === 'Unknown'),
  };
}

function buildCsvRows(exportData) {
  const rows = [
    ['word', 'normalized_word', 'total_count', 'cefr_level', 'sessions', 'last_seen_at'],
    ...exportData.wordFrequency.map((item) => [
      item.word,
      item.normalizedWord,
      item.totalCount,
      item.cefrLevel,
      item.sessions,
      item.lastSeenAt,
    ]),
  ];

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

export default function ExportDataPanel({ session }) {
  const [status, setStatus] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const userEmail = session?.user?.email;

  const exportData = async (format) => {
    if (!session?.user?.id) return;

    if (format === 'csv') {
      trackEvent('export_csv_click');
    }

    setIsExporting(true);
    setStatus('');

    try {
      const records = await getAnalysisExportData();
      const payload = buildExport(records, userEmail);
      const date = getExportDate();

      if (format === 'csv') {
        downloadFile(`french-word-frequency-${date}.csv`, buildCsvRows(payload), 'text/csv;charset=utf-8');
      } else {
        downloadFile(
          `french-analysis-export-${date}.json`,
          JSON.stringify(payload, null, 2),
          'application/json;charset=utf-8',
        );
      }

      setStatus(`已匯出 ${records.length} 筆分析紀錄。`);
    } catch (error) {
      setStatus(error.message || '匯出失敗。');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="export-panel" aria-labelledby="export-title">
      <div>
        <p className="eyebrow">Export</p>
        <h2 id="export-title">匯出個人資料</h2>
      </div>
      <p>匯出日期、統計、top words、詞頻、CEFR 與 unknown words；不包含貼上的原文。</p>
      <div className="export-panel__actions">
        <button type="button" onClick={() => exportData('json')} disabled={!userEmail || isExporting}>
          <Download size={16} />
          JSON
        </button>
        <button type="button" onClick={() => exportData('csv')} disabled={!userEmail || isExporting}>
          <Download size={16} />
          CSV
        </button>
      </div>
      {userEmail ? null : <small>登入後可以匯出自己的詞頻資料。</small>}
      {status ? <small>{status}</small> : null}
    </section>
  );
}
