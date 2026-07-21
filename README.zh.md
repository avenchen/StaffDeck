<div align="center">

<img src="packaging/assets/staffdeck_banner_cn.png" alt="StaffDeck 標誌"  />

<p align="center">
  <a href="https://staffdeck.openbmb.cn/"><img src="https://img.shields.io/badge/Website-staffdeck.openbmb.cn-FF6B35?style=flat-square&logo=googlechrome&logoColor=white" alt="Official Website"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL_3.0-blue.svg?style=flat-square" alt="License"/></a>
  <a href="https://github.com/OpenBMB/StaffDeck/stargazers"><img src="https://img.shields.io/github/stars/OpenBMB/StaffDeck?style=flat-square" alt="Stars"/></a>
  <br/>
  <a href="#-聯繫我們"><img src="https://img.shields.io/badge/Discord-社群-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord"/></a>
  &nbsp;
  <a href="#-聯繫我們"><img src="https://img.shields.io/badge/飛書-交流群-00D6B9?style=for-the-badge&logo=bytedance&logoColor=white" alt="Feishu"/></a>
  &nbsp;
  <a href="#-聯繫我們"><img src="https://img.shields.io/badge/微信-交流群-07C160?style=for-the-badge&logo=wechat&logoColor=white" alt="WeChat"/></a>
  <br/>
</p>

[English](./README.md) | **簡體中文**


</div>


## 更新日誌

  - **2026-07-15**：StaffDeck正式開源！歡迎大家使用反饋與Star支持。

# 💡 關於StaffDeck

StaffDeck是一套面向企業的數字員工構建與管理平臺，幫助專業員工將工作經驗、業務流程和判斷標準固化為可以持續工作的數字員工，接手重複性任務，並將個人能力沉澱為可複用、可迭代、可追溯的組織資產。StaffDeck由[面壁智能](https://modelbest.cn/)，[東北大學-面壁智能數據智能聯合實驗室](https://neuir.github.io/)，[清華大學THUNLP實驗室](https://nlp.csai.tsinghua.edu.cn/)，[OpenBMB](https://www.openbmb.cn/home)與[AI9Stars](https://github.com/AI9Stars)聯合研發，面向希望將 AI 從個人效率工具升級為組織生產力的企業與機構。

## 核心亮點

- 🧑‍💼 **數字員工構建與管理**：將專業員工的經驗、流程和判斷標準固化為擁有崗位、工號、能力檔案和工作記錄的數字員工；支持能力成長、權限隔離及發佈複用。
- 🧩 **狀態機驅動的流程型技能**：通過自然語言生成結構化 SOP，以狀態機保證複雜流程準確執行；支持多個流程實時切換、上下文保留、可視化編輯、版本管理和分支演化。
- 📚 **文檔結構感知的知識檢索**：基於文檔、章節、頁面和摘要等層級構建可導航索引，讓數字員工先判斷信息可能位於哪裡，再逐層定位原文；支持知識分桶、定向檢索、來源引用和檢索調試。
- 🔌 **自主執行與持續迭代**：通過 HTTP API、MCP 和定時任務執行真實業務操作，並結合長期記憶、完整 Trace、真人接管、用戶反饋和反饋分析形成持續迭代閉環。

## 客戶端下載

訪問 [StaffDeck 官方網站](https://staffdeck.openbmb.cn/)，或直接下載最新桌面客戶端：

| 平臺 | 架構 | 下載 |
| --- | --- | --- |
| macOS | Apple Silicon（arm64） | [下載 `.dmg`](https://github.com/OpenBMB/StaffDeck/releases/latest/download/StaffDeck-macos-arm64.dmg) |
| Windows | x64 | [下載安裝程序 `.exe`](https://github.com/OpenBMB/StaffDeck/releases/latest/download/StaffDeck-windows-x64-setup.exe) |
| Linux | x86_64（Debian/Ubuntu） | [下載 `.deb`](https://github.com/OpenBMB/StaffDeck/releases/latest/download/StaffDeck-linux-x86_64.deb) |

## Agent 一鍵部署

將下面的 Prompt 粘貼給 Cursor、Claude Code 或 Codex：

```text
閱讀 https://raw.githubusercontent.com/OpenBMB/StaffDeck/main/README.zh.md。
克隆 OpenBMB/StaffDeck 私有倉庫，準備 Python 3.11 和 Node.js 20，創建
backend/.venv，安裝前後端依賴，將 backend/.env.example 複製為
backend/.env；缺少 OpenAI 兼容模型地址或 API Key 時向我詢問；運行
DETACH=1 scripts/dev_up.sh，並驗證 /api/health 和 /workspace/gallery 後再報告完成。
```


## 目錄

- [💡 關於StaffDeck](#-關於staffdeck)
  - [核心亮點](#核心亮點)
  - [客戶端下載](#客戶端下載)
  - [Agent 一鍵部署](#agent-一鍵部署)
  - [目錄](#目錄)
  - [快速開始](#快速開始)
    - [環境要求](#環境要求)
    - [1. 克隆並安裝](#1-克隆並安裝)
    - [2. 配置模型](#2-配置模型)
    - [3. 啟動 Web Demo](#3-啟動-web-demo)
    - [4. 驗證安裝](#4-驗證安裝)
    - [常用命令](#常用命令)
  - [核心流程](#核心流程)
  - [項目結構](#項目結構)
  - [常見問題](#常見問題)
  - [路線圖](#路線圖)
- [💬 聯繫我們](#-聯繫我們)
  - [參與貢獻](#參與貢獻)
  - [風險與限制](#風險與限制)
  - [引用](#引用)
  - [許可證](#許可證)
  - [致謝](#致謝)

## 快速開始

### 環境要求

- 使用開發腳本時需要 macOS、Linux 或 WSL
- Python **3.11+**
- Node.js **20+** 與 npm
- OpenAI Chat Completions 兼容的模型接口和 API Key
- 應用本身不要求 CUDA；硬件要求由所選擇的模型服務決定

### 1. 克隆並安裝

```bash
git clone https://github.com/OpenBMB/StaffDeck.git
cd StaffDeck

python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -e "backend[dev]"
npm --prefix frontend-enterprise ci
cp backend/.env.example backend/.env
```

### 2. 配置模型

首次啟動前編輯 `backend/.env`：

```dotenv
APP_SECRET="請替換為足夠長的隨機字符串"
DEMO_MODEL_BASE_URL="https://你的OpenAI兼容接口/v1"
DEMO_MODEL_NAME="你的模型名"
DEMO_MODEL_API_KEY="你的API-Key"
```

API Key 用於創建初始模型配置，存入數據庫前會被加密。請勿提交 `backend/.env`。服務啟動後也可以在**管理員 → 模型配置**中管理模型服務。

### 3. 啟動 Web Demo

```bash
DETACH=1 scripts/dev_up.sh
```

腳本會構建 StaffDeck 前端，並由一個 FastAPI 進程在 `5173` 端口同時提供 UI、API 與 Swagger 文檔。默認管理員賬號為 `admin` / `admin`，請在首次登錄後通過賬號配置修改密碼。

### 4. 驗證安裝

```bash
curl http://127.0.0.1:5173/api/health
```

預期輸出：

```json
{"status":"ok"}
```

打開 [http://127.0.0.1:5173/workspace/gallery](http://127.0.0.1:5173/workspace/gallery)，選擇一個數字員工併發送首條消息。回答和執行記錄應該在同一個對話輪次中流式顯示。

### 常用命令

```bash
scripts/dev_status.sh       # 查看服務狀態
scripts/dev_down.sh         # 停止本地服務
scripts/dev_up.sh           # 前臺運行
```

> 完整說明 → [StaffDeck 使用教程](https://staffdeck.openbmb.cn/#/docs/introduce?lang=zh)




## 核心流程

1. **創建數字員工**：設置職位、崗位邊界、服務風格、創建者與訪問範圍。
2. **配置員工能力**：從廣場複製或自行創建知識庫、通用技能、SOP 與工具，不修改廣場原件。
3. **發起會話**：從數字員工廣場或員工列表進入；發送首條消息後持久化正式 Session。
4. **執行並觀測**：在執行記錄中查看流式意圖、檢索、技能、工具、校驗和回答事件。
5. **必要時介入**：繼續排隊請求、取消運行、轉人工或處理待回答內容。
6. **持續運營**：利用記憶、反饋、對話日誌和定時任務長期優化員工能力。

## 項目結構

```text
StaffDeck/
├── backend/                  # FastAPI 接口、Agent 運行時、存儲與任務 Worker
├── frontend-enterprise/      # React/TypeScript StaffDeck 工作臺
├── docs/                     # 教程、API、Schema 與示例流程
├── scripts/                  # 單端口服務生命週期與校驗腳本
├── packaging/                # macOS、Linux 與 Windows 打包資源
├── README.md                 # English
└── README.zh.md              # 簡體中文
```


## 常見問題

<details>
<summary><strong>頁面可以打開，但數字員工不回答。</strong></summary>

檢查所選模型配置、API Key、模型名和模型服務網絡。隨後查看執行記錄與 `.dev/logs/app.log`，定位模型服務返回的具體錯誤。
</details>

<details>
<summary><strong>沒有本地 GPU 可以運行嗎？</strong></summary>

可以。應用調用 OpenAI 兼容模型接口，GPU 要求由你自行部署或使用的模型服務決定。
</details>

<details>
<summary><strong>為什麼普通用戶可以使用廣場資源，但不能編輯？</strong></summary>

廣場資源是可複用模板。普通用戶可將有權限的資源複製或綁定到自己的員工，原始資源仍由創建者與管理員權限保護。
</details>

## 路線圖

- [ ] 群聊，多數字員工溝通/分工
- [ ] 更多企業連接器與經過審核的廣場資源
- [ ] 面向高風險工具動作的細粒度審批策略

路線優先級由真實部署需求驅動。請通過 [Issue](https://github.com/OpenBMB/StaffDeck/issues) 提供可復現的場景和預期行為。

# 💬 聯繫我們
- 關於技術問題及功能請求，請提交 [GitHub Issues](https://github.com/OpenBMB/StaffDeck/issues)。
- 商業合作，請聯繫：
  ```
  business@modelbest.cn
  ```
- 歡迎加入我們的社區與我們交流：

<table width="100%">
<tr>
<td width="33%" align="center"><b>微信交流群</b></td>
<td width="33%" align="center"><b>飛書交流群</b></td>
<td width="33%" align="center"><b>Discord 社區</b></td>
</tr>
<tr>
<td align="center"><img src="packaging/assets/qr-wechat.png" width="200" alt="微信二維碼"/></td>
<td align="center"><img src="packaging/assets/qr-feishu.jpg" width="200" alt="飛書二維碼"/></td>
<td align="center"><img src="packaging/assets/qr-discord.png" width="200" alt="Discord 二維碼"/></td>
</tr>
</table>

## 參與貢獻

歡迎獲得倉庫權限的協作者參與：

- 提交可復現的 Bug 與權限問題
- 提議數字員工、知識、技能、SOP 或工具流程
- 提交範圍清晰、包含測試與瀏覽器校驗的 PR
- 改進文檔和中英翻譯

請保留工作區中與任務無關的修改，根據影響範圍補充測試，並在 PR 中寫明完成 UI 校驗的路由與用戶角色。

## 風險與限制

- 模型回答可能不正確、不完整或不一致；執行記錄可以提高可審計性，但不能保證結論正確。
- 知識檢索效果受原始文檔質量、解析、索引、權限與模型能力共同影響。
- 外部工具與生成的 Runner 可能產生真實副作用。應使用最小權限憑據，併為高風險動作配置人工審批。
- 定時任務依賴持續運行的 Worker 與正確的用戶時區設置。
- 本項目不能替代法律、醫療、金融、安全及其他受監管領域的專業審核。
- 未獲得適當授權、隱私保護與人工監督時，不得使用本平臺處理數據或自動作出重要決定。

## 引用

在內部研究或經授權的公開材料中使用 StaffDeck 時，可引用：

```bibtex
@software{StaffDeck2026,
  title  = {StaffDeck: Build, Run, and Govern Enterprise Digital Employees},
  author = {OpenBMB},
  year   = {2026},
  url    = {https://github.com/OpenBMB/StaffDeck}
}
```


## 許可證

本項目基於 GNU Affero General Public License v3.0 開源。

## 致謝

StaffDeck 由 [OpenBMB](https://www.openbmb.cn/) 生態孵化。
