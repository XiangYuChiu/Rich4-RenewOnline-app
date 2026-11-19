/**
 * 派對模式 through Firebase Realtime Database (rich4-online fork, 2026-11-16): stands in for the author's VPS relay
 * (relay-peer.ts) so the fork depends on no server of the original author's. A FirebasePeer is this phone under its
 * peer id, a FirebaseConn one connection to another phone — the same shape as RelayPeer / RelayConn, so net-peer.ts
 * and party-net.ts use it unchanged (it reports itself as `via: 'vps'`, the relayed way).
 *
 * The database (rules: game/database.rules.json):
 *   peers/{id}          { uid, at }            who holds the id; `at` is refreshed every BEAT_MS. An id silent for
 *                                               STALE_MS may be taken over (a new host takes the room's id).
 *   inbox/{id}/{push}   { from, cid, t, d, at } frames for that id: t = conn | d | close. The holder reads them in
 *                                               push order (one sender's frames keep their order) and deletes each.
 *
 * Not dropping: the inbox is in the cloud, so frames sent while this phone is away (background, tunnel, Wi-Fi ⇄ mobile
 * data) wait there. Firebase reconnects by itself; on coming back within HOLD_MS the phone claims its id again and
 * reads what waited. Away longer, the session is gone: its connections close and 'disconnected' fires (net-peer.ts
 * then reconnects, as with the relay).
 *
 * Payloads travel as JSON strings: the database drops empty arrays, empty objects and nulls, which the game's
 * messages contain.
 */
import { getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getDatabase, get, onChildAdded, onValue, push, ref, remove, runTransaction, serverTimestamp, update,
  type Database, type Unsubscribe,
} from 'firebase/database';

type Handler = (...a: any[]) => void; // eslint-disable-line @typescript-eslint/no-explicit-any

class Emitter {
  private h = new Map<string, Handler[]>();
  on(ev: string, fn: Handler): this { (this.h.get(ev) ?? this.h.set(ev, []).get(ev)!).push(fn); return this; }
  off(ev: string, fn: Handler): this { const l = this.h.get(ev); if (l) this.h.set(ev, l.filter(x => x !== fn)); return this; }
  protected emit(ev: string, ...a: unknown[]) { for (const fn of [...(this.h.get(ev) ?? [])]) { try { fn(...a); } catch (e) { console.error(e); } } }
}

/** The holder refreshes its id this often. */
const BEAT_MS = 5_000;
/** An id not refreshed for this long counts as nobody's (taken over, or `nopeer` to a caller). Rules: 20000. */
export const STALE_MS = 20_000;
/** Away longer than this, the session is gone (the relay's HOLD_MS). */
const HOLD_MS = 55_000;

// ---- the app and the player (one anonymous account per install) ----

let config: FirebaseOptions | null = null;
let appName = '';
/**
 * Sets the Firebase config by hand (scripts and live tests); the app otherwise reads game/.env.local (VITE_FB_*).
 * A different `name` is a separate app with its own anonymous player (a second phone, in tests). Peers already open
 * keep the player they opened with.
 */
export function setFirebaseConfig(c: FirebaseOptions | null, name = '') { config = c; appName = name; ready = null; }

function envConfig(): FirebaseOptions | null {
  const env = import.meta.env as Record<string, string | undefined>;
  if (!env.VITE_FB_API_KEY || !env.VITE_FB_DB_URL) return null;
  return {
    apiKey: env.VITE_FB_API_KEY, authDomain: env.VITE_FB_AUTH_DOMAIN, databaseURL: env.VITE_FB_DB_URL,
    projectId: env.VITE_FB_PROJECT_ID, appId: env.VITE_FB_APP_ID,
  };
}

/** Whether this build has a Firebase project to use. */
export const firebaseConfigured = () => !!(config ?? envConfig());

interface Ready { db: Database; uid: string; offset: () => number }
let ready: Promise<Ready> | null = null;

function connectDb(): Promise<Ready> {
  ready ??= (async () => {
    const cfg = config ?? envConfig();
    if (!cfg) throw new Error('firebase: not configured');
    const name = `rich4-${cfg.projectId ?? 'app'}${appName ? '-' + appName : ''}`;
    const app = getApps().find(a => a.name === name) ?? initializeApp(cfg, name);
    const auth = getAuth(app);
    await auth.authStateReady();
    const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
    const db = getDatabase(app);
    let off = 0;
    onValue(ref(db, '.info/serverTimeOffset'), s => { off = Number(s.val()) || 0; });
    return { db, uid: user.uid, offset: () => off };
  })();
  ready.catch(() => { ready = null; });
  return ready;
}

// ---- connections ----

export class FirebaseConn extends Emitter {
  open = false;
  readonly via = 'vps' as const;
  private done = false;
  constructor(readonly owner: FirebasePeer, readonly cid: string, readonly peer: string) { super(); }
  send(d: unknown) { if (this.open && !this.done) this.owner.put(this.peer, { t: 'd', cid: this.cid, d: JSON.stringify(d ?? null) }); }
  close() {
    if (this.done) return;
    this.owner.put(this.peer, { t: 'close', cid: this.cid });
    this.closed();
  }
  /** @internal */ opened() { if (this.done || this.open) return; this.open = true; this.emit('open'); }
  /** @internal */ data(d: unknown) { if (!this.done) this.emit('data', d); }
  /** @internal */ closed() { if (this.done) return; this.done = true; this.open = false; this.owner.forget(this.cid); this.emit('close'); }
  /** @internal */ failed() { if (this.done) return; this.done = true; this.owner.forget(this.cid); this.emit('error', { type: 'peer-unavailable' }); }
}

interface Frame { from: string; cid: string; t: 'conn' | 'd' | 'close'; d?: string; at?: number }

// ---- this phone under its id ----

export class FirebasePeer extends Emitter {
  readonly via = 'vps' as const;
  /** Holding the id (false once the session is gone). */
  open = false;
  destroyed = false;
  /** Round trip to the database (ms), the newest heartbeat's; 0 before the first. */
  rtt = 0;
  private conns = new Map<string, FirebaseConn>();
  private seen = new Set<string>();
  private subs: Unsubscribe[] = [];
  private beat = 0;
  private n = 0;
  private online = true;
  private lostAt = 0;
  /** Server time this session began: older frames in the inbox were for an earlier holder of the id. */
  private since = 0;

  private constructor(private readonly r: Ready, readonly id: string) { super(); }

  private now() { return Date.now() + this.r.offset(); }
  private peerRef(id = this.id) { return ref(this.r.db, `peers/${id}`); }

  /** Takes the id when nobody holds it (or its holder went silent): true when this phone holds it now. */
  private async claim(): Promise<boolean> {
    const uid = this.r.uid;
    // Fresh from the server first: a transaction that aborts on a stale cached holder never asks the server again.
    await get(this.peerRef());
    const res = await runTransaction(this.peerRef(), (cur: { uid?: string; at?: number } | null) => {
      if (cur && cur.uid !== uid && this.now() - (cur.at ?? 0) <= STALE_MS) return undefined; // held: abort
      return { uid, at: Math.floor(this.now()) - 2000 };                                       // rules: at <= now
    }, { applyLocally: false });
    if (!res.committed || res.snapshot.val()?.uid !== uid) return false;
    void this.heartbeat();
    return true;
  }

  /** Opens this phone under `id`: the peer, null when the id is held, 'down' when Firebase can't be reached in `ms`. */
  static async open(id: string, ms: number): Promise<FirebasePeer | null | 'down'> {
    let r: Ready;
    try { r = await within(connectDb(), ms); } catch { return 'down'; }
    const p = new FirebasePeer(r, id);
    let held: boolean;
    try { held = await within(p.claim(), ms); } catch { return 'down'; }
    if (!held) return null;
    p.since = p.now() - 1000;
    p.start();
    return p;
  }

  private start() {
    this.open = true;
    const { db } = this.r;
    // Someone else took the id (this phone was silent too long): like the relay's `evicted`.
    this.subs.push(onValue(this.peerRef(), s => {
      const v = s.val() as { uid?: string } | null;
      if (this.destroyed) return;
      if (v && v.uid !== this.r.uid) { this.open = false; this.emit('error', { type: 'unavailable-id' }); this.destroy(); }
      else if (!v && this.open && this.online) void this.claim();  // cleared by the clean-up job while here
    }));
    this.subs.push(onChildAdded(ref(db, `inbox/${this.id}`), s => this.frame(s.key!, s.val() as Frame), () => {
      // Reading refused: the id is no longer this phone's.
      if (!this.destroyed) { this.open = false; this.emit('error', { type: 'unavailable-id' }); this.destroy(); }
    }));
    this.subs.push(onValue(ref(db, '.info/connected'), s => {
      const up = !!s.val();
      if (up === this.online) return;
      console.warn('[party]', new Date().toISOString().slice(11, 23), `firebase ${up ? 'connected' : 'DISCONNECTED'} (${this.id.slice(-6)})`);
      this.online = up;
      if (!up) { if (!this.lostAt) this.lostAt = Date.now(); return; }
      // Back: take the id again (still ours unless someone took it while away), read what waited.
      this.lostAt = 0;
      if (this.open) void this.claim().then(ok => { if (!ok && !this.destroyed) { this.emit('error', { type: 'unavailable-id' }); this.destroy(); } });
    }));
    this.beat = setInterval(() => this.tick(), BEAT_MS) as unknown as number;
  }

  private async heartbeat() {
    if (this.destroyed || !this.online) return;
    const t0 = Date.now();
    try { await update(this.peerRef(), { at: serverTimestamp() }); this.rtt = Math.max(1, Date.now() - t0); } catch { /* offline or refused */ }
  }

  private tick() {
    if (this.destroyed) return;
    if (this.online) { void this.heartbeat(); return; }
    if (this.lostAt && Date.now() - this.lostAt > HOLD_MS && this.open) this.lost();
  }

  /** The session is gone for good: connections closed, 'disconnected' (net-peer.ts calls reconnect). */
  private lost() {
    this.open = false;
    for (const c of [...this.conns.values()]) c.closed();
    this.emit('disconnected');
  }

  /** Takes the id again after the session ended (PeerJS's reconnect). */
  reconnect() {
    if (this.destroyed || this.open) return;
    void this.claim().then(ok => {
      if (this.destroyed) return;
      if (ok) { this.open = true; this.since = this.now() - 1000; }
      else { this.emit('error', { type: 'unavailable-id' }); this.destroy(); }
    }).catch(() => { /* still offline: net-peer tries again */ });
  }

  /** A connection to another phone's id: 'open' once the request is in its inbox, 'error' when nobody holds that id. */
  connect(to: string): FirebaseConn {
    const c = new FirebaseConn(this, `${this.id.slice(-12)}:${Date.now().toString(36)}:${++this.n}`, to);
    this.conns.set(c.cid, c);
    void (async () => {
      const v = (await get(this.peerRef(to))).val() as { at?: number } | null;
      if (!v || this.now() - (v.at ?? 0) > STALE_MS) { c.failed(); return; }
      await this.put(to, { t: 'conn', cid: c.cid });
      c.opened();
    })().catch(() => c.failed());
    return c;
  }

  /** @internal A frame into `to`'s inbox (pushes from this phone keep their order). */
  put(to: string, f: Omit<Frame, 'from' | 'at'>): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    return push(ref(this.r.db, `inbox/${to}`), { ...f, from: this.id, at: serverTimestamp() }).then(() => undefined, () => undefined);
  }
  /** @internal */ forget(cid: string) { this.conns.delete(cid); }

  private frame(key: string, f: Frame) {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    if (this.seen.size > 4000) this.seen = new Set([...this.seen].slice(-2000));
    void remove(ref(this.r.db, `inbox/${this.id}/${key}`)).catch(() => { /* gone already */ });
    if (!f || typeof f.cid !== 'string') return;
    if (typeof f.at === 'number' && f.at < this.since) return;   // for an earlier holder of this id
    const c = this.conns.get(f.cid);
    switch (f.t) {
      case 'conn': {
        if (c) return;
        const nc = new FirebaseConn(this, f.cid, String(f.from));
        this.conns.set(nc.cid, nc);
        this.emit('connection', nc);
        queueMicrotask(() => nc.opened());
        break;
      }
      case 'd': {
        let d: unknown;
        try { d = JSON.parse(f.d ?? 'null'); } catch { return; }
        c?.data(d);
        break;
      }
      case 'close': c?.closed(); break;
    }
  }

  destroy() {
    if (this.destroyed) return;
    const held = this.open || this.lostAt > 0;
    this.destroyed = true;
    this.open = false;
    for (const u of this.subs) u();
    this.subs = [];
    clearInterval(this.beat);
    for (const c of [...this.conns.values()]) c.closed();
    // Release the id (only if still this phone's). The first run sees the local cache, empty here: answering null
    // lets the server retry with the real value instead of aborting.
    if (held) {
      void get(this.peerRef())
        .then(() => runTransaction(this.peerRef(), (cur: { uid?: string } | null) => (cur === null || cur.uid === this.r.uid ? null : undefined), { applyLocally: false }))
        .catch(() => { /* offline: the id goes stale and can be taken after STALE_MS */ });
    }
  }
}

function within<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

/** Opens this phone under `id` on Firebase (openRelay's counterpart). */
export const openFirebase = (id: string, ms = 8000) => FirebasePeer.open(id, ms);
