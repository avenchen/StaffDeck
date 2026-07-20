# StaffDeck 現有架構分析（現況盤點）

> 分析日期：2026-07-20 ・ 分析範圍：`backend/`（約 40,500 行 Python）與 `frontend-enterprise/`（約 42,400 行 TS/TSX）

## 1. 系統全貌

StaffDeck 是「企業數位員工」平台，單一 FastAPI 行程同時服務 API、SSE 串流與前端靜態資源（單埠 5173）。

```
┌─────────────────────────────────────────────────────────┐
│ single_port_app.py（正式 ASGI 入口）                      │
│  靜態資源掛載 + SPA fallback + site-chat 反向代理          │
│  └── app/main.py（FastAPI 組裝根）                        │
│       ├── api/         18 個 router（12,336 行）          │
│       ├── core/        Agent 執行引擎（9,082 行）          │
│       ├── skills/ general_skills/ knowledge/ memory/      │
│       │   feedback/ scheduled_tasks/ tools/ agents/       │
│       ├── llm/         LLM client + prompt（1,558 行）    │
│       ├── db/          SQLModel + 手寫 migration（4,380）  │
│       └── security/ observability/ session/               │
└─────────────────────────────────────────────────────────┘
frontend-enterprise/（React 18 + Vite 6 + Tailwind 4 + shadcn/ui）
```

## 2. 後端現況

### 2.1 模組清單與規模

| 模組 | 行數 | 職責 | 主要問題 |
| --- | ---: | --- | --- |
| `api/` | 12,336 | HTTP 層（18 檔） | 胖控制器；`chat.py` 3,267 行內嵌大量業務邏輯 |
| `core/` | 9,082 | Agent 執行引擎 | `agent_loop.py` 6,747 行、單一類別約 140 個方法 |
| `db/` | 4,380 | 模型、種子、遷移 | 手寫 SQLite migration；seed 反向依賴 `agents/` |
| `knowledge/` | 3,210 | RAG / 知識庫 | `service.py` 1,863 行；跨域依賴 `skills.skill_schema` |
| `skills/` | 2,352 | SOP 技能設計期工具 | `skill_distiller.py` 1,174 行 |
| `agents/` | 1,603 | 多租戶 + 資源可見性 | `branching.py` 1,483 行 |
| `llm/` | 1,558 | LLM 呼叫封裝 | 每次呼叫重建 `LLMClient`（含金鑰解密） |
| `general_skills/` | 1,341 | 程式碼型技能執行 | `runner.py` 1,070 行 |
| `tools/` | 1,096 | HTTP 工具 + MCP | — |
| 其餘 | ~3,000 | memory / feedback / scheduled_tasks / session / security / observability | 相對健康、規模合理 |

### 2.2 聊天回合的執行流程（核心路徑）

```
api/chat.py /stream (SSE)
  └── AgentLoop.handle_turn_stream()          ← 單一方法約 850 行
        ├── _prepare_turn()                    載入 session/agent/skills/tools/model
        ├── Router.decide()                    LLM 場景路由
        ├── SkillRuntime.apply_decision()      slot / pending-task 狀態機
        ├── StepAgent.run()                    LLM 決定單步行動
        ├── _execute_tool_action_cycle() /     工具、知識、通用技能執行
        │   _execute_knowledge_query_cycle() /
        │   _execute_general_skill_tool_call()
        ├── ReflectionAgent（反思重試）
        ├── ResponseGenerator.generate_stream() 產生回覆
        └── _finalize_turn()                   持久化 + 事件 + 記憶擷取
```

### 2.3 具體問題（含證據位置）

1. **上帝物件**：`core/agent_loop.py:249` 的 `AgentLoop` 一個類別混合了回合編排、工具執行、知識檢索、反思、技能圖推進、人工接管、事件記錄、標題產生等 8 種以上職責，佔整個 `app/` 的 17%。
2. **胖控制器**：`api/chat.py` 內嵌標題摘要、排程任務草稿偵測、接管恢復、取消/中斷重建等業務邏輯；`api/agents.py`、`api/general_skills.py`、`api/skills.py` 皆超過 1,200 行。
3. **循環依賴（以延遲匯入迴避）**：
   - `memory ↔ core`：`memory/service.py:65` 函式內延遲匯入 `core.context_projection`，而 `core/agent_loop.py` 頂層匯入 `memory.*`。
   - `db ↔ agents`：`db/seed.py:9` 匯入 `agents.branching`，`agents/branching.py` 匯入 `db.models`。
   - `db ↔ general_skills`：`db/seed.py:668` 函式內延遲匯入。
4. **重複實作漂移**：`_slot_has_value` 在 `core/agent_loop.py:164`、`core/agent_loop.py:5877`、`core/step_agent.py:243`、`core/response_generator.py:426` 共 4 處定義，且出現 **3 種不同語意**（對空 list/dict 的判定不一致）——重複元件已造成實際行為分歧。
5. **跨域滲漏**：`knowledge/service.py:46` 匯入 `skills.skill_schema.SkillCard`，RAG 層依賴技能設計層的 schema。
6. **字串化狀態機**：`ChatSession` 以 8 個 JSON 欄位保存 slots / skill_stack / pending_tasks 等狀態，`router.py`、`skill_runtime.py`、`agent_loop.py` 各自手動正規化 dict，造成大量防禦式 `dict.get()`。
7. **組裝根不宣告式**：`main.py` 手工 include 22 個 router，模組沒有統一的註冊契約；startup/shutdown 使用已棄用的 `@app.on_event`。
8. **設定大雜燴**：單一 `Settings` 混合模型、工具、CORS、通用技能執行環境設定；環境變數仍沿用舊名 `ULTRARAG_` 前綴。
9. **每呼叫重建物件**：每個 LLM 階段呼叫都重新解密金鑰並建構 `OpenAI()` client，無快取。
10. **無正式遷移工具**：schema 演進靠 `db/database.py`（1,409 行）內的手寫 `_migrate_*` 函式，而非 Alembic。

## 3. 前端現況

### 3.1 技術棧

React 18.3 + TypeScript 5.7、react-router-dom v7、Vite 6、Tailwind CSS v4 + shadcn/ui（31 個 primitives）。**沒有**全域狀態庫、**沒有** data-fetching 庫。

### 3.2 具體問題（含證據位置）

1. **上帝元件**（前五大檔合計約 17,600 行，佔前端 42%）：

   | 檔案 | 行數 | useState 數 | 內嵌 API 呼叫 |
   | --- | ---: | ---: | ---: |
   | `pages/DistillPage.tsx` | 6,347 | 59 | 11 |
   | `pages/chat/useChatSession.ts` | 3,363 | 43 | 8 + SSE |
   | `pages/KnowledgePage.tsx` | 3,305 | 57 | 31 |
   | `pages/GeneralSkillsPage.tsx` | 2,482 | 58 | 14 |
   | `pages/ToolsPage.tsx` | 2,188 | 40 | 18 |

   `ToolsPage.tsx` 單檔輸出 **6 個路由頁面** 與約 30 個私有子元件。
2. **無服務層**：`src/api/client.ts`（247 行）是唯一的 API 封裝；全案 167 處 `api.*` 呼叫直接在頁面內硬編 URL 字串，loading / error 處理每處自行重寫。
3. **重複的 SSE 解析**：`client.ts` 的 `streamPost` 與 `streamGet` 是幾乎相同的 reader 迴圈。
4. **土製事件匯流排**：以 `localStorage` + `window` CustomEvent 做跨元件同步（27 個檔案、151 處），取代了狀態管理。
5. **Prop drilling**：`currentUser` / `onLogout` 從 `App.tsx` 手動穿透到幾乎每個頁面。
6. **路由內嵌於 App.tsx**（995 行）：3 組 `<Routes>` 依角色條件切換，無 route config、無 `<ProtectedRoute>` 抽象。
7. **重複 UI 元件**：`SectionCard` / `Field` 在 `ToolsPage.tsx:1083` 與 `GeneralSkillsPage.tsx:1116` 各自定義一份（結構相同、樣式參數不同）。
8. **平行的樣式慣例**：Tailwind class、`lib/enterprise-ui.ts` 共用字串、`distillPageStyles.ts` / `chatPageStyles.ts` inline style 物件三者並存。
9. **i18n 以 MutationObserver 走訪 DOM 翻譯**：中文硬編於元件內，執行期以字典替換為英文——翻譯與元件完全解耦但脆弱。

## 4. 結論

前後端的共同病灶是一致的：**缺乏元件邊界契約**。功能不是以「最小元件」組合而成，而是在單一檔案／單一類別內持續長大；共用邏輯靠複製貼上（並已漂移），跨模組互動靠隱式約定（JSON dict、localStorage 事件、延遲匯入）。這是 [02-minimal-component-redesign.md](./02-minimal-component-redesign.md) 重新規劃要解決的核心。
