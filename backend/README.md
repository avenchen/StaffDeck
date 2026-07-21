# Backend

FastAPI backend for the Skill Agent Loop MVP.

## Run

From the repository root, prefer:

```bash
scripts/dev_up.sh
```

For backend-only debugging:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
.venv/bin/uvicorn single_port_app:app --host 127.0.0.1 --port 5173
```

Swagger UI: `http://localhost:5173/docs`

`CORS_ORIGINS` controls the allowed frontend origins. The root `scripts/dev_up.sh`
sets the local single-port origin by default and can add a public tunnel origin with
`PUBLIC_APP_ORIGIN`.

## General Skill Code Runtime

通用技能生成的 Python/Bash runner 不直接依賴系統 Python。運行時按以下順序選擇環境：

1. `GENERAL_SKILL_RUNTIME_PYTHON` 指定的 Python；
2. `GENERAL_SKILL_RUNTIME_VENV` 指定虛擬環境中的 Python；
3. `backend/.venv/bin/python`；
4. 自動創建 `backend/.runtime_venv`。

`GENERAL_SKILL_RUNTIME_PACKAGES` 默認安裝/校驗 `requests,httpx`，用於通用 API
訪問。需要文檔解析或數據處理時可以擴展為：

```bash
GENERAL_SKILL_RUNTIME_PACKAGES="requests,httpx,beautifulsoup4,lxml,pypdf,python-docx,pandas,numpy,python-dateutil"
```

如果部署環境禁止自動安裝依賴，設置：

```bash
GENERAL_SKILL_RUNTIME_AUTO_INSTALL="false"
GENERAL_SKILL_RUNTIME_PYTHON="/path/to/prepared/venv/bin/python"
```

## Demo Seed

Startup seeds:

- `tenant_demo`
- refund skill `after_sales_refund`
- exchange skill `after_sales_exchange`
- mock HTTP tool `order.query`

Set `DEMO_MODEL_API_KEY` before first startup if you want a default model config to be created automatically.
