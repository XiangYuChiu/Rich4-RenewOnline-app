// planCleanup 的單元測試：node gas/cleanup.test.mjs
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';

const ctx = {};
runInNewContext(readFileSync(new URL('./cleanup.gs', import.meta.url), 'utf8'), ctx);
const plan = ctx.planCleanup;
const now = 1_000_000_000, stale = 600_000, fresh = now - 1000, old = now - stale - 1;

assert.deepEqual([...plan({}, {}, now, stale)], []);
assert.deepEqual([...plan(null, null, now, stale)], []);

// peers：舊的、格式錯的刪掉，新的留著
assert.deepEqual([...plan({ a: { uid: 'u', at: fresh }, b: { uid: 'u', at: old }, c: 'x', d: { uid: 'u' } }, {}, now, stale)],
  ['peers/b', 'peers/c', 'peers/d']);

// inbox：全部過期 → 整個刪；部分過期 → 逐則刪；全新 → 不動
assert.deepEqual([...plan({}, {
  r1: { k1: { at: old }, k2: { at: old } },
  r2: { k1: { at: old }, k2: { at: fresh } },
  r3: { k1: { at: fresh } },
  r4: 'junk',
}, now, stale)], ['inbox/r1', 'inbox/r2/k1', 'inbox/r4']);

console.log('cleanup.gs：全部通過');
