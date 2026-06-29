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

Then set the frontend environment variable:

```bash
VITE_FRENCH_NLP_API_URL=http://127.0.0.1:8000
```

If the API is not configured or is unavailable, the React app falls back to its local lemma rules.
