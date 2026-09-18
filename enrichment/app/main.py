"""FastAPI application exposing POST /api/v1/content/enrich (uc1_specs.md 2.3)."""

from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .models import EnrichmentError, EnrichmentMeta, EnrichmentStatus, EnrichRequest, EnrichResponse
from .obs import configure_logging, request_id_var
from .ratelimit import RateLimiter
from .service import EnrichmentService

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    app.state.settings = settings
    app.state.service = EnrichmentService(settings)
    app.state.rate_limiter = RateLimiter(max_requests=settings.max_requests_per_minute)
    logger.info("enrichment service ready (provider=%s)", app.state.service.provider.name)
    yield
    app.state.service.store.close()


app = FastAPI(
    title="LifeStage Curator Enrichment",
    version="0.1.0",
    description="Tier 1 intelligent content ingestion & enrichment (uc1_specs.md).",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    token = request_id_var.set(request_id)
    try:
        response = await call_next(request)
    finally:
        request_id_var.reset(token)
    response.headers["x-request-id"] = request_id
    return response


def get_service(request: Request) -> EnrichmentService:
    return request.app.state.service


def get_rate_limiter(request: Request) -> RateLimiter:
    return request.app.state.rate_limiter


@app.get("/healthz")
async def healthz(request: Request) -> dict:
    service: EnrichmentService = request.app.state.service
    return {
        "status": "ok",
        "provider": service.provider.name,
        "model": service.provider.model,
        "llm_configured": service.llm_configured,
        "indexed_content": service.store.count(),
        "embedding_duplicates": service.embeddings.available,
    }


@app.post("/api/v1/content/enrich", response_model=EnrichResponse)
async def enrich(
    payload: EnrichRequest,
    request: Request,
    x_request_id: str | None = Header(default=None),
    service: EnrichmentService = Depends(get_service),
    rate_limiter: RateLimiter = Depends(get_rate_limiter),
) -> EnrichResponse | JSONResponse:
    client_key = request.client.host if request.client else "anonymous"
    if not rate_limiter.allow(client_key):
        return JSONResponse(
            status_code=429,
            content={
                "status": "error",
                "enrichment_meta": {"provider": service.provider.name},
                "errors": [{"code": "rate_limited", "message": "Too many requests; try again shortly."}],
            },
        )

    try:
        return await service.enrich(payload, request_id=x_request_id or request_id_var.get())
    except Exception as exc:  # noqa: BLE001 - never leak unhandled errors (uc1_specs.md 2.6)
        logger.exception("unhandled enrichment error")
        return JSONResponse(
            status_code=200,
            content=EnrichResponse(
                status=EnrichmentStatus.error,
                enrichment_meta=EnrichmentMeta(provider=service.provider.name),
                errors=[EnrichmentError(code="internal_error", message=str(exc))],
            ).model_dump(mode="json"),
        )
