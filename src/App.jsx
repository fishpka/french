import { useEffect, useMemo, useState } from 'react';
import { Copy, RefreshCcw } from 'lucide-react';
import AuthPanel from './components/AuthPanel.jsx';
import ExportDataPanel from './components/ExportDataPanel.jsx';
import HistoryDashboard from './components/HistoryDashboard.jsx';
import MonthlyComparison from './components/MonthlyComparison.jsx';
import Navbar from './components/Navbar.jsx';
import SaveAnalysisButton from './components/SaveAnalysisButton.jsx';
import cefrVocabulary from './data/cefrVocabulary.js';
import frenchLemmaMap from './data/frenchLemmaMap.js';
import { getAnalysisHistory } from './lib/analysisPersistence.js';
import { isSupabaseConfigured, supabase } from './lib/supabaseClient.js';

const links = [
  { label: '分析器', href: '#analyzer' },
  { label: '圖表', href: '#charts' },
  { label: 'CEFR', href: '#cefr' },
  { label: '句型', href: '#patterns' },
  { label: '歷史', href: '#history' },
  { label: '月比較', href: '#monthly-comparison' },
  { label: '摘要', href: '#summary' },
];

const sampleText = `Aujourd'hui, les réseaux sociaux occupent une place importante dans notre vie quotidienne. Je pense que cette évolution peut être positive, car elle permet aux personnes de communiquer plus rapidement et de partager des informations.

Cependant, il faut aussi faire attention aux risques. Par exemple, certaines personnes passent trop de temps sur Internet, ce qui peut entraîner des problèmes de santé, de concentration et de relations sociales. À mon avis, il est important de trouver un équilibre.

D'abord, les réseaux sociaux peuvent aider les jeunes à s'informer et à découvrir de nouvelles idées. Ensuite, ils permettent de garder le contact avec la famille et les amis. De plus, ils peuvent être utiles pour le travail ou les études.

En revanche, les fausses informations circulent très vite. Il faut donc développer un esprit critique. En conclusion, les réseaux sociaux ne sont ni totalement bons ni totalement mauvais : tout dépend de la manière dont on les utilise.`;

const stopwords = new Set([
  'a', 'à', 'afin', 'ai', 'ainsi', 'alors', 'au', 'aucun', 'aussi', 'autre', 'aux', 'avec',
  'avoir', 'bien', 'car', 'ce', 'cela', 'ces', 'cet', 'cette', 'ceux', 'chaque',
  'chez', 'comme', 'comment', 'dans', 'de', 'des', 'du', 'elle', 'elles', 'en',
  'encore', 'entre', 'est', 'et', 'être', 'fait', 'faire', 'faut', 'fois', 'il',
  'ils', 'je', 'jusqu', 'la', 'le', 'les', 'leur', 'leurs', 'lui', 'mais', 'me',
  'même', 'mes', 'moins', 'mon', 'ne', 'nos', 'notre', 'nous', 'on', 'ont', 'ou',
  'où', 'par', 'parce', 'pas', 'peut', 'plus', 'pour', 'quand', 'que', 'quel',
  'quelle', 'quelles', 'quels', 'qui', 'quoi', 'sa', 'sans', 'se', 'ses', 'si',
  'son', 'sont', 'sur', 'ta', 'tes', 'ton', 'tous', 'tout', 'toute', 'toutes',
  'très', 'tu', 'un', 'une', 'vos', 'votre', 'vous', 'y', 'c', 'd', 'j', 'l',
  'm', 'n', 'qu', 's', 't',
]);

const patternRules = [
  { label: '表達意見', regex: /\b(je pense que|à mon avis|selon moi|personnellement)\b/gi },
  { label: '必要性', regex: /\b(il faut|il est important de|il est nécessaire de|on doit)\b/gi },
  { label: '舉例', regex: /\b(par exemple|notamment|comme)\b/gi },
  { label: '轉折', regex: /\b(cependant|pourtant|en revanche|mais|toutefois)\b/gi },
  { label: '順序', regex: /\b(d'abord|ensuite|puis|enfin|premièrement|deuxièmement)\b/gi },
  { label: '結果', regex: /\b(donc|ainsi|c'est pourquoi|par conséquent|cela permet de)\b/gi },
  { label: '結論', regex: /\b(en conclusion|pour conclure|en résumé|finalement)\b/gi },
  { label: '平衡論述', regex: /\b(d'un côté|de l'autre côté|non seulement|mais aussi|tout dépend)\b/gi },
];

const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Unknown'];
const autoDictionaryDefaultLevel = 'B2';
const autoDictionaryLimit = 20;

function normalizeWord(word) {
  return word.toLowerCase().replace(/[’]/g, "'").replace(/^['-]+|['-]+$/g, '');
}

function getLemmaFromMapping(word) {
  return frenchLemmaMap[word] || null;
}

function isKnownLemma(word) {
  return Boolean(getLemmaFromMapping(word) || cefrVocabulary[word]);
}

function normalizeFrenchWord(word) {
  let normalized = normalizeWord(word)
    .replace(/^[^a-zàâäçéèêëîïôöùûüÿñæœ]+|[^a-zàâäçéèêëîïôöùûüÿñæœ]+$/gi, '')
    .replace(/^(?:l|d|j|m|t|s|n|c|qu)'/i, '');

  const mappedLemma = getLemmaFromMapping(normalized);
  if (mappedLemma) return mappedLemma;

  if (cefrVocabulary[normalized]) return normalized;

  const candidates = [];

  if (
    normalized.length > 4
    && normalized.endsWith('es')
    && !normalized.endsWith('ées')
  ) {
    candidates.push(normalized.slice(0, -2));
  }

  if (
    normalized.length > 4
    && normalized.endsWith('s')
    && !normalized.endsWith('ss')
    && !normalized.endsWith('us')
  ) {
    candidates.push(normalized.slice(0, -1));
  }

  if (normalized.length > 4 && normalized.endsWith('x')) {
    candidates.push(normalized.slice(0, -1));
  }

  if (normalized.length > 5 && normalized.endsWith('e')) {
    candidates.push(normalized.slice(0, -1));
  }

  const knownCandidate = candidates.find(isKnownLemma);
  if (knownCandidate) return getLemmaFromMapping(knownCandidate) || knownCandidate;

  return normalized;
}

function tokenize(text) {
  const matches = text.match(/[a-zàâäçéèêëîïôöùûüÿñæœ]+(?:[’'-][a-zàâäçéèêëîïôöùûüÿñæœ]+)*/gi);
  return matches ? matches.map(normalizeWord).filter((word) => word.length > 1) : [];
}

function getRawWordRecords(text) {
  const wordPattern = /[a-zàâäçéèêëîïôöùûüÿñæœ]+(?:[’'-][a-zàâäçéèêëîïôöùûüÿñæœ]+)*/gi;
  return [...text.matchAll(wordPattern)].map((match) => ({
    word: match[0],
    normalizedWord: normalizeWord(match[0]),
    index: match.index ?? 0,
  }));
}

function countItems(items) {
  const map = new Map();
  items.forEach((item) => map.set(item, (map.get(item) || 0) + 1));
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function getWordCountSignature(wordCounts) {
  return wordCounts.map(({ word, count }) => `${word}:${count}`).join('|');
}

function getNgrams(words) {
  const phrases = [];
  for (let size = 2; size <= 5; size += 1) {
    for (let index = 0; index <= words.length - size; index += 1) {
      const slice = words.slice(index, index + size);
      const contentCount = slice.filter((word) => !stopwords.has(word)).length;
      if (contentCount === 0) continue;
      phrases.push(slice.join(' '));
    }
  }
  return countItems(phrases)
    .filter(([, count]) => count >= 2)
    .slice(0, 18)
    .map(([phrase, count]) => ({ phrase, count }));
}

function getSentenceStarts(text) {
  const sentences = text.split(/[.!?。！？\n]+/).map((sentence) => sentence.trim()).filter(Boolean);
  const starts = sentences
    .map((sentence) => tokenize(sentence).slice(0, 5).join(' '))
    .filter((start) => start.split(' ').length >= 3);
  return countItems(starts)
    .filter(([, count]) => count >= 2)
    .slice(0, 8)
    .map(([phrase, count]) => ({ phrase, count }));
}

function getCefrAnalysis(wordCounts) {
  const totalOccurrences = wordCounts.reduce((sum, item) => sum + item.count, 0);
  const levelMap = new Map(cefrLevels.map((level) => [level, {
    level,
    uniqueWords: 0,
    totalCount: 0,
    percentage: 0,
    topWords: [],
  }]));

  wordCounts.forEach(({ word, count }) => {
    const normalizedWord = normalizeFrenchWord(word);
    const originalLevel = cefrVocabulary[word];
    const normalizedLevel = cefrVocabulary[normalizedWord];
    const level = originalLevel || normalizedLevel || 'Unknown';
    const record = levelMap.get(level);
    record.uniqueWords += 1;
    record.totalCount += count;
    record.topWords.push({ word, normalizedWord, count });
  });

  return cefrLevels.map((level) => {
    const record = levelMap.get(level);
    return {
      ...record,
      percentage: totalOccurrences ? (record.totalCount / totalOccurrences) * 100 : 0,
      topWords: record.topWords
        .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
        .slice(0, 5),
    };
  });
}

function getCefrLevelForWord(word) {
  const normalizedWord = normalizeFrenchWord(word);
  return cefrVocabulary[word] || cefrVocabulary[normalizedWord] || 'Unknown';
}

function isSentenceStart(text, index) {
  const before = text.slice(0, index).trimEnd();
  return !before || /[.!?。！？\n]$/.test(before);
}

function getWordShapeStats(text) {
  const stats = new Map();

  getRawWordRecords(text).forEach(({ word, normalizedWord, index }) => {
    const current = stats.get(normalizedWord) || {
      hasDigit: false,
      hasLowercaseStart: false,
      hasCapitalizedNonSentenceStart: false,
      hasAcronymShape: false,
    };
    const firstLetter = word.match(/[a-zàâäçéèêëîïôöùûüÿñæœ]/i)?.[0] || '';
    const uppercaseLetters = word.match(/[A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸÑÆŒ]/g) || [];

    current.hasDigit = current.hasDigit || /\d/.test(word);
    current.hasLowercaseStart = current.hasLowercaseStart || Boolean(firstLetter && firstLetter === firstLetter.toLowerCase());
    current.hasCapitalizedNonSentenceStart = current.hasCapitalizedNonSentenceStart || (
      Boolean(firstLetter && firstLetter === firstLetter.toUpperCase() && firstLetter !== firstLetter.toLowerCase())
      && !isSentenceStart(text, index)
    );
    current.hasAcronymShape = current.hasAcronymShape || (
      uppercaseLetters.length >= 2
      && word.length <= 8
      && uppercaseLetters.length >= Math.max(2, Math.floor(word.length * 0.6))
    );

    stats.set(normalizedWord, current);
  });

  return stats;
}

function shouldExcludeDictionaryCandidate(word, shapeStats) {
  if (/\d/.test(word)) return true;
  if (!/[a-zàâäçéèêëîïôöùûüÿñæœ]/i.test(word)) return true;
  if (word.length < 3) return true;
  if (shapeStats?.hasDigit || shapeStats?.hasAcronymShape) return true;
  return Boolean(shapeStats?.hasCapitalizedNonSentenceStart && !shapeStats?.hasLowercaseStart);
}

function getAutoDictionaryDraft(wordCounts, text) {
  const shapeStats = getWordShapeStats(text);
  const entries = wordCounts
    .map(({ word, count }) => {
      const normalizedWord = normalizeFrenchWord(word);
      const originalLevel = cefrVocabulary[word];
      const normalizedLevel = cefrVocabulary[normalizedWord];
      return {
        word,
        normalizedWord,
        count,
        level: originalLevel || normalizedLevel || 'Unknown',
      };
    })
    .filter((entry) => entry.level === 'Unknown')
    .filter((entry) => !shouldExcludeDictionaryCandidate(entry.word, shapeStats.get(entry.word)))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, autoDictionaryLimit)
    .map((entry) => ({
      word: entry.normalizedWord,
      count: entry.count,
      level: autoDictionaryDefaultLevel,
    }));

  const uniqueEntries = [...new Map(entries.map((entry) => [entry.word, entry])).values()];
  const json = uniqueEntries.length
    ? JSON.stringify(
      uniqueEntries.reduce((draft, entry) => ({
        ...draft,
        [entry.word]: entry.level,
      }), {}),
      null,
      2,
    )
    : '{}';

  return {
    entries: uniqueEntries,
    json,
  };
}

function analyzeText(text) {
  const words = tokenize(text);
  const contentWords = words.filter((word) => !stopwords.has(word) && word.length >= 3);
  const wordCounts = countItems(contentWords).map(([word, count]) => ({ word, count }));
  const topWords = wordCounts.slice(0, 24);
  const allWordCounts = countItems(words);
  const repeatedPhrases = getNgrams(words);
  const sentenceStarts = getSentenceStarts(text);
  const cefrAnalysis = getCefrAnalysis(wordCounts);
  const autoDictionaryDraft = getAutoDictionaryDraft(wordCounts, text);
  const patternMatches = patternRules.map((rule) => {
    const matches = [...text.matchAll(rule.regex)].map((match) => match[0].toLowerCase());
    return {
      label: rule.label,
      count: matches.length,
      examples: [...new Set(matches)].slice(0, 4),
    };
  }).filter((pattern) => pattern.count > 0);

  return {
    words,
    contentWords,
    wordCounts,
    topWords,
    allWordCounts,
    cefrAnalysis,
    autoDictionaryDraft,
    repeatedPhrases,
    sentenceStarts,
    patternMatches,
    sentenceCount: text.split(/[.!?。！？]+/).filter((sentence) => sentence.trim()).length,
    uniqueCount: new Set(contentWords).size,
  };
}

export default function App() {
  const [text, setText] = useState(sampleText);
  const [session, setSession] = useState(null);
  const [history, setHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyRefreshIndex, setHistoryRefreshIndex] = useState(0);
  const [dictionaryCopyStatus, setDictionaryCopyStatus] = useState('');
  const analysis = useMemo(() => analyzeText(text), [text]);
  const analysisSnapshot = useMemo(() => ({
    totalWords: analysis.words.length,
    contentWords: analysis.contentWords.length,
    uniqueWords: analysis.uniqueCount,
    sentenceCount: analysis.sentenceCount,
    cefrSummary: analysis.cefrAnalysis.map((level) => ({
      level: level.level,
      uniqueWords: level.uniqueWords,
      totalCount: level.totalCount,
      percentage: level.percentage,
    })),
    topWords: analysis.topWords.slice(0, 12).map(({ word, count }) => ({
      word,
      count,
      cefrLevel: getCefrLevelForWord(word),
    })),
    wordFrequencies: analysis.wordCounts.map(({ word, count }) => ({
      word,
      normalizedWord: normalizeFrenchWord(word),
      count,
      cefrLevel: getCefrLevelForWord(word),
    })),
  }), [analysis]);
  const maxCount = analysis.topWords[0]?.count || 1;
  const cloudWords = analysis.topWords.slice(0, 24);
  const cloudAnimationKey = useMemo(() => getWordCountSignature(cloudWords), [cloudWords]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setHistoryRefreshIndex((index) => index + 1);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setHistory([]);
      return;
    }

    let isActive = true;
    setIsHistoryLoading(true);

    getAnalysisHistory()
      .then((records) => {
        if (isActive) setHistory(records);
      })
      .catch(() => {
        if (isActive) setHistory([]);
      })
      .finally(() => {
        if (isActive) setIsHistoryLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [session?.user?.id, historyRefreshIndex]);

  const copyDictionaryDraft = async () => {
    if (!analysis.autoDictionaryDraft.entries.length) return;

    try {
      await navigator.clipboard.writeText(analysis.autoDictionaryDraft.json);
      setDictionaryCopyStatus('已複製');
    } catch {
      setDictionaryCopyStatus('複製失敗');
    }

    window.setTimeout(() => setDictionaryCopyStatus(''), 1800);
  };

  useEffect(() => {
    const elements = document.querySelectorAll('[data-reveal]');

    if (!('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Navbar brand="French" links={links} />
      <main className="app-shell" id="home">
        <section className="intro" id="analyzer">
          <div className="intro__copy" data-reveal>
            <div className="intro__meta">
              <p className="eyebrow">French frequency studio</p>
              <p>Issue 01 / Text analysis</p>
            </div>
            <h1>
              <span>貼上法文文章，</span>
              <span>讀出文字的節奏。</span>
            </h1>
            <p>
              適合 B1-C1 作文、口說稿與新聞文章。工具會過濾常見虛詞，保留更有學習價值的主題詞，
              並抓出常用論述句型。
            </p>
          </div>
          <div className="visual-strip" aria-label="Analysis preview" data-reveal>
            <p className="visual-strip__label">Live frequency</p>
            {analysis.topWords.slice(0, 8).map((item, index) => (
              <span key={item.word} style={{ '--height': `${34 + index * 7}px`, '--index': index }}>
                {item.word}
              </span>
            ))}
          </div>
        </section>

        <div className="ticker" aria-hidden="true">
          <div className="ticker__track">
            {[...analysis.topWords.slice(0, 8), ...analysis.topWords.slice(0, 8)].map((item, index) => (
              <span key={`${item.word}-${index}`}>{item.word} <strong>{item.count}</strong></span>
            ))}
          </div>
        </div>

        <section className="workspace" data-reveal>
          <div className="editor-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Input</p>
                <h2>文章文本</h2>
              </div>
              <div className="button-row">
                <button type="button" onClick={() => setText(sampleText)}>
                  <Copy size={16} />
                  範例
                </button>
                <button type="button" onClick={() => setText('')}>
                  <RefreshCcw size={16} />
                  清空
                </button>
              </div>
            </div>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              spellCheck="false"
              placeholder="貼上你的法文文章、作文或口說稿..."
            />
            <SaveAnalysisButton
              disabled={!session?.user?.id || !analysis.wordCounts.length}
              session={session}
              snapshot={analysisSnapshot}
              onSaved={() => setHistoryRefreshIndex((index) => index + 1)}
            />
          </div>

          <aside className="summary-panel" id="summary">
            <AuthPanel session={session} />
            <ExportDataPanel session={session} />
          </aside>
        </section>

        <section className="analysis-grid" id="charts" data-reveal>
          <section className="chart-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Chart</p>
                <h2>高頻詞圖表</h2>
              </div>
            </div>
            <div className="bar-chart">
              {analysis.topWords.slice(0, 12).map((item, index) => (
                <div className="bar-row" key={item.word} style={{ '--index': index }}>
                  <span>{item.word}</span>
                  <div className="bar-track">
                    <div style={{ width: `${(item.count / maxCount) * 100}%` }} />
                  </div>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="cloud-panel" aria-labelledby="word-cloud-title">
            <div className="cloud-panel__heading">
              <div>
                <p className="eyebrow">Word cloud</p>
                <h2 id="word-cloud-title">文字雲</h2>
              </div>
            </div>
            <div className="word-cloud" key={cloudAnimationKey}>
              {cloudWords.map((item, index) => (
                <span
                  key={item.word}
                  aria-label={`${item.word}, ${item.count} 次`}
                  style={{
                    '--size': `${0.86 + (item.count / maxCount) * 1.7}rem`,
                    '--tone': index % 5,
                    '--index': index,
                  }}
                >
                  {item.word}
                </span>
              ))}
            </div>
          </section>
        </section>

        <section className="cefr-panel" id="cefr" data-reveal>
          <div className="section-title">
            <p className="eyebrow">CEFR</p>
            <h2>CEFR 詞彙難度分析</h2>
          </div>
          <div className="cefr-grid">
            {analysis.cefrAnalysis.map((level) => (
              <article className="cefr-card" key={level.level} data-level={level.level}>
                <div className="cefr-card__heading">
                  <strong>{level.level}</strong>
                  <span>{level.percentage.toFixed(1)}%</span>
                </div>
                <div className="cefr-meter" aria-hidden="true">
                  <div style={{ width: `${level.percentage}%` }} />
                </div>
                <dl className="cefr-stats">
                  <div>
                    <dt>詞數</dt>
                    <dd>{level.uniqueWords}</dd>
                  </div>
                  <div>
                    <dt>出現</dt>
                    <dd>{level.totalCount}</dd>
                  </div>
                </dl>
                {level.topWords.length ? (
                  <div className="cefr-words">
                    {level.topWords.map((item) => (
                      <span key={item.word}>{item.word} <small>{item.count}</small></span>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">沒有詞彙</p>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="patterns" id="patterns" data-reveal>
          <div className="section-title">
            <p className="eyebrow">Patterns</p>
            <h2>重複句型與常見片語</h2>
          </div>
          <div className="pattern-grid">
            <article>
              <h3>論述句型</h3>
              {analysis.patternMatches.length ? (
                analysis.patternMatches.map((pattern) => (
                  <div className="pattern-item" key={pattern.label}>
                    <span>{pattern.label}</span>
                    <strong>{pattern.count}</strong>
                    <p>{pattern.examples.join(' · ')}</p>
                  </div>
                ))
              ) : (
                <p className="empty-state">尚未偵測到常見 B2 論述句型。</p>
              )}
            </article>

            <article>
              <h3>重複片語</h3>
              {analysis.repeatedPhrases.length ? (
                analysis.repeatedPhrases.slice(0, 10).map((item) => (
                  <div className="phrase-row" key={item.phrase}>
                    <span>{item.phrase}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))
              ) : (
                <p className="empty-state">重複片語需要較長文本才會出現。</p>
              )}
            </article>

            <article>
              <h3>重複句首</h3>
              {analysis.sentenceStarts.length ? (
                analysis.sentenceStarts.map((item) => (
                  <div className="phrase-row" key={item.phrase}>
                    <span>{item.phrase}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))
              ) : (
                <p className="empty-state">目前沒有明顯重複句首。</p>
              )}
            </article>
          </div>
        </section>

        <HistoryDashboard
          history={history}
          isLoading={isHistoryLoading}
          onChanged={() => setHistoryRefreshIndex((index) => index + 1)}
        />

        <MonthlyComparison history={history} />

        <footer className="site-footer">
          <span>聯絡信箱</span>
          <a href="mailto:fishpka@hotmail.com">fishpka@hotmail.com</a>
        </footer>
      </main>
    </>
  );
}
