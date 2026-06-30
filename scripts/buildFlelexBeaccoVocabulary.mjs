import fs from 'node:fs';
import path from 'node:path';

const defaultInput = 'src/data/vendor/FleLex_TT_Beacco.tsv';
const defaultOutput = 'src/data/flelexBeaccoVocabulary.js';
const cefrLevelOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const cefrLevels = new Set(cefrLevelOrder);

function parseArgs(argv) {
  const options = {
    input: defaultInput,
    output: defaultOutput,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') options.input = argv[++index];
    if (arg === '--out') options.output = argv[++index];
  }

  return options;
}

function normalizeWord(word) {
  return word.toLowerCase().replace(/[’]/g, "'").trim();
}

function parseTsv(content) {
  const rows = content.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const header = rows.shift().split('\t');
  const wordIndex = header.indexOf('word');
  const levelIndex = header.indexOf('level');
  const totalFrequencyIndex = header.indexOf('freq_total');

  if (wordIndex === -1 || levelIndex === -1) {
    throw new Error('FLELex TSV must include word and level columns.');
  }

  const entries = new Map();

  rows.forEach((row) => {
    const columns = row.split('\t');
    const word = normalizeWord(columns[wordIndex] || '');
    const level = columns[levelIndex]?.trim();
    const totalFrequency = Number.parseFloat(columns[totalFrequencyIndex] || '0');

    if (!word || !cefrLevels.has(level)) return;

    const current = entries.get(word);
    const isBetterEntry = !current
      || totalFrequency > current.totalFrequency
      || (
        totalFrequency === current.totalFrequency
        && cefrLevelOrder.indexOf(level) < cefrLevelOrder.indexOf(current.level)
      );

    if (isBetterEntry) {
      entries.set(word, { level, totalFrequency });
    }
  });

  return [...entries.entries()]
    .map(([word, entry]) => [word, entry.level])
    .sort(([wordA], [wordB]) => wordA.localeCompare(wordB, 'fr'));
}

function buildModule(entries, sourcePath) {
  const objectBody = entries
    .map(([word, level]) => `  ${JSON.stringify(word)}: ${JSON.stringify(level)},`)
    .join('\n');

  return `// Generated from ${sourcePath}.\n// Source: FLELex / Beacco, CENTAL, CC BY-NC-SA 4.0.\n\nconst flelexBeaccoVocabulary = {\n${objectBody}\n};\n\nexport default flelexBeaccoVocabulary;\n`;
}

const options = parseArgs(process.argv.slice(2));
const inputPath = path.resolve(options.input);
const outputPath = path.resolve(options.output);
const content = fs.readFileSync(inputPath, 'utf8');
const entries = parseTsv(content);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, buildModule(entries, options.input));

console.log(`Generated ${entries.length} FLELex / Beacco CEFR entries at ${options.output}`);
