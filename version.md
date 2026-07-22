# StaffDeck / AIStaff 版本與機制總覽

> 本文件整理目前已完成的機制與功能，以及待處理的機制，作為架構重構期間的進度快照。
> 對應詳細規劃見 [docs/architecture/](docs/architecture/)，逐項工作追蹤見 [docs/architecture/task.md](docs/architecture/task.md)。
>
> 狀態標記：✅ 已完成 ・ 🔄 進行中 ・ ⬜ 待處理

---

## 一、已完成的機制與功能

### 1. 架構分析與規劃文件
- ✅ 前後端現況架構分析、最小元件原則目標架構、遷移計畫與技術規格（`docs/architecture/01~04`）

### 2. 後端基礎架構（Phase 0）
- ✅ `AppModule` 模組契約 + 宣告式模組表（`app/module_registry.py`、`app/modules.py`）
- ✅ `main.py` 改為 `create_app()` 組裝根、以 lifespan 取代 `@app.on_event`
- ✅ `slot_has_value` 統一為單一實作（原 4 處、3 種語意）
- ✅ 驗證：512+ 測試通過、OpenAPI 端點與重構前逐一比對一致

### 3. 前端基礎架構（Phase 0/1）
- ✅ `streamRequest` 收斂重複 SSE 解析；共用 `SectionCard`/`Field`；`useApiQuery` hook
- ✅ **endpoint 層收編（1.3）**：`src/api/endpoints/` 逐域收攏內嵌 URL
  - `tools.ts`、`agents.ts`
  - `knowledge.ts`（jobs / documents / buckets / chunks / discoveries / OKF / versions / lifecycle）
  - `skills.ts`、`generalSkills.ts`（含 AbortSignal 匯入）
  - `chat.ts`（sessions / messages / trace / handoffs / feedback / scheduled-task；tenantId 以參數傳入，取自登入使用者租戶）
  - 串流端點維持 `streamPost`/`streamGet` 原樣
- ✅ **AuthProvider（1.4）**：`app/AuthProvider.tsx` + `useAuth()`；18 個頁面改用 useAuth 取得 user/logout，移除 Shell 對頁面的 prop drilling
- ✅ **路由表抽出（1.5）**：`app/routes.tsx`（`EnterpriseShellRoutes`）+ `<ProtectedRoute>`（admin 守衛宣告化）；App.tsx 移除約 180 行內嵌 `<Routes>`

### 4. 上帝物件拆解（Phase 2，純搬移零行為變更）
- ✅ `ToolsPage`（2,111 行）→ `features/tools/`
- ✅ `GeneralSkillsPage`（2,454 行）→ `features/general-skills/`
- ✅ `KnowledgePage`（3,305 行）→ `features/knowledge/`
- ✅ `DistillPage`（6,347 行，最大 god-file）→ `features/distill/`
- ✅ `AppSidebar` → `components/sidebar/`；App.tsx（1,005→849）抽出 `app/`（appTypes、routeSelection、AgentCreateDialog）

### 5. 狀態與基礎設施硬化（Phase 3，部分）
- ✅ **3.3**：SkillCard/graph schema 下沉至中性 `app/skill_card.py`，解除 knowledge→skills 跨域依賴
- ✅ **3.5**：`_get_openai_client` 快取 OpenAI client（跨呼叫重用連線池、執行緒安全）；`prompt_cache.read_prompt` 以 mtime 快取 prompt 檔案
- ✅ **3.6**：設定拆域（`settings.app`/`settings.model`/`settings.general_skill_runtime` 唯讀視圖）+ `STAFFDECK_` 環境變數前綴（`AliasGenerator` 支援 STAFFDECK_ > ULTRARAG_ > 裸名；`brand_env` 供 DOTENV/DATA_DIR），平面欄位維持相容
- ✅ **3.2**：解除跨套件循環／層級反轉依賴
  - memory↔core：知識壓縮投影下沉至中性葉模組 `app/knowledge_projection.py`
  - db.seed↔agents、db↔general_skills：`seed.py`/`staffdeck_seed.py` 由 `app/db/` 上移至 `app/`，`db` 套件成為零領域依賴的葉節點

### 6. 新功能
- ✅ **知識庫 Wiki 視圖**
  - 後端 `app/api/knowledge_wiki.py` + `app/knowledge/wiki.py`：KB outline 樹狀聚合、LLM 跨頁問答 SSE 串流（複用 `KnowledgeService.search` 檢索、含引用），4 個單元測試
  - 前端 `src/pages/WikiPage.tsx`：三欄（目錄樹 / 正文閱讀 / 問 Wiki 串流面板）
  - 導覽整合：路由 enum、側邊欄「知識 Wiki」、App.tsx 路由
- ✅ **聊天對話 UX**：完成的助理訊息新增「複製」按鈕（`CopyMessageButton`），串流中顯示閃爍遊標
- ✅ **Gemini API 支援**：`app/llm/providers.py`（`resolve_base_url(provider, base_url)`，Gemini 走 Google OpenAI 相容端點）；`config.demo_model_provider`；`.env.example` 說明；前端 ModelsPage provider datalist；單元測試
- ✅ **簡體 → 繁體全面轉換**：OpenCC `s2tw` 套用至 208 個檔案（原始碼、測試、prompt、seed JSON、en.json key）
- ✅ **1.1（完成）**：`api/chat.py` 業務邏輯下沉服務層
  - 排程草稿格式化 → `app/scheduled_tasks/formatting.py`（純函式）
  - 標題摘要背景服務 → `app/chat_service/session_title.py`
  - 人工接管恢復 → `app/chat_service/handoff_resume.py`
  - 中性事件持久化 → `app/session/session_events.py`（`persist_relay_only_event`）
  - chat.py 由 3,267 → 2,883 行；控制器以別名 re-export 保持相容，新增服務層單元測試

### 7. 部門機制（Phase 1 後端完成，Phase 2 前端進行中）
- ✅ **資料模型**：`Department`（樹狀，根=全組織）、`User.department_id`（必填）、
  `AgentProfile.department_id`（可選）+ `visibility_all`/`visibility_same_department` +
  `agent_visibility_departments`/`agent_visibility_users` 關聯表
- ✅ **可見性判定服務** `app/departments/service.py`（葉模組）：可組合疊加
  （admin｜擁有者｜全用戶｜同部門(exact)｜指定部門(含子樹)｜指定用戶），
  agents/chat/permissions 統一委派；遷移 backfill + 相容 `published_to_gallery`
- ✅ **API**：部門 CRUD、使用者部門指派、Agent 所屬部門 + 可見性 GET/PUT
- ✅ **Phase 2 前端**：`AccountsPage` 部門管理面板 + 使用者所屬部門選擇器 + 部門欄；
  `AgentVisibilityDialog`（所屬部門 + 全用戶/同部門/指定部門/指定用戶，取代廣場發佈），
  由員工卡片「可見性設定」開啟；`employee.ts` 判定同步（`isAgentVisibleByFields`）；
  types/endpoint/`EnterpriseAuthUser.department_id` 全數補齊
- ✅ **Picker 完整化**：`list_agents` 對每筆 agent 標記伺服器計算的
  `visible_to_current_user`（涵蓋四種可見性模式），前端 picker 對子樹/指定用戶模式亦精確顯示

### 8. 專案維運
- ✅ 專案由 fork 重新上傳至自有 repo `avenchen/AIStaff`（完整歷史）
- ✅ 移除 fork 帶入的 CodeQL Advanced workflow；關閉 7 個 fork 繼承的 dependabot PR（CI 恢復乾淨）
- ✅ 部署與 Windows 更新／執行說明（`deploy.md`）

---

## 二、待處理的機制

### Phase 1 — 服務層下沉（後端胖控制器）
- 🔄 **1.1** `api/chat.py` 業務邏輯下沉
  - ✅ 排程草稿格式化（已完成）
  - ⬜ 標題摘要（背景執行緒 + LLM）、接管恢復（handoff resume）
  - 備註：現有測試對 module global（如 `chat_api.engine`）做 monkeypatch，抽取前需先補服務層測試腳手架
- ⬜ **1.2** `api/agents.py`（1,648）、`api/general_skills.py`（1,439）、`api/skills.py`（1,242）下沉 service，單檔 < 400 行（建議逐端點小步 + 測試護航）

### Phase 2 — 上帝物件拆解（核心，需測試護航）
- ⬜ **2.1–2.3** 以 delegation 從 `AgentLoop` 抽出 `ToolActionExecutor` / `KnowledgeQueryExecutor` / `GeneralSkillExecutor`、`TurnContextBuilder` / `ReflectionPolicy` / `TurnFinalizer`，收斂 `handle_turn_stream` 為 `TurnPipeline`（阻塞/SSE 共用管線）—— 動到即時 turn 執行核心，風險高
- ⬜ **2.7** `useChatSession.ts`（3,363 行）拆為 messages/stream/queue/attachments 多個 hook —— 高風險、缺前端測試腳手架

### Phase 3 — 狀態與基礎設施硬化（剩餘）
- ⬜ **3.1** `ChatSession` 8 個 JSON 欄位收斂為 typed `TurnStateSnapshot`（依賴 2.3 完成）
- ⬜ **3.4** Alembic 取代 `db/database.py` 手寫 `_migrate_*`（現有遷移轉 baseline revision）
- ⬜ **3.7** `stores/` 取代 localStorage + CustomEvent 匯流排（151 處、27 檔）
- ⬜ **3.8** 統一樣式慣例：淘汰 `distillPageStyles.ts`/`chatPageStyles.ts` inline style 物件

### 待議（需產品／團隊決策）
- ⬜ 前端測試基礎建設（vitest + `features/*/lib` 純函式測試）
- ⬜ i18n 改造：由 MutationObserver DOM 翻譯改為 key-based `t()`
- ⬜ 環境變數／內部 token 舊名（`ULTRARAG_*`、`X-UltraRAG-Internal-Token`）淘汰時程
- ⬜ `mock.py` 模擬電商 API 是否抽離為獨立 dev-only 模組

---

## 三、建議執行順序

1. **Phase 1 剩餘（1.1 → 1.2）**：逐項小步、每步先補測試再抽取，降低每日開發摩擦。
2. **Phase 2 後端（2.1 → 2.2 → 2.3）與前端（2.7）**：各自小步 PR，需測試護航。
3. **Phase 3**：在管線穩定後進行；3.1 依賴 2.3 完成。
