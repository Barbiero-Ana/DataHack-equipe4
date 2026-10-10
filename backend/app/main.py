from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_v1_router, health_router_root
from app.core.config import Settings
from app.core.database import Database


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings if settings is not None else Settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        database = Database(config) if config.database_url is not None else None
        application.state.database = database
        try:
            yield
        finally:
            if database is not None:
                database.dispose()
            application.state.database = None

    application = FastAPI(
        title=config.app_name,
        version="0.1.0",
        description="Fundação da API de inteligência educacional para Mato Grosso.",
        lifespan=lifespan,
    )
    application.state.settings = config
    application.state.database = None
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).rstrip("/") for origin in config.cors_origins],
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["Accept", "Content-Type"],
    )
    application.include_router(health_router_root)
    application.include_router(api_v1_router, prefix=config.api_v1_prefix)
    return application
