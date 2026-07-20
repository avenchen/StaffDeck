"""Minimal-component contract for composing the FastAPI application.

Each business module registers itself as an :class:`AppModule` in
``app.modules``. The composition root (``app.main``) only walks the module
table — it never imports business internals directly.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass, field

from fastapi import APIRouter, FastAPI


@dataclass(frozen=True)
class AppModule:
    """One self-contained feature unit: routers plus lifecycle hooks."""

    name: str
    routers: tuple[APIRouter, ...] = ()
    on_startup: tuple[Callable[[], None], ...] = ()
    on_shutdown: tuple[Callable[[], None], ...] = ()


def install_modules(app: FastAPI, modules: Iterable[AppModule]) -> None:
    """Mount every module's routers in declaration order.

    Declaration order is the FastAPI route-matching order, so modules whose
    prefixes nest inside another module's prefix (e.g. ``/api/chat/agents``
    under ``/api/chat``) must be declared after it.
    """
    for module in modules:
        for router in module.routers:
            app.include_router(router)


def run_startup(modules: Iterable[AppModule]) -> None:
    for module in modules:
        for hook in module.on_startup:
            hook()


def run_shutdown(modules: Iterable[AppModule]) -> None:
    """Run shutdown hooks in reverse module order (LIFO, mirroring startup)."""
    for module in reversed(list(modules)):
        for hook in reversed(module.on_shutdown):
            hook()
