from __future__ import annotations

import os
import sys
from pathlib import Path


def is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def app_root() -> Path:
    # 開發態：backend/ 目錄（app/paths.py 的上上級）
    return Path(__file__).resolve().parents[1]


def resource_dir() -> Path:
    if is_frozen():
        return Path(getattr(sys, "_MEIPASS"))
    return app_root()


def user_data_dir() -> Path:
    # 環境變量前綴保留 ULTRARAG_（內部標識，不改）；目錄名用對外品牌 StaffDeck
    override = os.environ.get("ULTRARAG_DATA_DIR", "").strip()
    if override:
        base = Path(override).expanduser()
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support" / "StaffDeck"
    elif sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", Path.home())) / "StaffDeck"
    else:
        base = Path.home() / ".local" / "share" / "StaffDeck"
    base.mkdir(parents=True, exist_ok=True)
    return base
