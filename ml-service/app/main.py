"""WorldSphere ML service: conservation-risk model + dataset insights only.

Accounts, favorites, AI chat and PostgreSQL live in ../server.

Run from the ml-service directory:

    python model/train.py
    uvicorn app.main:app --reload --port 8001
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.config import parse_cors_origins
from app.schemas import PredictionRequest, PredictionResponse, InsightsResponse
from app.service import Model

app = FastAPI(title="WorldSphere ML Service", version="1.0.0")

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_cors_origins(),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

model = Model()

_NOT_TRAINED = "Model not trained yet. Run: python model/train.py"


@app.get("/health")
def health(response: Response) -> dict:
    if not model.ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "ok" if model.ready else "degraded", "model_ready": model.ready}


@app.post("/predict", response_model=PredictionResponse)
def predict(req: PredictionRequest) -> dict:
    if not model.ready:
        raise HTTPException(status_code=503, detail=_NOT_TRAINED)
    return model.predict(req.model_dump(by_alias=True))


@app.get("/insights", response_model=InsightsResponse)
def insights() -> dict:
    if not model.ready:
        raise HTTPException(status_code=503, detail=_NOT_TRAINED)
    return model.insights()
