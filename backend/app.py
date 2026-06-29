import os

import spacy
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


NLP_MODEL = os.getenv("SPACY_MODEL", "fr_core_news_sm")
MAX_TEXT_LENGTH = int(os.getenv("MAX_TEXT_LENGTH", "20000"))
DEFAULT_ORIGINS = (
    "http://127.0.0.1:5173,"
    "http://127.0.0.1:5174,"
    "http://localhost:5173,"
    "http://localhost:5174"
)
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", DEFAULT_ORIGINS).split(",")
    if origin.strip()
]

nlp = spacy.load(NLP_MODEL)
app = FastAPI(title="French NLP API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    text: str


@app.get("/health")
def health():
    return {"ok": True, "model": NLP_MODEL}


@app.post("/api/french-tokens")
def french_tokens(payload: AnalyzeRequest):
    doc = nlp(payload.text[:MAX_TEXT_LENGTH])
    return {
        "tokens": [
            {
                "text": token.text,
                "lemma": token.lemma_,
                "pos": token.pos_,
                "is_alpha": token.is_alpha,
                "is_stop": token.is_stop,
                "is_proper_noun": token.pos_ == "PROPN",
            }
            for token in doc
        ]
    }
