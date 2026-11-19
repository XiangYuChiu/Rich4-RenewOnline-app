/** Soak: host and guest ping each other like Room's heartbeat (3 s) plus bursts of answers; reports the longest gap. FB_LIVE=1 FB_SOAK_S=240 */
import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { FirebasePeer, openFirebase, setFirebaseConfig, type FirebaseConn } from './firebase-peer';

const live = !!process.env.FB_LIVE;
function cfg() {
  const env = Object.fromEntries(readFileSync(new URL('../../.env.local', import.meta.url), 'utf8').split(/\r?\n/).filter(l => /^VITE_FB_/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  return { apiKey: env.VITE_FB_API_KEY, authDomain: env.VITE_FB_AUTH_DOMAIN, databaseURL: env.VITE_FB_DB_URL, projectId: env.VITE_FB_PROJECT_ID, appId: env.VITE_FB_APP_ID };
}
const tag = `soak-${Date.now().toString(36)}`;
const opened: FirebasePeer[] = [];
describe.skipIf(!live)('soak', () => {
  afterAll(() => opened.forEach(p => p.destroy()));
  it('keeps talking', async () => {
    const secs = Number(process.env.FB_SOAK_S ?? 240);
    setFirebaseConfig(cfg(), 'A'); const host = await openFirebase(`${tag}-h`, 15000) as FirebasePeer; opened.push(host);
    setFirebaseConfig(cfg(), 'B'); const guest = await openFirebase(`${tag}-g`, 15000) as FirebasePeer; opened.push(guest);
    const inc = new Promise<FirebaseConn>(r => host.on('connection', r));
    const c = guest.connect(`${tag}-h`);
    const hc = await inc;
    let lastH = Date.now(), lastG = Date.now(), maxH = 0, maxG = 0, nH = 0, nG = 0, lost = 0;
    hc.on('data', () => { const n = Date.now(); maxH = Math.max(maxH, n - lastH); lastH = n; nH++; });
    c.on('data', () => { const n = Date.now(); maxG = Math.max(maxG, n - lastG); lastG = n; nG++; });
    hc.on('close', () => lost++); c.on('close', () => lost++);
    host.on('disconnected', () => lost++); guest.on('disconnected', () => lost++);
    host.on('error', () => lost++); guest.on('error', () => lost++);
    const end = Date.now() + secs * 1000;
    let i = 0;
    while (Date.now() < end) {
      c.send({ t: 'ping', at: Date.now() }); hc.send({ t: 'ping', at: Date.now() });
      if (++i % 10 === 0) for (let k = 0; k < 8; k++) { c.send({ t: 'ans', seq: i + k, v: { a: 'roll' }, u: false }); hc.send({ t: 'ans', seq: i + k, v: null, u: false }); }
      await new Promise(r => setTimeout(r, 3000));
    }
    await new Promise(r => setTimeout(r, 4000));
    console.log(`SOAK ${secs}s: host got ${nH}, guest got ${nG}, max gap host ${maxH} ms, guest ${maxG} ms, lost events ${lost}`);
    expect(lost).toBe(0);
  }, (Number(process.env.FB_SOAK_S ?? 240) + 60) * 1000);
});
