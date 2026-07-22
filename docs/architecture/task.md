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
| 1.1 | ⬜ `api/chat.py` 業務邏輯下沉（標題摘要、排程草稿偵測、接管恢復 → service） | 後端 | 中 |
| 1.2 | ⬜ `api/agents.py`、`api/general_skills.py`、`api/skills.py` 下沉 service，單檔 < 400 行 | 後端 | 中 |
| 1.3 | 🔄 建立 `src/api/endpoints/<domain>.ts`，逐域收編 167 處內嵌 URL（✅ tools/agents ・ ⬜ knowledge → skills → chat） | 前端 | 大 |
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
| 3.2 | ⬜ 解除循環依賴：`memory↔core`（`compact_step_result` 下沉）、`db.seed↔agents`（seed 移入模組 on_startup）、`db↔general_skills` | 後端 | 中 |
| 3.3 | ✅ SkillCard/graph schemas 下沉至中性 `app/skill_card.py`；`skill_schema` re-export（skills 域匯入不變）；`knowledge/service` 改匯入 skill_card，knowledge→skills 依賴解除 | 後端 | 小 |
| 3.4 | ⬜ Alembic 取代 `db/database.py` 手寫 `_migrate_*`（現有遷移轉 baseline revision） | 後端 | 中 |
| 3.5 | ✅ `_get_openai_client` 快取 OpenAI client（跨呼叫重用連線池，執行緒安全）；`prompt_cache.read_prompt` 以 mtime 快取 prompt 檔案（step_agent 每回合 8 檔→快取） | 後端 | 小 |
| 3.6 | ⬜ 設定拆域（App/Model/GeneralSkillRuntime）+ `STAFFDECK_` 前綴（相容 `ULTRARAG_`） | 後端 | 小 |
| 3.7 | ⬜ `stores/` 取代 localStorage + CustomEvent 匯流排（151 處、27 檔） | 前端 | 大 |
| 3.8 | ⬜ 統一樣式慣例：淘汰 `distillPageStyles.ts`/`chatPageStyles.ts` inline style 物件 | 前端 | 中 |

### 新功能：知識 Wiki + 聊天 UX（已完成）

- ✅ 後端 Wiki 端點（`app/api/knowledge_wiki.py` + `app/knowledge/wiki.py`）：KB outline 樹狀聚合、
  LLM 跨頁問答 SSE 串流（複用 `KnowledgeService.search` 檢索、含引用），4 個單元測試護航
- ✅ 前端 Wiki 視圖（`src/pages/WikiPage.tsx`）：三欄（目錄樹 / 正文閱讀 / 問 Wiki 串流面板），
  使用 endpoint 層（`api/endpoints/knowledge.ts`）+ `useApiQuery` + `SectionCard` 共用元件
- ✅ 導覽整合：路由 enum、側邊欄「知識 Wiki」、App.tsx 路由
- ✅ 聊天 UX：完成的助理訊息新增「複製」按鈕（`CopyMessageButton`），串流中顯示閃爍遊標

### 待議（需產品/團隊決策）

- ⬜ 前端測試基礎建設（vitest + `features/*/lib` 純函式測試）
- ⬜ i18n 改造：由 MutationObserver DOM 翻譯改為 key-based `t()`（涉及全部元件內硬編中文）
- ⬜ 環境變數/內部 token 舊名（`ULTRARAG_*`、`X-UltraRAG-Internal-Token`）淘汰時程
- ⬜ `mock.py` 模擬電商 API 是否抽離為獨立 dev-only 模組

## 建議執行順序

1. Phase 1（1.4 → 1.5 → 1.3 → 1.1 → 1.2）：低風險、立即降低每日開發摩擦。
2. Phase 2 後端（2.1 → 2.2 → 2.3）與前端（2.4 → 2.5 → 2.6 → 2.7 → 2.8 → 2.9）可並行，各自小步 PR。
3. Phase 3 在管線穩定後進行；3.1 依賴 2.3 完成。
