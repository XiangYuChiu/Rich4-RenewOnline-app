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
| 5 | Google Apps Script 後勤（清理過期資料、戰績） | ⬜ |
| 6 | 打包 Windows / Android | ⬜ |
| 7 | 跨網實測 | ⬜ |

詳細的施作紀錄、設計與踩過的坑：[`docs/online/PROGRESS.md`](docs/online/PROGRESS.md)

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
