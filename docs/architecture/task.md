# StaffDeck 架構重構工作清單

> 對應 [03-migration-plan.md](./03-migration-plan.md) 的階段劃分與 [04-technical-spec.md](./04-technical-spec.md) 的規格。
> 狀態標記：✅ 完成 ・ 🔄 進行中 ・ ⬜ 待安排

## 已完成

- ✅ 前後端現況架構分析（01 文件）
- ✅ 最小元件原則目標架構設計（02 文件）
- ✅ 遷移計畫與技術規格（03、04 文件）
- ✅ 後端：`AppModule` 模組契約 + 宣告式模組表（`module_registry.py`、`modules.py`）
- ✅ 後端：`main.py` 改為 `create_app()` 組裝根、lifespan 取代 `@app.on_event`
- ✅ 後端：`slot_has_value` 統一為單一實作（原 4 處、3 種語意）
- ✅ 後端驗證：512 個測試全數通過；OpenAPI 160 端點與重構前逐一比對一致
- ✅ 前端：`streamRequest` 收斂重複 SSE 解析；共用 `SectionCard`/`Field`；`useApiQuery` hook + `ToolTestPage` 示範

- ✅ 前端驗證：`npm ci` + `tsc -b` + `vite build` 全數通過，Phase 0 程式碼已提交
- ✅ Phase 1.3（首個領域）：建立 `src/api/endpoints/`（`shared.ts` / `tools.ts` / `agents.ts`），
  ToolsPage 19 處內嵌 URL 全數收編、`currentAgentQuery` 字串拼接改為型別化參數

## 未完成 / 可安排工作

### Phase 1 — 服務層與 endpoint 層（優先，低風險）

| # | 工作 | 範圍 | 預估 |
| --- | --- | --- | --- |
| 1.1 | ✅ `api/chat.py` 業務邏輯下沉：排程草稿格式化 → `scheduled_tasks/formatting.py`（純函式）；標題摘要 → `chat_service/session_title.py`；接管恢復 → `chat_service/handoff_resume.py`；中性 `session/session_events.py` 提供 `persist_relay_only_event`。chat.py 由 3,267 → 2,883 行；控制器以別名 re-export 保持相容，測試改 patch 服務模組並新增服務層單元測試 | 後端 | 中 |
| 1.2 | ⬜ `api/agents.py`、`api/general_skills.py`、`api/skills.py` 下沉 service，單檔 < 400 行（大量搬移，建議逐端點小步 + 測試護航） | 後端 | 中 |
| 1.3 | ✅ 建立 `src/api/endpoints/<domain>.ts` 逐域收編內嵌 URL：tools/agents ・ knowledge（jobs/documents/buckets/chunks/discoveries/OKF/versions）・ skills + general-skills ・ chat（sessions/messages/trace/handoffs/feedback…）；串流端點維持 streamPost/streamGet 原樣 | 前端 | 大 |
| 1.4 | ✅ `app/AuthProvider.tsx` + `useAuth()` 上線；18 個頁面改用 useAuth 取得 user/logout，移除 Shell 對頁面的 currentUser/onLogout prop drilling（AppHeader 因登入頁在 provider 外，維持 props） | 前端 | 小 |
| 1.5 | ✅ 路由表抽出 `app/routes.tsx`（`EnterpriseShellRoutes`）+ `<ProtectedRoute>`（admin 守衛宣告化）；App.tsx 移除約 180 行內嵌 `<Routes>` 與頁面 import | 前端 | 中 |

### Phase 2 — 上帝物件拆解（核心，需測試護航）

| # | 工作 | 範圍 | 預估 |
| --- | --- | --- | --- |
| 2.1 | ⬜ 以 delegation 從 `AgentLoop` 抽出 `ToolActionExecutor` / `KnowledgeQueryExecutor` / `GeneralSkillExecutor` | 後端 | 大 |
| 2.2 | ⬜ 抽出 `TurnContextBuilder`、`ReflectionPolicy`、`TurnFinalizer`；建立 `TurnState` 型別 | 後端 | 大 |
| 2.3 | ⬜ 收斂 `handle_turn_stream` 為 `TurnPipeline`，阻塞/SSE 共用管線（`TurnEmitter` 介面） | 後端 | 大 |
| 2.4 | ✅ `ToolsPage.tsx`（2,111 行、6 路由）拆為 `features/tools/`（types/styles/lib/components/pages + index barrel），純搬移零行為變更 | 前端 | 中 |
| 2.5 | ✅ `GeneralSkillsPage.tsx`（2,454 行）拆為 `features/general-skills/`（types/styles/lib/components/pages + barrel），純搬移零行為變更 | 前端 | 中 |
| 2.6 | ✅ `KnowledgePage.tsx`（3,305 行）拆為 `features/knowledge/`（types + parts + pages + barrel），純搬移零行為變更 | 前端 | 大 |
| 2.7 | ⬜ `useChatSession.ts`（3,363 行）拆為 messages/stream/queue/attachments 四個 hook | 前端 | 大 |
| 2.8 | ✅ `DistillPage.tsx`（6,347 行，最大 god-file）拆為 `features/distill/`（types + parts + page + barrel），純搬移零行為變更 | 前端 | 大 |
| 2.9 | ✅ AppSidebar 拆為 `components/sidebar/`（management/chat）；App.tsx（1,005→849）抽出 `app/`（appTypes、routeSelection、AgentCreateDialog），route 表與 AuthProvider 續作 | 前端 | 中 |

### Phase 3 — 狀態與基礎設施硬化

| # | 工作 | 範圍 | 預估 |
| --- | --- | --- | --- |
| 3.1 | ⬜ `ChatSession` 8 個 JSON 欄位收斂為 typed `TurnStateSnapshot`，由 `SlotStateMachine` 獨佔讀寫 | 後端 | 大 |
| 3.2 | ✅ 解除循環依賴：`memory↔core`（`compact_step_result`/知識壓縮下沉至中性 `app/knowledge_projection.py`，memory 不再 import core）；`db.seed↔agents`、`db↔general_skills`（`seed.py`/`staffdeck_seed.py` 由 `app/db/` 上移至 `app/`，db 套件成為零領域依賴葉節點；fixtures 與 spec 同步） | 後端 | 中 |
| 3.3 | ✅ SkillCard/graph schemas 下沉至中性 `app/skill_card.py`；`skill_schema` re-export（skills 域匯入不變）；`knowledge/service` 改匯入 skill_card，knowledge→skills 依賴解除 | 後端 | 小 |
| 3.4 | ⬜ Alembic 取代 `db/database.py` 手寫 `_migrate_*`（現有遷移轉 baseline revision） | 後端 | 中 |
| 3.5 | ✅ `_get_openai_client` 快取 OpenAI client（跨呼叫重用連線池，執行緒安全）；`prompt_cache.read_prompt` 以 mtime 快取 prompt 檔案（step_agent 每回合 8 檔→快取） | 後端 | 小 |
| 3.6 | ✅ 設定拆域（`settings.app`/`settings.model`/`settings.general_skill_runtime` 唯讀視圖）+ `STAFFDECK_` 前綴（`AliasGenerator` 支援 STAFFDECK_ > ULTRARAG_ > 裸名；`brand_env` 供 DOTENV/DATA_DIR）；平面欄位維持相容，6 測試護航 | 後端 | 小 |
| 3.7 | ⬜ `stores/` 取代 localStorage + CustomEvent 匯流排（151 處、27 檔） | 前端 | 大 |
| 3.8 | ⬜ 統一樣式慣例：淘汰 `distillPageStyles.ts`/`chatPageStyles.ts` inline style 物件 | 前端 | 中 |

### 新功能：知識 Wiki + 聊天 UX（已完成）

- ✅ 後端 Wiki 端點（`app/api/knowledge_wiki.py` + `app/knowledge/wiki.py`）：KB outline 樹狀聚合、
  LLM 跨頁問答 SSE 串流（複用 `KnowledgeService.search` 檢索、含引用），4 個單元測試護航
- ✅ 前端 Wiki 視圖（`src/pages/WikiPage.tsx`）：三欄（目錄樹 / 正文閱讀 / 問 Wiki 串流面板），
  使用 endpoint 層（`api/endpoints/knowledge.ts`）+ `useApiQuery` + `SectionCard` 共用元件
- ✅ 導覽整合：路由 enum、側邊欄「知識 Wiki」、App.tsx 路由
- ✅ 聊天 UX：完成的助理訊息新增「複製」按鈕（`CopyMessageButton`），串流中顯示閃爍遊標

### 新功能：部門機制 + 數字員工可見性（已完成）

- ✅ 後端資料模型：`Department`（樹狀，根＝「全組織」）、`User.department_id`（必填，遷移 backfill 至根）、
  `AgentProfile.department_id`（可選）+ `visibility_all`/`visibility_same_department` +
  `agent_visibility_departments`/`agent_visibility_users` 關聯表；`db/database.py` `_migrate_department_schema`
  於啟動自動遷移（冪等，`published_to_gallery`→`visibility_all`）
- ✅ 可見性判定服務 `app/departments/service.py`（葉模組，僅依賴 models）：可組合疊加
  （admin｜擁有者｜全用戶｜同部門 exact｜指定部門含子樹｜指定用戶）；`agents/chat/permissions` 統一委派
- ✅ API：部門 CRUD（`app/api/departments.py`）、使用者部門指派（`auth.py`）、Agent 所屬部門 +
  可見性 GET/PUT（`agents.py`）；`list_agents` 標記伺服器計算的 `visible_to_current_user`
- ✅ 前端：`AccountsPage` 部門管理面板 + 使用者所屬部門選擇器 + 部門欄；`AgentVisibilityDialog`
  （由員工卡片「可見性設定」開啟，取代廣場發佈）；`employee.ts` `isAgentVisibleByFields` 同步；
  `lib/departments.ts`、`api/endpoints/departments.ts`、型別/`EnterpriseAuthUser.department_id` 補齊
- ✅ 驗證：後端 535 測試通過；`tsc -b` + `vite build` 通過

### 待議（需產品/團隊決策）

- ⬜ 前端測試基礎建設（vitest + `features/*/lib` 純函式測試）
- ⬜ i18n 改造：由 MutationObserver DOM 翻譯改為 key-based `t()`（涉及全部元件內硬編中文）
- ⬜ 環境變數/內部 token 舊名（`ULTRARAG_*`、`X-UltraRAG-Internal-Token`）淘汰時程
- ⬜ `mock.py` 模擬電商 API 是否抽離為獨立 dev-only 模組

## 剩餘待處理（下一個 session 從這裡接手）

依風險由低到高的建議順序：

1. **1.2** 後端胖控制器下沉：`agents.py`(1,648) / `general_skills.py`(1,439) / `skills.py`(1,242) → 單檔 < 400 行。
   沿用 1.1 模式：逐服務/端點抽出到 `app/<domain>_service/` 或既有服務層，控制器以別名 re-export 保相容，
   每抽一塊就跑 `pytest` + 補服務層單元測試。**低風險、機械性、可立刻開工。**
2. **3.4** Alembic 取代 `db/database.py` 手寫 `_migrate_*`（把現有遷移含 `_migrate_department_schema` 轉 baseline revision）。中。
3. **3.8** 統一樣式：淘汰 `distillPageStyles.ts`/`chatPageStyles.ts` inline style 物件。中。
4. **2.1 → 2.2 → 2.3** `AgentLoop` → `TurnPipeline`（動即時 turn 執行核心，**高風險、需測試護航**；建議先補管線測試腳手架）。
5. **2.7** `useChatSession.ts`(3,363) 拆 messages/stream/queue/attachments hook（**高風險，缺前端測試腳手架**）。
6. **3.1** `ChatSession` JSON 欄位收斂為 typed `TurnStateSnapshot`（依賴 2.3 完成）。
7. **3.7** `stores/` 取代 localStorage + CustomEvent 匯流排（151 處、27 檔，大）。
8. 待議項（前端測試基礎建設 vitest、i18n key-based `t()`、`ULTRARAG_*` 舊名淘汰、`mock.py` 抽離）。

---

## 新 Session 起手 · 環境注意事項（直接用 AIStaff）

> 新 session 若直接 clone/使用 **avenchen/AIStaff**，預設分支 `main` 即為最新（本文件所述狀態）。

**倉庫 / 分支**
- 工作倉庫：`avenchen/AIStaff`，最新在 `main`。建議在 `main` 開一條工作分支再 PR。
- （本輪歷史同時鏡像到 `avenchen/StaffDeck` 的 `claude/staffdeck-architecture-redesign-0wziyk` 分支；
  StaffDeck 的 `main` 是舊的，勿以它為基準。）

**執行（單一埠 5173）**
- macOS/Linux：`scripts/dev_up.sh`（`DETACH=1` 背景執行）；Windows：`scripts\dev_up.ps1`。
  會先 `npm run build` 再以單一 FastAPI 行程提供 UI+API+SSE。停止：`dev_down`；狀態：`dev_status`。
- 純後端除錯：`cd backend && uvicorn single_port_app:app --host 127.0.0.1 --port 5173`。
- 初始帳號 `admin` / `admin`。詳見 `deploy.md`（含「6. 更新既有安裝」與 Windows 步驟）。

**驗證指令（每次改動後務必跑）**
- 後端：`backend/.venv/bin/python -m pytest backend/tests -q`（目前 **535 passed**）。
- 前端：`npm --prefix frontend-enterprise run build`（內含 `tsc -b` + `vite build`）。

**資料庫 / 遷移**
- SQLite，開發預設 `backend/skill_agent_loop.db`。綱要於啟動時由 `init_db` 的手寫 `_migrate_*`
  **自動升級**（含部門機制），冪等、資料保留；**不需手動遷移指令**。改綱要時新增一個 `_migrate_*` 函式並於 `init_db` 呼叫。

**語言（重要）**
- 全繁體中文；原始碼字串直接硬編繁體。**勿引入簡體字。**
- ⚠️ OpenCC `s2t` 逐字比對會把標準繁體 `核/峰/秘/干/群/吃/才/灶` 誤報為「應轉異體字」——**那是誤報，不要改**。
  要偵測真正簡體請用人工或校對，不要盲信 s2t 異體字建議。
- i18n 現況：中文為源、`en.json` + `MutationObserver` 做英文；尚未 key-based（見待議）。

**架構慣例（延續）**
- 最小元件原則：控制器薄、業務邏輯下沉 service；跨域共用邏輯放**中性葉模組**避免循環依賴
  （範例：`app/knowledge_projection.py`、`app/skill_card.py`、`app/departments/service.py`、`app/session/session_events.py`）。
- 前端一律走 `src/api/endpoints/<domain>.ts`，**勿內嵌 URL**；串流端點用 `streamPost/streamGet`。
- 數字員工可見性以 `app/departments/service.py` 為唯一判定來源，`agents/chat/permissions` 皆委派；
  前端 picker 信任 `metadata.visible_to_current_user`（由 `list_agents` 標記）。
- 模型支援 OpenAI 相容與 Gemini（`app/llm/providers.py` `resolve_base_url`）；設定用 `STAFFDECK_` 前綴（相容 `ULTRARAG_`）。

**Git 操作**
- `git push -u origin <branch>`；PR 目標為 AIStaff。網路失敗時指數退避重試。
- 只在使用者明確要求時才開 PR。
