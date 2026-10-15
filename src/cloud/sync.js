import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth';
import { initializeFirestore, collection, doc, runTransaction, onSnapshot } from 'firebase/firestore';
import * as db from '../db';
import { BUILTIN_CONFIG } from './builtin';

const CFG_KEY = 'em-cloud-config';

function loadDeviceId() {
  let id = '';
  try { id = localStorage.getItem('em-device-id') || ''; } catch { /* ignore */ }
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem('em-device-id', id); } catch { /* ignore */ }
  }
  return id;
}
const deviceId = loadDeviceId();
export function getDeviceName() {
  try { return localStorage.getItem('em-device-name') || `جهاز ${deviceId.slice(0, 3)}`; } catch { return 'جهاز'; }
}
export function setDeviceName(n) {
  try { localStorage.setItem('em-device-name', n.trim().slice(0, 30)); } catch { /* ignore */ }
}

/** phase: nocfg | signedout | syncing | synced | offline | error */
export const state = { phase: 'nocfg', email: '', lastSync: null, pending: 0, error: '', server: true };
const subs = new Set();
const remoteCbs = new Set();
const snap = () => ({ ...state });
const emit = () => subs.forEach((cb) => cb(snap()));
export const subscribe = (cb) => {
  subs.add(cb);
  return () => subs.delete(cb);
};
export const onRemoteApplied = (cb) => {
  remoteCbs.add(cb);
  return () => remoteCbs.delete(cb);
};

/** يقبل JSON أو كود JavaScript الذي يعرضه Firebase (const firebaseConfig = {...}) */
export function parseConfig(text) {
  const cfg = {};
  const re = /["']?(\w+)["']?\s*:\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(text || ''))) cfg[m[1]] = m[2];
  if (!cfg.apiKey || !cfg.projectId || !cfg.appId) return null;
  return cfg;
}
export function loadConfig() {
  try {
    const s = localStorage.getItem(CFG_KEY);
    if (s) return JSON.parse(s);
  } catch { /* ignore */ }
  return BUILTIN_CONFIG;
}
export const saveConfig = (cfg) => localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
export const clearConfig = () => localStorage.removeItem(CFG_KEY);

export function arabicError(e) {
  const c = e?.code || '';
  const map = {
    'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة.',
    'auth/wrong-password': 'كلمة المرور غير صحيحة.',
    'auth/user-not-found': 'لا يوجد حساب بهذا البريد. أنشئ حسابًا أولًا.',
    'auth/email-already-in-use': 'هذا البريد مسجَّل مسبقًا. استخدم «تسجيل الدخول».',
    'auth/weak-password': 'كلمة المرور ضعيفة: يجب ألا تقل عن 6 أحرف.',
    'auth/invalid-email': 'صيغة البريد غير صحيحة.',
    'auth/network-request-failed': 'تعذّر الاتصال بالإنترنت.',
    'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.',
    'auth/operation-not-allowed': 'لم تُفعَّل طريقة «البريد وكلمة المرور» في Firebase Authentication.',
    'auth/invalid-api-key': 'مفتاح API غير صحيح. راجع إعداد Firebase.',
    'permission-denied': 'رفضت قواعد Firestore الوصول. انسخ القواعد الموضحة في صفحة السحابة.',
    unavailable: 'الخدمة غير متاحة الآن (تحقق من الإنترنت).',
    'failed-precondition': 'لم تُنشأ قاعدة Firestore بعد في مشروعك.',
  };
  return map[c] || `${c || 'خطأ'}: ${e?.message || e}`;
}

let inited = false;
let auth = null;
let fs = null;
let col = null;
let unsub = null;
let flushTimer = null;
let flushing = false;
let firstSnapshot = false;
let serverSynced = false; // وصلتنا لقطة من الخادم نفسه (لا من الذاكرة المؤقتة)

const online = () => (typeof navigator === 'undefined' ? true : navigator.onLine);

async function refreshPending() {
  try { state.pending = (await db.getOutbox()).length; } catch { /* ignore */ }
}

const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej({ code: 'timeout' }), ms))]);

/** يرفع سجلًا واحدًا دون أن يطغى على نسخة أحدث موجودة في السحابة (الأحدث يفوز) */
async function pushOne(e) {
  const payload = { ...(await db.buildPayload(e)), by: deviceId, byName: getDeviceName() };
  const ref = doc(col, `${e.store}-${e.id}`);
  await withTimeout(
    runTransaction(fs, async (tx) => {
      const cur = await tx.get(ref);
      if (cur.exists() && (cur.data().updatedAt || 0) > payload.updatedAt) return;
      tx.set(ref, payload);
    }),
    15000
  );
}

function settle() {
  if (state.phase === 'error' || state.phase === 'signedout' || state.phase === 'nocfg') return;
  state.phase = !online() || !state.server ? 'offline' : state.pending ? 'syncing' : 'synced';
}

export function scheduleFlush(ms = 500) {
  if (!col) return;
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, ms);
}

async function flush() {
  if (!col || !serverSynced || flushing) return;
  if (!online()) {
    await refreshPending();
    settle();
    emit();
    return;
  }
  flushing = true;
  try {
    const list = await db.getOutbox();
    for (const e of list) {
      await pushOne(e);
      await db.clearOutbox(e.key, e.updatedAt);
    }
    state.error = '';
    if (state.phase === 'error') state.phase = 'syncing';
    state.lastSync = Date.now();
  } catch (err) {
    if (err?.code === 'timeout' || err?.code === 'unavailable' || err?.code === 'failed-precondition' && !online()) {
      state.server = false; // اتصال ضعيف أو منقطع: تبقى التعديلات في الصندوق الصادر وتُعاد المحاولة
    } else {
      state.phase = 'error';
      state.error = arabicError(err);
    }
  } finally {
    flushing = false;
    await refreshPending();
    settle();
    emit();
  }
}

function stop() {
  if (unsub) unsub();
  unsub = null;
  col = null;
  firstSnapshot = false;
  serverSynced = false;
  clearTimeout(flushTimer);
}

async function start(uid) {
  stop();
  state.phase = 'syncing';
  state.error = '';
  emit();
  col = collection(fs, 'users', uid, 'records');
  const seeded = `em-cloud-seeded-${uid}`;
  try {
    if (!localStorage.getItem(seeded)) {
      await db.enqueueAllLocal();
      localStorage.setItem(seeded, '1');
    }
  } catch { /* ignore */ }
  unsub = onSnapshot(
    col,
    { includeMetadataChanges: true },
    async (s) => {
      state.server = !s.metadata.fromCache;
      if (state.server) serverSynced = true;
      let changed = false;
      let maxTs = 0;
      const events = [];
      for (const ch of s.docChanges()) {
        if (ch.type === 'removed') continue;
        const d = ch.doc.data();
        if (!d?.store) continue;
        maxTs = Math.max(maxTs, d.updatedAt || 0);
        try {
          const res = await db.applyRemote({ store: d.store, id: d.id, deleted: !!d.deleted, data: d.data, updatedAt: d.updatedAt || 0 });
          if (res) {
            changed = true;
            if (d.by !== deviceId && (res.op !== 'del' || res.rec)) {
              events.push({ op: res.op, store: d.store, data: res.op === 'del' ? res.rec : d.data, by: d.byName || '', ts: d.updatedAt || 0 });
            }
          }
        } catch { /* ignore one bad record */ }
      }
      // أول دخول: لا إشعارات للبيانات القديمة. وفي التشغيلات التالية: فقط ما جدّ بعد آخر ما رأيته
      const lsKey = `em-cloud-lastseen-${uid}`;
      let prev = 0;
      try { prev = Number(localStorage.getItem(lsKey) || 0); } catch { /* ignore */ }
      const notify = firstSnapshot ? events : prev ? events.filter((e) => e.ts > prev) : [];
      try { localStorage.setItem(lsKey, String(Math.max(prev, maxTs))); } catch { /* ignore */ }
      if (changed) remoteCbs.forEach((cb) => cb(notify));
      firstSnapshot = true;
      if (state.server) state.lastSync = Date.now();
      if (state.phase === 'error' && !flushing) state.error = '';
      await refreshPending();
      if (state.phase === 'error') state.phase = 'syncing';
      settle();
      emit();
      scheduleFlush(0);
    },
    (err) => {
      state.phase = 'error';
      state.error = arabicError(err);
      emit();
    }
  );
}

export function init() {
  if (inited) return;
  inited = true;
  const cfg = loadConfig();
  if (!cfg?.apiKey || !cfg?.projectId || !cfg?.appId) {
    state.phase = 'nocfg';
    emit();
    return;
  }
  try {
    const app = initializeApp(cfg);
    auth = getAuth(app);
    fs = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch (e) {
    state.phase = 'error';
    state.error = arabicError(e);
    emit();
    return;
  }
  state.phase = 'signedout';
  emit();
  onAuthStateChanged(auth, (user) => {
    if (user) {
      state.email = user.email || '';
      start(user.uid);
    } else {
      stop();
      state.email = '';
      state.phase = 'signedout';
      emit();
    }
  });
  db.onLocalChange(() => scheduleFlush(600));
  // إعادة المحاولة كل 20 ثانية ما دامت هناك تعديلات معلّقة (navigator.onLine لا يكشف دائمًا غياب الإنترنت الفعلي)
  setInterval(() => { if (col && state.pending > 0) scheduleFlush(0); }, 20000);
  window.addEventListener('online', () => { state.server = true; scheduleFlush(0); settle(); emit(); });
  window.addEventListener('offline', () => { settle(); emit(); });
}

export const signUp = (email, pw) => createUserWithEmailAndPassword(auth, email, pw);
export const signIn = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const signOutNow = () => fbSignOut(auth);
export function syncNow() {
  scheduleFlush(0);
}
