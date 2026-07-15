import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Copy, RefreshCcw } from 'lucide-react';
import Navbar from './components/Navbar.jsx';
import { getAnalysisHistory, getGlobalTopWords } from './lib/analysisPersistence.js';
import { trackEvent } from './lib/analytics.js';
import { isSupabaseConfigured, supabase } from './lib/supabaseClient.js';
import { applySeoMetadata, getInternalHref, getPageIdFromLocation } from './seo.js';

const AuthPanel = lazy(() => import('./components/AuthPanel.jsx'));
const ExportDataPanel = lazy(() => import('./components/ExportDataPanel.jsx'));
const HistoryDashboard = lazy(() => import('./components/HistoryDashboard.jsx'));
const MonthlyComparison = lazy(() => import('./components/MonthlyComparison.jsx'));
const SaveAnalysisButton = lazy(() => import('./components/SaveAnalysisButton.jsx'));

let cefrVocabulary = {};
let frenchChineseGlosses = {};
let frenchLemmaMap = {};
let frenchDataModulesPromise;

function loadFrenchDataModules() {
  if (!frenchDataModulesPromise) {
    frenchDataModulesPromise = Promise.all([
      import('./data/cefrVocabulary.js'),
      import('./data/frenchChineseGlosses.js'),
      import('./data/frenchLemmaMap.js'),
    ]).then(([cefrModule, glossModule, lemmaModule]) => {
      cefrVocabulary = cefrModule.default;
      frenchChineseGlosses = glossModule.default;
      frenchLemmaMap = lemmaModule.default;
    });
  }

  return frenchDataModulesPromise;
}

const showTopVocabulary = false;
const topVocabularyPagePath = getInternalHref('top-100-mots');
const homePagePath = getInternalHref('home');

const links = [
  { label: '分析器', href: '#analyzer' },
  { label: '圖表', href: '#charts' },
  { label: 'Top 100', href: topVocabularyPagePath },
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
  'même', 'mes', 'moins', 'mon', 'ma', 'ne', 'ni', 'nos', 'notre', 'nous', 'on', 'ont', 'or', 'ou',
  'où', 'par', 'parce', 'pas', 'peut', 'plus', 'pour', 'quand', 'que', 'quel',
  'quelle', 'quelles', 'quels', 'qui', 'quoi', 'sa', 'sans', 'se', 'ses', 'si',
  'son', 'sont', 'sous', 'sur', 'ta', 'tes', 'ton', 'tous', 'tout', 'toute', 'toutes',
  'très', 'tu', 'un', 'une', 'vos', 'votre', 'vous', 'y', 'c', 'd', 'j', 'l',
  'm', 'n', 'qu', 's', 't', "c'", "c'est", "d'", "d'un", "j'", "l'", "m'", "n'", "qu'", "s'", "t'",
]);

const patternRules = [
  { label: '表達意見', pattern: 'je pense que|à mon avis|selon moi|personnellement' },
  { label: '必要性', pattern: 'il faut|il est important de|il est nécessaire de|on doit' },
  { label: '舉例', pattern: 'par exemple|notamment|comme' },
  { label: '轉折', pattern: 'cependant|pourtant|en revanche|mais|toutefois' },
  { label: '順序', pattern: "d'abord|ensuite|puis|enfin|premièrement|deuxièmement" },
  { label: '結果', pattern: "donc|ainsi|c'est pourquoi|par conséquent|cela permet de" },
  { label: '結論', pattern: 'en conclusion|pour conclure|en résumé|finalement' },
  { label: '平衡論述', pattern: "d'un côté|de l'autre côté|non seulement|mais aussi|tout dépend" },
];

const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Unknown'];
const autoDictionaryDefaultLevel = 'B2';
const autoDictionaryLimit = 20;
const showActionRecommendations = false;
const showUnknownReview = false;
const showCefrExcludedNote = false;
const showChineseGlosses = false;
const frenchNlpApiUrl = import.meta.env.VITE_FRENCH_NLP_API_URL?.trim() || '';
const configuredFrenchNlpMaxTextLength = Number.parseInt(import.meta.env.VITE_FRENCH_NLP_MAX_TEXT_LENGTH || '20000', 10);
const frenchNlpMaxTextLength = Number.isFinite(configuredFrenchNlpMaxTextLength)
  ? Math.max(configuredFrenchNlpMaxTextLength, 1)
  : 20000;
const frenchLetterClass = 'a-zàâäçéèêëîïôöùûüÿñæœ';
const sentenceDelimiter = /[.!?。！？\n]+/;
const advancedCefrLevels = new Set(['B2', 'C1', 'C2']);
function createWordPattern() {
  return new RegExp(`[${frenchLetterClass}]+(?:[’'-][${frenchLetterClass}]+)*`, 'gi');
}

function createPhraseRegex(pattern) {
  return new RegExp(`(^|[^${frenchLetterClass}])(${pattern})(?=$|[^${frenchLetterClass}])`, 'giu');
}

function getCurrentPage() {
  return getPageIdFromLocation(window.location);
}

function normalizeWord(word) {
  return word.toLowerCase().replace(/[’]/g, "'").replace(/^['-]+|['-]+$/g, '');
}

function shouldSkipWord(word) {
  const normalized = normalizeWord(word);
  return (
    stopwords.has(normalized)
    || /^\d+$/.test(normalized)
    || normalized.length <= 1
    || /^[.,!?;:'"«»—…]+$/.test(normalized)
  );
}

function TopVocabularyPanel({
  vocabulary,
  copyStatus,
  emptyMessage = '目前還沒有可顯示的高頻詞。',
  errorMessage = '',
  isStandalone = false,
  isLoading = false,
  summary,
  onCopy,
}) {
  const itemCount = vocabulary.length;

  return (
    <section
      className={`top-vocabulary-panel ${isStandalone ? 'top-vocabulary-panel--standalone' : ''}`}
      id="top-vocabulary"
      data-reveal
    >
      <div className="section-title top-vocabulary-panel__heading">
        <div>
          <p className="eyebrow">Vocabulary</p>
          <h2>Top 100 mots français</h2>
        </div>
        <button
          className="top-vocabulary-panel__copy"
          type="button"
          onClick={onCopy}
          disabled={!itemCount}
        >
          <Copy size={16} />
          複製 CSV
        </button>
      </div>
      <p className="top-vocabulary-panel__summary">
        {summary || `依全站已儲存分析紀錄彙總 normalized word，排序前 ${itemCount} 個熱門詞。`}
      </p>
      {isLoading ? (
        <p className="empty-state">正在載入全站熱門詞...</p>
      ) : errorMessage ? (
        <p className="empty-state">{errorMessage}</p>
      ) : itemCount ? (
        <div className="top-vocabulary-table" role="table" aria-label="Top 100 mots français">
          <div className="top-vocabulary-table__row top-vocabulary-table__row--head" role="row">
            <span role="columnheader">#</span>
            <span role="columnheader">Word</span>
            <span role="columnheader">Count</span>
            <span role="columnheader">CEFR</span>
          </div>
          {vocabulary.map((item, index) => (
            <div className="top-vocabulary-table__row" role="row" key={item.word}>
              <span role="cell">{index + 1}</span>
              <strong role="cell">{item.word}</strong>
              <span role="cell">{item.count}</span>
              <span role="cell">{item.cefrLevel}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">{emptyMessage}</p>
      )}
      {copyStatus ? <small>{copyStatus}</small> : null}
    </section>
  );
}

function getLemmaFromMapping(word) {
  return frenchLemmaMap[word] || null;
}

function getCefrVocabularyLevel(word) {
  return cefrVocabulary[normalizeWord(word)] || null;
}

function isKnownLemma(word) {
  return Boolean(getLemmaFromMapping(word) || getCefrVocabularyLevel(word));
}

function getKnownCandidate(candidates) {
  return candidates.find((candidate) => candidate && isKnownLemma(candidate)) || '';
}

function getCandidateLevel(word) {
  if (!word) return '';
  const lemma = getLemmaFromMapping(word) || word;
  return getCefrVocabularyLevel(lemma) || '';
}

function buildNlpTokenMap(tokens) {
  const map = new Map();

  tokens.forEach((token) => {
    const word = normalizeWord(token.text || '');
    if (!word) return;

    const lemma = normalizeWord(token.lemma || '');
    const current = map.get(word) || {
      lemma: '',
      pos: '',
      isProperNoun: false,
    };

    if (lemma && lemma !== word && lemma !== '-pron-') {
      current.lemma = lemma;
    }

    if (token.pos) current.pos = token.pos;
    current.isProperNoun = current.isProperNoun || token.is_proper_noun || token.pos === 'PROPN';
    map.set(word, current);
  });

  return map;
}

function getNlpLemmaOverride(word, nlpTokenMap) {
  const token = nlpTokenMap?.get(normalizeWord(word));
  if (!token?.lemma) return '';
  return token.lemma;
}

function normalizeFrenchWord(word, nlpTokenMap) {
  let normalized = normalizeWord(word)
    .replace(/^[^a-zàâäçéèêëîïôöùûüÿñæœ]+|[^a-zàâäçéèêëîïôöùûüÿñæœ]+$/gi, '')
    .replace(/^(?:l|d|j|m|t|s|n|c|qu)'/i, '');

  const nlpLemma = getNlpLemmaOverride(normalized, nlpTokenMap);
  if (nlpLemma && (getCefrVocabularyLevel(nlpLemma) || getLemmaFromMapping(nlpLemma))) {
    return getLemmaFromMapping(nlpLemma) || nlpLemma;
  }

  const mappedLemma = getLemmaFromMapping(normalized);
  if (mappedLemma) return mappedLemma;

  if (getCefrVocabularyLevel(normalized)) return normalized;

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
  const matches = text.match(createWordPattern());
  return matches ? matches.map(normalizeWord).filter((word) => !shouldSkipWord(word)) : [];
}

function getRawWordRecords(text) {
  return [...text.matchAll(createWordPattern())].map((match) => ({
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
  const phraseCounts = new Map();

  for (let size = 2; size <= 5; size += 1) {
    for (let index = 0; index <= words.length - size; index += 1) {
      const slice = words.slice(index, index + size);
      if (slice.every(shouldSkipWord)) continue;
      const phrase = slice.join(' ');
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
    }
  }

  return [...phraseCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .filter(([, count]) => count >= 2)
    .slice(0, 18)
    .map(([phrase, count]) => ({ phrase, count }));
}

function getSentences(text) {
  return text.split(sentenceDelimiter).map((sentence) => sentence.trim()).filter(Boolean);
}

function getSentenceStarts(text) {
  const sentences = getSentences(text);
  const starts = sentences
    .map((sentence) => tokenize(sentence).slice(0, 5).join(' '))
    .filter((start) => start.split(' ').length >= 3);
  return countItems(starts)
    .filter(([, count]) => count >= 2)
    .slice(0, 8)
    .map(([phrase, count]) => ({ phrase, count }));
}

function getCefrAnalysis(wordCounts, nlpTokenMap) {
  const totalOccurrences = wordCounts.reduce((sum, item) => sum + item.count, 0);
  const levelMap = new Map(cefrLevels.map((level) => [level, {
    level,
    uniqueWords: 0,
    totalCount: 0,
    percentage: 0,
    topWords: [],
  }]));

  wordCounts.forEach(({ word, count }) => {
    const normalizedWord = normalizeFrenchWord(word, nlpTokenMap);
    const originalLevel = getCefrVocabularyLevel(word);
    const normalizedLevel = getCefrVocabularyLevel(normalizedWord);
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

function getTopVocabulary(words, nlpTokenMap) {
  const normalizedWords = words
    .map((word) => normalizeFrenchWord(word, nlpTokenMap))
    .filter((word) => word && !shouldSkipWord(word) && word.length >= 3);

  return countItems(normalizedWords)
    .slice(0, 100)
    .map(([word, count]) => ({
      word,
      count,
      cefrLevel: getCefrLevelForWord(word, nlpTokenMap),
    }));
}

function getCefrLevelForWord(word, nlpTokenMap) {
  const normalizedWord = normalizeFrenchWord(word, nlpTokenMap);
  return getCefrVocabularyLevel(word) || getCefrVocabularyLevel(normalizedWord) || 'Unknown';
}

function getChineseGlossForWord(word, nlpTokenMap) {
  const normalizedWord = normalizeFrenchWord(word, nlpTokenMap);
  return frenchChineseGlosses[word] || frenchChineseGlosses[normalizedWord] || '';
}

function isSentenceStart(text, index) {
  const before = text.slice(0, index).trimEnd();
  return !before || /[.!?。！？\n]$/.test(before);
}

function getWordShapeStats(records, text) {
  const stats = new Map();

  records.forEach(({ word, normalizedWord, index }) => {
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

function getCefrExcludedWords(records, shapeStats, nlpTokenMap) {
  const excludedWords = new Set();

  records.forEach(({ normalizedWord }) => {
    if (
      nlpTokenMap?.get(normalizedWord)?.isProperNoun
      || shouldExcludeDictionaryCandidate(normalizedWord, shapeStats.get(normalizedWord))
    ) {
      excludedWords.add(normalizedWord);
    }
  });

  return excludedWords;
}

function getAutoDictionaryDraft(wordCounts, shapeStats, nlpTokenMap) {
  const entries = wordCounts
    .map(({ word, count }) => {
      const normalizedWord = normalizeFrenchWord(word, nlpTokenMap);
      const originalLevel = getCefrVocabularyLevel(word);
      const normalizedLevel = getCefrVocabularyLevel(normalizedWord);
      return {
        word,
        normalizedWord,
        count,
        level: originalLevel || normalizedLevel || 'Unknown',
      };
    })
    .filter((entry) => entry.level === 'Unknown')
    .filter((entry) => !shouldExcludeDictionaryCandidate(
      entry.normalizedWord,
      shapeStats.get(entry.normalizedWord),
    ))
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

function getExcludedReason(shapeStats) {
  if (shapeStats?.hasDigit) return '含數字';
  if (shapeStats?.hasAcronymShape) return '縮寫';
  if (shapeStats?.hasCapitalizedNonSentenceStart && !shapeStats?.hasLowercaseStart) return '可能專有名詞';
  return '非 CEFR 候選';
}

function getUnknownReview(wordCounts, cefrExcludedWordCounts, shapeStats, autoDictionaryDraft, nlpTokenMap) {
  const resolvedForms = wordCounts
    .map(({ word, count }) => {
      const normalizedWord = normalizeFrenchWord(word, nlpTokenMap);
      const cefrLevel = getCefrLevelForWord(word, nlpTokenMap);
      return {
        word,
        normalizedWord,
        count,
        cefrLevel,
      };
    })
    .filter((item) => item.word !== item.normalizedWord && item.cefrLevel !== 'Unknown')
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, 8);

  const excluded = cefrExcludedWordCounts
    .map(({ word, count }) => ({
      word,
      count,
      reason: getExcludedReason(shapeStats.get(word)),
    }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, 10);

  const pendingDictionary = autoDictionaryDraft.entries.slice(0, 10);
  const totalPendingCount = autoDictionaryDraft.entries.length;

  return {
    resolvedForms,
    excluded,
    pendingDictionary,
    totalPendingCount,
    diagnostics: getUnknownDiagnostics(wordCounts, shapeStats, nlpTokenMap),
    json: autoDictionaryDraft.json,
  };
}

function getNlpTokenInfo(word, nlpTokenMap) {
  return nlpTokenMap?.get(normalizeWord(word)) || {};
}

function uniqueCandidates(candidates) {
  return [...new Set(candidates.filter(Boolean))];
}

function getVerbLemmaCandidates(word) {
  const candidates = [];

  if (/ées?$/.test(word)) candidates.push(word.replace(/ées?$/, 'er'));
  if (/és?$/.test(word)) candidates.push(word.replace(/és?$/, 'er'));
  if (/(ais|ait|aient|ions|iez)$/.test(word)) {
    candidates.push(word.replace(/(ais|ait|aient|ions|iez)$/, 'er'));
    candidates.push(word.replace(/(ais|ait|aient|ions|iez)$/, 'ir'));
    candidates.push(word.replace(/(ais|ait|aient|ions|iez)$/, 're'));
  }
  if (/(erai|eras|era|erons|erez|eront)$/.test(word)) {
    candidates.push(word.replace(/(erai|eras|era|erons|erez|eront)$/, 'er'));
  }
  if (/(irai|iras|ira|irons|irez|iront)$/.test(word)) {
    candidates.push(word.replace(/(irai|iras|ira|irons|irez|iront)$/, 'ir'));
  }
  if (/(rai|ras|ra|rons|rez|ront)$/.test(word)) {
    candidates.push(word.replace(/(rai|ras|ra|rons|rez|ront)$/, 're'));
  }
  if (/(ons|ez|ent|es|e)$/.test(word)) candidates.push(word.replace(/(ons|ez|ent|es|e)$/, 'er'));
  if (/(is|it|issent|issons|issez)$/.test(word)) candidates.push(word.replace(/(is|it|issent|issons|issez)$/, 'ir'));
  if (/(u|ue|us|ues)$/.test(word)) candidates.push(word.replace(/(u|ue|us|ues)$/, 're'));

  return uniqueCandidates(candidates).filter((candidate) => candidate !== word && candidate.length >= 3);
}

function getPluralLemmaCandidates(word) {
  const candidates = [];
  if (word.endsWith('aux')) candidates.push(`${word.slice(0, -3)}al`);
  if (word.endsWith('eaux')) candidates.push(word.slice(0, -1));
  if (word.length > 3 && word.endsWith('x')) candidates.push(word.slice(0, -1));
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) candidates.push(word.slice(0, -1));
  return uniqueCandidates(candidates).filter((candidate) => candidate !== word && candidate.length >= 3);
}

function getGenderLemmaCandidates(word) {
  const candidates = [];
  if (word.endsWith('euse')) candidates.push(`${word.slice(0, -4)}eur`);
  if (word.endsWith('trice')) candidates.push(`${word.slice(0, -5)}teur`);
  if (word.endsWith('ive')) candidates.push(`${word.slice(0, -3)}if`);
  if (word.endsWith('ère')) candidates.push(`${word.slice(0, -3)}er`);
  if (word.endsWith('e') && word.length > 4) candidates.push(word.slice(0, -1));
  if (word.endsWith('ée')) candidates.push(word.slice(0, -1));
  if (word.endsWith('ées')) candidates.push(word.slice(0, -1), word.slice(0, -2), word.slice(0, -3));
  if (word.endsWith('es')) candidates.push(word.slice(0, -1), word.slice(0, -2));
  return uniqueCandidates(candidates).filter((candidate) => candidate !== word && candidate.length >= 3);
}

function getUnknownDiagnostics(wordCounts, shapeStats, nlpTokenMap) {
  return wordCounts
    .map(({ word, count }) => {
      const normalizedWord = normalizeFrenchWord(word, nlpTokenMap);
      const nlpToken = getNlpTokenInfo(word, nlpTokenMap);
      const shape = shapeStats.get(normalizeWord(word)) || shapeStats.get(normalizedWord);
      const originalLevel = getCefrVocabularyLevel(word);
      const normalizedLevel = getCefrVocabularyLevel(normalizedWord);

      if (originalLevel || normalizedLevel) return null;

      const nlpLemma = nlpToken.lemma && nlpToken.lemma !== word ? nlpToken.lemma : '';
      const mappedLemma = getLemmaFromMapping(word) || getLemmaFromMapping(normalizedWord) || '';
      const verbCandidates = getVerbLemmaCandidates(normalizedWord);
      const pluralCandidates = getPluralLemmaCandidates(normalizedWord);
      const genderCandidates = getGenderLemmaCandidates(normalizedWord);
      const likelyLemma = getKnownCandidate([
        nlpLemma,
        mappedLemma,
        ...verbCandidates,
        ...pluralCandidates,
        ...genderCandidates,
      ]) || nlpLemma || mappedLemma || verbCandidates[0] || pluralCandidates[0] || genderCandidates[0] || normalizedWord;
      const likelyLevel = getCandidateLevel(likelyLemma);
      const checks = [];

      if (nlpToken.pos === 'VERB' || nlpToken.pos === 'AUX' || verbCandidates.length) {
        checks.push({
          type: '動詞變位',
          detail: getKnownCandidate(verbCandidates)
            ? `可能來自 ${getKnownCandidate(verbCandidates)}`
            : '符合常見動詞詞尾，但字典沒有確認 lemma',
        });
      }

      if (pluralCandidates.length) {
        checks.push({
          type: '名詞複數',
          detail: getKnownCandidate(pluralCandidates)
            ? `單數可能是 ${getKnownCandidate(pluralCandidates)}`
            : `可能單數：${pluralCandidates.slice(0, 2).join(' / ')}`,
        });
      }

      if (genderCandidates.length) {
        checks.push({
          type: '陰陽性變化',
          detail: getKnownCandidate(genderCandidates)
            ? `基本形可能是 ${getKnownCandidate(genderCandidates)}`
            : `可能基本形：${genderCandidates.slice(0, 2).join(' / ')}`,
        });
      }

      if (word !== normalizeWord(word) || /['’-]/.test(word)) {
        checks.push({
          type: '標點/連字',
          detail: `分析時正規化為 ${normalizeWord(word)}`,
        });
      }

      if (nlpToken.isProperNoun || nlpToken.pos === 'PROPN' || shouldExcludeDictionaryCandidate(normalizedWord, shape)) {
        checks.push({
          type: '專有名詞',
          detail: getExcludedReason(shape),
        });
      }

      if (!checks.length) {
        checks.push({
          type: '字典未收錄',
          detail: '未找到可靠的變位、複數、性別或標點線索',
        });
      }

      return {
        word,
        normalizedWord,
        count,
        likelyLemma,
        likelyLevel,
        checks,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

function getPatternCount(patternMatches, label) {
  return patternMatches.find((pattern) => pattern.label === label)?.count || 0;
}

function getCefrTotal(cefrAnalysis, levels) {
  return cefrAnalysis
    .filter((level) => levels.has(level.level))
    .reduce((sum, level) => sum + level.totalCount, 0);
}

function getActionRecommendations(analysis) {
  const recommendations = [];
  const totalWords = analysis.words.length;
  const contentWordCount = analysis.contentWords.length;
  const cefrTotal = analysis.cefrWordCounts.reduce((sum, item) => sum + item.count, 0);
  const unknownCount = analysis.cefrAnalysis.find((level) => level.level === 'Unknown')?.totalCount || 0;
  const unknownRatio = cefrTotal ? unknownCount / cefrTotal : 0;
  const advancedCount = getCefrTotal(analysis.cefrAnalysis, advancedCefrLevels);
  const advancedRatio = cefrTotal ? advancedCount / cefrTotal : 0;
  const topWordTotal = analysis.topWords.slice(0, 3).reduce((sum, item) => sum + item.count, 0);
  const topWordRatio = contentWordCount ? topWordTotal / contentWordCount : 0;
  const hasText = totalWords > 0;

  if (!hasText) {
    return [{
      id: 'start-with-text',
      priority: 'Start',
      title: '先貼上一段法文文本',
      reason: '目前還沒有可分析的詞彙。',
      action: '貼上作文、口說稿或新聞段落後，這裡會產生可執行的修改建議。',
      examples: ['作文', '口說稿', '新聞文章'],
    }];
  }

  if (totalWords < 120) {
    recommendations.push({
      id: 'short-text',
      priority: 'High',
      title: '文本偏短，先補足篇幅',
      reason: `目前約 ${totalWords} 個詞，統計結果容易受少數詞影響。`,
      action: '若這是作文練習，先擴寫到 150-250 詞，再判斷 CEFR 分布與重複句型會更穩定。',
      examples: ['補一個具體例子', '補一段反方觀點', '補結論'],
    });
  }

  if (unknownRatio >= 0.15) {
    const unknownWords = analysis.cefrAnalysis
      .find((level) => level.level === 'Unknown')
      ?.topWords
      .slice(0, 4)
      .map((item) => item.word) || [];

    recommendations.push({
      id: 'unknown-words',
      priority: 'High',
      title: '先檢查 Unknown words',
      reason: `Unknown 詞約占 ${(unknownRatio * 100).toFixed(0)}%，可能混有拼字、專有名詞或字典未收錄詞。`,
      action: '優先檢查高頻 Unknown words；若是正確詞彙，可以加入個人字典或調整 CEFR 標記。',
      examples: unknownWords.length ? unknownWords : ['拼字檢查', '專有名詞', '字典補充'],
    });
  }

  if (advancedRatio < 0.1 && totalWords >= 120) {
    recommendations.push({
      id: 'advanced-vocabulary',
      priority: 'Medium',
      title: '補強 B2 以上論述詞彙',
      reason: `B2-C2 詞彙目前約占 ${(advancedRatio * 100).toFixed(0)}%，文章可能偏基礎敘述。`,
      action: '挑 2-4 個核心概念換成更精準的抽象詞，讓文章更接近 B2/C1 論述。',
      examples: ['influence', 'conséquence', 'perspective', 'responsabilité'],
    });
  }

  if (!getPatternCount(analysis.patternMatches, '轉折')) {
    recommendations.push({
      id: 'missing-contrast',
      priority: 'High',
      title: '加入轉折句型',
      reason: '目前沒有偵測到明顯轉折，論述可能只往單一方向推進。',
      action: '在第二段或反方觀點前加入轉折，讓文章更有層次。',
      examples: ['cependant', 'en revanche', 'toutefois'],
    });
  }

  if (!getPatternCount(analysis.patternMatches, '舉例')) {
    recommendations.push({
      id: 'missing-example',
      priority: 'Medium',
      title: '補一個具體例子',
      reason: '目前沒有偵測到舉例句型，主張可能缺少支撐。',
      action: '在主要觀點後加一個例子，說明這個現象如何出現在生活、學校或工作中。',
      examples: ['par exemple', 'notamment', 'comme'],
    });
  }

  if (!getPatternCount(analysis.patternMatches, '結果')) {
    recommendations.push({
      id: 'missing-result',
      priority: 'Medium',
      title: '補強因果或結果',
      reason: '目前較少結果表達，讀者可能不容易看出前後推論。',
      action: '在原因或例子後加入結果句，讓段落邏輯更清楚。',
      examples: ['donc', 'par conséquent', "c'est pourquoi"],
    });
  }

  if (!getPatternCount(analysis.patternMatches, '結論')) {
    recommendations.push({
      id: 'missing-conclusion',
      priority: 'Medium',
      title: '加上明確結論',
      reason: '目前沒有偵測到結論句型，文章收尾可能不夠清楚。',
      action: '最後一段用一句總結立場，再補一句平衡或建議。',
      examples: ['en conclusion', 'pour conclure', 'finalement'],
    });
  }

  if (analysis.repeatedPhrases.length >= 3) {
    recommendations.push({
      id: 'repeated-phrases',
      priority: 'Medium',
      title: '降低重複片語',
      reason: `偵測到 ${analysis.repeatedPhrases.length} 組重複片語，文章節奏可能偏單調。`,
      action: '保留關鍵主題詞，但把部分重複名詞換成代名詞、同義詞或概括表達。',
      examples: analysis.repeatedPhrases.slice(0, 3).map((item) => item.phrase),
    });
  }

  if (analysis.sentenceStarts.length) {
    recommendations.push({
      id: 'sentence-starts',
      priority: 'Medium',
      title: '變化句首節奏',
      reason: '部分句子使用相似開頭，讀起來可能像清單。',
      action: '交替使用順序、補充、轉折與結果開頭，讓段落推進更自然。',
      examples: ["D'abord", 'De plus', 'En revanche', 'Ainsi'],
    });
  }

  if (topWordRatio >= 0.28 && analysis.topWords.length >= 3) {
    recommendations.push({
      id: 'top-word-concentration',
      priority: 'Low',
      title: '分散高頻主題詞',
      reason: `前三個內容詞占內容詞約 ${(topWordRatio * 100).toFixed(0)}%，用詞可能過度集中。`,
      action: '把部分重複主題詞改成同義表達，或用更具體的名詞補充觀點。',
      examples: analysis.topWords.slice(0, 3).map((item) => item.word),
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      id: 'balanced-draft',
      priority: 'Next',
      title: '這篇文章結構相對平衡',
      reason: '目前沒有明顯高風險問題，詞彙、句型與重複度都在可接受範圍。',
      action: '下一步可以儲存這次分析，之後比較 B2+ 詞彙比例和 Unknown words 是否下降。',
      examples: ['儲存分析', '下次比較', '追蹤進步'],
    });
  }

  const priorityRank = { High: 0, Medium: 1, Low: 2, Next: 3, Start: 4 };
  return recommendations
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
    .slice(0, 5);
}

function analyzeText(text, nlpTokenMap = new Map()) {
  const words = tokenize(text);
  const rawWordRecords = getRawWordRecords(text);
  const shapeStats = getWordShapeStats(rawWordRecords, text);
  const contentWords = words.filter((word) => !shouldSkipWord(word) && word.length >= 3);
  const wordCounts = countItems(contentWords).map(([word, count]) => ({ word, count }));
  const cefrExcludedWords = getCefrExcludedWords(rawWordRecords, shapeStats, nlpTokenMap);
  const cefrWordCounts = wordCounts.filter(({ word }) => !cefrExcludedWords.has(word));
  const cefrExcludedWordCounts = wordCounts.filter(({ word }) => cefrExcludedWords.has(word));
  const topWords = wordCounts.slice(0, 24);
  const topVocabulary = getTopVocabulary(contentWords, nlpTokenMap);
  const repeatedPhrases = getNgrams(words);
  const sentenceStarts = getSentenceStarts(text);
  const cefrAnalysis = getCefrAnalysis(cefrWordCounts, nlpTokenMap);
  const autoDictionaryDraft = getAutoDictionaryDraft(wordCounts, shapeStats, nlpTokenMap);
  const unknownReview = getUnknownReview(
    wordCounts,
    cefrExcludedWordCounts,
    shapeStats,
    autoDictionaryDraft,
    nlpTokenMap,
  );
  const patternMatches = patternRules.map((rule) => {
    const matches = [...text.matchAll(createPhraseRegex(rule.pattern))]
      .map((match) => match[2].toLowerCase());
    return {
      label: rule.label,
      count: matches.length,
      examples: [...new Set(matches)].slice(0, 4),
    };
  }).filter((pattern) => pattern.count > 0);
  const partialAnalysis = {
    words,
    contentWords,
    cefrWordCounts,
    topWords,
    cefrAnalysis,
    repeatedPhrases,
    sentenceStarts,
    patternMatches,
  };

  return {
    words,
    contentWords,
    wordCounts,
    cefrWordCounts,
    cefrExcludedWords,
    cefrExcludedWordCounts,
    topWords,
    topVocabulary,
    cefrAnalysis,
    autoDictionaryDraft,
    unknownReview,
    repeatedPhrases,
    sentenceStarts,
    patternMatches,
    recommendations: getActionRecommendations(partialAnalysis),
    sentenceCount: getSentences(text).length,
    uniqueCount: new Set(contentWords).size,
  };
}

export default function App() {
  const [text, setText] = useState(sampleText);
  const [page, setPage] = useState(getCurrentPage);
  const [session, setSession] = useState(null);
  const [history, setHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyRefreshIndex, setHistoryRefreshIndex] = useState(0);
  const [dictionaryCopyStatus, setDictionaryCopyStatus] = useState('');
  const [topVocabularyCopyStatus, setTopVocabularyCopyStatus] = useState('');
  const [globalTopVocabulary, setGlobalTopVocabulary] = useState([]);
  const [globalTopVocabularyStatus, setGlobalTopVocabularyStatus] = useState({
    error: '',
    loading: false,
  });
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
  const [frenchDataVersion, setFrenchDataVersion] = useState(0);
  const [nlpTokens, setNlpTokens] = useState([]);
  const isTopVocabularyPage = page === 'top-100-mots';
  const nlpTokenMap = useMemo(() => buildNlpTokenMap(nlpTokens), [nlpTokens]);
  const analysis = useMemo(() => analyzeText(text, nlpTokenMap), [text, nlpTokenMap, frenchDataVersion]);
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
      cefrLevel: analysis.cefrExcludedWords.has(word) ? 'Excluded' : getCefrLevelForWord(word, nlpTokenMap),
    })),
    wordFrequencies: analysis.wordCounts.map(({ word, count }) => ({
      word,
      normalizedWord: normalizeFrenchWord(word, nlpTokenMap),
      count,
      cefrLevel: analysis.cefrExcludedWords.has(word) ? 'Excluded' : getCefrLevelForWord(word, nlpTokenMap),
    })),
  }), [analysis, nlpTokenMap, frenchDataVersion]);
  const maxCount = analysis.topWords[0]?.count || 1;
  const cloudWords = analysis.topWords.slice(0, 24);
  const cloudAnimationKey = useMemo(() => getWordCountSignature(cloudWords), [cloudWords]);
  const isAuthenticated = Boolean(session?.user?.id);
  const navLinks = isTopVocabularyPage
    ? [
        { label: '分析器', href: `${homePagePath}#analyzer` },
        { label: 'Top 100', href: topVocabularyPagePath },
      ]
    : links;

  useEffect(() => {
    applySeoMetadata(page);
  }, [page]);

  useEffect(() => {
    const handlePopState = () => setPage(getCurrentPage());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (isTopVocabularyPage) return undefined;

    let isActive = true;
    loadFrenchDataModules().then(() => {
      if (isActive) setFrenchDataVersion((version) => version + 1);
    });

    return () => {
      isActive = false;
    };
  }, [isTopVocabularyPage]);

  useEffect(() => {
    if (!isTopVocabularyPage) return undefined;

    if (!isSupabaseConfigured || !supabase) {
      setGlobalTopVocabulary([]);
      setGlobalTopVocabularyStatus({
        error: 'Supabase 尚未設定，因此目前無法載入全站熱門 100 mots。',
        loading: false,
      });
      return undefined;
    }

    if (!session?.user?.id) {
      setGlobalTopVocabulary([]);
      setGlobalTopVocabularyStatus({
        error: '請先登入以載入全站熱門 100 mots。',
        loading: false,
      });
      return undefined;
    }

    let isActive = true;
    setGlobalTopVocabularyStatus({ error: '', loading: true });

    getGlobalTopWords(100)
      .then((words) => {
        if (isActive) {
          setGlobalTopVocabulary(words);
          setGlobalTopVocabularyStatus({ error: '', loading: false });
        }
      })
      .catch(() => {
        if (isActive) {
          setGlobalTopVocabulary([]);
          setGlobalTopVocabularyStatus({
            error: '目前無法載入全站熱門詞。請確認 Supabase 已套用 get_global_top_words migration。',
            loading: false,
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [isTopVocabularyPage, session?.user?.id]);

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
    if (!frenchNlpApiUrl || !text.trim()) {
      setNlpTokens([]);
      return undefined;
    }

    const nlpText = text.slice(0, frenchNlpMaxTextLength);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      fetch(`${frenchNlpApiUrl.replace(/\/$/, '')}/api/french-tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: nlpText }),
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error('French NLP API request failed');
          return response.json();
        })
        .then((data) => {
          setNlpTokens(Array.isArray(data.tokens) ? data.tokens : []);
        })
        .catch((error) => {
          if (error.name !== 'AbortError') setNlpTokens([]);
        });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [text]);

  useEffect(() => {
    if (!session?.user?.id) {
      setHistory([]);
      return;
    }

    setIsAuthPromptOpen(false);

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
    if (!analysis.unknownReview.pendingDictionary.length) return;

    try {
      await navigator.clipboard.writeText(analysis.unknownReview.json);
      setDictionaryCopyStatus('已複製待補字典 JSON。');
    } catch {
      setDictionaryCopyStatus('複製失敗。');
    }

    window.setTimeout(() => setDictionaryCopyStatus(''), 1800);
  };

  const copyVocabularyCsv = async (vocabulary, eventName = 'top_vocabulary_copy') => {
    if (!vocabulary.length) return;

    const escapeCell = (value) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [
      ['rank', 'word', 'count', 'cefrLevel'].map(escapeCell).join(','),
      ...vocabulary.map((item, index) => [
        index + 1,
        item.word,
        item.count,
        item.cefrLevel,
      ].map(escapeCell).join(',')),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(csv);
      setTopVocabularyCopyStatus('已複製 Top 100 CSV。');
      trackEvent(eventName, { count: vocabulary.length });
    } catch {
      setTopVocabularyCopyStatus('複製失敗。');
    }

    window.setTimeout(() => setTopVocabularyCopyStatus(''), 1800);
  };

  const copyTopVocabulary = () => copyVocabularyCsv(analysis.topVocabulary, 'top_vocabulary_copy');
  const copyGlobalTopVocabulary = () => copyVocabularyCsv(globalTopVocabulary, 'global_top_vocabulary_copy');

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

  if (isTopVocabularyPage) {
    return (
      <>
        <Navbar brand="French" brandHref={homePagePath} links={navLinks} />
        <main className="app-shell top-vocabulary-page" id="home">
          <section className="top-vocabulary-hero" data-reveal>
            <p className="eyebrow">Top 100 mots</p>
            <h1>最常分析的 100 個法文詞。</h1>
            <p>
              這裡彙總所有已儲存分析紀錄的 normalized word，依總出現次數排序並標示 CEFR，
              用來觀察大家最常遇到的法文學習詞。
            </p>
          </section>

          <section className="top-vocabulary-workspace" data-reveal>
            <TopVocabularyPanel
              vocabulary={globalTopVocabulary}
              copyStatus={topVocabularyCopyStatus}
              emptyMessage="目前還沒有全站熱門詞資料。使用者儲存分析後，這裡會開始累積。"
              errorMessage={globalTopVocabularyStatus.error}
              isStandalone
              isLoading={globalTopVocabularyStatus.loading}
              summary={`依全站已儲存分析紀錄彙總 normalized word；目前顯示 ${globalTopVocabulary.length} 個詞。`}
              onCopy={copyGlobalTopVocabulary}
            />
          </section>

          <footer className="site-footer">
            <a href={`${homePagePath}#analyzer`}>回到主分析器</a>
            <a href={homePagePath}>French 詞頻分析器</a>
            <span>聯絡信箱</span>
            <a href="mailto:fishpka@hotmail.com">fishpka@hotmail.com</a>
          </footer>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar brand="French" brandHref={homePagePath} links={navLinks} />
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
                <button type="button" onClick={() => trackEvent('analyze_click')}>
                  分析
                </button>
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
            <Suspense fallback={null}>
              <SaveAnalysisButton
                disabled={!analysis.wordCounts.length}
                session={session}
                snapshot={analysisSnapshot}
                onSaved={() => setHistoryRefreshIndex((index) => index + 1)}
              />
            </Suspense>
          </div>

          <aside className="summary-panel" id="summary">
            <Suspense fallback={null}>
              <AuthPanel session={session} />
              <ExportDataPanel session={session} />
            </Suspense>
          </aside>
        </section>

        <section className="top-vocabulary-banner" aria-labelledby="top-vocabulary-banner-title" data-reveal>
          <div>
            <p className="eyebrow">Vocabulary list</p>
            <h2 id="top-vocabulary-banner-title">需要完整 Top 100 mots？</h2>
            <p>看看大家都在用什麼法文詞？</p>
          </div>
          <a
            className="top-vocabulary-banner__link"
            href={topVocabularyPagePath}
            onClick={() => trackEvent('top_100_banner_click')}
          >
            打開 Top 100
            <ArrowRight size={18} />
          </a>
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
                  <span className="bar-row__word">
                    <span>{item.word}</span>
                    {showChineseGlosses && getChineseGlossForWord(item.word, nlpTokenMap) ? (
                      <small>{getChineseGlossForWord(item.word, nlpTokenMap)}</small>
                    ) : null}
                  </span>
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

        {showActionRecommendations ? (
          <section className="recommendations-panel" id="recommendations" data-reveal>
            <div className="section-title">
              <div>
                <p className="eyebrow">Next actions</p>
                <h2>分析後的行動建議</h2>
              </div>
            </div>
            <div className="recommendation-grid">
              {analysis.recommendations.map((item, index) => (
                <article
                  className="recommendation-card"
                  key={item.id}
                  data-priority={item.priority}
                  style={{ '--index': index }}
                >
                  <div className="recommendation-card__heading">
                    <span>{item.priority}</span>
                    <strong>{item.title}</strong>
                  </div>
                  <p>{item.reason}</p>
                  <p>{item.action}</p>
                  {item.examples.length ? (
                    <div className="recommendation-card__examples">
                      {item.examples.map((example) => (
                        <span key={example}>{example}</span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {showTopVocabulary ? (
          <TopVocabularyPanel
            vocabulary={analysis.topVocabulary}
            copyStatus={topVocabularyCopyStatus}
            emptyMessage="貼上法文文章後，這裡會產生最多 100 個高頻詞。"
            summary={`依 normalized word 統計文章高頻詞，已排除 stopwords；目前顯示 ${analysis.topVocabulary.length} 個詞。`}
            onCopy={copyTopVocabulary}
          />
        ) : null}

        <section className="cefr-panel" id="cefr" data-reveal>
          <div className="section-title">
            <div>
              <p className="eyebrow">CEFR</p>
              <h2>CEFR 詞彙難度分析</h2>
            </div>
          </div>
          {showCefrExcludedNote && analysis.cefrExcludedWordCounts.length ? (
            <p className="cefr-panel__note">
              已排除 {analysis.cefrExcludedWordCounts.length} 個專有名詞、縮寫或非 CEFR 詞：
              {' '}
              {analysis.cefrExcludedWordCounts.slice(0, 8).map(({ word }) => word).join(' · ')}
            </p>
          ) : null}
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
          {showUnknownReview ? (
            <div className="dictionary-builder" aria-labelledby="unknown-review-title">
              <div className="dictionary-builder__heading">
                <div>
                  <p className="eyebrow">Unknown review</p>
                  <h3 id="unknown-review-title">Unknown 詞彙檢查</h3>
                </div>
                <button
                  className="dictionary-builder__copy"
                  type="button"
                  onClick={copyDictionaryDraft}
                  disabled={!analysis.unknownReview.pendingDictionary.length}
                >
                  <Copy size={16} />
                  複製 JSON
                </button>
              </div>
              <div className="unknown-review-grid">
                <article>
                  <span>已排除</span>
                  <strong>{analysis.unknownReview.excluded.length}</strong>
                  <p>專有名詞、縮寫或非 CEFR 候選不納入難度比例。</p>
                  {analysis.unknownReview.excluded.length ? (
                    <div className="dictionary-builder__words">
                      {analysis.unknownReview.excluded.map((item) => (
                        <span key={item.word}>
                          {item.word} <small>{item.reason}</small>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-state">目前沒有明顯需要排除的詞。</p>
                  )}
                </article>
                <article>
                  <span>詞形已還原</span>
                  <strong>{analysis.unknownReview.resolvedForms.length}</strong>
                  <p>這些詞已透過 lemma 或字尾規則對應到 CEFR 詞彙。</p>
                  {analysis.unknownReview.resolvedForms.length ? (
                    <div className="dictionary-builder__words">
                      {analysis.unknownReview.resolvedForms.map((item) => (
                        <span key={`${item.word}-${item.normalizedWord}`}>
                          {item.word}
                          {' -> '}
                          {item.normalizedWord}
                          {' '}
                          <small>{item.cefrLevel}</small>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-state">目前沒有需要顯示的詞形還原。</p>
                  )}
                </article>
                <article>
                  <span>Unknown 診斷</span>
                  <strong>{analysis.unknownReview.diagnostics.length}</strong>
                  <p>逐一檢查 Unknown 詞是否像動詞變位、複數、陰陽性、標點問題或專有名詞。</p>
                  {analysis.unknownReview.diagnostics.length ? (
                    <div className="unknown-diagnostics">
                      {analysis.unknownReview.diagnostics.map((item) => (
                        <div className="unknown-diagnostic" key={item.word}>
                          <div className="unknown-diagnostic__heading">
                            <strong>{item.word}</strong>
                            <small>{item.count}</small>
                          </div>
                          <p>
                            Lemma:
                            {' '}
                            <strong>{item.likelyLemma}</strong>
                            {item.likelyLevel ? ` (${item.likelyLevel})` : ''}
                          </p>
                          <div className="unknown-diagnostic__checks">
                            {item.checks.map((check) => (
                              <span key={`${item.word}-${check.type}`}>
                                <strong>{check.type}</strong>
                                {check.detail}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-state">目前沒有 Unknown 詞需要診斷。</p>
                  )}
                </article>
                <article>
                  <span>待補字典</span>
                  <strong>{analysis.unknownReview.totalPendingCount}</strong>
                  <p>這些詞不是明顯專有名詞，也還沒有 CEFR 分級。</p>
                  {analysis.unknownReview.pendingDictionary.length ? (
                    <>
                      <div className="dictionary-builder__words">
                        {analysis.unknownReview.pendingDictionary.map((item) => (
                          <span key={item.word}>
                            {item.word} <small>{item.count}</small>
                          </span>
                        ))}
                      </div>
                      <pre className="dictionary-builder__json">{analysis.unknownReview.json}</pre>
                    </>
                  ) : (
                    <p className="empty-state">目前沒有需要補進字典的 Unknown 詞。</p>
                  )}
                </article>
              </div>
              {dictionaryCopyStatus ? <small>{dictionaryCopyStatus}</small> : null}
            </div>
          ) : null}
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

        {isAuthenticated ? (
          <Suspense fallback={null}>
            <HistoryDashboard
              history={history}
              isAuthenticated={isAuthenticated}
              isLoading={isHistoryLoading}
              onChanged={() => setHistoryRefreshIndex((index) => index + 1)}
              onRequireAuth={() => setIsAuthPromptOpen(true)}
            />

            <MonthlyComparison
              history={history}
              isAuthenticated={isAuthenticated}
              onRequireAuth={() => setIsAuthPromptOpen(true)}
            />
          </Suspense>
        ) : null}

        <footer className="site-footer">
          <a href={topVocabularyPagePath}>Top 100法文單字</a>
          <span>聯絡信箱</span>
          <a href="mailto:fishpka@hotmail.com">fishpka@hotmail.com</a>
        </footer>
      </main>

      {isAuthPromptOpen && !session?.user?.id ? (
        <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
          <div className="auth-modal__backdrop" onClick={() => setIsAuthPromptOpen(false)} />
          <div className="auth-modal__panel">
            <button
              className="auth-modal__close"
              type="button"
              onClick={() => setIsAuthPromptOpen(false)}
              aria-label="關閉登入視窗"
            >
              ×
            </button>
            <div className="auth-modal__intro">
              <p className="eyebrow">Account</p>
              <h2 id="auth-modal-title">登入後使用歷史比較</h2>
              <p>分析可以直接使用；只有儲存、查看歷史紀錄、比較每月趨勢時才需要登入。</p>
            </div>
            <div className="auth-modal__promo">
              <strong>登入後即可追蹤你的法文成長：</strong>
              <ul>
                <li>保存所有分析紀錄</li>
                <li>比較每月進步趨勢</li>
                <li>查看專屬 French Wrapped 年度報告</li>
                <li>建立個人單字筆記本</li>
              </ul>
            </div>
            <Suspense fallback={null}>
              <AuthPanel session={session} />
            </Suspense>
          </div>
        </div>
      ) : null}
    </>
  );
}
