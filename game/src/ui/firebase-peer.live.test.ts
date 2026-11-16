/**
 * firebase-peer.ts against the real rich4-online database (not the default run: it needs the network and
 * game/.env.local). Run in game/:  FB_LIVE=1 npx vitest run src/ui/firebase-peer.live.test.ts
 * (company network: NODE_OPTIONS=--use-system-ca).
 */
import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { FirebasePeer, openFirebase, setFirebaseConfig, type FirebaseConn } from './firebase-peer';

const live = !!process.env.FB_LIVE;

function loadConfig() {
  const env = Object.fromEntries(readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => /^VITE_FB_/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  return {
    apiKey: env.VITE_FB_API_KEY, authDomain: env.VITE_FB_AUTH_DOMAIN, databaseURL: env.VITE_FB_DB_URL,
    projectId: env.VITE_FB_PROJECT_ID, appId: env.VITE_FB_APP_ID,
  };
}

const tag = `live-${Date.now().toString(36)}`;
const opened: FirebasePeer[] = [];
/** Opens `id` as phone `phone` (each phone a separate anonymous player). */
async function phone(phoneName: string, id: string) {
  setFirebaseConfig(loadConfig(), phoneName);
  const p = await openFirebase(id, 15000);
  if (p instanceof FirebasePeer) opened.push(p);
  return p;
}
const next = <T,>(on: (fn: (v: T) => void) => void, ms = 10000) => new Promise<T>((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('timed out')), ms);
  on(v => { clearTimeout(t); resolve(v); });
});

describe.skipIf(!live)('FirebasePeer (live)', () => {
  afterAll(() => { for (const p of opened) p.destroy(); });

  it('holds an id: another phone cannot take it while it is held', async () => {
    const a = await phone('A', `${tag}-room`);
    expect(a).toBeInstanceOf(FirebasePeer);
    expect(await phone('B', `${tag}-room`)).toBeNull();
  }, 30000);

  it('connects, carries messages both ways in order, keeps empty arrays and nulls', async () => {
    const host = await phone('A', `${tag}-host`) as FirebasePeer;
    const guest = await phone('B', `${tag}-guest`) as FirebasePeer;

    const incoming = next<FirebaseConn>(fn => host.on('connection', fn));
    const c = guest.connect(`${tag}-host`);
    await next<void>(fn => c.on('open', fn));
    const hc = await incoming;
    expect(hc.peer).toBe(`${tag}-guest`);
    await next<void>(fn => (hc.open ? fn() : hc.on('open', fn)));

    // Guest → host: 30 numbered answers, the shape party-net.ts sends; they must arrive whole and in order.
    const got: unknown[] = [];
    const all = next<void>(fn => hc.on('data', (d: unknown) => { got.push(d); if (got.length === 30) fn(); }), 20000);
    for (let seq = 0; seq < 30; seq++) c.send({ t: 'ans', seq, v: seq % 3 ? { pick: seq } : null, u: false });
    await all;
    expect(got.map(m => (m as { seq: number }).seq)).toEqual([...Array(30).keys()]);
    expect((got[0] as { v: unknown }).v).toBeNull();

    // Host → guest: a message the database would mangle if stored as is.
    const back = next<unknown>(fn => c.on('data', fn));
    hc.send({ t: 'log', from: 0, answers: [], total: 0, members: [{ id: 'x', away: undefined }], extra: {} });
    expect(await back).toEqual({ t: 'log', from: 0, answers: [], total: 0, members: [{ id: 'x' }], extra: {} });

    // Closing one end closes the other.
    const closed = next<void>(fn => hc.on('close', fn));
    c.close();
    await closed;
    expect(hc.open).toBe(false);
  }, 60000);

  it('says peer-unavailable for an id nobody holds', async () => {
    const a = await phone('A', `${tag}-lonely`) as FirebasePeer;
    const c = a.connect(`${tag}-nobody`);
    const e = await next<{ type?: string }>(fn => c.on('error', fn));
    expect(e.type).toBe('peer-unavailable');
  }, 30000);

  it('releases the id on destroy, so another phone can take it (a new host)', async () => {
    const a = await phone('A', `${tag}-handover`) as FirebasePeer;
    a.destroy();
    let b: FirebasePeer | null | 'down' = null;
    for (let i = 0; i < 10 && !(b instanceof FirebasePeer); i++) { await new Promise(r => setTimeout(r, 500)); b = await phone('B', `${tag}-handover`); }
    expect(b).toBeInstanceOf(FirebasePeer);
  }, 30000);

  it('measures a round trip', async () => {
    const a = await phone('A', `${tag}-rtt`) as FirebasePeer;
    for (let i = 0; i < 20 && !a.rtt; i++) await new Promise(r => setTimeout(r, 250));
    console.log(`round trip to Firebase: ${a.rtt} ms`);
    expect(a.rtt).toBeGreaterThan(0);
  }, 30000);
});
