#!/usr/bin/env bash
# 在 x86_64 Ubuntu 容器裡測試 build_linux.sh
# 項目掛載到 /work（可寫），輸出在 /work/packaging/out
set -e

echo "=========================================="
echo "  容器架構: $(uname -m)"
echo "=========================================="

echo "==> 裝系統依賴"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  curl wget file software-properties-common \
  ruby ruby-dev build-essential \
  libfuse2 fuse \
  ca-certificates \
  >/dev/null 2>&1 || { echo "apt 裝依賴失敗"; exit 1; }

echo "==> 裝 Python 3.11（項目要求 >=3.11，ubuntu:22.04 自帶 3.10）"
add-apt-repository -y ppa:deadsnakes/ppa >/dev/null 2>&1
apt-get update -qq
apt-get install -y -qq python3.11 python3.11-venv python3.11-dev >/dev/null 2>&1
echo "python3.11: $(python3.11 --version 2>&1)"

echo "==> 裝 node 20"
curl -fsSL https://deb.nodesource.com/setup_20.x 2>/dev/null | bash - >/dev/null 2>&1
apt-get install -y -qq nodejs >/dev/null 2>&1
echo "node: $(node -v 2>&1), npm: $(npm -v 2>&1)"

echo "==> 裝 fpm"
gem install --no-document fpm >/dev/null 2>&1 && echo "fpm: $(fpm --version 2>&1)" || echo "fpm 裝失敗"

echo "==> 下載 appimagetool（QEMU 模擬無 FUSE，需解壓成普通可執行）"
cd /tmp
wget -q -O appimagetool.AppImage \
  https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage
chmod +x appimagetool.AppImage
# QEMU 模擬環境 FUSE 不可用，AppImage 自身跑不了 → 解壓出來直接用其內部的 AppRun
./appimagetool.AppImage --appimage-extract >/dev/null 2>&1 || true
if [ -x /tmp/squashfs-root/AppRun ]; then
  # 用解壓後的 appimagetool
  cat > /usr/local/bin/appimagetool <<'WRAP'
#!/bin/sh
exec /tmp/squashfs-root/AppRun "$@"
WRAP
  chmod +x /usr/local/bin/appimagetool
  echo "appimagetool 已解壓可用"
else
  cp appimagetool.AppImage /usr/local/bin/appimagetool
  chmod +x /usr/local/bin/appimagetool
  echo "appimagetool 解壓失敗，用原 AppImage（可能因 FUSE 失敗）"
fi
cd /work

echo "==> python: $(python3 --version 2>&1)"

echo ""
echo "=========================================="
echo "  環境就緒，把項目拷到容器內部（避開掛載 macOS fs 的符號鏈接問題）"
echo "=========================================="
# 關鍵：不在掛載的 /work 裡構建（macOS fs 對 python 符號鏈接處理有問題）。
# 把源碼拷到容器內部 /build，在那裡構建，產物再拷回 /work/packaging/out。
rm -rf /build && mkdir -p /build
# 拷源碼，排除大目錄和 arm64 產物
apt-get install -y -qq rsync >/dev/null 2>&1
rsync -a --exclude='.git' --exclude='backend/.venv' \
  --exclude='frontend-enterprise/node_modules' \
  --exclude='packaging/out' --exclude='packaging/build' \
  --exclude='packaging/runtime_dl' --exclude='frontend-enterprise/dist' \
  --exclude='.dev' \
  /work/ /build/
cd /build

# 前端 node_modules 是 macOS(arm64) 裝的，容器裡重裝並構建
echo "==> 容器內重裝前端依賴並構建"
( cd frontend-enterprise && npm install >/dev/null 2>&1 && npm run build )
echo "前端 dist 已就緒（x86_64 容器內構建）"

# appimagetool、版本、python 命令、pip 鏡像
export APPIMAGETOOL=/usr/local/bin/appimagetool
export VERSION=0.1.0
ln -sf /usr/bin/python3.11 /usr/local/bin/python 2>/dev/null || true
echo "python -> $(python --version 2>&1)"
mkdir -p /etc/pip
cat > /etc/pip.conf <<'PIPCONF'
[global]
index-url = https://mirrors.aliyun.com/pypi/simple/
timeout = 120
retries = 5
PIPCONF

echo ""
echo "=========================================="
echo "  在容器內部跑 build_linux.sh（前端已 build）"
echo "=========================================="
# 允許 build_linux.sh 部分失敗（AppImage 在 QEMU 模擬無 FUSE 可能失敗），不中斷後續拷回
set +e
SKIP_FRONTEND=1 bash packaging/build_linux.sh
BUILD_RC=$?
set -e
echo "build_linux.sh 退出碼: $BUILD_RC"

echo ""
echo "==> 把產物拷回掛載目錄 /work/packaging/out"
mkdir -p /work/packaging/out
cp -f packaging/out/StaffDeck-linux-x86_64.deb /work/packaging/out/ 2>/dev/null && echo "✓ deb 已拷回" || echo "✗ 無 deb"
cp -f packaging/out/StaffDeck-linux-x86_64.AppImage /work/packaging/out/ 2>/dev/null && echo "✓ AppImage 已拷回" || echo "✗ 無 AppImage（模擬環境 FUSE 限制，真機可出）"
ls -lh /work/packaging/out/StaffDeck-linux-x86_64.* 2>/dev/null || echo "（無 Linux 產物）"
