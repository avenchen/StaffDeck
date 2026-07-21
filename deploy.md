# StaffDeck 部署與啟動說明

StaffDeck 以「單一埠」模式運作：一個 FastAPI 行程同時提供 API、SSE 串流與已建置的前端靜態資源，預設埠為 **5173**（若被占用，會在 5173–5199 範圍自動選一個）。

---

## 1. 環境需求

- macOS、Linux 或 WSL（開發腳本使用 bash）
- **Python 3.11+**
- **Node.js 20+** 與 npm
- 一個 OpenAI 相容的 Chat Completions 端點與 API key
- 應用本身不需要 GPU；硬體需求取決於你使用的模型服務

---

## 2. 安裝

在專案根目錄執行：

```bash
git clone https://github.com/OpenBMB/StaffDeck.git
cd StaffDeck

# 後端：建立虛擬環境並安裝（含開發相依）
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -e "backend[dev]"

# 前端：安裝相依
npm --prefix frontend-enterprise ci

# 設定檔
cp backend/.env.example backend/.env
```

> 若透過 proxy 或內網 registry 安裝前端相依時遇到 403，改用官方 registry：
> `npm --prefix frontend-enterprise ci --registry=https://registry.npmjs.org --replace-registry-host=always`

---

## 3. 設定模型（首次啟動前）

編輯 `backend/.env`：

```dotenv
APP_SECRET="換成一段夠長的隨機字串"
DEMO_MODEL_BASE_URL="https://你的-openai-相容端點/v1"
DEMO_MODEL_NAME="你的模型名稱"
DEMO_MODEL_API_KEY="你的-api-key"
```

- API key 用於建立初始模型設定，會**加密後**存入資料庫，請勿把 `backend/.env` 提交進版控。
- 啟動後也可在 **管理 → 模型配置** 中新增/管理模型服務。
- 其他可調環境變數：`DATABASE_URL`（預設 SQLite）、`CORS_ORIGINS`、`TOOL_TIMEOUT_SECONDS`、`GENERAL_SKILL_RUNTIME_*`（通用技能程式碼執行環境，見 `backend/README.md`）。

---

## 4. 啟動

### 開發／單機（建議）

```bash
# 前景執行（Ctrl-C 停止）
scripts/dev_up.sh

# 背景執行（detach）
DETACH=1 scripts/dev_up.sh
```

`dev_up.sh` 會：**建置前端 bundle**（`npm run build`）→ 以單一 FastAPI 行程在埠 5173 提供 UI、API 與串流。

初始管理員帳號：使用者名稱 `admin`、密碼 `admin`，登入後請立即修改密碼。

### 常用生命週期指令

```bash
scripts/dev_status.sh    # 查看行程 / 埠 / 健康狀態
scripts/dev_down.sh      # 停止服務
```

（Windows 使用者對應 `scripts/dev_up.ps1` / `dev_down.ps1` / `dev_status.ps1`。）

### 純後端除錯（不建置前端）

```bash
cd backend
source .venv/bin/activate
uvicorn single_port_app:app --host 127.0.0.1 --port 5173
```

Swagger（僅後端模式下）：`http://localhost:5173/docs`。

---

## 5. 驗證安裝

```bash
curl http://127.0.0.1:5173/api/health
# 預期： {"status":"ok","app":"StaffDeck"}
```

接著開啟 [http://127.0.0.1:5173/workspace/gallery](http://127.0.0.1:5173/workspace/gallery)，選一個數位員工並送出第一則訊息，回覆與其執行紀錄應會串流進同一輪對話。

新增的**知識 Wiki** 頁面在：`/enterprise/wiki`（側邊欄「知識 Wiki」）。

---

## 6. 測試與品質檢查

```bash
# 後端測試
backend/.venv/bin/python -m pytest backend/tests -q

# 前端型別檢查與正式建置
npm --prefix frontend-enterprise run build   # 內含 tsc -b + vite build
```

---

## 7. 桌面版打包（選用）

`packaging/` 內含 macOS / Windows / Linux 的打包資產與腳本：

```bash
packaging/build_macos.sh      # macOS .dmg（arm64）
packaging/build_windows.ps1   # Windows 安裝檔
packaging/build_linux.sh      # Linux .deb
```

詳見 `packaging/` 內各腳本與 `WINDOWS_SIGNING.md`。

---

## 8. 遠端／容器環境注意事項

- 服務對外開放時，把該來源加入 `CORS_ORIGINS`；`dev_up.sh` 可用 `PUBLIC_APP_ORIGIN` 加入公開通道來源。
- 容器磁碟為固定配額；`df` 顯示 Avail 為 0 但 Used 很低時代表配額用盡，刪除建置產物（`frontend-enterprise/dist`、`node_modules` 快取等）即可釋出。
- 排程任務依賴持續運行的背景 worker 與正確的使用者時區設定。

---

## 疑難排解

| 症狀 | 檢查 |
| --- | --- |
| 頁面開得起來但數位員工不回覆 | 模型設定、API key、模型名稱、模型服務網路；查執行紀錄與 `.dev/logs/app.log` |
| 埠 5173 被占用 | 會自動改用 5173–5199；用 `scripts/dev_status.sh` 查實際埠 |
| 前端相依安裝 403 | 見第 2 節的官方 registry 指令 |
| 知識 Wiki 問答無回覆 | 需在「模型配置」設定可用的預設模型；瀏覽與大綱不需模型 |
