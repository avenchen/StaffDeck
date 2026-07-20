# StaffDeck 最小元件原則架構重規劃

> 目標：以「最小元件原則」重新劃分前後端架構，使每個元件單一職責、介面最小、可獨立測試與替換。

## 1. 最小元件原則（本專案的定義）

1. **單一職責**：一個元件只做一件事；檔案超過約 400 行或類別方法超過約 15 個即視為分割訊號。
2. **最小介面**：元件之間只透過明確的契約（typed schema / Protocol / Props）互動，不共享可變的 dict / localStorage 隱式狀態。
3. **單向依賴**：依賴只能由外向內（API → 服務 → 領域 → 平台），禁止循環匯入——包括以延遲匯入偽裝的循環。
4. **組合優於內聚成長**：新能力以「新增元件並在組裝根註冊」實現，而不是在既有大檔案內加方法。
5. **一份實作**：任何邏輯只允許存在一份（如 slot 判定、SSE 解析、SectionCard），共用即抽出。

## 2. 後端目標架構

### 2.1 分層

```
backend/app/
├── platform/                  # 平台層：無業務語意的最小元件
│   ├── config                 # 分域設定（App / Model / GeneralSkillRuntime）
│   ├── module_registry        # AppModule 契約 + 宣告式註冊（本次已實作）
│   ├── db                     # engine、migration（改用 Alembic）
│   ├── security               # auth / tenant / permissions / encryption
│   └── observability          # spans / event log
├── modules/                   # 業務模組：每個模組 = api + service + schema（+ models）
│   ├── identity/              # auth、users、tenants
│   ├── agents/                # AgentProfile、資源可見性（branching）
│   ├── conversation/          # ChatSession、Message、附件、接管
│   ├── orchestration/         # 回合管線（取代 AgentLoop，見 2.2）
│   ├── skills/                # SOP 技能（設計期）
│   ├── general_skills/        # 程式碼技能與執行環境
│   ├── knowledge/             # 知識庫 / RAG
│   ├── memory/  feedback/  scheduling/  tools/  model_configs/
└── main.py                    # 組裝根：create_app() 走訪模組註冊表
```

**模組契約**（`platform` 提供，所有模組實作同一形狀）：

```python
@dataclass(frozen=True)
class AppModule:
    name: str
    routers: tuple[APIRouter, ...] = ()
    on_startup: tuple[Callable[[], None], ...] = ()
    on_shutdown: tuple[Callable[[], None], ...] = ()
```

組裝根不再認識任何業務模組的內部；新增模組 = 在註冊表加一行。

### 2.2 AgentLoop 拆解為回合管線（orchestration 模組）

6,747 行的 `AgentLoop` 依職責切成一組最小元件，以 typed `TurnState` 串接：

```
TurnPipeline（編排器，只負責依序呼叫階段並轉發事件）
 ├── TurnContextBuilder     載入 session/agent/資源/記憶 → TurnContext
 ├── SceneRouter            包裝 Router.decide → RouterDecision
 ├── SlotStateMachine       既有 SkillRuntime（slot / pending-task）
 ├── StepPlanner            包裝 StepAgent.run → StepAction
 ├── ActionExecutor（介面）  依 action 分派到：
 │     ├── ToolActionExecutor
 │     ├── KnowledgeQueryExecutor
 │     └── GeneralSkillExecutor
 ├── ReflectionPolicy       反思重試決策
 ├── ResponseComposer       既有 ResponseGenerator
 └── TurnFinalizer          持久化、事件、記憶擷取排程
```

- 每個階段輸入輸出皆為 Pydantic 模型（`session/session_schema.py` 已有基礎），淘汰跨檔案手動正規化 JSON dict。
- 事件發送抽為 `TurnEmitter` 介面，SSE / 阻塞式呼叫共用同一條管線。
- `ChatSession` 的 8 個 JSON 狀態欄位收斂為單一 `TurnStateSnapshot` schema 的序列化，由 `SlotStateMachine` 獨佔讀寫。

### 2.3 API 層瘦身

- `api/*.py` 只保留：路由宣告、權限依賴、請求/回應 schema 轉換；業務邏輯全部下沉到各模組 `service.py`。
- `api/chat.py` 內嵌的標題摘要、排程草稿偵測、接管恢復分別移入 `conversation/`、`scheduling/`、`conversation/` 的服務。

### 2.4 其他收斂

| 項目 | 現況 | 目標 |
| --- | --- | --- |
| slot 判定 | 4 處定義、3 種語意 | `session/slot_policy.slot_has_value` 一份（已實作） |
| LLM client | 每階段呼叫重建 | 依 model config 快取的 `LLMClientPool` |
| 設定 | 單一扁平 Settings | 依域拆分子設定，環境變數改 `STAFFDECK_` 前綴（保留舊名相容） |
| migration | 手寫 `_migrate_*` | Alembic |
| startup | `@app.on_event`（已棄用） | lifespan（已實作） |
| knowledge → skills 依賴 | 直接匯入 SkillCard | SkillCard 下沉為共用 schema 或以介面反轉 |

## 3. 前端目標架構

### 3.1 分層

```
frontend-enterprise/src/
├── app/                       # 組裝根：providers、route config、guards
│   ├── routes.tsx             # 宣告式路由表（取代 App.tsx 內嵌 3 組 <Routes>）
│   └── AuthProvider.tsx       # currentUser / onLogout context（取代 prop drilling）
├── api/
│   ├── client.ts              # 只有 HTTP/SSE 傳輸核心（SSE 解析一份，已實作）
│   └── endpoints/<domain>.ts  # 每個領域一個 typed endpoint 模組（tools.ts、knowledge.ts…）
├── hooks/
│   └── useApiQuery.ts         # 共用資料抓取 hook：loading/error/refresh 一份（已實作）
├── components/
│   ├── ui/                    # shadcn primitives（不動）
│   ├── form/                  # SectionCard、Field 等表單最小元件（已實作）
│   └── layout/                # AppHeader、AppSidebar 拆分後的導航元件
├── features/<domain>/         # 每個功能域 = pages/ + components/ + hooks/
│   ├── tools/                 # ToolsPage 6 個路由頁各自成檔
│   ├── knowledge/  chat/  skills/  general-skills/  distill/ …
└── stores/                    # 型別化的跨頁狀態（取代 localStorage + CustomEvent 匯流排）
```

### 3.2 上帝元件拆解規則

每個巨型頁面依「資料 / 邏輯 / 視圖」三分：

- **資料**：`features/<domain>/hooks/useXxx.ts`（以 `useApiQuery` + endpoint 模組組成）。
- **邏輯**：純函式模組（payload 組裝、驗證、格式化），可單元測試。
- **視圖**：每個路由一個檔案，每個可命名區塊一個元件，單檔上限約 300 行。

以 `ToolsPage.tsx`（2,188 行、6 個路由）為例的目標形狀：

```
features/tools/
├── pages/ToolsListPage.tsx / ToolEditorPage.tsx / ToolTestPage.tsx
│         / McpServerEditorPage.tsx（editor 以 mode="new"|"edit" 復用）
├── components/ToolFormFields.tsx / ToolProbeCard.tsx / SavedToolTestCard.tsx
├── hooks/useTools.ts / useToolDetail.ts
└── lib/toolPayload.ts（buildToolPayload / toolToFormValues，純函式）
```

`useChatSession.ts`（3,363 行）拆為：`useChatMessages`（訊息串）、`useChatStream`（SSE 生命週期）、`useChatQueue`（佇列/草稿）、`useChatAttachments`，由薄的 `useChatSession` 組合。

### 3.3 狀態管理

- `AuthProvider` 提供 `currentUser` / `logout`，移除全部手動 prop 穿透。
- `stores/` 以輕量 store（zustand 或 React Context + reducer）承接現行 151 處 localStorage/CustomEvent 用法；localStorage 僅作為持久化後端，訂閱透過 store，不再直接 `addEventListener`。

## 4. 元件邊界守則（前後端通用）

1. 模組間只能匯入對方的 `schema` / 公開服務介面，不得匯入內部實作。
2. 禁止函式內延遲匯入來繞開循環依賴——出現循環即代表邊界劃錯，需反轉依賴。
3. 共用邏輯第二次出現時必須抽出成元件；code review 以此為硬性標準。
4. 後端單檔超過 400 行、前端元件超過 300 行需說明理由。

實施順序與風險控管見 [03-migration-plan.md](./03-migration-plan.md)。
