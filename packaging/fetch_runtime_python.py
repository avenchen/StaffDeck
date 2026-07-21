# packaging/fetch_runtime_python.py
# 用法: python packaging/fetch_runtime_python.py <dest_dir> [--expect-arch arm64|x86_64]
#
# 下載對應平臺的 python-build-standalone（install_only 變體自帶 pip），
# 預裝通用技能高頻包後，供 build 腳本拷進最終產物的 runtime/ 目錄。
import os
import platform
import subprocess
import sys
import tarfile
import urllib.request
from pathlib import Path

for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")

# 已知穩定 release（執行前用 curl -sI 核實資產可達；失效則更新此處並同步 docs）
BASE = "https://github.com/astral-sh/python-build-standalone/releases/download/20240415"
ASSETS = {
    ("Darwin", "arm64"): "cpython-3.11.9+20240415-aarch64-apple-darwin-install_only.tar.gz",
    ("Darwin", "x86_64"): "cpython-3.11.9+20240415-x86_64-apple-darwin-install_only.tar.gz",
    ("Linux", "x86_64"): "cpython-3.11.9+20240415-x86_64-unknown-linux-gnu-install_only.tar.gz",
    ("Windows", "AMD64"): "cpython-3.11.9+20240415-x86_64-pc-windows-msvc-install_only.tar.gz",
}
# 預裝清單（第一版）：含 Word(python-docx) / Excel(openpyxl) 處理；不預裝 pandas/numpy（體積大，用戶需要時聯網裝）
PRELOAD = ["requests", "httpx", "beautifulsoup4", "lxml", "python-docx",
           "openpyxl", "python-dateutil"]

# 架構別名歸一：Windows 返回 AMD64，mac/linux 返回 x86_64/arm64/aarch64
ARCH_ALIASES = {
    "amd64": "x86_64", "x86_64": "x86_64", "x64": "x86_64",
    "arm64": "arm64", "aarch64": "arm64",
}


def _norm_arch(value: str) -> str:
    return ARCH_ALIASES.get(value.lower(), value.lower())


def _machine() -> str:
    machine = platform.machine() or os.environ.get("PROCESSOR_ARCHITECTURE", "")
    if machine:
        return machine
    if platform.system() == "Windows" and sys.maxsize > 2**32:
        return "AMD64"
    return machine


def main(argv: list[str]) -> int:
    dest = argv[0]
    expect_arch = None
    if "--expect-arch" in argv:
        expect_arch = argv[argv.index("--expect-arch") + 1]

    key = (platform.system(), _machine())
    if key not in ASSETS:
        print(f"不支持的平臺/架構: {key}", file=sys.stderr)
        return 3
    # 確保附帶 Python 架構與 PyInstaller 產物架構一致（歸一化後比較）
    if expect_arch and _norm_arch(expect_arch) != _norm_arch(key[1]):
        print(f"架構不匹配: 期望 {expect_arch}, 實際 {key[1]}", file=sys.stderr)
        return 4

    asset = ASSETS[key]
    dest_dir = Path(dest)
    # 清理舊殘留，保證乾淨解壓（避免重複運行時 pip/site-packages 半升級損壞）
    if dest_dir.exists():
        import shutil
        shutil.rmtree(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    tgz = dest_dir / asset
    print(f"下載 {BASE}/{asset} ...")
    urllib.request.urlretrieve(f"{BASE}/{asset}", tgz)
    with tarfile.open(tgz) as tar:
        tar.extractall(dest_dir)
    py = dest_dir / "python" / ("python.exe" if key[0] == "Windows" else "bin/python3")

    # install_only 變體自帶 pip（24.0），直接裝預裝包；不升級 pip（升級易觸發 resolvelib 半損壞）
    subprocess.run(
        [
            str(py), "-m", "pip", "install",
            "--no-cache-dir", "--disable-pip-version-check",
            "--timeout", "30", "--retries", "5",
            *PRELOAD,
        ],
        check=True,
    )

    # 驗證附帶 Python 的 SSL 證書 + 關鍵包可用（否則技能裡 https/word/excel 會失敗）
    check = subprocess.run(
        [str(py), "-c",
         "import ssl, requests, docx, openpyxl; "
         "print(ssl.get_default_verify_paths().cafile or 'certifi')"],
        capture_output=True, text=True,
    )
    if check.returncode != 0:
        print(f"附帶 Python 自檢失敗（ssl/requests/docx/openpyxl）：{check.stderr}", file=sys.stderr)
        return 5
    print(f"runtime ready at {py} (ssl: {check.stdout.strip()})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
