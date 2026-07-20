# StaffDeck 架構重構遷移計畫

> 原則：每一階段都保持行為相容、測試綠燈（後端 51 個測試檔約 21,700 行；前端 `tsc -b` + `vite build`），小步提交、可隨時中止。

## Phase 0 — 組裝根與共用最小元件（本分支已實作）

**後端**

1. `app/module_registry.py`：新增 `AppModule` 契約與 `install_modules()`。
2. `app/modules.py`：22 個 router、startup/shutdown 掛勾以宣告式模組表註冊；`main.py` 縮為純組裝根 `create_app()`，並由 `@app.on_event` 改為 lifespan。
3. `app/session/slot_policy.py`：新增唯一的 `slot_has_value()`，取代 4 處重複定義（統一語意：`None` / `""` / `[]` / `{}` 視為未填）。

**前端**

4. `src/api/client.ts`：`streamPost` / `streamGet` 收斂為單一 `streamRequest` 核心。
5. `src/components/form/SectionCard.tsx`：抽出共用 `SectionCard` / `Field`，`ToolsPage`、`GeneralSkillsPage` 改為匯入（樣式以 props 保留各頁原貌）。
6. `src/hooks/useApiQuery.ts`：共用資料抓取 hook（loading / error / refresh 一份），並率先在 `ToolTestPage` 採用示範。

**驗收**：後端 pytest 全綠；前端 typecheck + build 通過；API 路由表與 UI 外觀不變。

## Phase 1 — 服務層與 endpoint 層

- 後端：`api/chat.py`、`api/agents.py`、`api/general_skills.py`、`api/skills.py` 的業務邏輯下沉至各模組 `service.py`；API 檔案目標 < 400 行。
- 前端：建立 `src/api/endpoints/<domain>.ts`，逐域收編 167 處內嵌 `api.*` 呼叫；新程式碼禁止硬編 URL。
- 前端：`app/AuthProvider.tsx` 上線，移除 `currentUser` / `onLogout` prop drilling；路由表抽出至 `app/routes.tsx`。

## Phase 2 — 上帝物件拆解

- 後端：`AgentLoop` 依 [02 §2.2](./02-minimal-component-redesign.md) 拆為 `TurnPipeline` + 階段元件。策略：先以 delegation 抽出 `ToolActionExecutor` / `KnowledgeQueryExecutor` / `GeneralSkillExecutor`（行為不變、測試護航），最後才收斂 `handle_turn_stream`。
- 前端：五大巨檔依 features/ 結構拆解，順序：`ToolsPage`（結構最規則）→ `GeneralSkillsPage` → `KnowledgePage` → `useChatSession` → `DistillPage`（最大、最後）。

## Phase 3 — 狀態與基礎設施硬化

- `ChatSession` 8 個 JSON 欄位收斂為 typed `TurnStateSnapshot`。
- 移除全部函式內延遲匯入（`memory↔core`、`db↔agents`、`db↔general_skills`），以依賴反轉解環。
- Alembic 取代手寫 migration；`LLMClientPool` 取代每呼叫重建；設定拆域並改 `STAFFDECK_` 前綴（相容舊 `ULTRARAG_`）。
- 前端 `stores/` 取代 localStorage + CustomEvent 匯流排。

## 風險與回退

- 每階段獨立 PR、獨立可回退；不允許「重構 + 行為變更」混在同一提交。
- Phase 0 唯一刻意的語意統一是 `slot_has_value`（空集合視為未填）；已由測試套件驗證無回歸。
- 路由註冊順序在模組表中保持 `chat` 模組先於其他 `/api/chat/*` 前綴的模組，維持 FastAPI 路徑匹配順序不變。
