# 給 AI 助手（Codex CLI 等）的說明

這是使用者 Fork 的「大富翁4 跨網連線版」。**開始任何工作前，先讀 `README.md` 開頭的「目前進度」與「下一步（詳細做法）」**，那裡有現況、下一步要做什麼、怎麼做，以及必須遵守的規則（「給 AI 助手的規則」）。

技術細節與歷史紀錄在 `docs/online/PROGRESS.md`；在新電腦上建置照 `docs/online/HOME-SETUP.md`。

重點規則（完整版在 README）：
- 使用繁體中文與使用者溝通。
- 工作分支 `feature/online`，推送後把 `main` 快轉到同一個 commit；禁止推送到 `upstream`。
- 絕不提交 `game/public/assets/`（版權素材）與 `game/.env.local`（Firebase 設定）。
- 每完成一個步驟，更新 `docs/online/PROGRESS.md` 與 `README.md` 的進度。
