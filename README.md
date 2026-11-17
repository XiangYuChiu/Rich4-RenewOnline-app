# 大富翁4 跨網連線版（Rich4-RenewOnline-app）

這是 [iam567/rich4-renew-app](https://github.com/iam567/rich4-renew-app)（v1.2.0）的 Fork，目標是讓**派對模式不依賴原作者的伺服器**，改用 **Firebase Realtime Database**（免費 Spark 方案）轉送連線，做到**全程免費、不買網域、不同網路也能一起玩**。

遊戲本身（規則、畫面、素材）完全沿用原作者的成果，這個 Fork 只換掉連線層。

## 目前進度

| 站 | 內容 | 狀態 |
|---|---|---|
| 0 | 環境建置與授權確認 | ✅ |
| 1 | 讀懂原版網路層 | ✅ |
| 2 | 建立 Firebase 專案（匿名登入、Realtime Database、安全規則） | ✅ |
| 3 | 實作 Firebase 傳輸層 `firebase-peer.ts` | ✅ 瀏覽器實測可開房、加入、擲骰 |
| 4 | 切斷對原作者伺服器的依賴（房間前綴、P2P 備援、遊戲內更新、回報） | ✅ 不再連線到原作者的任何伺服器 |
| 5 | Google Apps Script 後勤（清理過期資料、戰績） | ⏳ 清理腳本完成，待安裝（[`GAS-SETUP.md`](docs/online/GAS-SETUP.md)）；戰績之後再做 |
| 6 | 打包 Windows / Android | ✅ Windows 版完成並實測可執行；Android APK 暫緩 |
| 7 | 跨網實測（電腦對電腦） | ⬜ **← 下一步，做法見下方「下一步」** |

詳細的施作紀錄、設計與踩過的坑：[`docs/online/PROGRESS.md`](docs/online/PROGRESS.md)

在新電腦上從零建置、打包 Windows / Android、做跨網測試：[`docs/online/HOME-SETUP.md`](docs/online/HOME-SETUP.md)

## 下一步（詳細做法）

> 這一節寫給**使用者本人**，以及接手的 AI 助手（Claude Code、Codex CLI 等）。照順序做即可，不需要先讀其他文件。
> 標【使用者】的步驟要人在電腦前操作；標【AI】的步驟可以交給 AI 助手。
> 最後更新：2026-11-17

### 現況一句話

連線改走 Firebase 的程式**已完成**，Windows 版 `Rich4Online.exe` 已在家用電腦確認**單機能啟動**；**還沒有實際測過兩個玩家連線對戰**。使用者的手機是 iPhone，所以 Android APK 暫緩，**跨網測試改用兩台電腦**。

### 步驟 1：確認手上有可執行的 `Rich4Online.exe`【使用者】

- 家用電腦上之前打包好的位置是 `<打包資料夾>\win-unpacked\Rich4Online.exe`（建置指南的範例資料夾是 `D:\rich4-release`；若當時填了別的位置，就去那裡找）。
- 找不到、或程式碼有更新需要重新打包：照 [`docs/online/HOME-SETUP.md`](docs/online/HOME-SETUP.md) 第 7 節打包（約 10–20 分鐘）。【AI】可以代為執行打包指令。
- ⚠️ 這個 exe 與 `win-unpacked` 資料夾內含有版權的素材：**只在自己的電腦之間用隨身碟複製，不要上傳到雲端硬碟、GitHub 或任何網址。**

### 步驟 2：同一台電腦開兩個玩家（暖身，約 15 分鐘）【使用者】

目的：先確認「建房 → 加入 → 對戰」整個流程能走通。這一步也是透過 Firebase 連線，只是兩個玩家在同一個網路。

1. 雙擊 `Rich4Online.exe`，這是**玩家 1**。
2. 開 **PowerShell**（開始選單搜尋 PowerShell），貼上下面這行並按 Enter，開出**玩家 2**。
   把 `D:\rich4-release` 換成步驟 1 實際的資料夾：
   ```powershell
   $env:RICH4_USER_DATA="$env:APPDATA\rich4-online-p2"; & 'D:\rich4-release\win-unpacked\Rich4Online.exe'
   ```
   `RICH4_USER_DATA` 讓第二個視窗用另一個資料夾存資料，Firebase 才會把它當成另一個玩家。
   若出現「Windows 防火牆」詢問視窗，按「**取消**」即可（遊戲只往外連，不需要別人連進來）。
3. 玩家 1：主選單 →「**派對模式**」→「**建立房間**」→ 選「**私享房間**」→ 畫面會顯示 **4 位數房間碼**。
4. 玩家 2：主選單 →「**派對模式**」→「**進入房間**」→ 輸入那 4 位數字。
5. 玩家 1 看到玩家 2 進房後按「**開始遊戲**」，兩邊輪流擲骰，玩 **3–5 回合**，並在聊天框各打一句話。
6. 記下結果（見步驟 4 的格式）：
   - 能不能進房、能不能開始
   - 兩邊畫面是否一致（金錢、位置相同）
   - 玩家名字旁的延遲數字（例如 `85 ms`；綠色 ≤100、黃色 ≤250、紅色更慢）

### 步驟 3：兩台電腦、兩種網路（真正的跨網測試，約 40 分鐘）【使用者】

目的：確認**不同網路**的玩家能一起玩，這是本 Fork 的最終目的。

準備：
- **電腦 A**（家用桌機）：連**家裡的網路**。
- **電腦 B**（筆電或另一台電腦）：開 iPhone「設定 → 個人熱點」，電腦 B 的 Wi-Fi **只連 iPhone 熱點**，不要連家裡 Wi-Fi。
- 用隨身碟把電腦 A 上**整個 `win-unpacked` 資料夾**（約 1.5 GB）複製到電腦 B 任意位置。電腦 B 不需要安裝 Node 或任何開發工具。
- 熱點會用掉行動數據：遊戲本身每小時約 2 MB，主要耗量是電腦 B 的系統更新，可先暫停 Windows Update。

測試：
1. 電腦 A 雙擊 `Rich4Online.exe` → 派對模式 → 建立房間 → 私享房間 → 記下房間碼。
2. 電腦 B 雙擊 `Rich4Online.exe` → 派對模式 → 進入房間 → 輸入房間碼。
3. 開始遊戲，玩**至少 10 回合**，雙方都在聊天框打字。
4. **斷線測試**：電腦 B 關閉 Wi-Fi，等 **10 秒**再打開，看能否自動接回並繼續玩。
5. **背景測試**：電腦 B 把遊戲視窗最小化 **30 秒**再還原，看遊戲是否繼續。
6. 兩台各記下延遲數字。

### 步驟 4：回報結果【使用者】→ 寫進文件【AI】

使用者把結果用下面格式告訴 AI 助手（照抄填空即可）：

```
步驟 2（同機雙開）：進房 成功/失敗；開始遊戲 成功/失敗；畫面一致 是/否；延遲 ___ ms
步驟 3（跨網）：進房 成功/失敗；玩了 ___ 回合；畫面一致 是/否
  關 Wi-Fi 10 秒：自動接回 是/否（若否，畫面顯示什麼）
  最小化 30 秒：遊戲繼續 是/否
  延遲：電腦 A ___ ms，電腦 B ___ ms
其他問題：（錯誤訊息、卡住的畫面，可附截圖）
```

AI 助手收到後要做：
1. 把結果寫進 `docs/online/PROGRESS.md` 第 3 節「各站狀態」表格第 7 站，並更新檔案開頭的「最後更新」。
2. 同步更新本 README 的「目前進度」表與本節「現況一句話」。
3. 依下面「出問題時」排查；修好後重新打包，請使用者重測。
4. 提交並推送（規則見下方「給 AI 助手的規則」）。

### 出問題時

| 現象 | 先看哪裡 |
|---|---|
| 進房間時說連不上／「暫時無法聯機」 | 遊戲視窗按 **Ctrl+Shift+I** 開開發者工具 → Console 分頁，把紅字截圖 |
| 測試時 Firebase Console 的 `peers` 底下**完全沒有資料** | exe 打包時 `game/.env.local` 不存在，裡面沒有 Firebase 設定，遊戲會改用 PeerJS 公用伺服器直連（不是走 Firebase）。補上 `.env.local` 後重新打包（HOME-SETUP.md 第 5、7 節） |
| 輸入房間碼後說房間不存在 | Firebase Console → Realtime Database → 資料，看 `peers` 底下有沒有 `rich4online-v1-room-<房間碼>` |
| 能進房但畫面不同步、卡住 | 同上看 `inbox` 底下是否堆積訊息；把兩台的 Console 截圖給 AI |
| 斷線後沒有接回 | 記下等了多久、畫面顯示什麼。程式設計是 55 秒內回來都能接回 |

### 之後的工作（測試通過後）

| 項目 | 誰 | 說明 |
|---|---|---|
| 安裝 Firebase 定時清理 | 使用者（約 5 分鐘，瀏覽器操作） | 照 [`docs/online/GAS-SETUP.md`](docs/online/GAS-SETUP.md)；不影響遊玩，只是避免資料庫累積垃圾 |
| 戰績寫入 Google 試算表 | AI 實作 | 第 5 站後半，尚未開始，使用者決定要不要做 |
| 給朋友玩 | 使用者 | 把 `win-unpacked` 資料夾私下給朋友（不可公開散布素材） |
| iPhone / Android / 網頁版 | 暫緩 | iPhone App 需要 Mac；網頁版要公開網址會散布素材，不做 |

### 給 AI 助手的規則

- 使用**繁體中文**與使用者溝通。
- 工作分支 `feature/online`；推送後把 `main` 快轉到同一個 commit：`git push origin feature/online && git push origin feature/online:main`。**禁止推送到 `upstream`**（原作者）。
- 提交身分：`XiangYuChiu <61840928+XiangYuChiu@users.noreply.github.com>`（repo 已設定）。
- **絕不提交**：`game/public/assets/`（版權素材）、`game/.env.local`（Firebase 設定）、任何打包產物。提交前先看 `git status`，不要用 `git add -A`。
- 每完成一個步驟，更新 `docs/online/PROGRESS.md`（狀態表、最後更新）與本 README 的進度表、本節。
- 在新電腦上（沒有 `game/public/assets` 或 `game/.env.local`）：照 [`docs/online/HOME-SETUP.md`](docs/online/HOME-SETUP.md) 從頭建置。
- 技術細節、設計與踩過的坑：[`docs/online/PROGRESS.md`](docs/online/PROGRESS.md)。

## 運作方式

```
玩家 A（Windows）─┐
玩家 B（Android）─┼─ Firebase Realtime Database ── 轉送每位玩家的操作
玩家 C（瀏覽器） ─┘   peers/{房間或玩家 ID}  inbox/{ID}/{訊息}
```

- 原版的派對模式是 **lockstep**：每台裝置用同一個亂數種子各自跑完整遊戲，網路只傳「玩家的選擇」，流量很小。
- 原版透過作者自架的 VPS 轉送（`relay-peer.ts`）；本 Fork 新增 `game/src/ui/firebase-peer.ts`，介面完全相同，遊戲邏輯 `party-net.ts` 不需修改。
- 安全規則：[`game/database.rules.json`](game/database.rules.json)，只開放 `peers` 與 `inbox`，防止冒充玩家或搶佔房間 ID。

## 自行建置

完整步驟（含 Windows 版與 Android APK 打包）見 [`docs/online/HOME-SETUP.md`](docs/online/HOME-SETUP.md)，摘要如下：

1. 依下方「原專案說明 → 執行」安裝套件並取得素材。
2. 建立自己的 Firebase 專案：啟用**匿名登入**、建立 **Realtime Database**，把 `game/database.rules.json` 貼到規則頁並發布。
3. 在 `game/.env.local` 填入 Firebase 網頁應用程式設定（此檔不進 Git）：
   ```
   VITE_FB_API_KEY=...
   VITE_FB_AUTH_DOMAIN=...
   VITE_FB_DB_URL=https://<專案>-default-rtdb.<區域>.firebasedatabase.app
   VITE_FB_PROJECT_ID=...
   VITE_FB_APP_ID=...
   ```
4. 驗證：`node scripts/firebase-smoke.mjs`（規則）、`FB_LIVE=1 npx vitest run src/ui/firebase-peer.live.test.ts`（傳輸層）。

本 Fork 的 App ID 是 `io.github.xiangyuchiu.rich4online`（名稱「大富翁4連線版」），可以和官方版同時安裝，存檔與資料互不干擾。

## 授權與素材

- 程式碼沿用原專案的 **GPL-3.0-or-later**。
- 大富翁4 原遊戲資源及其重繪**不在授權範圍、僅供私人使用**，本 Fork 不包含也不散布任何素材；請依原作者說明自行取得。

---

# 原專案說明

> 以下為原作者 [iam567/rich4-renew-app](https://github.com/iam567/rich4-renew-app) 的 README，保留原文。

## 大富翁4 重制版 App（rich4-renew-app）

大富翁4是我童年最喜欢的游戏，现在闲着没事的时候，我还是喜欢拿出来玩上一会。一玩就很容易沉浸进去。
4代的成功，让我对接下来推出的5代大感失望。
本来他可以把4代美化一下，游戏机能更新一下，就可以算得上是一个很棒的游戏了。
但他却偏偏选择发售他们认为很好玩的新的游戏机制。

既然他们不懂得做游戏，那么就由我来做吧。
高解析度重制版的 App 源码：Vite + TypeScript 遊戲本體，Capacitor 打包成 iOS App。
規則依原版反組譯還原（見 `docs/rules/`），另有新玩法「大富豪模式」（東京／大阪／札幌／九州／沖繩 12 人全國戰）。

同时也增加了新地图新玩法——歌舞伎町。在夜生活的世界里，有一套独立的事件系统与建筑风格。
更多的玩法，等我想到了就慢慢的更新。

完整素材（原版提取、高清重繪、地圖、地表、音效）不放進 Git，放在 Releases 的 `rich4-assets.tar`；地圖製作與生圖工具不在這裡。

### 游戏截图

| | |
|:---:|:---:|
| <img src="screenshots/01-title.jpg" width="420" alt="标题画面"><br>标题画面 | <img src="screenshots/02-classic-taiwan.jpg" width="420" alt="原版台湾地图"><br>原版台湾地图 |
| <img src="screenshots/03-tokyo.jpg" width="420" alt="东京"><br>东京（大富豪模式五城之一） | <img src="screenshots/04-kabukicho.jpg" width="420" alt="歌舞伎町"><br>新地图：歌舞伎町 |
| <img src="screenshots/05-jiqing-tiananmen.jpg" width="420" alt="激情岁月"><br>新地图：激情岁月 | <img src="screenshots/06-lottery.jpg" width="420" alt="乐透彩券行"><br>乐透彩券行 |
| <img src="screenshots/07-missile-film.jpg" width="420" alt="飞弹动画"><br>道具和高级卡片的电影动画 | <img src="screenshots/08-party-taunt.jpg" width="200" alt="派对模式"><br>派对模式：联机对战与嘲讽 |

下载：[最新版安装包](https://github.com/iam567/rich4-renew-app/releases/latest)（安卓 APK、iPhone IPA、Windows、Mac）

### 目錄
- `game/src/core` 規則引擎（回合、地產、股票、卡片、道具、事件、大富豪模式）
- `game/src/ui` 畫面與動畫
- `game/ios` iOS 工程、`game/android` 安卓工程（Capacitor 7）
- `game/scripts` 素材連結、打包、安裝到 iPhone
- `docs/rules` 規則文件

### 執行
```bash
cd game
npm install
# 素材：下載 Releases 裡的 rich4-assets.tar（和 .sha256），檢查後解壓到 game/public
gh release download assets -p 'rich4-assets.tar*'
shasum -a 256 -c rich4-assets.tar.sha256
mkdir -p public && tar -xf rich4-assets.tar -C public
npm run dev
npm test
npm run ios      # 打包並安裝到已連接的 iPhone
npm run package  # 出安裝包到 game/release/：安卓 APK（可直接安裝）＋ 未簽名 iOS IPA
```

### 授權
GPL-3.0-or-later（規則研究引用 mytbk/rich4，見 `THIRD_PARTY.md`）。Releases 裡的大富翁4 原遊戲資源及其重繪不在此授權範圍，僅供私人使用。
