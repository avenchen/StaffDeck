from __future__ import annotations

from app.llm.client import LLMClient
from app.llm.providers import GEMINI_OPENAI_BASE_URL, resolve_base_url


def test_resolve_base_url_prefers_explicit() -> None:
    assert resolve_base_url("gemini", "https://custom/v1") == "https://custom/v1"


def test_resolve_base_url_gemini_default() -> None:
    assert resolve_base_url("gemini", None) == GEMINI_OPENAI_BASE_URL
    assert resolve_base_url("Gemini", "") == GEMINI_OPENAI_BASE_URL
    assert resolve_base_url("google", "  ") == GEMINI_OPENAI_BASE_URL


def test_resolve_base_url_unknown_provider_empty() -> None:
    assert resolve_base_url("openai_compatible", None) == ""
    assert resolve_base_url("", None) == ""


def test_llm_client_uses_gemini_base_url(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class _FakeClient:
        pass

    monkeypatch.setattr("app.llm.client.decrypt_secret", lambda _v: "api-key")
    monkeypatch.setattr(
        "app.llm.client.OpenAI",
        lambda **kwargs: captured.update(kwargs) or _FakeClient(),
    )
    monkeypatch.setattr(
        "app.llm.client.get_settings",
        lambda: type("S", (), {"model_api_timeout_seconds": 600.0,
                               "model_thinking_mode": "", "model_thinking_models": ""})(),
    )
    model_config = type(
        "ModelConfig",
        (),
        {
            "api_key_encrypted": "enc",
            "provider": "gemini",
            "base_url": None,
            "model": "gemini-2.5-flash",
            "temperature": 0.2,
            "max_output_tokens": 256,
            "extra_body_json": {},
        },
    )()

    client = LLMClient(model_config)
    assert client.base_url == GEMINI_OPENAI_BASE_URL
    assert captured["base_url"] == GEMINI_OPENAI_BASE_URL
