import { useEffect } from 'react';
import StaffdeckIcon, { type StaffdeckIconName } from '../components/StaffdeckIcon';

type TocGroup = {
  title: string;
  items: Array<{ id: string; label: string }>;
};

type Feature = {
  title: string;
  subtitle: string;
  body: string;
  icon: StaffdeckIconName;
  proof: string;
};

type QuickStep = {
  title: string;
  body: string;
  outcome: string;
};

type Scenario = {
  title: string;
  body: string;
  stack: string;
  tags: string[];
};

const TOC_GROUPS: TocGroup[] = [
  {
    title: '開始使用',
    items: [
      { id: 'intro', label: '項目簡介' },
      { id: 'install', label: '安裝說明' },
      { id: 'quickstart', label: '快速開始' },
    ],
  },
  {
    title: '核心功能',
    items: [
      { id: 'core-features', label: '能力總覽' },
      { id: 'runtime', label: '運行閉環' },
      { id: 'governance', label: '治理與復盤' },
    ],
  },
  {
    title: '架構說明',
    items: [
      { id: 'architecture', label: '架構概覽' },
      { id: 'flow', label: '執行流程' },
    ],
  },
  {
    title: '參考與案例',
    items: [
      { id: 'reference', label: '配置參考' },
      { id: 'development', label: '開發指南' },
      { id: 'showcase', label: '案例展示' },
      { id: 'faq', label: '常見問題' },
    ],
  },
];

const FEATURES: Feature[] = [
  {
    title: '數字員工',
    subtitle: '崗位邊界',
    body: '每個員工獨立維護崗位描述、服務範圍、資源綁定和運營記錄，適合把客服、導購、運營、知識助手拆成不同角色。',
    icon: 'user',
    proof: '檔案 / 資源 / 權限',
  },
  {
    title: '知識庫',
    subtitle: '可信來源',
    body: '把制度、商品、交付和服務口徑解析為可檢索片段，回覆時保留引用線索，降低“聽起來對但查不到來源”的風險。',
    icon: 'database',
    proof: '文檔 / 桶 / 片段 / 引用',
  },
  {
    title: '技能',
    subtitle: '可複用能力',
    body: '把瀏覽器、查詢、文檔處理、MCP 或項目工作流沉澱為技能，讓能力能被多個員工複用和迭代。',
    icon: 'spark',
    proof: '運行測試 / 版本 / 發佈',
  },
  {
    title: 'SOP',
    subtitle: '流程約束',
    body: '用節點、必填信息、允許動作、中斷策略和回覆規則描述流程；已滿足的信息不重複追問，只推進真正缺失的部分。',
    icon: 'filter',
    proof: '節點 / 槽位 / 動作白名單',
  },
  {
    title: '工具',
    subtitle: '業務動作',
    body: '通過 HTTP 工具和內置工具連接訂單、商品、知識檢索或內部服務，讓員工可以查詢、校驗、創建和觸發動作。',
    icon: 'tool',
    proof: 'Schema / 測試 / 調用日誌',
  },
  {
    title: '記憶',
    subtitle: '長期上下文',
    body: '把用戶偏好、項目背景、復盤結論和協作習慣沉澱為可查記錄，幫助後續會話繼承已驗證的上下文。',
    icon: 'history',
    proof: '抽取 / 回憶 / 複用',
  },
  {
    title: '定時任務',
    subtitle: '後臺常駐',
    body: '讓員工按一次性、每日、每週或每月計劃執行提示詞，適合巡檢、週報、提醒、異常跟進和週期分析。',
    icon: 'clock',
    proof: '計劃 / 執行 / 歷史',
  },
  {
    title: '追蹤與反饋',
    subtitle: '運營閉環',
    body: '用對話日誌、Trace、反饋分析和事件記錄串起路由、工具調用、回覆與改進線索，失敗後能定位到具體環節。',
    icon: 'eye',
    proof: 'Trace / Feedback / Event',
  },
];

const QUICK_STEPS: QuickStep[] = [
  {
    title: '建立運行底座',
    body: '準備 OpenAI 兼容模型、單端口服務和 demo 租戶數據，讓企業端、對話端、API 文檔在同一個本地入口下運行。',
    outcome: '系統可啟動、頁面可訪問、模型可用於生成。',
  },
  {
    title: '定義一個真實崗位',
    body: '先選一個低風險但流程密集的崗位，例如售後服務、導購、運營巡檢或內部知識助手。',
    outcome: '崗位邊界清楚，知道它能處理什麼、不能處理什麼。',
  },
  {
    title: '補齊知識與 SOP',
    body: '把業務文檔沉澱為知識庫，把關鍵流程拆成節點、必填信息、允許動作和回覆規則。',
    outcome: '員工能按業務規則推進，而不是自由發揮。',
  },
  {
    title: '連接必要工具',
    body: '只給員工接入它真正需要的工具，例如訂單查詢、商品購買、內部查詢或知識檢索。',
    outcome: '工具調用可驗證，參數和結果都能復盤。',
  },
  {
    title: '用真實表達試跑',
    body: '不要只用標準話術測試，要用用戶真實表達覆蓋缺信息、信息已給全、改口、插話和轉人工。',
    outcome: '流程能跳過已滿足信息，並在關鍵動作前確認。',
  },
  {
    title: '把結果變成運營資產',
    body: '通過 Trace、反饋、記憶和定時任務沉澱失敗原因、穩定口徑和長期任務。',
    outcome: '一次測試能變成下一輪配置改進。',
  },
];

const SCENARIOS: Scenario[] = [
  {
    title: '售後服務員工',
    body: '退款、退貨、換貨流程需要確認訂單、查詢資格、收集原因並控制承諾邊界，是最適合驗證 SOP 和工具調用的場景。',
    stack: '售後 SOP -> 訂單查詢工具 -> 風險回覆規則 -> Trace 復盤',
    tags: ['訂單確認', '資格查詢', '轉人工'],
  },
  {
    title: '電商導購員工',
    body: '通過商品知識庫、比價技能和購買工具，完成推薦、價格解釋、下單確認和結果反饋。',
    stack: '商品知識庫 -> 比價技能 -> 購買 SOP -> 工具結果反饋',
    tags: ['商品知識', '價格對比', '下單確認'],
  },
  {
    title: '運營常駐員工',
    body: '週期巡檢、週報、異常提醒和待辦跟進可以配置為定時任務，讓員工在後臺持續推進。',
    stack: '定時任務 -> 運行記錄 -> 記憶沉澱 -> 下輪複用',
    tags: ['Cron', '週報', '持續跟蹤'],
  },
  {
    title: '內部知識助手',
    body: '把制度、交付文檔和服務規範沉澱為知識庫，再用引用和反饋持續修正口徑。',
    stack: '知識庫 -> 引用回覆 -> 反饋分析 -> 知識更新',
    tags: ['制度問答', '引用來源', '口徑治理'],
  },
];

const ARCHITECTURE_LAYERS = [
  ['入口層', '對話端承接真實用戶表達；企業端負責配置、運營和復盤。'],
  ['配置層', '模型、員工、知識庫、技能、SOP、工具、定時任務共同定義員工能力。'],
  ['運行層', 'Router、Agent Loop、Skill Runtime 和 Response Generator 推進任務。'],
  ['上下文層', '知識引用、長期記憶、會話狀態和反饋結果進入下一次決策。'],
  ['觀測層', 'Trace、事件日誌和反饋分析讓每次執行都能被追蹤和改進。'],
];

export default function TutorialPage() {
  useEffect(() => {
    const rawHash = window.location.hash.slice(1);
    if (!rawHash) return undefined;
    let targetId = rawHash;
    try {
      targetId = decodeURIComponent(rawHash);
    } catch {
      targetId = rawHash;
    }

    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.scrollY - 24;
      const previousScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, Math.max(top, 0));
      document.documentElement.style.scrollBehavior = previousScrollBehavior;
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <main className="tutorial-doc-page">
      <section className="tutorial-doc-hero" id="intro">
        <div className="tutorial-doc-hero-copy">
          <span className="ui-typography tutorial-doc-eyebrow">StaffDeck Docs</span>
          <h1 className="ui-typography">企業數字員工運行時，從配置到持續運營</h1>
          <p className="ui-typography">
            StaffDeck 把模型、數字員工、知識庫、技能、SOP、工具、記憶、定時任務和 Trace 放到一條鏈路裡，
            讓企業擁有可配置、可驗證、可復盤的業務流程對話系統。
          </p>
          <div className="tutorial-doc-actions">
            <a className="tutorial-doc-primary-action" href="#quickstart">快速開始</a>
            <a className="tutorial-doc-secondary-action" href="#core-features">查看核心功能</a>
          </div>
          <div className="tutorial-doc-proof-row">
            <span><strong>8</strong>核心模塊</span>
            <span><strong>6</strong>步運行閉環</span>
            <span><strong>4</strong>推薦場景</span>
          </div>
        </div>
        <div className="tutorial-doc-hero-map" aria-label="StaffDeck runtime map">
          <span className="tutorial-doc-map-label">Agent-native business runtime</span>
          <div className="tutorial-doc-map-grid">
            {FEATURES.slice(0, 6).map((feature) => (
              <span key={feature.title}>
                <StaffdeckIcon name={feature.icon} />
                <em>{feature.title}</em>
              </span>
            ))}
          </div>
          <div className="tutorial-doc-map-line">
            <strong>Conversation</strong>
            <i />
            <strong>Workflow</strong>
            <i />
            <strong>Operations</strong>
          </div>
        </div>
      </section>

      <div className="tutorial-doc-shell">
        <aside className="tutorial-doc-nav" aria-label="StaffDeck 單頁文檔目錄">
          <div className="tutorial-doc-nav-title">
            <span>目錄</span>
            <strong>頁面章節</strong>
          </div>
          {TOC_GROUPS.map((group) => (
            <nav key={group.title}>
              <span>{group.title}</span>
              {group.items.map((item) => (
                <a key={item.id} href={`#${item.id}`}>{item.label}</a>
              ))}
            </nav>
          ))}
        </aside>

        <div className="tutorial-doc-main">

      <section className="tutorial-doc-section tutorial-doc-intro-panel">
        <div>
          <span className="ui-typography tutorial-doc-eyebrow">項目簡介</span>
          <h2 className="ui-typography">不是通用 Agent 框架，而是面向業務流程的企業對話運行時</h2>
          <p className="ui-typography">
            StaffDeck 的核心不是“能聊天”，而是讓一個真實崗位擁有自己的配置、資源、執行規則和運營記錄。
            每個員工都可以有獨立知識、SOP、工具和記憶；每次對話都能回看路由、工具調用、回覆和反饋。
          </p>
        </div>
        <div className="tutorial-doc-pain-grid">
          <span>流程靠人盯</span>
          <span>知識口徑漂移</span>
          <span>工具調用不可控</span>
          <span>失敗無法復盤</span>
        </div>
      </section>

      <section className="tutorial-doc-section" id="install">
        <SectionHeading
          eyebrow="Getting Started"
          title="安裝與入口"
          body="推薦單端口啟動：企業端、對話端和 API 文檔都由同一個 FastAPI 進程掛載，適合本地演示和外部隧道測試。"
        />
        <div className="tutorial-doc-install-grid">
          <div className="tutorial-doc-command-card">
            <span>一鍵啟動</span>
            <code>scripts/dev_up.sh</code>
            <p>構建前端，並掛載對話端、企業端和 API。</p>
          </div>
          <div className="tutorial-doc-command-card">
            <span>後臺運行</span>
            <code>DETACH=1 scripts/dev_up.sh</code>
            <p>適合瀏覽器驗證和長時間演示。</p>
          </div>
          <div className="tutorial-doc-command-card">
            <span>查看狀態</span>
            <code>scripts/dev_status.sh</code>
            <p>確認端口、健康檢查和日誌位置。</p>
          </div>
          <div className="tutorial-doc-command-card">
            <span>停止服務</span>
            <code>scripts/dev_down.sh</code>
            <p>停止腳本託管的本地進程。</p>
          </div>
        </div>
      </section>

      <section className="tutorial-doc-section" id="quickstart">
        <SectionHeading
          eyebrow="Quick Start"
          title="從空系統到一個可復盤員工"
          body="這不是單次 demo，而是一條最短運營閉環：配置、驗證、復盤、沉澱。"
        />
        <div className="tutorial-doc-steps">
          {QUICK_STEPS.map((step, index) => (
            <article key={step.title} className="tutorial-doc-step">
              <em>{String(index + 1).padStart(2, '0')}</em>
              <div>
                <h3 className="ui-typography">{step.title}</h3>
                <p className="ui-typography">{step.body}</p>
              </div>
              <strong>{step.outcome}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="tutorial-doc-section" id="core-features">
        <SectionHeading
          eyebrow="Core Features"
          title="核心功能不是散點，而是一套員工運行系統"
          body="PilotDeck 把能力分成 WorkSpace、Router、Memory、Always On、Gateway；StaffDeck 對應到企業數字員工場景，重點是崗位邊界、知識治理、流程執行、工具調用和運營復盤。"
        />
        <div className="tutorial-doc-feature-grid">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="tutorial-doc-feature">
              <span><StaffdeckIcon name={feature.icon} /></span>
              <em>{feature.subtitle}</em>
              <strong>{feature.title}</strong>
              <p>{feature.body}</p>
              <small>{feature.proof}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="tutorial-doc-section tutorial-doc-runtime" id="runtime">
        <SectionHeading
          eyebrow="Runtime Loop"
          title="一條業務請求如何被推進"
          body="StaffDeck 的對話不是單輪問答。它會在路由、知識、技能、SOP、工具和回覆生成之間形成可追蹤執行鏈路。"
        />
        <div className="tutorial-doc-loop">
          {['用戶消息', 'Router 判斷', 'SOP / 技能推進', '知識與工具調用', '回覆生成', 'Trace / 反饋 / 記憶'].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="tutorial-doc-section" id="governance">
        <SectionHeading
          eyebrow="Operations"
          title="讓 AI 員工可運營、可治理"
          body="真正能落地的企業 AI，需要知道它做了什麼、為什麼這麼做、哪裡失敗、下一次如何改。"
        />
        <div className="tutorial-doc-governance-grid">
          {['對話日誌記錄每輪輸入輸出', 'Trace 展示路由、槽位和工具調用', '反饋分析定位失敗原因', '記憶沉澱長期偏好和復盤結論', '定時任務把週期工作常駐化', '開放廣場讓能力複製和複用'].map((item) => (
            <span key={item}><StaffdeckIcon name="check" />{item}</span>
          ))}
        </div>
      </section>

      <section className="tutorial-doc-section" id="architecture">
        <SectionHeading
          eyebrow="Architecture"
          title="架構概覽"
          body="當前倉庫由後端服務、企業端控制台和對話端組成。企業端負責配置，對話端負責使用，後端運行對話、知識、工具和任務。"
        />
        <div className="tutorial-doc-architecture">
          {ARCHITECTURE_LAYERS.map(([title, body]) => (
            <article key={title}>
              <strong>{title}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="tutorial-doc-section" id="flow">
        <SectionHeading
          eyebrow="Execution Flow"
          title="核心執行流程"
          body="從用戶消息到最終回覆，中間的每一步都應該能在日誌和 Trace 中找到證據。"
        />
        <pre className="tutorial-doc-code">{`User message
  -> Chat API
  -> Router
  -> Skill / SOP / Knowledge / Tool
  -> Agent Loop
  -> Response Generator
  -> Trace / Feedback / Memory`}</pre>
      </section>

      <section className="tutorial-doc-section" id="reference">
        <SectionHeading
          eyebrow="Reference"
          title="配置參考"
          body="這些不是跳轉入口，而是配置時應當檢查的對象和驗收標準。"
        />
        <div className="tutorial-doc-reference-grid">
          <span>模型：默認模型唯一，測試連接成功，密鑰脫敏展示。</span>
          <span>員工：崗位邊界明確，資源綁定清楚，狀態可管理。</span>
          <span>知識：文檔解析完成，能命中引用，口徑可複查。</span>
          <span>SOP：節點、槽位、允許動作和回覆規則明確。</span>
          <span>工具：參數 schema 可驗證，測試調用有結果。</span>
          <span>運營：日誌、Trace、反饋、記憶能形成閉環。</span>
        </div>
      </section>

      <section className="tutorial-doc-section" id="development">
        <SectionHeading
          eyebrow="Development"
          title="開發指南"
          body="功能開發時保持一個原則：配置變更要能被運行驗證，運行失敗要能被 Trace 解釋。"
        />
        <div className="tutorial-doc-dev-grid">
          <div><code>scripts/dev_status.sh</code><span>查看當前服務狀態</span></div>
          <div><code>scripts/dev_down.sh</code><span>停止單端口服務</span></div>
          <div><code>cd backend && .venv/bin/pytest</code><span>運行後端測試</span></div>
          <div><code>cd frontend-enterprise && npm run build</code><span>驗證企業端構建</span></div>
        </div>
      </section>

      <section className="tutorial-doc-section" id="showcase">
        <SectionHeading
          eyebrow="Showcase"
          title="適合先試跑的企業場景"
          body="先從低風險、高流程密度、可復盤的任務開始，再逐步接入更強工具和更高風險動作。"
        />
        <div className="tutorial-doc-showcase-grid">
          {SCENARIOS.map((scenario) => (
            <article key={scenario.title}>
              <h3 className="ui-typography">{scenario.title}</h3>
              <p className="ui-typography">{scenario.body}</p>
              <code>{scenario.stack}</code>
              <div>
                {scenario.tags.map((tag) => <span key={tag} className="ui-tag">{tag}</span>)}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="tutorial-doc-section" id="faq">
        <SectionHeading
          eyebrow="FAQ"
          title="常見問題排查"
          body="大多數問題可以落到模型、知識、SOP、工具、權限和 Trace 六個層面定位。"
        />
        <div className="tutorial-doc-faq">
          <details open>
            <summary>模型測試失敗怎麼辦？</summary>
            <p>檢查 API Key、Base URL 是否包含 `/v1`、模型 ID、餘額和網絡。先讓默認模型測試通過，再驗證對話端。</p>
          </details>
          <details>
            <summary>SOP 為什麼重複追問？</summary>
            <p>檢查節點 instruction、expected_user_info 和槽位抽取策略，確保已滿足信息會被跳過。</p>
          </details>
          <details>
            <summary>工具沒有被調用怎麼辦？</summary>
            <p>檢查 SOP 節點 allowed_actions、工具啟用狀態、參數 schema 和當前員工綁定關係。</p>
          </details>
          <details>
            <summary>知識庫沒有引用怎麼辦？</summary>
            <p>檢查文檔解析狀態、知識庫是否綁定到當前員工，以及問題是否覆蓋文檔中的關鍵概念。</p>
          </details>
        </div>
      </section>
        </div>
      </div>
    </main>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="tutorial-doc-section-heading">
      <span className="ui-typography tutorial-doc-eyebrow">{eyebrow}</span>
      <h2 className="ui-typography">{title}</h2>
      <p className="ui-typography">{body}</p>
    </div>
  );
}
