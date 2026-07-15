# AGENTS.md

## Project Overview

This project is a Vite + React single-page app for analyzing French articles. It runs primarily in the browser and can optionally call a local FastAPI/spaCy backend for better French lemmatization, POS tagging, and proper noun detection.

The app is deployed under the `/french/` base path, so asset and route changes must keep GitHub Pages-style subpath deployment in mind.

## Project Structure

- `src/App.jsx` - main analyzer UI and core text-analysis logic: tokenization, stopword filtering, CEFR lookup, phrase detection, charts, history wiring, and feature visibility flags.
- `src/main.jsx` - React entry point.
- `src/styles.css` - global styles for the analyzer and dashboard UI.
- `src/components/` - reusable UI sections:
  - `Navbar.jsx`
  - `AuthPanel.jsx`
  - `SaveAnalysisButton.jsx`
  - `HistoryDashboard.jsx`
  - `MonthlyComparison.jsx`
  - `ExportDataPanel.jsx`
- `src/lib/` - integrations and persistence helpers:
  - `supabaseClient.js` - optional Supabase client setup from Vite env vars.
  - `analysisPersistence.js` - save/read/delete/export analysis sessions, including RPC fallback handling.
  - `analytics.js` - Umami event tracking wrapper.
- `src/data/` - local lexical resources:
  - `cefrVocabulary.js` - combined CEFR dictionary consumed by the analyzer.
  - `flelexBeaccoVocabulary.js` - generated FLELex / Beacco CEFR vocabulary.
  - `frenchLemmaMap.js` - local fallback lemma map.
  - `frenchChineseGlosses.js` - curated French-Chinese glosses.
  - `vendor/FleLex_TT_Beacco.tsv` - raw FLELex / Beacco source TSV.
- `scripts/` - data generation scripts:
  - `buildFlelexBeaccoVocabulary.mjs`
  - `buildFrenchChineseGlosses.mjs`
- `backend/` - optional FastAPI NLP service:
  - `app.py` - `/health` and `/api/french-tokens`.
  - `requirements.txt`
  - `README.md`
- `supabase/migrations/` - database schema and RPC migration SQL.
- `public/` - static assets, SEO files, and legacy vocabulary assets.
- `vite.config.js` - Vite config with `base: '/french/'`.

## Tech Stack

- Frontend: React, Vite, plain CSS.
- Icons: `lucide-react`.
- Persistence/auth: optional Supabase via `@supabase/supabase-js`.
- Analytics: optional Umami via `window.umami`.
- Optional NLP backend: FastAPI, spaCy, `fr_core_news_sm`.
- Deployment assumption: static build served from `/french/`.

## Environment Variables

Copy `.env.example` to `.env` when local integrations are needed.

- `VITE_SUPABASE_URL` - Supabase project URL.
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key.
- `VITE_FRENCH_NLP_API_URL` - optional local NLP API origin, for example `http://127.0.0.1:8000`.
- `VITE_FRENCH_NLP_MAX_TEXT_LENGTH` - maximum characters sent to the optional NLP API.

Backend-only NLP API controls:

- `FRENCH_NLP_API_KEY` - optional API key required by the FastAPI backend.
- `MAX_TEXT_LENGTH` - maximum text characters accepted by the backend.
- `MAX_REQUEST_BYTES` - maximum request body size accepted by the backend.
- `RATE_LIMIT_REQUESTS` and `RATE_LIMIT_WINDOW_SECONDS` - per-client in-memory rate limit.

The app must continue to work without these variables. Supabase and spaCy backend support are optional.

## Change Guidelines

- Keep `vite.config.js` `base: '/french/'` unless the deployment target changes.
- Preserve the browser-only fallback path. Do not make Supabase or the NLP backend mandatory for core analysis.
- Keep tokenization, stopword filtering, `normalizeFrenchWord`, lemma lookup, and CEFR lookup behavior consistent when adding analysis features.
- If changing CEFR behavior, check both direct word lookup and normalized/lemma lookup. CEFR lookup should use lowercased normalized words.
- Be careful with feature flags in `src/App.jsx`:
  - `showTopVocabulary`
  - `showActionRecommendations`
  - `showUnknownReview`
  - `showCefrExcludedNote`
  - `showChineseGlosses`
- Do not re-enable hidden UI sections unless explicitly requested.
- Avoid committing generated data changes unless the source or generation rule changed intentionally.
- When editing generated lexical files, prefer changing the source TSV/script and regenerating instead of manual edits.
- Keep Supabase persistence compatible with both the `save_analysis_session` RPC and the direct insert fallback in `analysisPersistence.js`.
- Keep backend CORS origins aligned with local Vite ports if changing dev server defaults.
- Use ASCII for new code/comments unless the file already uses non-ASCII content or user-facing Traditional Chinese/French text is required.

## Data Generation

Regenerate FLELex / Beacco vocabulary after replacing `src/data/vendor/FleLex_TT_Beacco.tsv`:

```bash
npm run build:flelex
```

Generate a larger French-Chinese gloss file from Kaikki/Wiktextract and word2word sources:

```bash
npm run build:glosses -- \
  --kaikki path/to/kaikki-french.jsonl \
  --word2word path/to/fr-zh.tsv \
  --out src/data/frenchChineseGlosses.generated.js \
  --max 5000
```

Review generated glosses before replacing `src/data/frenchChineseGlosses.js`.

## Local Development

Install dependencies:

```bash
npm install
```

Run the frontend:

```bash
npm run dev
```

Run the optional NLP backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -m spacy download fr_core_news_sm
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

Then set:

```bash
VITE_FRENCH_NLP_API_URL=http://127.0.0.1:8000
```

## Acceptance Commands

Run these before handing off frontend changes:

```bash
npm run build
```

For changes to lexical generation:

```bash
npm run build:flelex
npm run build
```

For gloss generation changes, run the relevant `npm run build:glosses -- ...` command with local source files, then review the generated output and run:

```bash
npm run build
```

For backend changes, from `backend/`:

```bash
python3 -m py_compile app.py
uvicorn app:app --host 127.0.0.1 --port 8000
```

Then verify:

```bash
curl -I http://127.0.0.1:8000/health
```

## Manual QA Checklist

- Paste a French article and click Analyze.
- Confirm top words, CEFR summary, repeated phrases, charts, and sentence metrics render.
- Confirm common stopwords such as `c'est` and `d'un` are excluded from content-word results.
- Confirm Unknown review and Top 100 vocabulary sections stay hidden unless explicitly enabled.
- If `VITE_FRENCH_NLP_API_URL` is configured, confirm analysis still succeeds when the backend is available.
- If no env vars are configured, confirm the app still works in browser-only mode.
- If Supabase env vars are configured, test saving, history, monthly comparison, export, and delete flows.

## Notes For Future Agents

- This repository may contain generated static assets and large vocabulary files. Keep diffs scoped and explain generated-file churn.
- There is no configured lint script in `package.json`; `npm run build` is the primary frontend validation command.
- Network-dependent actions such as pushing to GitHub or fetching external data may need explicit approval in sandboxed environments.
