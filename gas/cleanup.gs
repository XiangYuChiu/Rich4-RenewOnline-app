/**
 * 大富翁4連線版：Firebase Realtime Database 定時清理（第 5 站，Google Apps Script）
 *
 * 遊戲正常離開時會自己釋放 peers/{id}、讀完就刪 inbox 的訊息；但 App 被強制關閉、手機沒電、
 * 網路斷掉太久時，會留下：
 *   peers/{id}          不再更新 at 的佔用紀錄（遊戲 20 秒後就視為離線，但紀錄本身不會消失）
 *   inbox/{id}/{push}   送給已離開玩家、永遠不會被讀的訊息
 * 這個腳本每小時把超過 STALE_MIN 分鐘的這兩種資料刪掉，讓資料庫不會越長越大。
 *
 * 權限：預設用執行者（Firebase 專案擁有者）的 Google 帳號 OAuth 存取，不需要任何密鑰。
 *       若想改用舊版 Database secret，可在「專案設定 → 指令碼屬性」加 FB_SECRET。
 * 設定：指令碼屬性 FB_DB_URL = https://rich4-online-default-rtdb.asia-southeast1.firebasedatabase.app
 * 安裝步驟：docs/online/GAS-SETUP.md
 */

/** 超過幾分鐘沒更新就清掉。遊戲本身 20 秒視為離線、55 秒視為會話結束，10 分鐘很保守。 */
var STALE_MIN = 10;
/** 一次 PATCH 最多刪幾條路徑。 */
var CHUNK = 500;

/** 觸發器呼叫的進入點。 */
function cleanup() {
  var db = dbConfig_();
  var now = Date.now();
  var peers = fetchJson_(db, 'peers') || {};
  var inbox = fetchJson_(db, 'inbox') || {};
  var paths = planCleanup(peers, inbox, now, STALE_MIN * 60 * 1000);
  for (var i = 0; i < paths.length; i += CHUNK) {
    var body = {};
    paths.slice(i, i + CHUNK).forEach(function (p) { body[p] = null; });
    request_(db, '', 'patch', body);
  }
  console.log('清理完成：刪除 ' + paths.length + ' 筆（peers ' + Object.keys(peers).length +
    ' 個、inbox ' + Object.keys(inbox).length + ' 個）');
  return paths.length;
}

/** 建立每小時執行一次的觸發器（只要手動執行一次）。 */
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'cleanup') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('cleanup').timeBased().everyHours(1).create();
  console.log('已建立每小時執行 cleanup 的觸發器');
}

/**
 * 純邏輯（可在 Node 測試）：回傳要刪除的路徑。
 * - peers/{id}：at 早於 now - staleMs，或格式不對。
 * - inbox/{id}/{key}：at 早於 now - staleMs，或格式不對；整個 inbox/{id} 都要刪時合併成一條路徑。
 */
function planCleanup(peers, inbox, now, staleMs) {
  var cutoff = now - staleMs;
  var out = [];
  var old = function (v) { return !v || typeof v !== 'object' || typeof v.at !== 'number' || v.at < cutoff; };
  Object.keys(peers || {}).forEach(function (id) {
    if (old(peers[id])) out.push('peers/' + id);
  });
  Object.keys(inbox || {}).forEach(function (id) {
    var box = inbox[id];
    if (!box || typeof box !== 'object') { out.push('inbox/' + id); return; }
    var keys = Object.keys(box);
    var gone = keys.filter(function (k) { return old(box[k]); });
    if (gone.length === keys.length) out.push('inbox/' + id);
    else gone.forEach(function (k) { out.push('inbox/' + id + '/' + k); });
  });
  return out;
}

function dbConfig_() {
  var props = PropertiesService.getScriptProperties();
  var url = (props.getProperty('FB_DB_URL') || '').replace(/\/+$/, '');
  if (!url) throw new Error('請在指令碼屬性設定 FB_DB_URL');
  var secret = props.getProperty('FB_SECRET');
  return { url: url, auth: secret ? 'auth=' + encodeURIComponent(secret) : 'access_token=' + ScriptApp.getOAuthToken() };
}

function fetchJson_(db, path) { return request_(db, path, 'get'); }

function request_(db, path, method, body) {
  var opts = { method: method, muteHttpExceptions: true, contentType: 'application/json' };
  if (body !== undefined) opts.payload = JSON.stringify(body);
  var res = UrlFetchApp.fetch(db.url + '/' + path + '.json?' + db.auth, opts);
  var code = res.getResponseCode();
  if (code !== 200) throw new Error(method.toUpperCase() + ' /' + path + ' 失敗 ' + code + '：' + res.getContentText());
  return JSON.parse(res.getContentText());
}
