# French NLP API

Optional FastAPI backend for French lemmatization, POS tags, and proper noun detection.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -m spacy download fr_core_news_sm
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

Optional API controls:

```bash
FRENCH_NLP_API_KEY=change-me
MAX_TEXT_LENGTH=20000
MAX_REQUEST_BYTES=81024
RATE_LIMIT_REQUESTS=60
RATE_LIMIT_WINDOW_SECONDS=60
CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
```

If `FRENCH_NLP_API_KEY` is set, callers must send it as `X-API-Key` or `Authorization: Bearer ...`.
Do not expose that key in browser JavaScript; use it only from trusted clients or a backend proxy.

Then set the frontend environment variable:

```bash
VITE_FRENCH_NLP_API_URL=http://127.0.0.1:8000
VITE_FRENCH_NLP_MAX_TEXT_LENGTH=20000
```

If the API is not configured or is unavailable, the React app falls back to its local lemma rules.
