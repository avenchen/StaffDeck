from __future__ import annotations

import pytest

from app.config import (
    AppConfig,
    GeneralSkillRuntimeConfig,
    ModelConfig,
    Settings,
    brand_env,
)


def _clear_env(monkeypatch: pytest.MonkeyPatch, *names: str) -> None:
    for name in names:
        monkeypatch.delenv(name, raising=False)


def test_bare_env_name_still_works(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_env(monkeypatch, "STAFFDECK_DATABASE_URL", "ULTRARAG_DATABASE_URL")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///bare.db")
    settings = Settings(_env_file=None)
    assert settings.database_url == "sqlite:///bare.db"


def test_staffdeck_prefix_takes_priority(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "sqlite:///bare.db")
    monkeypatch.setenv("ULTRARAG_DATABASE_URL", "sqlite:///legacy.db")
    monkeypatch.setenv("STAFFDECK_DATABASE_URL", "sqlite:///branded.db")
    settings = Settings(_env_file=None)
    assert settings.database_url == "sqlite:///branded.db"


def test_ultrarag_prefix_is_compatible(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_env(monkeypatch, "STAFFDECK_APP_SECRET", "APP_SECRET")
    monkeypatch.setenv("ULTRARAG_APP_SECRET", "legacy-secret")
    settings = Settings(_env_file=None)
    assert settings.app_secret == "legacy-secret"


def test_brand_env_prefers_staffdeck(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ULTRARAG_DATA_DIR", "/legacy")
    monkeypatch.setenv("STAFFDECK_DATA_DIR", "/branded")
    assert brand_env("DATA_DIR") == "/branded"


def test_brand_env_falls_back_to_ultrarag(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_env(monkeypatch, "STAFFDECK_DATA_DIR")
    monkeypatch.setenv("ULTRARAG_DATA_DIR", "/legacy")
    assert brand_env("DATA_DIR") == "/legacy"
    _clear_env(monkeypatch, "ULTRARAG_DATA_DIR")
    assert brand_env("DATA_DIR", "fallback") == "fallback"


def test_domain_views_project_flat_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("DATABASE_URL", "DEMO_MODEL_NAME", "GENERAL_SKILL_RUNTIME_PACKAGES"):
        _clear_env(monkeypatch, name, f"STAFFDECK_{name}", f"ULTRARAG_{name}")
    settings = Settings(_env_file=None)
    assert isinstance(settings.app, AppConfig)
    assert isinstance(settings.model, ModelConfig)
    assert isinstance(settings.general_skill_runtime, GeneralSkillRuntimeConfig)
    assert settings.app.database_url == settings.database_url
    assert settings.model.name == settings.demo_model_name
    assert settings.general_skill_runtime.packages == tuple(
        settings.general_skill_runtime_package_list
    )
