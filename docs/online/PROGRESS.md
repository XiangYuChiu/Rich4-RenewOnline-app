# 大富翁4 跨網連線版：施作進度

> 給下一次開啟 Claude Code 的自己：先讀完這份檔案再動手。**在新電腦上請改依 `docs/online/HOME-SETUP.md` 從頭建置。**
> 最後更新：2026-11-19（朋友實測回報三個問題，見第 5.6 節；已修「下一局」會關房間）；前次 2026-11-17（README 新增「下一步（詳細做法）」與 AGENTS.md；Windows 版已在家用電腦實測可執行遊戲；第 5 站清理腳本已安裝並每小時執行；**下一步：使用者回家依 HOME-SETUP.md 第 9 節做電腦對電腦的跨網實測**（手機是 iPhone，先不做手機））

### Firebase 專案（第 2 站產出）

| 項目 | 值 |
|---|---|
| 專案 ID | `rich4-online`（Spark 免費方案） |
| 資料庫 | `https://rich4-online-default-rtdb.asia-southeast1.firebasedatabase.app` |
| 設定檔 | `game/.env.local`（`VITE_FB_*`，已被 Git 忽略；換電腦要重建，內容在 Firebase Console → 專案設定） |
| 安全規則 | `game/database.rules.json`（改了要手動貼到 Console → Realtime Database → 規則 → 發布） |
| 冒煙測試 | `cd game && NODE_OPTIONS=--use-system-ca node scripts/firebase-smoke.mjs` |
| SDK | `firebase@^13.3.0` |

## 1. 專案目標

以 [iam567/rich4-renew-app](https://github.com/iam567/rich4-renew-app) v1.2.0 為基礎，做出**不依賴原作者伺服器**、**全程免費**（不買網域、不升級付費方案）、**可跨網路連線**的版本。

- 先做**安裝版**（Windows exe / Android APK），網頁版之後再說。
- 遊戲在玩家裝置本地執行；雲端只負責轉送訊息。
- 即時連線：**Firebase Realtime Database**（Spark 免費方案，不綁信用卡）。
- Google Apps Script：只做後勤（清理過期資料、戰績寫入試算表），**不當遊戲伺服器**。
- 完整原始計畫（架構圖、優劣分析）：`D:\Persional\大富翁4跨網連線施作計畫.html`
  - ⚠️ 該計畫寫於讀程式碼之前，第 3–5 站內容已被本文件第 5 節取代。

## 2. 環境與路徑

| 項目 | 值 |
|---|---|
| 專案根目錄 | `D:\Persional\rich4` |
| 遊戲程式 | `D:\Persional\rich4\game`（Vite + TypeScript；`desktop/` 是 Electron 外殼） |
| 工作分支 | `feature/online`（從 upstream `main` 的 `e07a1f6` = v1.2.0 開出；推送後 `main` 快轉到同一個 commit） |
| `origin` | https://github.com/XiangYuChiu/Rich4-RenewOnline-app.git（使用者的 Fork） |
| `upstream` | https://github.com/iam567/rich4-renew-app.git（**push 已設為 DISABLED**） |
| 素材 | `game/public/assets/`（1.4 GB，37,787 檔，已被 `.gitignore` 排除，**絕不提交**） |
| 素材原始壓縮檔 | 公司電腦上已刪除（素材已解壓到 `game/public/assets`；SHA-256 `9cc407a5…80ed`） |
| Node / npm | v24.22.2 / 11.19.1 |
| 未安裝 | `gh`、Java（Firebase 模擬器需要 Java） |

### 這台電腦（公司網路）的特殊處理

- 公司網路有 **SSL 攔截（自簽憑證）**：
  - Git：本 repo 已設定 `http.sslBackend=schannel`（用 Windows 憑證庫）。
  - npm：指令前加 `NODE_OPTIONS=--use-system-ca`，例如 `NODE_OPTIONS=--use-system-ca npm ci`。
  - 下載檔案：用 Windows 內建的 `/c/Windows/System32/curl.exe --ssl-revoke-best-effort`（Git Bash 的 curl 不行）。
- Git Bash 的 `tar` 會把 `D:` 當成遠端主機：要先 `cd` 再用相對路徑。
- `editor/site/assets` 在 Git 裡是符號連結，Windows checkout 會變成純文字檔。已改成 **junction** 指向 `game/public/assets/maps`，並執行 `git update-index --skip-worktree editor/site/assets`。換電腦或重新 clone 時要重做：
  ```powershell
  Remove-Item editor\site\assets
  New-Item -ItemType Junction -Path editor\site\assets -Target <repo>\game\public\assets\maps
  git update-index --skip-worktree editor/site/assets
  ```
- 從 Claude 的 Bash 用 curl 測 `127.0.0.1` 會逾時，請改用 PowerShell 的 `Invoke-WebRequest`。

### 常用指令（在 `game/` 底下）

```bash
npm run dev     # http://127.0.0.1:5173/ ，第一次載入要 20–30 秒
npm test        # 目前 70 檔 / 640 測試全過（約 60 秒）
npx tsc --noEmit
```

## 3. 各站狀態

| 站 | 內容 | 狀態 |
|---|---|---|
| 0 | 環境建置與授權確認 | ✅ 完成：測試全過，使用者已在瀏覽器確認可玩 |
| 1 | 讀懂原版網路層 | ✅ 程式碼閱讀完成（見第 4 節）；⏳ **原版跨網實測待使用者回家測** |
| 2 | 建立 Firebase 專案 | ✅ 完成：專案 `rich4-online`、匿名登入、RTDB（asia-southeast1）、規則已發布；`scripts/firebase-smoke.mjs` 10 項全過，往返 153 ms |
| 3 | 實作 `firebase-peer.ts` | ✅ 完成：即時測試 5/5；使用者以 Chrome＋Edge 實測可開房、加入、擲骰（2026-11-16） |
| 4 | 切斷對原作者伺服器的依賴 | ✅ 完成：使用者已在瀏覽器重測連線正常 |
| 5 | GAS 後勤 | ✅ 定時清理已安裝（2026-11-17）：GAS 專案「rich4-online 清理」，每小時執行；首次執行刪除 36 筆（peers 34、inbox 2，皆為先前測試殘留）。戰績寫入試算表：未做，使用者決定要不要做 |
| 6 | 打包 Windows / Android | ✅ App ID 已改、Windows 版已打包，**使用者已在家用電腦確認 exe 可執行遊戲（2026-11-16 晚）**（見第 5.3 節）；Android APK **暫緩**（使用者手機是 iPhone） |
| 7 | 跨網實測 | ⬜ 改為**電腦對電腦**：優先採用「使用者在家用 exe 開房、朋友在他家用 exe 加入」；備案為電腦 B 連 iPhone 熱點。做法見 README「下一步」 |

### 待使用者回報：原版跨網實測

用**官方** v1.2.0 安裝檔：電腦（家裡網路）＋手機（**關 Wi-Fi、用行動數據**）。
派對模式 → 建立房間 → 私享房間，手機輸入 4 位數房號加入。玩幾回合，手機切背景 30 秒再切回。
要回報：能不能連上、延遲顯示幾 ms、切背景後有沒有斷。這個結果之後拿來跟我們的 Firebase 版本比較。

## 4. 第 1 站發現（原版網路架構）

### 4.1 檔案分工（`game/src/ui/`）

| 檔案 | 角色 |
|---|---|
| `net-peer.ts` | 選路：先試轉發伺服器（`relay-peer.ts`），不通再用 PeerJS 直連。對外提供 `NetPeer`、`NetConn`、`openNet()`、`relayReachable()` |
| `relay-peer.ts` | 作者轉發伺服器的用戶端（WebSocket）。`RelayPeer` 長得像 PeerJS 的 `Peer`，`RelayConn` 長得像 `DataConnection`。每則訊息有編號、斷線 60 秒內補送 |
| `party-net.ts` | 派對模式的邏輯（`Lobby`、`Room`）。**只透過 `NetPeer` / `NetConn` 收發**，不直接碰 WebSocket 或 PeerJS |
| `party-check.ts` | 連線前的網路檢查（轉發伺服器、PeerJS 配對、STUN/TURN） |
| `party-presence.ts` | 每 15 秒向作者伺服器回報在線，取得在線人數 |
| `party-report.ts` | 連線錯誤、聊天回報到作者伺服器（`/report`、`/chat`） |
| `update.ts` | 遊戲內更新，從 `https://rich.areu.pro/u` 下載 |
| `peerjs-mock.ts` | 測試用的假 PeerJS |
| 文件 | `docs/rules/22-party-mode.md`（§3.1 轉發、§5 換房主）、`docs/rules/28-lobby.md` |

### 4.2 同步模型：lockstep

- 每台裝置用**同一個亂數種子**各自執行完整遊戲；網路上只傳「玩家的選擇」（`ans`，依 `seq` 編號）。
- 房主是星狀中心：轉送並保存所有選擇；每回合廣播 `digest`（遊戲狀態雜湊），不一致的裝置會回報。
- 斷線重連（`resume` + `log` 補送）、房主轉移（下一位接手房間 ID）、電腦代打、途中加入、投票踢人：**原版都已做好**。
- 訊息型別：`party-net.ts` 約第 137–158 行的 `Msg` union。
- 房間 ID：`rich4-party-v2-room-{4 位數}`；大廳清單由某台裝置持有固定 ID `rich4-party-v2-lobby-v2`。
- 流量：作者估計每人每小時約 2 MB。

### 4.3 對原作者基礎設施的依賴（全部要處理）

| 依賴 | 位置 | 處理方式 |
|---|---|---|
| 轉發伺服器 `wss://rich.areu.pro` | `net-peer.ts` 的 `RELAYS` | 改用 Firebase（第 3 站） |
| 轉發清單 `relay.json`（從作者 GitHub 讀） | `net-peer.ts` 的 `LIST_URL` | 移除或指向自己的 repo |
| TURN `game.flj.info`（作者東京 VPS，帳密寫死） | `party-net.ts` 的 `ICE_SERVERS` | 移除；P2P 備援只留公用 STUN，或整個停用 |
| PeerJS 公用配對伺服器 | `peerjs` 預設 | 若停用 P2P 備援就不再需要 |
| 在線人數 | `party-presence.ts` | 改用 Firebase 計算，或先停用 |
| 錯誤／聊天回報 | `party-report.ts` | 停用，或改送到自己的 GAS |
| **遊戲內更新** `https://rich.areu.pro/u` | `update.ts` | **必須停用**，否則會被作者的更新覆蓋掉我們的修改 |
| 房間 ID 前綴 `rich4-party-v2-` | `party-net.ts` 的 `PREFIX` | 改成自己的前綴，避免和官方玩家混房 |
| 作者轉發伺服器的原始碼 | `tools/party-relay/relay.mjs` | **不在公開 repo 中**，無法自架，所以改用 Firebase |

## 5. 修正後的施作計畫

### 核心做法

照 `relay-peer.ts` 的介面寫一個 **`game/src/ui/firebase-peer.ts`**（`FirebasePeer` + `FirebaseConn`），在 `net-peer.ts` 裡取代 `openRelay()`。**`party-net.ts` 不修改**。

### `firebase-peer.ts` 設計草案

Realtime Database 路徑：

```
peers/{peerId}            { uid, at }        # 佔用 ID；用 transaction 搶，onDisconnect 時移除
                                             # 已斷線或 20 秒沒更新可被接手（與 relay 規則一致，房主轉移要用）
inbox/{peerId}/{pushId}   { from, cid, t, d }  # 送給 peerId 的訊息；t = conn | d | close
                                             # 接收方 onChildAdded 處理完就刪除；push key 保證同一發送者的順序
```

要對應 `RelayPeer` 的行為：

- `openRelay(url, id)` → `openFirebase(id)`：匿名登入，用 transaction 佔用 `peers/{id}`；被佔用就回傳 `null`（等同 `taken`），連不上就回傳 `'down'`。
- `connect(to)`：先讀 `peers/{to}`，不存在就觸發 `error {type:'peer-unavailable'}`（等同 `nopeer`）；存在就寫一則 `conn` 到對方的 inbox，然後 `open`。
- 對方收到 `conn` 時觸發 `'connection'` 事件，產生新的 `FirebaseConn`。
- `send(d)` → push `{t:'d'}` 到對方的 inbox；`close()` → push `{t:'close'}`。
- `'disconnected'`：監聽 `.info/connected`；Firebase SDK 會自動重連，inbox 在雲端不會遺失，所以短暫斷線不需要補送機制。
- `rtt`：用 `.info/serverTimeOffset` 或 ping 自己的 inbox 量測。

### 第 2 站：建立 Firebase 專案（使用者操作，Claude 指引）

1. Firebase Console 建立專案，**維持 Spark 方案，不綁信用卡**。
2. Authentication → 啟用「匿名」登入。
3. Realtime Database → 區域 `asia-southeast1`（新加坡）→ 以鎖定模式建立。
4. 新增「網頁應用程式」→ 取得 `firebaseConfig`。
5. 設定寫入 `game/.env.local`（根目錄 `.gitignore` 的 `.env.*` 已排除）：
   `VITE_FB_API_KEY`、`VITE_FB_AUTH_DOMAIN`、`VITE_FB_DB_URL`、`VITE_FB_PROJECT_ID`、`VITE_FB_APP_ID`
6. `NODE_OPTIONS=--use-system-ca npm i firebase`（在 `game/`）。
7. 安全規則改成符合上面 `peers` / `inbox` 結構（**不是** HTML 計畫裡的 `rooms` 結構）。
8. （選做）App Check + reCAPTCHA v3。

### 之後各站

- **第 3 站**：`firebase-peer.ts` + 單元測試（參考 `peerjs-mock.ts` 寫一個假的 RTDB；這台沒有 Java，無法跑 Firebase 模擬器）。
- **第 4 站**：處理第 4.3 節所有依賴；改 `PREFIX`；停用 `update.ts` 的遊戲內更新。
- **第 5 站**：GAS 每小時清掉 `peers` 中過期的 ID 與殘留的 `inbox`。
- **第 6 站**：`npm run package` / `desktop` 打包；確認 Android 有 `INTERNET` 權限。
- **第 7 站**：跨網實測（家用網路＋4G＋公司網路），與第 3 節的原版實測結果比較。

## 5.1 第 3 站實作紀錄

已完成的修改：

| 檔案 | 內容 |
|---|---|
| `game/src/ui/firebase-peer.ts` | 新增。`FirebasePeer` / `FirebaseConn`，介面與 `RelayPeer` / `RelayConn` 相同，`via` 回報為 `'vps'` |
| `game/src/ui/net-peer.ts` | 有 Firebase 設定時，`relayFor()` 改用 `openFirebase()`，**完全不連作者的轉發伺服器**；測試環境（VITEST）不用 Firebase |
| `game/src/ui/firebase-peer.live.test.ts` | 新增。真資料庫的測試，預設略過 |
| `game/database.rules.json` | 新增。已發布到 Console |
| `game/scripts/firebase-smoke.mjs` | 新增。規則冒煙測試 |
| `game/package.json` / `package-lock.json` | 加入 `firebase` |

測試指令（在 `game/`）：

```bash
FB_LIVE=1 NODE_OPTIONS=--use-system-ca npx vitest run src/ui/firebase-peer.live.test.ts   # 5 項，往返約 60–90 ms
npm test   # 639 過；偶爾出現 vitest「Timeout calling onTaskUpdate」是機器忙，不是測試失敗
```

實作要點與踩過的坑：

- 訊息內容以 **JSON 字串**存放：RTDB 會丟掉空陣列、空物件、null，而遊戲訊息常有這些（例如 `answers: []`）。
- **RTDB transaction 會先拿本機快取執行，回傳 `undefined`（放棄）時不會再問伺服器**，所以快取裡殘留的舊持有者會讓搶 ID 永遠失敗。解法：transaction 前先 `get()` 一次刷新快取（`claim()` 與 `destroy()` 都有）。
- 每則訊息帶 `at`（伺服器時間），早於本次會話開始的訊息丟棄：避免重複使用的房間 ID 收到上一任房主的殘留訊息。
- 心跳每 5 秒更新 `peers/{id}/at`；超過 20 秒沒更新視為離線（可被接手，或對連線者回 `peer-unavailable`）；斷線超過 55 秒視為會話結束。
- ⚠️ 目前 `net-peer.ts` 仍會把房間 ID **在背景登記到 PeerJS 公用伺服器**（`attachP2P`），而前綴與官方相同，官方玩家理論上可經 P2P 連進來。第 4 站要改前綴並決定是否保留 P2P 備援。

### 待使用者驗證：瀏覽器實測

`npm run dev` 後，用 **Chrome 和 Edge 各開一個** http://127.0.0.1:5173/（或 Chrome 一般視窗＋無痕視窗，才會是兩個不同的匿名玩家）。
派對模式 → 建立房間（私享）→ 另一個瀏覽器輸入房間碼加入 → 開始遊戲玩幾回合。
同時可在 Firebase Console → Realtime Database → 資料 看到 `peers` 出現房間 ID。

## 5.2 第 4 站實作紀錄

| 依賴 | 處理 | 檔案 |
|---|---|---|
| 作者轉發伺服器、`relay.json` 清單 | `RELAYS = []`、不再讀作者 GitHub 的清單；`game/relay.json` 改為空清單 | `net-peer.ts`、`relay.json` |
| 在線人數、錯誤／聊天回報 | 兩者都用轉發伺服器的位址，清單為空後自動不送（原本就會在沒位址時直接返回） | `party-presence.ts`、`party-report.ts`（未改） |
| PeerJS 直連備援 | 新增 `firebaseOnly()`：有 Firebase 設定時不登記 PeerJS、不走直連；Firebase 連不上就是連不上 | `net-peer.ts` |
| 作者的 STUN / TURN（`game.flj.info`，含帳密） | 從 `ICE_SERVERS` 移除，只留公用 STUN | `party-net.ts` |
| 網路檢查 | Firebase 模式下不再問 PeerJS 與 STUN；連不上 Firebase 直接顯示「暫時無法聯機」 | `party-check.ts` |
| 遊戲內更新 | 更新伺服器改為建置設定 `VITE_UPDATE_SERVER`，**預設空白＝停用**；下載頁改指向本 Fork 的 Releases | `update.ts` |
| 房間 ID 前綴 | `rich4-party-v2-` → `rich4online-v1-`，與官方玩家的房間、大廳清單完全分開 | `party-net.ts` |

測試調整：`party-check.test.ts` 改為斷言「沒有 TURN、沒有作者伺服器」；`update.test.ts` 以 `vi.stubEnv` 提供假的更新伺服器繼續測下載邏輯，並新增「沒設定時完全不詢問」的測試。

`import.meta.env` 要直接寫 `import.meta.env.X`（`tsconfig` 已載入 `vite/client` 型別）；寫成 `(import.meta as …).env` 時 Vitest 的 `vi.stubEnv` 不會生效。

**剩下指向作者的地方（第 6 站處理）**：App ID 仍是 `pro.areu.rich4`（`capacitor.config.json`、`desktop/electron-builder.config.cjs`、`android/app/build.gradle`）。不改的話，手機上已裝官方版時無法安裝本 Fork（簽章不同），桌面版也可能共用同一個存檔位置。

## 5.3 第 6 站實作紀錄

**App 身分**（讓本 Fork 能和官方版同時安裝、資料互不干擾）：

| 項目 | 原版 | 本 Fork | 檔案 |
|---|---|---|---|
| App ID | `pro.areu.rich4` | `io.github.xiangyuchiu.rich4online` | `capacitor.config.json`、`android/app/build.gradle`（`applicationId`；Java `namespace` 不動）、`android/.../strings.xml`、`desktop/electron-builder.config.cjs` |
| 名稱 | 大富翁4 | 大富翁4連線版 | 同上、`desktop/main.cjs` 視窗標題 |
| Windows 執行檔 | `Rich4.exe` | `Rich4Online.exe` | `electron-builder.config.cjs` |
| 桌面版資料夾 | `%APPDATA%\大富翁4` | `%APPDATA%\rich4-online` | `desktop/main.cjs`（`app.setPath('userData', …)`） |

桌面版資料夾**必須分開**：原版桌面殼會優先載入資料夾內 `rich4-update/` 的已下載更新；若和官方版共用，官方版下載的 v1.2.x 更新會蓋過本 Fork 的程式碼（本 Fork 版本號是 1.0.0），存檔也會混在一起。

iOS 的 Bundle ID（`ios/App/App.xcodeproj`）沒改：沒有 Mac 無法打包 iOS，之後需要時再處理。

**打包腳本 `scripts/package.mjs` 改為 Windows 可用**：`npx` / `gradlew.bat` 透過 shell 執行、自動找 Windows 上 Android Studio 的 JDK 與 SDK、`local.properties` 用正斜線；沒有 `cwebp` 時不做 WebP 壓縮（原版強制要求）。

**Windows 版**（公司電腦，2026-11-16）：打包成功，`Rich4Online.exe` 確認能啟動；建置的 JS 已確認含 Firebase 位址、不含 `areu.pro` / `flj.info`。完整步驟見 `HOME-SETUP.md` 第 7 節。

- 啟動時 Windows 防火牆會詢問是否允許網路存取：**按「取消」即可**。遊戲只需要往外連 Firebase（443 埠），不需要輸入連線。
- 為避免公司 IT 疑慮，公司電腦上的打包產物已刪除。**之後打包好的 exe／APK 只在家用電腦執行**；公司電腦只寫程式、跑測試與開發伺服器。

## 5.4 第 5 站實作紀錄

| 檔案 | 內容 |
|---|---|
| `gas/cleanup.gs` | 每小時執行：讀 `peers` 與 `inbox`，刪除 `at` 超過 10 分鐘的紀錄；一整個 inbox 都過期就整個刪。以 PATCH（值為 null）分批刪除，每批 500 條 |
| `gas/appsscript.json` | 宣告 `firebase.database`、`userinfo.email` 等 OAuth 範圍 |
| `gas/cleanup.test.mjs` | `planCleanup()` 的單元測試：`node gas/cleanup.test.mjs` |
| `docs/online/GAS-SETUP.md` | 安裝步驟（使用者操作） |

**已安裝**（2026-11-17）：script.google.com 專案「rich4-online 清理」，用 Firebase 專案擁有者帳號、OAuth 方式（未用 `FB_SECRET`），觸發器每小時執行 `cleanup`。改了 `gas/cleanup.gs` 要手動重新貼上。

- **不用密鑰**：用執行者帳號的 OAuth token（`ScriptApp.getOAuthToken()`）以 `?access_token=` 呼叫 RTDB REST API；專案擁有者的帳號有管理權限、不受安全規則限制。備案：指令碼屬性 `FB_SECRET`（舊版資料庫密鑰）。
- **逐則判斷時間而不是看 ID 是否還有人佔用**：新訊息的 `at` 一定是新的，所以清理不會刪到剛建立連線的訊息，沒有競態。
- 遊戲端已處理「自己的 `peers/{id}` 被清掉」：`firebase-peer.ts` 的 `onValue` 會重新佔用（10 分鐘門檻下正常不會發生）。
- 安全規則不用改：GAS 走管理權限。

## 5.5 連線路徑查核（2026-11-17）

確認遊戲連線只走 Firebase，不碰原作者任何伺服器：

- **原始碼**：`game/src`、`desktop/` 中的外部網址只剩 Firebase 與本 Fork 的 GitHub Releases；`areu.pro`、`flj.info` 只出現在說明註解。
- **建置產物**（`vite build` 後掃描 JS/HTML/JSON）：外部主機只有 Firebase（`rich4-online-default-rtdb…`、`securetoken.google.com`、`apis.google.com`、`www.google.com`）、`github.com`（本 Fork 的下載頁）、函式庫授權註解中的 `apache.org` / `capacitorjs.com`。
- 唯一殘留：PeerJS 函式庫內建的預設伺服器常數 `0.peerjs.com`。Firebase 模式下 `firebaseOnly()` 為真，`net-peer.ts` 不會建立 PeerJS 連線，所以不會連線；要完全移除得刪掉 PeerJS 備援程式，目前不值得。
- 在線人數、錯誤回報：轉發伺服器清單為空，不會送出。遊戲內更新：`VITE_UPDATE_SERVER` 未設定，停用。

## 5.6 朋友實測回報（2026-11-19）

朋友拿打包好的 exe 跨網測試，回報三個問題：

| # | 問題 | 狀態 |
|---|---|---|
| 1 | 檔案 1.6 GB | 素材已是 WebP，zip 無損壓縮沒用。新增 `game/scripts/recompress-dist.py`（Pillow，只處理 `dist`，不動 `public/assets`）：WebP 重壓 q80，素材 1,245→898 MB。打包後資料夾約 1.3 GB（素材 1,030＋Electron 280），zip（WebP/PNG/m4a 不壓、其餘 deflate）約 1.2 GB。要更小可降到 q70 或把 `hd` 縮 75%（原作者的 `RICH4_SHRINK`，但需要 `cwebp`，自動下載被擋，需使用者自行安裝） |
| 2 | 同一局第三輪擲骰時房客斷線，房主仍在 | 根因未確認。真資料庫雙人互傳 7 分鐘（每 3 秒 ping＋每 30 秒一批答案）0 斷線、最大間隔 3.5 秒（`firebase-soak.live.test.ts`），所以傳輸層本身穩定，推測是朋友那端網路或視窗被降速。已做：判定「沉默＝斷線」由 10 秒放寬為 25 秒（`Room.SILENT_MS`）；Electron 關閉背景節流（`desktop/main.cjs`）；新增連線日誌 `netlog()`（Console 的 `[party]`，也存 localStorage `rich4.party.log` 最近 200 行） |
| 3 | 房客斷線重連後變成複製舊進度開新房間 | 根因未確認。自動重連（`rejoin`）失敗後，使用者重新輸入房間碼走的是 `hi`→`resume` 路徑（從最新回合快照載入），看起來像新房間。需要日誌確認自動重連為何失敗 |

（先前「下一局會關房間」的修正仍保留：派對模式結算不顯示「下一局」。那不是這次斷線的原因。）

## 6. 注意事項

- 素材屬原版權方，僅供私人使用：**不提交、不上傳到任何公開網址**。
- 程式碼是 GPL-3.0-or-later：發佈修改版要公開原始碼（Fork 保持公開即可）。
- `npm ci` 回報 7 個套件弱點（2 個 critical）是原版就有的，打包發佈前再一起評估，目前不動。
