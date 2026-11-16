// Firebase smoke test (第 2 站): two anonymous players against the real rich4-online database.
// Checks sign-in, peer-id claiming, inbox send / receive / delete, and that the security rules refuse what they should.
// Run in game/: node scripts/firebase-smoke.mjs   (company network: NODE_OPTIONS=--use-system-ca)
import { readFileSync } from 'node:fs';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInAnonymously, inMemoryPersistence, setPersistence } from 'firebase/auth';
import { getDatabase, ref, set, get, push, remove, serverTimestamp, goOffline } from 'firebase/database';

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split(/\r?\n/).filter(l => /^VITE_FB_/.test(l)).map(l => l.split('=').map(s => s.trim())));
const config = {
  apiKey: env.VITE_FB_API_KEY, authDomain: env.VITE_FB_AUTH_DOMAIN, databaseURL: env.VITE_FB_DB_URL,
  projectId: env.VITE_FB_PROJECT_ID, appId: env.VITE_FB_APP_ID,
};

const tag = `smoke-${Date.now().toString(36)}`;
let failed = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++; };
const denied = async (p) => { try { await p; return false; } catch (e) { return /permission/i.test(String(e?.code ?? e?.message)); } };

async function player(name) {
  const app = initializeApp(config, name);
  const auth = getAuth(app);
  await setPersistence(auth, inMemoryPersistence);
  const cred = await signInAnonymously(auth);
  return { app, db: getDatabase(app), uid: cred.user.uid };
}

const timeout = setTimeout(() => { console.log('FAIL  timed out after 30 s'); process.exit(1); }, 30_000);
try {
  const a = await player('A'), b = await player('B');
  ok('anonymous sign-in (two different players)', a.uid && b.uid && a.uid !== b.uid);

  const idA = `${tag}-a`, idB = `${tag}-b`;
  await set(ref(a.db, `peers/${idA}`), { uid: a.uid, at: serverTimestamp() });
  await set(ref(b.db, `peers/${idB}`), { uid: b.uid, at: serverTimestamp() });
  ok('claim own peer id', (await get(ref(b.db, `peers/${idA}`))).val()?.uid === a.uid);

  ok('cannot take a live peer id from someone else',
    await denied(set(ref(b.db, `peers/${idA}`), { uid: b.uid, at: serverTimestamp() })));

  const t0 = Date.now();
  await push(ref(a.db, `inbox/${idB}`), { from: idA, cid: 'c1', t: 'd', d: { hello: 'world' } });
  const box = (await get(ref(b.db, `inbox/${idB}`))).val() ?? {};
  const [key, msg] = Object.entries(box)[0] ?? [];
  ok('send to another inbox and read it', msg?.d?.hello === 'world', `${Date.now() - t0} ms round trip`);

  ok('cannot read someone else\'s inbox', await denied(get(ref(a.db, `inbox/${idB}`))));
  ok('cannot send pretending to be another peer',
    await denied(push(ref(a.db, `inbox/${idA}`), { from: idB, cid: 'c2', t: 'd', d: 1 })));
  ok('cannot send an unknown frame type',
    await denied(push(ref(a.db, `inbox/${idB}`), { from: idA, cid: 'c3', t: 'evil' })));
  ok('cannot write outside peers / inbox', await denied(set(ref(a.db, `rooms/x`), 1)));

  await remove(ref(b.db, `inbox/${idB}/${key}`));
  ok('receiver deletes the message it handled', !(await get(ref(b.db, `inbox/${idB}`))).exists());

  await remove(ref(a.db, `peers/${idA}`));
  await remove(ref(b.db, `peers/${idB}`));
  ok('release own peer id', !(await get(ref(a.db, `peers/${idA}`))).exists());

  for (const p of [a, b]) { goOffline(p.db); await deleteApp(p.app); }
} catch (e) {
  failed++;
  console.log('FAIL  unexpected error:', e?.code ?? '', e?.message ?? e);
}
clearTimeout(timeout);
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
