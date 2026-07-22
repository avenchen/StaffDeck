"""Declarative module table — the single place that lists what StaffDeck is
made of.

Adding a feature means adding one :class:`AppModule` entry here; the
composition root (``app.main``) stays untouched.

Ordering rules:
- ``chat`` must precede every other module mounting under ``/api/chat/*``
  so FastAPI route matching keeps its historical order.
- Startup hooks run top-to-bottom (database before the scheduled-task
  worker); shutdown hooks run bottom-to-top.
"""

from __future__ import annotations

from sqlmodel import Session

from app.api import (
    agents,
    auth,
    chat,
    departments,
    feedback,
    general_skills,
    knowledge,
    knowledge_bases,
    knowledge_wiki,
    memories,
    mock,
    model_configs,
    persona,
    scheduled_tasks,
    sessions,
    skills,
    tools,
    traces,
    ui_config,
)
from app.async_jobs import shutdown_async_jobs
from app.db import engine, init_db
from app.seed import seed_demo_data
from app.module_registry import AppModule
from app.scheduled_tasks.worker import start_background_worker, stop_background_worker


def _seed_demo_data() -> None:
    with Session(engine) as db:
        seed_demo_data(db)


MODULES: tuple[AppModule, ...] = (
    AppModule(name="database", on_startup=(init_db, _seed_demo_data)),
    AppModule(name="async-jobs", on_shutdown=(shutdown_async_jobs,)),
    AppModule(name="chat", routers=(chat.router,)),
    AppModule(
        name="agents",
        routers=(agents.chat_router, agents.scope_router, agents.enterprise_router),
    ),
    AppModule(
        name="ui-config",
        routers=(ui_config.chat_router, ui_config.enterprise_router),
    ),
    AppModule(name="auth", routers=(auth.router,)),
    AppModule(name="departments", routers=(departments.router,)),
    AppModule(name="general-skills", routers=(general_skills.router,)),
    AppModule(
        name="knowledge",
        routers=(knowledge_bases.router, knowledge.router, knowledge_wiki.router),
    ),
    AppModule(name="skills", routers=(skills.router,)),
    AppModule(name="model-configs", routers=(model_configs.router,)),
    AppModule(name="memories", routers=(memories.router,)),
    AppModule(name="feedback", routers=(feedback.router,)),
    AppModule(name="persona", routers=(persona.router,)),
    AppModule(
        name="scheduled-tasks",
        routers=(
            scheduled_tasks.enterprise_router,
            scheduled_tasks.chat_router,
            scheduled_tasks.chat_draft_router,
        ),
        on_startup=(start_background_worker,),
        on_shutdown=(stop_background_worker,),
    ),
    AppModule(name="tools", routers=(tools.router, tools.mcp_router)),
    AppModule(name="sessions", routers=(sessions.router,)),
    AppModule(name="traces", routers=(traces.router,)),
    AppModule(name="mock", routers=(mock.router,)),
)
