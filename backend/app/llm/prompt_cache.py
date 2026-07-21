"""Cached prompt-file reader.

Prompt markdown files were re-read from disk on every LLM stage call (the step
agent alone reads up to 8 rule files per turn). Cache their contents keyed by
path, invalidating on mtime so edits during development are still picked up.
"""

from __future__ import annotations

import os
from pathlib import Path

_CACHE: dict[str, tuple[float, str]] = {}


def read_prompt(path: str | os.PathLike[str]) -> str:
    key = str(path)
    try:
        mtime = os.path.getmtime(key)
    except OSError:
        return Path(key).read_text(encoding="utf-8")
    cached = _CACHE.get(key)
    if cached is not None and cached[0] == mtime:
        return cached[1]
    text = Path(key).read_text(encoding="utf-8")
    _CACHE[key] = (mtime, text)
    return text
