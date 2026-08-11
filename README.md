# French

A local React website for analyzing French articles.

Features:

- Paste French text and analyze it instantly
- Show high-frequency content words
- Render bar charts and a word cloud
- Detect repeated phrases and common B2 argument patterns
- Works fully in the browser without an API
- Optionally calls a local spaCy backend for better French lemmatization and proper noun detection

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## API Configuration And Security

The frontend uses a Supabase anon key, which is expected to be public in browser JavaScript. Do not use a Supabase service-role key in this app.

Required GitHub Pages build variable:

```bash
VITE_SUPABASE_ANON_KEY=<supabase anon public key>
```

Set it in GitHub repository Variables as `VITE_SUPABASE_ANON_KEY`. The deploy workflow intentionally does not include a hardcoded fallback key.

Local development can use `.env`, but `.env` is ignored by git. Keep `.env.example` as the only tracked env template.

Before relying on persistence in production, apply all SQL migrations in `supabase/migrations/`, especially:

```bash
supabase/migrations/004_add_save_analysis_quotas.sql
```

That migration limits save payloads, revokes direct inserts, and restricts the global Top 100 RPC to authenticated users.

## Optional spaCy Backend

The frontend can call a local FastAPI service for French token analysis. This improves CEFR matching for inflected forms and helps filter proper nouns from Unknown/CEFR results.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -m spacy download fr_core_news_sm
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

Configure the frontend:

```bash
VITE_FRENCH_NLP_API_URL=http://127.0.0.1:8000
VITE_FRENCH_NLP_MAX_TEXT_LENGTH=20000
```

Without `VITE_FRENCH_NLP_API_URL`, the app keeps using the browser-only fallback rules.
The optional NLP backend also supports `FRENCH_NLP_API_KEY`, `MAX_TEXT_LENGTH`, `MAX_REQUEST_BYTES`,
`RATE_LIMIT_REQUESTS`, and `RATE_LIMIT_WINDOW_SECONDS` for server-side access control.

## FLELex / Beacco CEFR Vocabulary

The main CEFR vocabulary is generated from the official FLELex / Beacco TreeTagger TSV distributed by CENTAL:

- Source page: https://cental.uclouvain.be/cefrlex/flelex/download/
- Local raw file: `src/data/vendor/FleLex_TT_Beacco.tsv`
- Generated module: `src/data/flelexBeaccoVocabulary.js`
- License: CC BY-NC-SA 4.0

The raw resource is lemma + POS. The generated browser dictionary is `word -> CEFR level`; when a word appears with multiple POS tags, the converter keeps the entry with the highest `freq_total`, using the lower CEFR level as a tie-breaker.

Regenerate the local module after replacing the TSV:

```bash
npm run build:flelex
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
