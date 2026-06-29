# French

A local React website for analyzing French articles.

Features:

- Paste French text and analyze it instantly
- Show high-frequency content words
- Render bar charts and a word cloud
- Detect repeated phrases and common B2 argument patterns
- Works fully in the browser without an API

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## French-Chinese Glosses

High-frequency chart glosses use `src/data/frenchChineseGlosses.js`.

To generate a larger local gloss file from a Kaikki/Wiktextract French JSONL dump and a word2word French-to-Chinese export:

```bash
npm run build:glosses -- \
  --kaikki path/to/kaikki-french.jsonl \
  --word2word path/to/fr-zh.tsv \
  --out src/data/frenchChineseGlosses.generated.js \
  --max 5000
```

The script keeps curated entries first, uses Kaikki/Wiktextract as the primary generated source, then uses word2word to fill missing glosses. Review the generated file before replacing the curated gloss file.
