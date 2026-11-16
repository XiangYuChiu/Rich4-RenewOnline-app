# 大富翁4 跨網連線版：施作進度

> 給下一次開啟 Claude Code 的自己：先讀完這份檔案再動手。
> 最後更新：2026-11-16（第 4 站完成：不再連原作者任何伺服器；待使用者瀏覽器重測。下一步第 5 站 GAS 或第 6 站打包）

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
| 工作分支 | `feature/online`（從 upstream `main` 的 `e07a1f6` = v1.2.0 開出，尚無 commit） |
| `origin` | https://github.com/XiangYuChiu/Rich4-RenewOnline-app.git（使用者的 Fork） |
| `upstream` | https://github.com/iam567/rich4-renew-app.git（**push 已設為 DISABLED**） |
| 素材 | `game/public/assets/`（1.4 GB，37,787 檔，已被 `.gitignore` 排除，**絕不提交**） |
| 素材原始壓縮檔 | `D:\Persional\rich4-downloads\rich4-assets.tar`（SHA-256 `9cc407a5…80ed` 已驗證，可刪） |
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
| 4 | 切斷對原作者伺服器的依賴 | ✅ 程式完成、測試全過（見第 5.2 節）；⏳ 待使用者在瀏覽器重新實測（房間前綴已換） |
| 5 | GAS 後勤 | ⬜ |
| 6 | 打包 Windows / Android | ⬜（要先改 App ID，見第 5.2 節） |
| 7 | 跨網實測 | ⬜ |

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

已完成的修改（尚未 commit）：

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

## 6. 注意事項

- 素材屬原版權方，僅供私人使用：**不提交、不上傳到任何公開網址**。
- 程式碼是 GPL-3.0-or-later：發佈修改版要公開原始碼（Fork 保持公開即可）。
- `npm ci` 回報 7 個套件弱點（2 個 critical）是原版就有的，打包發佈前再一起評估，目前不動。
- 目前 `feature/online` 還沒有 commit。本文件與 `CLAUDE.md` 是第一批新增的檔案。
