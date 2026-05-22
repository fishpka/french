import { useMemo, useState } from 'react';
import { BarChart3, Copy, FileText, RefreshCcw, Sparkles } from 'lucide-react';
import Navbar from './components/Navbar.jsx';

const links = [
  { label: '分析器', href: '#analyzer' },
  { label: '圖表', href: '#charts' },
  { label: '句型', href: '#patterns' },
  { label: '摘要', href: '#summary' },
];

const sampleText = `Aujourd'hui, les réseaux sociaux occupent une place importante dans notre vie quotidienne. Je pense que cette évolution peut être positive, car elle permet aux personnes de communiquer plus rapidement et de partager des informations.

Cependant, il faut aussi faire attention aux risques. Par exemple, certaines personnes passent trop de temps sur Internet, ce qui peut entraîner des problèmes de santé, de concentration et de relations sociales. À mon avis, il est important de trouver un équilibre.

D'abord, les réseaux sociaux peuvent aider les jeunes à s'informer et à découvrir de nouvelles idées. Ensuite, ils permettent de garder le contact avec la famille et les amis. De plus, ils peuvent être utiles pour le travail ou les études.

En revanche, les fausses informations circulent très vite. Il faut donc développer un esprit critique. En conclusion, les réseaux sociaux ne sont ni totalement bons ni totalement mauvais : tout dépend de la manière dont on les utilise.`;

const stopwords = new Set([
  'a', 'afin', 'ai', 'ainsi', 'alors', 'au', 'aucun', 'aussi', 'autre', 'aux', 'avec',
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

function normalizeWord(word) {
  return word.toLowerCase().replace(/[’]/g, "'").replace(/^['-]+|['-]+$/g, '');
}

function tokenize(text) {
  const matches = text.match(/[a-zàâäçéèêëîïôöùûüÿñæœ]+(?:[’'-][a-zàâäçéèêëîïôöùûüÿñæœ]+)*/gi);
  return matches ? matches.map(normalizeWord).filter((word) => word.length > 1) : [];
}

function countItems(items) {
  const map = new Map();
  items.forEach((item) => map.set(item, (map.get(item) || 0) + 1));
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
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

function analyzeText(text) {
  const words = tokenize(text);
  const contentWords = words.filter((word) => !stopwords.has(word) && word.length >= 3);
  const topWords = countItems(contentWords).slice(0, 24).map(([word, count]) => ({ word, count }));
  const allWordCounts = countItems(words);
  const repeatedPhrases = getNgrams(words);
  const sentenceStarts = getSentenceStarts(text);
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
    topWords,
    allWordCounts,
    repeatedPhrases,
    sentenceStarts,
    patternMatches,
    sentenceCount: text.split(/[.!?。！？]+/).filter((sentence) => sentence.trim()).length,
    uniqueCount: new Set(contentWords).size,
  };
}

export default function App() {
  const [text, setText] = useState(sampleText);
  const analysis = useMemo(() => analyzeText(text), [text]);
  const maxCount = analysis.topWords[0]?.count || 1;
  const density = analysis.words.length ? Math.round((analysis.uniqueCount / analysis.contentWords.length) * 100) : 0;

  return (
    <>
      <Navbar brand="LexiScope" links={links} />
      <main className="app-shell">
        <section className="intro" id="analyzer">
          <div className="intro__copy">
            <p className="eyebrow">French frequency studio</p>
            <h1>貼上法文文章，自動找出高頻詞與重複句型。</h1>
            <p>
              適合 B1-C1 作文、口說稿與新聞文章。工具會過濾常見虛詞，保留更有學習價值的主題詞，
              並抓出常用論述句型。
            </p>
          </div>
          <div className="visual-strip" aria-label="Analysis preview">
            {analysis.topWords.slice(0, 8).map((item, index) => (
              <span key={item.word} style={{ '--height': `${34 + index * 7}px` }}>
                {item.word}
              </span>
            ))}
          </div>
        </section>

        <section className="workspace">
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
          </div>

          <aside className="summary-panel" id="summary">
            <p className="eyebrow">Summary</p>
            <div className="metric-grid">
              <article>
                <FileText size={18} />
                <span>總詞數</span>
                <strong>{analysis.words.length}</strong>
              </article>
              <article>
                <Sparkles size={18} />
                <span>內容詞</span>
                <strong>{analysis.contentWords.length}</strong>
              </article>
              <article>
                <BarChart3 size={18} />
                <span>不同詞</span>
                <strong>{analysis.uniqueCount}</strong>
              </article>
              <article>
                <span>句子</span>
                <strong>{analysis.sentenceCount}</strong>
                <small>詞彙密度 {Number.isFinite(density) ? density : 0}%</small>
              </article>
            </div>
          </aside>
        </section>

        <section className="analysis-grid" id="charts">
          <section className="chart-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Chart</p>
                <h2>高頻詞圖表</h2>
              </div>
            </div>
            <div className="bar-chart">
              {analysis.topWords.slice(0, 12).map((item) => (
                <div className="bar-row" key={item.word}>
                  <span>{item.word}</span>
                  <div className="bar-track">
                    <div style={{ width: `${(item.count / maxCount) * 100}%` }} />
                  </div>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="cloud-panel">
            <p className="eyebrow">Word cloud</p>
            <div className="word-cloud">
              {analysis.topWords.map((item, index) => (
                <span
                  key={item.word}
                  style={{
                    '--size': `${0.86 + (item.count / maxCount) * 1.7}rem`,
                    '--tone': index % 5,
                  }}
                >
                  {item.word}
                </span>
              ))}
            </div>
          </section>
        </section>

        <section className="patterns" id="patterns">
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
      </main>
    </>
  );
}
