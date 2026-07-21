#!/usr/bin/env bash
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"
VERSION="${VERSION:-0.1.0}"
ARCH="$(uname -m)"
MAC_SIGN_ID="${MAC_SIGN_ID:-}"
NOTARY_PROFILE="${NOTARY_PROFILE:-}"
NOTARY_KEYCHAIN="${NOTARY_KEYCHAIN:-}"

sign_code() {
  local target="$1"
  if [ -n "$MAC_SIGN_ID" ]; then
    codesign --force --timestamp --options runtime --sign "$MAC_SIGN_ID" "$target"
  else
    codesign --force --timestamp=none --sign - "$target" 2>/dev/null || true
  fi
}

sign_app_bundle() {
  local app="$1"
  xattr -cr "$app" 2>/dev/null || true
  if [ -n "$MAC_SIGN_ID" ]; then
    echo "使用 Developer ID 簽名"
    python3 - "$app" <<'PY' | while IFS= read -r item; do
import subprocess
import sys
from pathlib import Path

app = Path(sys.argv[1])
items = []
for path in app.rglob("*"):
    if not path.is_file() or path.is_symlink():
        continue
    try:
        desc = subprocess.check_output(["file", str(path)], text=True, stderr=subprocess.DEVNULL)
    except Exception:
        continue
    if "Mach-O" in desc:
        items.append(path)

for path in sorted(items, key=lambda p: len(p.parts), reverse=True):
    print(path)
PY
      sign_code "$item"
    done
  else
    echo "未配置 MAC_SIGN_ID，使用 ad-hoc 簽名"
    find "$app/Contents/Frameworks" -type f -name "*.dylib" 2>/dev/null \
      -exec codesign --force --timestamp=none --sign - {} \; 2>/dev/null || true
    codesign --force --timestamp=none --sign - "$app/Contents/MacOS/staffdeck" 2>/dev/null || true
  fi
  sign_code "$app"
}

echo "==> [1/5] 構建前端"
npm --prefix frontend-enterprise run build

echo "==> [2/5] 後端 venv + 運行依賴 + 打包工具"
cd backend
if [ ! -x ".venv/bin/pyinstaller" ]; then
  # 若無 venv（如 CI 全新 checkout），自建並裝運行依賴
  if [ ! -x ".venv/bin/python" ]; then
    python3 -m venv .venv
    .venv/bin/python -m ensurepip --upgrade 2>/dev/null || true
  fi
  # 裝運行依賴（從 pyproject 提取；本項目不 editable 安裝）
  if .venv/bin/python -m pip --version >/dev/null 2>&1; then
    DEPS="$(.venv/bin/python -c "import tomllib,pathlib; print(' '.join(tomllib.loads(pathlib.Path('pyproject.toml').read_text())['project']['dependencies']))")"
    .venv/bin/python -m pip install -U pip
    .venv/bin/python -m pip install $DEPS "pyinstaller>=6.6.0" "certifi>=2024.2.2"
  elif command -v uv >/dev/null 2>&1; then
    # 本機 venv 由 uv 管理、無 pip：用 uv pip 補裝打包工具（運行依賴已在 venv 中）
    VIRTUAL_ENV="$(pwd)/.venv" uv pip install "pyinstaller>=6.6.0" "certifi>=2024.2.2"
  else
    echo "無法安裝打包依賴：venv 既無 pip 也無 uv" >&2
    exit 1
  fi
fi
# macOS Dock 殼依賴 pyobjc（冪等，已裝則跳過）
if ! .venv/bin/python -c "import AppKit" >/dev/null 2>&1; then
  if .venv/bin/python -m pip --version >/dev/null 2>&1; then
    .venv/bin/python -m pip install "pyobjc-framework-Cocoa>=10.0"
  elif command -v uv >/dev/null 2>&1; then
    VIRTUAL_ENV="$(pwd)/.venv" uv pip install "pyobjc-framework-Cocoa>=10.0"
  fi
fi

echo "==> [3/5] PyInstaller 打包（spec 在 macOS 下同時產出 StaffDeck.app）"
.venv/bin/pyinstaller ../packaging/ultrarag.spec --noconfirm \
  --distpath ../packaging/out --workpath ../packaging/build
cd "$REPO"
APP="packaging/out/StaffDeck.app"
test -d "$APP" || { echo "PyInstaller 未產出 $APP"; exit 1; }

echo "==> [4/5] 附帶 python 運行時（放 .app/Contents/Resources/runtime）"
# 注意：runtime 必須放 Resources 而非 MacOS。放 MacOS 時 codesign 會把 runtime 裡
# 每個文件都當作需簽名的代碼，附帶 python 有大量腳本/符號鏈接/畸形目錄（如 itcl4.2.2），
# 導致頂層簽名失敗、密封無效（"a sealed resource is missing or invalid"）→ 無法雙擊打開。
# 放 Resources 後按數據資源密封，頂層簽名可通過，app 能正常啟動。
python3 packaging/fetch_runtime_python.py packaging/runtime_dl --expect-arch "$ARCH"
rm -rf "$APP/Contents/Resources/runtime" "$APP/Contents/MacOS/runtime"
cp -R packaging/runtime_dl/python "$APP/Contents/Resources/runtime"

echo "==> [5/5] 簽名 + 打 dmg"
sign_app_bundle "$APP"

if codesign --verify --deep --strict "$APP" 2>/dev/null; then
  echo "✓ 簽名密封驗證通過"
else
  echo "警告：密封校驗未過，雙擊可能無法打開"
fi

DMG="packaging/out/StaffDeck-macos-${ARCH}.dmg"
DMG_ROOT="packaging/out/dmg-root"
DMG_BACKGROUND="packaging/build/staffdeck-dmg-background.png"
rm -f "$DMG"
rm -f "packaging/out/rw."*"StaffDeck-macos-${ARCH}.dmg" 2>/dev/null || true
rm -rf "$DMG_ROOT"
mkdir -p "$DMG_ROOT"
ditto "$APP" "$DMG_ROOT/StaffDeck.app"
python3 packaging/make_dmg_background.py "$DMG_BACKGROUND"

if command -v create-dmg >/dev/null 2>&1; then
  LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 create-dmg --volname "StaffDeck" \
    --window-pos 120 100 --window-size 840 360 \
    --background "$DMG_BACKGROUND" \
    --icon-size 96 --text-size 13 \
    --icon "StaffDeck.app" 230 180 \
    --hide-extension "StaffDeck.app" \
    --app-drop-link 610 175 \
    --app-drop-link-name "Applications" \
    --volicon "packaging/assets/staffdeck.icns" \
    --no-internet-enable --overwrite \
    "$DMG" "$DMG_ROOT" \
    || { ln -s /Applications "$DMG_ROOT/Applications"; hdiutil create -volname StaffDeck -srcfolder "$DMG_ROOT" -ov -format UDZO "$DMG"; }
else
  ln -s /Applications "$DMG_ROOT/Applications"
  hdiutil create -volname StaffDeck -srcfolder "$DMG_ROOT" -ov -format UDZO "$DMG"
fi
rm -rf "$DMG_ROOT"
rm -f "packaging/out/rw."*"StaffDeck-macos-${ARCH}.dmg" 2>/dev/null || true

if [ -n "$MAC_SIGN_ID" ]; then
  codesign --force --timestamp --sign "$MAC_SIGN_ID" "$DMG"
  codesign --verify --strict "$DMG"
fi

if [ -n "$NOTARY_PROFILE" ]; then
  if [ -z "$MAC_SIGN_ID" ]; then
    echo "配置 NOTARY_PROFILE 時也必須配置 MAC_SIGN_ID" >&2
    exit 1
  fi
  NOTARY_ARGS=(--keychain-profile "$NOTARY_PROFILE")
  if [ -n "$NOTARY_KEYCHAIN" ]; then
    NOTARY_ARGS+=(--keychain "$NOTARY_KEYCHAIN")
  fi
  xcrun notarytool submit "$DMG" "${NOTARY_ARGS[@]}" --wait
  xcrun stapler staple "$DMG"
  xcrun stapler validate "$DMG"
  spctl -a -vvv -t open --context context:primary-signature "$DMG"
fi

echo "built $DMG"
ls -lh "$DMG"
