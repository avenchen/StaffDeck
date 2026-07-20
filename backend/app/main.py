from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.module_registry import install_modules, run_shutdown, run_startup
from app.modules import MODULES


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        run_startup(MODULES)
        yield
        run_shutdown(MODULES)

    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.get("/api/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok", "app": "StaffDeck"}

    install_modules(application, MODULES)
    return application


app = create_app()
