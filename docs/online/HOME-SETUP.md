# 從零開始：在另一台電腦建置、打包、跨網測試

> **給 Claude**：這份文件假設你沒有任何先前對話的記憶。請先讀完 `docs/online/PROGRESS.md` 了解專案目標與目前進度，再依本文件逐步操作。每完成一步，回報使用者並更新 `PROGRESS.md` 的狀態表。
> 需要使用者親自操作的步驟（登入、按按鈕、拿手機）會標記為 **【使用者】**。

適用情境：在一台全新的 Windows 電腦（例如家裡電腦）上，把專案建起來、打包 Windows 版與 Android APK，並做真正的跨網測試。

## 0. 需要安裝的工具

| 工具 | 版本 | 用途 | 下載 |
|---|---|---|---|
| Git | 任意新版 | 取得程式碼 | https://git-scm.com/download/win |
| Node.js | 22 LTS 以上（已驗證 24） | 建置遊戲 | https://nodejs.org |
| Android Studio | 最新版 | 打包 APK（內含 JDK 21 與 Android SDK） | https://developer.android.com/studio |

Android Studio 安裝時全部用預設選項。第一次開啟時會跑 Setup Wizard，選 **Standard** 讓它下載 SDK。
本專案需要 **Android SDK Platform 35**（`compileSdkVersion = 35`）：Android Studio → More Actions → SDK Manager → SDK Platforms，確認 **Android 15.0 (API 35)** 已勾選安裝。

> 家用網路一般沒有 SSL 攔截，不需要 `PROGRESS.md` 第 2 節那些公司網路的特殊處理。如果遇到 `self signed certificate` 錯誤，再參考那一節。

## 1. 取得程式碼

```bash
git clone https://github.com/XiangYuChiu/Rich4-RenewOnline-app.git rich4
cd rich4
git checkout feature/online
# 這台電腦也用 GitHub 隱藏信箱提交，不要用公司信箱
git config user.name "XiangYuChiu"
git config user.email "61840928+XiangYuChiu@users.noreply.github.com"
# 原作者倉庫：只用來同步更新，禁止推送
git remote add upstream https://github.com/iam567/rich4-renew-app.git
git remote set-url --push upstream DISABLED
```

**【使用者】** 第一次 `git push` 時會跳出 GitHub 登入視窗，用 XiangYuChiu 帳號登入。

## 2. 安裝套件

```bash
cd game
npm ci
cd ..
```

## 3. 取得素材（約 1.5 GB，有版權，絕不提交）

素材在原作者 Releases 的 `assets` 標籤。下載到 **repo 外面**的資料夾：

```powershell
# PowerShell，在 rich4 的上一層執行
mkdir rich4-downloads; cd rich4-downloads
curl.exe -L -C - -o rich4-assets.tar https://github.com/iam567/rich4-renew-app/releases/download/assets/rich4-assets.tar
curl.exe -L -o rich4-assets.tar.sha256 https://github.com/iam567/rich4-renew-app/releases/download/assets/rich4-assets.tar.sha256
(Get-FileHash rich4-assets.tar -Algorithm SHA256).Hash.ToLower()
```

雜湊必須是 `9cc407a5e88c295f2470d306ed483a3e2e2ff126521f94066c0618e9e1f980ed`。下載中斷時，重跑同一行 `curl.exe -C -` 會從中斷處續傳。

解壓到 `game/public`（排除 macOS 的 `._*` 垃圾檔）。用 **Windows 內建的 `tar.exe`**（PowerShell 裡的 `tar` 就是它）：

```powershell
cd ..\rich4\game
mkdir public -Force
tar -xf ..\..\rich4-downloads\rich4-assets.tar -C public --exclude "._*"
```

完成後應有 `game/public/assets/{audio,ground,hd,maps,orig}`，約 37,787 個檔案、1.4 GB。

> Git Bash 的 GNU tar 會把 `D:` 當成遠端主機而失敗；若要用 Git Bash，先 `cd` 再用相對路徑。

## 4. 修正 `editor/site/assets` 連結

這個路徑在 Git 裡是符號連結，Windows 預設會 checkout 成一個純文字檔，導致 1 個測試失敗。改成 junction（不需要系統管理員權限）：

```powershell
# 在 rich4 根目錄
Remove-Item editor\site\assets
New-Item -ItemType Junction -Path editor\site\assets -Target (Resolve-Path game\public\assets\maps)
git update-index --skip-worktree editor/site/assets
git status   # 應該是乾淨的
```

## 5. Firebase 設定檔 `game/.env.local`

此檔不在 Git 裡，每台電腦要自己建立。**【使用者】** 到 Firebase Console → 專案 `rich4-online` → 左上齒輪「專案設定」→「你的應用程式」→ 網頁應用程式 → 「SDK 設定和配置」選「設定」，把 `firebaseConfig` 貼給 Claude。

Claude 依下列格式建立 `game/.env.local`：

```
VITE_FB_API_KEY=<apiKey>
VITE_FB_AUTH_DOMAIN=rich4-online.firebaseapp.com
VITE_FB_DB_URL=https://rich4-online-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FB_PROJECT_ID=rich4-online
VITE_FB_APP_ID=<appId>
```

確認被 Git 忽略：`git check-ignore -v game/.env.local` 要有輸出。

> Firebase 專案、匿名登入、資料庫與安全規則都已經在雲端建好，不用重做。規則原始檔是 `game/database.rules.json`。

## 6. 驗證

在 `game/` 底下：

```bash
npx tsc --noEmit                       # 型別檢查
npm test                               # 預期 640 通過；偶爾 vitest 的 onTaskUpdate timeout 是機器忙，重跑即可
node scripts/firebase-smoke.mjs        # Firebase 規則：預期 10 項 PASS
FB_LIVE=1 npx vitest run src/ui/firebase-peer.live.test.ts   # 傳輸層：預期 5 項通過
npm run dev                            # http://127.0.0.1:5173/ ，第一次載入要 20–30 秒
```

PowerShell 設環境變數的寫法：`$env:FB_LIVE='1'; npx vitest run src/ui/firebase-peer.live.test.ts`

**【使用者】** 用 Chrome＋Edge（或一般視窗＋無痕視窗）各開 `http://127.0.0.1:5173/`，派對模式 → 建立房間（私享）→ 另一邊輸入房間碼加入 → 玩幾回合。

## 7. 打包 Windows 版

```powershell
cd game
$env:RICH4_NO_ASSETS='1'; npx vite build; Remove-Item Env:RICH4_NO_ASSETS
node scripts/bundle-assets.mjs           # 把遊戲用到的素材複製進 dist（約 1.4 GB）
cd desktop
npm install
$env:RICH4_DIST=(Resolve-Path ..\dist).Path
$env:RICH4_DESKTOP_OUT='D:\Persional\Rich4\rich4-release'   # repo 外面的資料夾，換成你要的位置
npx electron-builder --config electron-builder.config.cjs --win zip --x64
```

產出：`<RICH4_DESKTOP_OUT>\win-unpacked\Rich4Online.exe`（直接執行）與一個 zip（給朋友）。
Windows 會跳出「Windows 已保護你的電腦」，點「其他資訊 → 仍要執行」（沒有程式碼簽章）。
Windows 防火牆若詢問是否允許網路存取，**按「取消」即可**：遊戲只需要往外連 Firebase，不需要別人連進來。

本 Fork 的桌面版資料放在 `%APPDATA%\rich4-online`，與原版 `大富翁4` 完全分開，可以和官方版同時安裝。

## 8. 打包 Android APK（暫緩：使用者手機是 iPhone）

> 目前不需要。留著給之後有 Android 手機的朋友使用。

在 `game/` 底下：

```bash
npm run package -- apk
```

腳本會自動找 Android Studio 的 JDK（`C:\Program Files\Android\Android Studio\jbr`）與 SDK（`%LOCALAPPDATA%\Android\Sdk`），自動建立 `android/local.properties`。若裝在別的位置，先設 `JAVA_HOME` 與 `ANDROID_HOME`。

- 第一次執行 Gradle 會下載很多東西，要等一段時間。
- 沒有安裝 `cwebp` 時，素材不重新壓縮，APK 會比官方版大（約 1.5 GB 以上），不影響功能。
- 產出：`game/release/rich4-<版本>.apk`（`release/` 已被 Git 忽略）。
- App ID 是 `io.github.xiangyuchiu.rich4online`、名稱「大富翁4連線版」，可以和官方版同時安裝。

**【使用者】** 安裝到手機：把 APK 傳到手機（USB、雲端硬碟、LINE 傳給自己都可以），點開安裝，依提示允許「安裝不明來源的應用程式」。

## 9. 跨網實測（這個 Fork 的最終目的）

> 2026-11-17 決定：使用者的手機是 iPhone，**先不做手機，只測電腦對電腦**。

### 9.1 先在同一台電腦開兩個玩家（暖身，確認流程）

同一台電腦開兩個 exe，用不同的資料夾，才會是兩個不同的匿名玩家：

```powershell
# 第二個視窗（第一個直接雙擊 Rich4Online.exe）
$env:RICH4_USER_DATA="$env:APPDATA\rich4-online-p2"; & 'D:\Persional\Rich4\rich4-release\win-unpacked\Rich4Online.exe'
```

一個建立房間（私享），另一個輸入房間碼加入，玩幾回合。這一步走的仍是 Firebase，只是兩個玩家在同一個網路。

### 9.2 真正的跨網：兩台電腦、兩種網路

**【使用者】**

- **電腦 A**：家裡網路，執行 `Rich4Online.exe`。
- **電腦 B**（筆電或另一台電腦）：**連 iPhone 的個人熱點（行動數據）**，不要連家裡 Wi-Fi。
  把電腦 A 的 `win-unpacked` 整個資料夾（約 1.5 GB）用隨身碟複製過去，或在電腦 B 依本文件從頭建置。

步驟：

1. 電腦 A → 派對模式 → 建立房間（私享），記下房間碼
2. 電腦 B → 派對模式 → 進入房間 → 輸入房間碼
3. 開始遊戲，玩至少 10 回合；試聊天
4. 電腦 B 關掉 Wi-Fi 10 秒再打開，看能否接回並繼續
5. 電腦 B 把遊戲視窗最小化 30 秒再還原，看遊戲是否繼續
6. 記下延遲標籤顯示的毫秒數（兩台各記一次）

把結果寫進 `PROGRESS.md` 第 3 節（第 7 站）。若有連不上或不同步，按 Ctrl+Shift+I 看 Console 錯誤，並到 Firebase Console → Realtime Database → 資料，看 `peers` / `inbox` 底下的狀況。

### 選做：與原版比較

用原作者官方的 v1.2.0（https://github.com/iam567/rich4-renew-app/releases/tag/v1.2.0 ）做同樣的測試，比較延遲與穩定度。官方版走原作者的伺服器，和本 Fork 的房間互不相通。

## 10. 完成後

```bash
git add <改過的檔案>     # 不要用 git add -A 把素材或 .env.local 加進去
git commit -m "..."
git push origin feature/online
git branch -f main feature/online && git push origin main   # GitHub 首頁顯示 main
```

提交前務必 `git status` 確認沒有 `game/public/assets`、`game/.env.local`、`game/release`、`dist`。
