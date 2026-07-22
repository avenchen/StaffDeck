import os as _os
from dataclasses import dataclass
from functools import lru_cache

from pydantic import AliasChoices, AliasGenerator
from pydantic_settings import BaseSettings, SettingsConfigDict


def brand_env(name: str, default: str = "") -> str:
    """Read an OS env var by its brand-neutral suffix.

    Prefers the new ``STAFFDECK_`` prefix, falling back to the legacy
    ``ULTRARAG_`` prefix so existing deployments keep working. Used for the
    bootstrap vars (dotenv path, data dir) that are read before Settings loads.
    """
    for prefix in ("STAFFDECK_", "ULTRARAG_"):
        value = _os.environ.get(f"{prefix}{name}", "").strip()
        if value:
            return value
    return default


def _brand_alias(field_name: str) -> AliasChoices:
    """Accept ``STAFFDECK_<FIELD>`` (preferred), ``ULTRARAG_<FIELD>`` (legacy)
    and the bare ``<FIELD>`` env name (current behaviour), case-insensitively."""
    upper = field_name.upper()
    return AliasChoices(f"STAFFDECK_{upper}", f"ULTRARAG_{upper}", upper)


class Settings(BaseSettings):
    # --- App ---
    app_name: str = "Skill Agent Loop Service"
    database_url: str = "sqlite:///./skill_agent_loop.db"
    app_secret: str = "change-me-in-development"
    tool_timeout_seconds: float = 8.0
    tool_base_url: str = "http://localhost:5173"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # --- Model ---
    demo_model_provider: str = "openai_compatible"
    demo_model_base_url: str = "http://58.57.119.12:52010/v1"
    demo_model_name: str = "qwen3.6-27b"
    demo_model_api_key: str = ""
    model_api_timeout_seconds: float = 600.0
    model_thinking_mode: str = ""
    model_thinking_models: str = ""

    # --- General skill runtime ---
    general_skill_runtime_python: str = ""
    general_skill_runtime_venv: str = ""
    general_skill_runtime_packages: str = "requests,httpx"
    general_skill_runtime_auto_install: bool = True
    general_skill_pip_index_url: str = ""
    general_skill_pip_timeout_seconds: int = 180
    general_skill_network_install: bool = False

    model_config = SettingsConfigDict(
        env_file=brand_env("DOTENV", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        alias_generator=AliasGenerator(validation_alias=_brand_alias),
        populate_by_name=True,
        protected_namespaces=(),
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def normalized_tool_base_url(self) -> str:
        return self.tool_base_url.rstrip("/")

    @property
    def general_skill_runtime_package_list(self) -> list[str]:
        return [item.strip() for item in self.general_skill_runtime_packages.split(",") if item.strip()]

    # --- Domain-grouped views ---
    # Read-only projections that group the flat fields by concern. The flat
    # attributes remain the source of truth (and stay accessible for
    # backward compatibility); these views give callers a scoped surface.
    @property
    def app(self) -> "AppConfig":
        return AppConfig(
            app_name=self.app_name,
            database_url=self.database_url,
            app_secret=self.app_secret,
            tool_timeout_seconds=self.tool_timeout_seconds,
            tool_base_url=self.normalized_tool_base_url,
            cors_origins=tuple(self.cors_origin_list),
        )

    @property
    def model(self) -> "ModelConfig":
        return ModelConfig(
            provider=self.demo_model_provider,
            base_url=self.demo_model_base_url,
            name=self.demo_model_name,
            api_key=self.demo_model_api_key,
            api_timeout_seconds=self.model_api_timeout_seconds,
            thinking_mode=self.model_thinking_mode,
            thinking_models=self.model_thinking_models,
        )

    @property
    def general_skill_runtime(self) -> "GeneralSkillRuntimeConfig":
        return GeneralSkillRuntimeConfig(
            python=self.general_skill_runtime_python,
            venv=self.general_skill_runtime_venv,
            packages=tuple(self.general_skill_runtime_package_list),
            auto_install=self.general_skill_runtime_auto_install,
            pip_index_url=self.general_skill_pip_index_url,
            pip_timeout_seconds=self.general_skill_pip_timeout_seconds,
            network_install=self.general_skill_network_install,
        )


@dataclass(frozen=True)
class AppConfig:
    app_name: str
    database_url: str
    app_secret: str
    tool_timeout_seconds: float
    tool_base_url: str
    cors_origins: tuple[str, ...]


@dataclass(frozen=True)
class ModelConfig:
    provider: str
    base_url: str
    name: str
    api_key: str
    api_timeout_seconds: float
    thinking_mode: str
    thinking_models: str


@dataclass(frozen=True)
class GeneralSkillRuntimeConfig:
    python: str
    venv: str
    packages: tuple[str, ...]
    auto_install: bool
    pip_index_url: str
    pip_timeout_seconds: int
    network_install: bool


@lru_cache
def get_settings() -> Settings:
    return Settings()
