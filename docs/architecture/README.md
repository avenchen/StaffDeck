# StaffDeck 架構重規劃文件

以最小元件原則（minimal-component principle）對 StaffDeck 前後端進行的架構分析與重新規劃。

| 文件 | 內容 |
| --- | --- |
| [01-current-state.md](./01-current-state.md) | 現有架構盤點：模組職責、規模、耦合與問題點（含證據位置） |
| [02-minimal-component-redesign.md](./02-minimal-component-redesign.md) | 目標架構：分層、模組契約、上帝物件拆解方案、元件邊界守則 |
| [03-migration-plan.md](./03-migration-plan.md) | 分階段遷移計畫（Phase 0–3）與風險控管 |
| [04-technical-spec.md](./04-technical-spec.md) | 細節技術規格：原架構完整技術細節 + 各元件開發規格（介面契約、守則、驗收） |
| [task.md](./task.md) | 重構工作清單：已完成 / 進行中 / 可安排工作與建議執行順序 |

Phase 0（組裝根 + 共用最小元件）已在本分支實作完成，詳見 04 文件 B.4 節。
