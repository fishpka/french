import os
import time
from collections import defaultdict, deque

import spacy
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


NLP_MODEL = os.getenv("SPACY_MODEL", "fr_core_news_sm")
MAX_TEXT_LENGTH = int(os.getenv("MAX_TEXT_LENGTH", "20000"))
MAX_REQUEST_BYTES = int(os.getenv("MAX_REQUEST_BYTES", str((MAX_TEXT_LENGTH * 4) + 1024)))
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "60"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
API_KEY = os.getenv("FRENCH_NLP_API_KEY", "").strip()
DEFAULT_ORIGINS = (
    "http://127.0.0.1:5173,"
    "http://127.0.0.1:5174,"
    "http://127.0.0.1:5175,"
    "http://localhost:5173,"
    "http://localhost:5174,"
    "http://localhost:5175"
)
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", DEFAULT_ORIGINS).split(",")
    if origin.strip()
]

nlp = spacy.load(NLP_MODEL)
app = FastAPI(title="French NLP API")
request_log = defaultdict(deque)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_TEXT_LENGTH)


def validate_api_key(request: Request):
    if not API_KEY:
        return

    api_key = request.headers.get("x-api-key", "")
    authorization = request.headers.get("authorization", "")
    bearer_prefix = "Bearer "
    bearer_token = authorization[len(bearer_prefix):] if authorization.startswith(bearer_prefix) else ""

    if api_key != API_KEY and bearer_token != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key.",
        )


def enforce_rate_limit(request: Request):
    now = time.monotonic()
    client_host = request.client.host if request.client else "unknown"
    timestamps = request_log[client_host]
    cutoff = now - RATE_LIMIT_WINDOW_SECONDS

    while timestamps and timestamps[0] < cutoff:
        timestamps.popleft()

    if len(timestamps) >= RATE_LIMIT_REQUESTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded.",
        )

    timestamps.append(now)


@app.middleware("http")
async def reject_large_requests(request: Request, call_next):
    content_length = request.headers.get("content-length")

    if content_length and content_length.isdigit() and int(content_length) > MAX_REQUEST_BYTES:
        return JSONResponse(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            content={"detail": "Request body is too large."},
        )

    return await call_next(request)


@app.get("/health")
def health():
    return {"ok": True, "model": NLP_MODEL}


@app.post("/api/french-tokens")
def french_tokens(payload: AnalyzeRequest, request: Request):
    validate_api_key(request)
    enforce_rate_limit(request)

    doc = nlp(payload.text)
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
