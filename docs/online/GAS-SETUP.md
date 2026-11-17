# 第 5 站：用 Google Apps Script 定時清理 Firebase

遊戲正常離開時會自己清掉在 Firebase 上的資料。但 App 被強制關閉、手機沒電或斷網太久時，會留下：

- `peers/{id}`：已離開玩家的 ID 佔用紀錄
- `inbox/{id}/…`：送給已離開玩家、永遠不會被讀取的訊息

這些不影響遊玩（遊戲 20 秒後就把沒更新的 ID 當成離線），但會一直累積。`gas/cleanup.gs` 每小時刪除超過 10 分鐘沒更新的資料。

**不需要任何密鑰**：腳本用執行者的 Google 帳號存取資料庫，所以請用**擁有 Firebase 專案 `rich4-online` 的那個 Google 帳號**操作。全程免費（GAS 免費額度：每天 20,000 次 UrlFetch，這裡每小時 2–3 次）。

## 安裝（約 5 分鐘，公司或家裡的瀏覽器都可以）

1. 開 <https://script.google.com/> → **新專案**，專案名稱改成 `rich4-online 清理`。
2. 左側 ⚙️ **專案設定** → 勾選「**在編輯器中顯示「appsscript.json」資訊清單檔案**」。
3. 回到 **編輯器**：
   - 點 `appsscript.json`，整個內容換成 repo 的 `gas/appsscript.json`。
   - 點 `程式碼.gs`（或 `Code.gs`），整個內容換成 repo 的 `gas/cleanup.gs`。
   - 按 💾 儲存。
4. ⚙️ **專案設定** → 最下面「**指令碼屬性**」→ 新增：
   - 屬性：`FB_DB_URL`
   - 值：`https://rich4-online-default-rtdb.asia-southeast1.firebasedatabase.app`
5. 回到編輯器，上方函式選單選 **`cleanup`** → **執行**。
   - 第一次會要求授權：選你的帳號 →「進階」→「前往 rich4-online 清理（不安全）」→ 允許。
     （「不安全」只是因為這是你自己寫、沒送 Google 審核的腳本。）
   - 執行記錄應出現 `清理完成：刪除 N 筆（peers … 個、inbox … 個）`。
6. 函式選單改選 **`installTrigger`** → **執行**。執行記錄出現「已建立每小時執行 cleanup 的觸發器」。
   左側 ⏰ **觸發條件** 會看到一條 `cleanup`／每小時。

完成。之後可在左側 **執行項目** 查看每次清理的結果。

## 疑難排解

| 錯誤 | 原因與處理 |
|---|---|
| `請在指令碼屬性設定 FB_DB_URL` | 第 4 步沒做或名稱打錯 |
| `GET /peers 失敗 401` 或 `Permission denied` | 執行的 Google 帳號不是 Firebase 專案成員。換成專案擁有者的帳號；或到 Firebase Console → 專案設定 → 服務帳戶 → **資料庫密鑰**，把密鑰加到指令碼屬性 `FB_SECRET`（腳本會改用密鑰） |
| 授權畫面沒出現 Firebase 權限 | 第 3 步的 `appsscript.json` 沒換到。換好儲存後再執行一次 `cleanup` |

## 修改後

`gas/cleanup.gs` 的邏輯有單元測試（不需要 Firebase）：

```bash
node gas/cleanup.test.mjs
```

改了 repo 裡的腳本後，要手動把內容再貼到 script.google.com 的編輯器（GAS 不會自動同步）。
