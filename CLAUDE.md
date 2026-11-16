# Rich4 跨網連線版（使用者的 Fork）

開始任何工作前，先讀 `docs/online/PROGRESS.md`：裡面有目標、目前進度、下一步。

- **在新的電腦上（例如還沒有 `game/public/assets` 或 `game/.env.local`）**：依 `docs/online/HOME-SETUP.md` 從頭建置，那份文件假設你沒有任何先前的記憶。
- 使用繁體中文與使用者溝通。
- 工作分支 `feature/online`；推送後也把 `main` 快轉到同一個 commit（GitHub 首頁顯示 `main`）。`upstream`（原作者）禁止推送。
- 提交身分用 `XiangYuChiu <61840928+XiangYuChiu@users.noreply.github.com>`（repo 本地設定），不要用公司信箱。
- `game/public/assets/` 是有版權的素材，`game/.env.local` 是 Firebase 設定，兩者都絕不提交或上傳；打包產物放在 repo 外面。
- 每完成一個步驟，更新 `docs/online/PROGRESS.md` 的狀態表與「最後更新」，並同步 `README.md` 的進度表。
