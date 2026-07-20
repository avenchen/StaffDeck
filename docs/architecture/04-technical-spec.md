# StaffDeck 技術規格書：原架構細節與重構開發規格

> 本文件是 [01-current-state.md](./01-current-state.md)（現況摘要）與 [02-minimal-component-redesign.md](./02-minimal-component-redesign.md)（目標架構）的細節補充：第一部分完整記錄原架構的技術細節，第二部分定義重構後各元件的開發規格（介面契約、命名、測試要求）。

---

## Part A — 原架構技術細節

### A.1 執行環境與入口

| 項目 | 內容 |
| --- | --- |
| 語言/框架 | Python 3.11 + FastAPI + SQLModel（SQLite）；React 18.3 + TypeScript 5.7 + Vite 6 |
| 正式 ASGI 入口 | `backend/single_port_app.py`（194 行）：匯入 `app.main:app`，另掛載 Vite 靜態資源（4 個前綴）、SPA fallback（`/chat`、`/enterprise`、`/workspace`）、`/api/site-chat/*` httpx 串流反向代理 |
| 開發啟動 | `scripts/dev_up.sh` → `scripts/dev_supervisor.py`，單埠 5173 |
| 桌面版 | `backend/desktop_launcher.py`（613 行）：埠選擇、單一實例鎖、macOS NSApplication / Windows ctypes 外殼、PyInstaller 打包（`packaging/`） |
| 組裝根 | `app/main.py`：CORS 中介層（唯一的 middleware）、`/api/health`、22 個 router 註冊；startup 依序執行 `init_db()` → `seed_demo_data()` → `start_background_worker()` |

### A.2 後端模組職責與相依

依賴方向（→ 表示匯入）：

```
api → {core, agents, db, feedback, general_skills, knowledge, llm,
        memory, observability, scheduled_tasks, security, session, skills, tools}
core → {agents, db, general_skills, knowledge, llm, memory,
        observability, session, tools}
scheduled_tasks → {agents, core, db, llm, security, session}
knowledge → {db, llm, observability, skills.skill_schema}   ← 跨域滲漏
memory → {async_jobs, db, llm, observability, session, core(延遲)}  ← 循環
db.seed → {agents.branching, general_skills(延遲)}                ← 循環
```

各模組細節：

- **`api/`（18 檔、12,336 行）**：`chat.py`(3,267)、`agents.py`(1,648，3 個 router)、`general_skills.py`(1,439)、`skills.py`(1,242)、`knowledge.py`(1,047)、`knowledge_bases.py`(1,002)、`tools.py`(891，含 mcp_router)、`mock.py`(480，模擬電商 API)、其餘 < 300 行。
- **`core/`（10 檔、9,082 行）**：
  - `agent_loop.py`(6,747)：`AgentLoop` 類別，約 140 個方法。關鍵方法：`handle_turn`(353)、`handle_turn_stream`(1332，約 850 行)、`_prepare_turn`(2246)、`_run_reflection_rounds`(3192)、`_auto_progress_skill_graph`(3270)、`_execute_tool_action_cycle`(3732)、`_execute_knowledge_query_cycle`(3911)、`_execute_general_skill_tool_call`(5190)、`_finalize_turn`(6648)。
  - `skill_runtime.py`(502)：`SkillRuntime`，操作 `ChatSession` JSON 欄位的 slot / pending-task 狀態機。
  - `response_generator.py`(464)、`context_projection.py`(429)、`conversation_context.py`(278)、`router.py`(233)、`step_agent.py`(262)、`reflection_agent.py`(136)、`cancellation.py`(27)。
- **`llm/`（1,558 行）**：`client.py`(1,259) `LLMClient` 包裝 OpenAI SDK——`generate_text` / `generate_text_stream` / `generate_json`（JSON 修復重試、空回應重試、`_fit_request_messages` token 預算裁切、thinking-mode 參數）。`stage_protocol.py` 定義統一 system prompt 與各階段 payload schema；prompt 為 `llm/prompts/*.md`，每次呼叫從磁碟讀取。
- **`agents/`（1,603 行）**：`branching.py`(1,483) 定義 per-agent 資源可見性（open-gallery 與私有綁定、branch 投影）。
- **`knowledge/`（3,210 行）**：`service.py`(1,863) 摄取、分塊、bucket、檢索；`okf.py`(820) OKF 概念格式；`citations.py` 引用來源。
- **`general_skills/`（1,341 行）**：`runner.py`(1,070) `GeneralSkillSelector` + `GeneralSkillRunner`（子行程/venv 執行、stdout 串流、重試）；`runtime_env.py` 依 `GENERAL_SKILL_RUNTIME_*` 環境變數解析 Python 執行環境（4 層 fallback：指定 Python → 指定 venv → `backend/.venv` → 自建 `.runtime_venv`）。
- **`tools/`（1,096 行）**：`mcp_client.py`(586) 支援 stdio / http / sse 三種 MCP 傳輸；`http_request.py` HTTP 工具執行。
- **`scheduled_tasks/`（997 行）**：`service.py`(783) CRUD + rrule + 到期掃描 + 執行（跑 `AgentLoop`）；`worker.py` 背景輪詢執行緒。
- **`security/`（253 行）**：自製 HMAC 簽名 opaque token（非 JWT 庫）；`get_current_user` 依賴注入；tenancy 以 query param `tenant_id` 與 token 交叉驗證（`require_current_tenant` 不符回 403）；角色 `admin`/`member`；`encryption.py` 加密模型 API key；`internal_service.py` 以 `X-UltraRAG-Internal-Token` 保護 mock API。
- **`observability/`（202 行）**：`spans.py` ContextVar span sink（`llm_operation` / `observed_span` / `ManualSpan`），chat 串流 worker 綁定 sink 後將 span 持久化為 `AgentEvent`；失敗一律吞掉不影響請求。
- **`session/`（594 行）**：`session_schema.py` Pydantic DTO（`ChatTurnRequest/Response`、`RouterDecision`、`StepAgentResult`、`PendingTask`）；`attachments.py`(319) 附件解析為上下文。
- **`db/`（4,380 行）**：`database.py`(1,409) engine + 手寫 `_migrate_*` SQLite 遷移；`models.py`(663)；`seed.py`(1,338) + `staffdeck_seed.py`(966) 種子資料。

### A.3 資料模型（`db/models.py`）

全部為扁平 SQLModel 表、無 ORM `Relationship()`——關聯靠字串外鍵 + JSON 欄位在應用層手動 join；每張表都有 `tenant_id`（約定式租戶隔離，無 DB 約束）：

| 分組 | 資料表 |
| --- | --- |
| 租戶/身分 | `Tenant`、`User` |
| SOP 技能 | `Skill`、`SkillVersion`、`AgentSkillBranch`、`AgentSkillBranchVersion` |
| 程式碼技能 | `GeneralSkill` |
| 知識/RAG | `KnowledgeBase`、`KnowledgeBaseVersion`、`AgentKnowledgeBranch`、`KnowledgeDocument`、`KnowledgeBucket`、`KnowledgeChunk`、`KnowledgeConcept`、`KnowledgeDiscoverySuggestion`、`KnowledgeIngestJob` |
| 員工/設定 | `AgentProfile`、`AgentUsage`、`AgentModelBinding`、`AgentResourceBinding`、`ModelConfig`、`PersonaConfig`、`UIConfig` |
| 工具 | `Tool`、`MCPServer` |
| 執行期 | `ChatSession`（8 個 JSON 狀態欄位：slots、skill_stack、pending_tasks、awaiting_input、knowledge_context、context_state…）、`Message`、`AgentEvent`、`HumanHandoffRequest` |
| 排程 | `ScheduledTask`、`ScheduledTaskRun` |
| 回饋/記憶 | `MessageFeedback`、`SkillFeedback`、`MemoryRecord` |
| 模擬域 | `MockOrder` |

### A.4 聊天回合生命週期（詳細）

1. **入口**：`POST /api/chat/turn`（阻塞）或 `POST /api/chat/stream`（SSE）。`/stream` 開 worker thread、建立獨立 DB session、以 `set_span_sink`/`persist_span` 綁定 span sink（span → `AgentEvent`），迭代 `AgentLoop.handle_turn_stream()` 將每個 yield 的 dict 轉為 SSE 區塊。
2. **準備**：`_prepare_turn` 載入 session / agent / 可見技能與工具（經 `agents.branching` 投影）/ 模型設定，組合對話上下文（`conversation_context.py`）與記憶（`memory_read`）。
3. **路由**：`Router.decide`（LLM JSON）→ `RouterDecision`：`start / continue / switch / clarify / handoff`；`SkillRuntime.apply_decision` 更新 slot / skill_stack / pending_tasks。
4. **步進**：`StepAgent.run`（LLM JSON）→ `StepAgentResult`：`reply / ask_user / call_tool / query_knowledge / advance / handoff`。
5. **動作迴圈**：依 action 進入 `_execute_tool_action_cycle` / `_execute_knowledge_query_cycle` / `_execute_general_skill_tool_call`；`action_needs_reflection` 判斷是否進 `ReflectionAgent` 反思重試（`_reflect_and_retry`）；技能圖自動推進（`_auto_progress_skill_graph`）。
6. **回覆**：`ResponseGenerator.generate[_stream]` 產生最終文字（或直接使用 step reply）。
7. **收尾**：`_finalize_turn` 持久化 `Message`、記錄 `EventLog` 事件、`memory.jobs` 排入記憶擷取非同步任務（`async_jobs.AsyncJobQueue`，ThreadPoolExecutor、in-memory、上限 500 筆歷史）。

每個 LLM 階段：讀取 `llm/prompts/*.md` → `stage_protocol` 組 payload → **新建** `LLMClient`（含 API key 解密）→ `observability.llm_operation` 包裝呼叫。

### A.5 前端技術細節

- **路由**：`App.tsx`(995 行) 內 3 組 `<Routes>` 依 `isEnterpriseAdmin` / `isGalleryEmployee` / `canAccessEmployeeAgent` 條件切換；約 25 條 enterprise 路由 + workspace（gallery、`/workspace/chat/:sessionId`）。`enums/routes.ts` 僅存路徑常數。
- **API 層**：`src/api/client.ts`(247 行) 唯一封裝——`api.get/post/put/delete/postWithSignal/postKeepalive/blob`、`ApiError`、`isAuthError`、FastAPI 錯誤體解析（`parseErrorMessage`/`formatValidationDetail`）、SSE（`streamChatTurn`/`streamPost`/`streamGet`，手寫 `ReadableStream` + `\n\n` 區塊解析）、`uploadChatAttachments`（FormData）。
- **狀態**：無全域 store；`I18nContext` 與 `SidebarContext` 兩個 Context；跨頁同步以 localStorage + `window` CustomEvent（27 檔 151 處，如 `lib/agent-scope-storage.ts`、`MODEL_CONFIGS_UPDATED_EVENT`）。
- **i18n**：`i18n/index.tsx`(300 行) 中文為元件內硬編來源語言，英文以 `en.json` 字典 + MutationObserver 執行期走訪 DOM 替換；另有 `t()` 函式與 `scripts/check-i18n.cjs` 檢查。
- **樣式**：Tailwind v4 + `styles.css`(~131KB)；三種並行慣例——markup 內 Tailwind class、`lib/enterprise-ui.ts` 共用字串常數、`distillPageStyles.ts`/`chatPageStyles.ts` inline style 物件。
- **測試/建置**：`tsc -b` + `vite build`；無前端單元測試。後端 51 個測試檔（21,686 行）、512 個測試。

---

## Part B — 重構開發規格

### B.1 後端元件契約

#### B.1.1 模組註冊（Phase 0，已實作）

```python
# app/module_registry.py
@dataclass(frozen=True)
class AppModule:
    name: str                                        # kebab-case 模組名
    routers: tuple[APIRouter, ...] = ()              # 掛載順序 = 宣告順序
    on_startup: tuple[Callable[[], None], ...] = ()  # 由上而下執行
    on_shutdown: tuple[Callable[[], None], ...] = () # 由下而上（LIFO）執行
```

規格：

- 所有業務模組**只能**在 `app/modules.py` 的 `MODULES` 表註冊；`app/main.py` 禁止直接 import 業務模組。
- 路由順序約束：`chat` 模組必須先於其他掛載 `/api/chat/*` 前綴的模組（`agents`、`ui-config`、`scheduled-tasks`），維持 FastAPI 路徑匹配歷史順序。
- 生命週期以 FastAPI lifespan 實作，不得再使用 `@app.on_event`。

#### B.1.2 Slot 判定（Phase 0，已實作）

```python
# app/session/slot_policy.py
def slot_has_value(slots: Mapping[str, Any] | None, field: str) -> bool
```

- 唯一實作；`None` / `""` / `[]` / `{}` 一律視為未填。
- 禁止任何模組再自行定義 `_slot_has_value`；語意如需分歧，必須在此檔擴充參數而非複製。

#### B.1.3 回合管線（Phase 2 規格）

```python
# modules/orchestration/pipeline.py（目標形狀）
class TurnStage(Protocol):
    def run(self, state: TurnState, emit: TurnEmitter) -> TurnState: ...

class TurnEmitter(Protocol):
    def emit(self, event: str, data: Mapping[str, Any]) -> None: ...

@dataclass
class TurnState:              # 每階段唯一的輸入/輸出載體（Pydantic 或 dataclass）
    request: ChatTurnRequest
    context: TurnContext | None = None
    decision: RouterDecision | None = None
    step: StepAgentResult | None = None
    executions: list[ActionExecution] = field(default_factory=list)
    response: TurnResponse | None = None
```

- 階段實作：`TurnContextBuilder`、`SceneRouter`、`SlotStateMachine`（收編 `SkillRuntime`）、`StepPlanner`、`ToolActionExecutor`、`KnowledgeQueryExecutor`、`GeneralSkillExecutor`、`ReflectionPolicy`、`ResponseComposer`、`TurnFinalizer`。
- 每個階段一個檔案、單元可測（以假 LLM client 注入）；阻塞與 SSE 走同一條管線，差別只在 `TurnEmitter` 實作。
- 拆解策略：先以 delegation 從 `AgentLoop` 抽出 executor（`AgentLoop` 方法改為轉呼叫新元件、簽名不變），全測試綠燈後再收斂 `handle_turn_stream`。
- `ChatSession` 的 8 個 JSON 欄位由 `SlotStateMachine` 獨佔讀寫；其他階段只能透過 `TurnState` 取得投影。

#### B.1.4 服務層（Phase 1 規格）

- 每個模組結構：`modules/<name>/{api.py, service.py, schema.py}`（必要時 `models.py`、`jobs.py`）。
- `api.py` 只允許：路由宣告、`Depends` 權限、schema 驗證轉換；**每個 endpoint 函式體 ≤ 30 行**，超過即下沉 service。
- service 函式簽名一律 `def fn(db: Session, tenant_id: str, ...) -> SchemaOut`；不得回傳 ORM 物件給 api 層以外的呼叫者。
- 跨模組呼叫只能 import 對方的 `service` 公開函式與 `schema`，禁止 import `models` 與私有函式（`_` 開頭）。

#### B.1.5 基礎設施（Phase 3 規格）

- **LLMClientPool**：`llm/pool.py`，以 `model_config.id + updated_at` 為鍵快取 client；prompt 檔案改為模組載入時讀取並以 mtime 失效。
- **設定**：拆為 `AppSettings` / `ModelSettings` / `GeneralSkillRuntimeSettings`，環境變數改 `STAFFDECK_` 前綴、舊 `ULTRARAG_` 以 alias 相容一個版本。
- **遷移**：導入 Alembic，`db/database.py` 的 `_migrate_*` 轉為初始 baseline revision；新欄位一律走 revision。
- **依賴解環**：`memory→core` 以將 `compact_step_result` 下沉至 `session/`（或獨立 `projection/`）解除；`db.seed→agents` 以 seed 移入 `modules/agents/seed.py` 並由模組 `on_startup` 註冊解除。

### B.2 前端元件契約

#### B.2.1 傳輸核心（Phase 0，已實作）

- `src/api/client.ts` 僅保留：`request`、`streamRequest`（SSE 解析唯一實作）、`ApiError`、auth header。`streamPost` / `streamGet` 為 `streamRequest` 的薄包裝。
- 新增 endpoint 一律建立 `src/api/endpoints/<domain>.ts`（Phase 1）：

```ts
// 目標形狀：src/api/endpoints/tools.ts
export const toolsApi = {
  list: (params: ToolListParams) => api.get<ToolListResponse>(`/api/enterprise/tools?${qs(params)}`),
  get: (id: string, params: TenantParams) => api.get<ToolRead>(`/api/enterprise/tools/${id}?${qs(params)}`),
  create: (body: ToolCreate) => api.post<ToolRead>('/api/enterprise/tools', body),
  // ...
};
```

  頁面元件內禁止出現字串字面值 URL。

#### B.2.2 資料抓取（Phase 0，已實作）

```ts
// src/hooks/useApiQuery.ts
useApiQuery<T>(fetcher: (() => Promise<T>) | null, deps, { onError? }): {
  data, loading, error, refresh, setData
}
```

- 取消保護（unmount 後不 setState）、`null` fetcher = idle、`refresh()` 重抓。
- 所有新的「進頁面抓資料」一律使用本 hook；禁止再新寫 `useEffect + api.get + setLoading` 樣板。

#### B.2.3 表單元件（Phase 0，已實作）

```ts
// src/components/form/SectionCard.tsx
SectionCard: { title?, extra?, loading?, className?, headerClassName?,
               titleClassName?, bodyClassName? } & HTMLAttributes
Field:       { label, htmlFor?, hint?, labelClassName?, hintClassName?, children }
```

- 頁面以薄 preset wrapper 綁定自身樣式常數（結構與 loading 邏輯共用一份）。
- 其他重複出現 ≥ 2 次的 UI 樣板（StatCard 列、Editor 雙欄骨架等）比照抽入 `components/form|layout/`。

#### B.2.4 功能域結構（Phase 2 規格）

```
features/<domain>/
├── pages/        # 一個路由一檔，僅組合 hooks + components，≤ 300 行
├── components/   # 該域專用視圖元件（純 props 進出）
├── hooks/        # useXxx 資料 hooks（useApiQuery + endpoints 組合）
└── lib/          # 純函式（payload 組裝/驗證/格式化），需可單元測試
```

- 編輯器頁以 `mode: 'new' | 'edit'` prop 復用，路由 wrapper 不再手寫兩份。
- `useChatSession` 拆分規格：`useChatMessages`（訊息串與分頁）、`useChatStream`（SSE 連線生命週期、取消）、`useChatQueue`（佇列與草稿，收編 `chatQueueStorage`）、`useChatAttachments`；由 ≤ 200 行的 `useChatSession` 組合並保持對 `ChatPage` 的既有回傳介面。

#### B.2.5 狀態與路由（Phase 1 規格）

- `app/AuthProvider.tsx`：提供 `{ currentUser, logout }`；頁面一律 `useAuth()`，刪除 `currentUser`/`onLogout` props。
- `app/routes.tsx`：以 `RouteObject[]` 宣告路由表，`guard: 'admin' | 'employee' | 'public'` 欄位取代條件式三組 `<Routes>`；`<ProtectedRoute>` 統一導向。
- `stores/`：以 Context+reducer 或 zustand 取代 localStorage CustomEvent 匯流排；localStorage 只作持久化（store 內部細節），元件不得直接 `addEventListener('storage'|custom)`。

### B.3 通用開發守則

1. **檔案上限**：後端單檔 ≤ 400 行、前端元件 ≤ 300 行；超過需在 PR 說明理由。
2. **一份實作**：同邏輯第二次出現即抽共用元件；review 硬性標準。
3. **禁止延遲匯入解環**：出現循環依賴 = 邊界劃錯，必須反轉依賴或下沉共用層。
4. **行為相容**：重構提交不得混入行為變更；後端以 512 個既有測試護航，前端以 `tsc -b` + `vite build` + 手動路由驗證。
5. **測試**：新後端元件需附單元測試（假 LLM/DB 注入）；前端 `features/*/lib` 純函式需可測（後續導入 vitest）。
6. **命名**：後端模組 snake_case、模組名 kebab-case（`AppModule.name`）；前端檔名 PascalCase（元件）/ camelCase（hooks、lib）。

### B.4 Phase 0 已交付清單（本分支）

| 類別 | 檔案 | 內容 |
| --- | --- | --- |
| 新增 | `backend/app/module_registry.py` | `AppModule` 契約 + `install_modules`/`run_startup`/`run_shutdown` |
| 新增 | `backend/app/modules.py` | 18 個模組宣告式註冊表（22 個 router + 生命週期掛勾） |
| 重寫 | `backend/app/main.py` | `create_app()` 組裝根、lifespan 取代 `on_event`，92 → 48 行 |
| 修改 | `backend/app/session/slot_policy.py` | 新增唯一 `slot_has_value` |
| 修改 | `backend/app/core/{agent_loop,step_agent,response_generator}.py` | 移除 4 處重複 slot 判定 |
| 新增 | `frontend-enterprise/src/components/form/SectionCard.tsx` | 共用 `SectionCard`/`Field` |
| 新增 | `frontend-enterprise/src/hooks/useApiQuery.ts` | 共用資料抓取 hook |
| 修改 | `frontend-enterprise/src/api/client.ts` | SSE 解析收斂為 `streamRequest` 一份 |
| 修改 | `frontend-enterprise/src/pages/{ToolsPage,GeneralSkillsPage}.tsx` | 改用共用元件；`ToolTestPage` 示範 `useApiQuery` |

驗證：後端 512 測試全數通過；OpenAPI 路由表 160 端點與重構前逐一比對一致；前端 typecheck + build 通過。
