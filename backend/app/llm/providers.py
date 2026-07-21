"""LLM provider registry.

StaffDeck talks to every model through the OpenAI-compatible Chat Completions
API. Providers that expose such an endpoint (OpenAI, Google Gemini, …) only
differ by base URL, so a known provider can default its base URL and let the
user leave the field blank.
"""

from __future__ import annotations

# Google Gemini's OpenAI-compatible endpoint.
GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

PROVIDER_DEFAULT_BASE_URLS: dict[str, str] = {
    "gemini": GEMINI_OPENAI_BASE_URL,
    "google": GEMINI_OPENAI_BASE_URL,
    "google_gemini": GEMINI_OPENAI_BASE_URL,
}


def resolve_base_url(provider: str | None, base_url: str | None) -> str:
    """Return the effective base URL.

    An explicit ``base_url`` always wins; otherwise a known provider supplies
    its default. Unknown providers with no base URL return an empty string,
    preserving the previous behaviour (the OpenAI SDK then uses its default).
    """
    if base_url and base_url.strip():
        return base_url.strip()
    return PROVIDER_DEFAULT_BASE_URLS.get((provider or "").strip().lower(), "")
