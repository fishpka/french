import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const chineseLanguageCodes = new Set(['zh', 'cmn', 'zh-hans', 'zh-hant', 'nan', 'yue']);
const sourceRank = {
  seed: 0,
  kaikki: 1,
  word2word: 2,
};

function parseArgs(argv) {
  const options = {
    kaikkiPath: '',
    word2wordPath: '',
    seedPath: 'src/data/frenchChineseGlosses.js',
    outputPath: 'src/data/frenchChineseGlosses.generated.js',
    maxEntries: 5000,
  };

  if (argv.length && !argv[0].startsWith('--')) {
    options.kaikkiPath = argv[0] || '';
    options.outputPath = argv[1] || options.outputPath;
    options.maxEntries = Number(argv[2] || options.maxEntries);
    return options;
  }

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key.startsWith('--')) continue;

    if (key === '--kaikki') options.kaikkiPath = value || '';
    if (key === '--word2word') options.word2wordPath = value || '';
    if (key === '--seed') options.seedPath = value || '';
    if (key === '--out') options.outputPath = value || options.outputPath;
    if (key === '--max') options.maxEntries = Number(value || options.maxEntries);
    index += 1;
  }

  return options;
}

function printUsage() {
  console.error([
    'Usage:',
    '  npm run build:glosses -- --kaikki path/to/kaikki-french.jsonl --word2word path/to/fr-zh.tsv --out src/data/frenchChineseGlosses.generated.js --max 5000',
    '',
    'Inputs:',
    '  --kaikki     Kaikki/Wiktextract French JSONL dump. Used as the primary generated source.',
    '  --word2word  word2word fr->zh export as TSV/CSV/JSON/JSONL. Used to fill missing glosses.',
    '  --seed       Existing curated JS gloss file. Defaults to src/data/frenchChineseGlosses.js.',
    '  --out        Output JS module. Defaults to src/data/frenchChineseGlosses.generated.js.',
    '  --max        Maximum entries. Defaults to 5000.',
  ].join('\n'));
}

function hasChineseText(value) {
  return /[\u3400-\u9fff]/.test(value);
}

function normalizeWord(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeGloss(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[;；/]+/g, '、')
    .trim();
}

function pickGloss(translations) {
  return translations
    .map(normalizeGloss)
    .filter((translation) => translation && translation.length <= 16)
    .slice(0, 2)
    .join('、');
}

function setGloss(entries, word, gloss, source) {
  const normalizedWord = normalizeWord(word);
  const normalizedGloss = normalizeGloss(gloss);
  if (!normalizedWord || !normalizedGloss || !hasChineseText(normalizedGloss)) return;

  const current = entries.get(normalizedWord);
  if (current && sourceRank[current.source] <= sourceRank[source]) return;

  entries.set(normalizedWord, {
    gloss: normalizedGloss,
    source,
  });
}

async function loadSeedGlosses(entries, seedPath) {
  if (!seedPath) return;

  try {
    const source = await readFile(resolve(seedPath), 'utf8');
    const entryPattern = /^\s*(?:"([^"]+)"|'([^']+)'|([A-Za-zÀ-ÖØ-öø-ÿœæŒÆ0-9_'-]+))\s*:\s*(['"])(.*?)\4,?/gmu;
    const glosses = [...source.matchAll(entryPattern)].map((match) => ({
      word: match[1] || match[2] || match[3],
      gloss: match[5],
    }));

    glosses.forEach(({ word, gloss }) => {
      setGloss(entries, word, gloss, 'seed');
    });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

function getKaikkiChineseTranslations(entry) {
  const translations = Array.isArray(entry.translations) ? entry.translations : [];
  return translations
    .filter((translation) => {
      const code = String(translation.code || translation.lang_code || '').toLowerCase();
      const lang = String(translation.lang || '').toLowerCase();
      const word = String(translation.word || '').trim();
      return word && (
        chineseLanguageCodes.has(code)
        || lang.includes('chinese')
        || lang.includes('mandarin')
        || hasChineseText(word)
      );
    })
    .map((translation) => String(translation.word || '').trim())
    .filter(Boolean);
}

async function loadKaikkiGlosses(entries, kaikkiPath, maxEntries) {
  if (!kaikkiPath) return;

  const source = createReadStream(resolve(kaikkiPath), { encoding: 'utf8' });
  const lines = createInterface({ input: source, crlfDelay: Infinity });

  for await (const line of lines) {
    if (!line.trim()) continue;

    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const word = normalizeWord(entry.word);
    if (!word) continue;

    const gloss = pickGloss(getKaikkiChineseTranslations(entry));
    setGloss(entries, word, gloss, 'kaikki');
    if (entries.size >= maxEntries) break;
  }
}

function extractWord2wordPairsFromJson(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractWord2wordPairsFromJson(item));
  }

  if (!value || typeof value !== 'object') return [];

  const word = value.word || value.source || value.src || value.fr || value[0];
  const translations = value.translations || value.targets || value.zh || value.translation || value[1];

  if (Array.isArray(translations)) {
    return translations.map((translation) => [word, translation.word || translation.target || translation]);
  }

  return [[word, translations]];
}

function parseDelimitedWord2wordLine(line) {
  const delimiter = line.includes('\t') ? '\t' : ',';
  const [word, ...rest] = line.split(delimiter);
  return rest
    .join(delimiter)
    .split(/[|,;；/]/)
    .map((translation) => [word, translation]);
}

async function loadWord2wordGlosses(entries, word2wordPath, maxEntries) {
  if (!word2wordPath) return;

  const raw = await readFile(resolve(word2wordPath), 'utf8');
  const trimmed = raw.trim();
  if (!trimmed) return;

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const data = JSON.parse(trimmed);
    extractWord2wordPairsFromJson(data).forEach(([word, translation]) => {
      setGloss(entries, word, translation, 'word2word');
    });
    return;
  }

  trimmed.split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return;

    if (line.trim().startsWith('{')) {
      try {
        extractWord2wordPairsFromJson(JSON.parse(line)).forEach(([word, translation]) => {
          setGloss(entries, word, translation, 'word2word');
        });
      } catch {
        // Fall through to delimited parsing for malformed JSONL rows.
        parseDelimitedWord2wordLine(line).forEach(([word, translation]) => {
          setGloss(entries, word, translation, 'word2word');
        });
      }
      return;
    }

    parseDelimitedWord2wordLine(line).forEach(([word, translation]) => {
      setGloss(entries, word, translation, 'word2word');
    });
  });

  if (entries.size > maxEntries) {
    const sorted = [...entries.entries()].slice(0, maxEntries);
    entries.clear();
    sorted.forEach(([word, entry]) => entries.set(word, entry));
  }
}

function serializeGlosses(entries, maxEntries) {
  const sortedEntries = [...entries.entries()]
    .slice(0, maxEntries)
    .sort(([wordA], [wordB]) => wordA.localeCompare(wordB, 'fr'));

  const body = sortedEntries
    .map(([word, entry]) => `  ${JSON.stringify(word)}: ${JSON.stringify(entry.gloss)},`)
    .join('\n');

  return {
    count: sortedEntries.length,
    output: `const frenchChineseGlosses = {\n${body}\n};\n\nexport default frenchChineseGlosses;\n`,
  };
}

const options = parseArgs(process.argv.slice(2));

if (!options.kaikkiPath && !options.word2wordPath) {
  printUsage();
  process.exit(1);
}

if (!Number.isFinite(options.maxEntries) || options.maxEntries <= 0) {
  throw new Error('--max must be a positive number.');
}

const entries = new Map();

await loadSeedGlosses(entries, options.seedPath);
await loadKaikkiGlosses(entries, options.kaikkiPath, options.maxEntries);
await loadWord2wordGlosses(entries, options.word2wordPath, options.maxEntries);

const { count, output } = serializeGlosses(entries, options.maxEntries);

await mkdir(dirname(resolve(options.outputPath)), { recursive: true });
await writeFile(resolve(options.outputPath), output, 'utf8');

console.log(`Wrote ${count} glosses to ${options.outputPath}`);
