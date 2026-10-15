// تخزين محلي دائم (IndexedDB) + «صندوق صادر» يسجّل كل تعديل ليُرسَل إلى السحابة عند تفعيلها.
// كل سجل يحمل updatedAt، وعند التعارض يفوز الأحدث.
export const DEFAULT_SETTINGS = {
  meterName: 'العداد الرئيسي',
  price: '0.60',
  currency: 'شيكل',
  decimals: 2,
  startDate: '',
  openingReading: '',
  dateFormat: 'DMY',
};

const DB_NAME = 'electricity-monitor';
const VERSION = 2;
export const STORES = ['readings', 'payments', 'adjustments'];

let dbp = null;
const listeners = new Set();
export const onLocalChange = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const emit = () => listeners.forEach((cb) => { try { cb(); } catch { /* ignore */ } });

/** معرّف فريد عبر الأجهزة (يمنع التصادم عند المزامنة) */
export const genId = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);
const keyOf = (store, id) => `${store}/${id}`;

export function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const rq = indexedDB.open(DB_NAME, VERSION);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      STORES.forEach((s) => {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id', autoIncrement: true });
      });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'key' });
    };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => {
      dbp = null;
      reject(rq.error);
    };
  });
  return dbp;
}

/** يغلق الاتصال (يُستخدم في الاختبارات لمحاكاة إغلاق التطبيق) */
export async function closeDB() {
  if (!dbp) return;
  const db = await dbp;
  db.close();
  dbp = null;
}

const req = (r) =>
  new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
const done = (tx) =>
  new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });

export async function getAll(store) {
  const db = await openDB();
  return req(db.transaction(store).objectStore(store).getAll());
}

export async function addRec(store, obj) {
  const now = Date.now();
  const id = obj.id ?? genId();
  const rec = { ...obj, id, createdAt: obj.createdAt || now, updatedAt: now };
  const db = await openDB();
  const tx = db.transaction([store, 'outbox'], 'readwrite');
  tx.objectStore(store).put(rec);
  tx.objectStore('outbox').put({ key: keyOf(store, id), store, id, op: 'put', updatedAt: now });
  await done(tx);
  emit();
  return id;
}

export async function putRec(store, obj) {
  const now = Date.now();
  const rec = { ...obj, updatedAt: now };
  const db = await openDB();
  const tx = db.transaction([store, 'outbox'], 'readwrite');
  tx.objectStore(store).put(rec);
  tx.objectStore('outbox').put({ key: keyOf(store, rec.id), store, id: rec.id, op: 'put', updatedAt: now });
  await done(tx);
  emit();
}

export async function delRec(store, id) {
  const now = Date.now();
  const db = await openDB();
  const tx = db.transaction([store, 'outbox'], 'readwrite');
  tx.objectStore(store).delete(id);
  tx.objectStore('outbox').put({ key: keyOf(store, id), store, id, op: 'del', updatedAt: now });
  await done(tx);
  emit();
}

export async function getSettings() {
  const db = await openDB();
  const rec = await req(db.transaction('settings').objectStore('settings').get('main'));
  return { ...DEFAULT_SETTINGS, ...(rec?.value || {}) };
}

export async function saveSettings(value) {
  const now = Date.now();
  const db = await openDB();
  const tx = db.transaction(['settings', 'outbox'], 'readwrite');
  tx.objectStore('settings').put({ key: 'main', value, updatedAt: now });
  tx.objectStore('outbox').put({ key: 'settings/main', store: 'settings', id: 'main', op: 'put', updatedAt: now });
  await done(tx);
  emit();
}

/** استبدال كل البيانات دفعة واحدة داخل معاملة واحدة (تُلغى كلها عند أي خطأ) */
export async function replaceAll({ settings, readings, payments, adjustments }) {
  const now = Date.now();
  const db = await openDB();
  const tx = db.transaction([...STORES, 'settings', 'outbox'], 'readwrite');
  const incoming = { readings, payments, adjustments };
  const outbox = tx.objectStore('outbox');
  for (const s of STORES) {
    const st = tx.objectStore(s);
    const oldKeys = await req(st.getAllKeys());
    st.clear();
    const keep = new Set(incoming[s].map((r) => r.id));
    oldKeys.forEach((k) => {
      if (!keep.has(k)) outbox.put({ key: keyOf(s, k), store: s, id: k, op: 'del', updatedAt: now });
    });
    incoming[s].forEach((r) => {
      st.put({ ...r, updatedAt: now });
      outbox.put({ key: keyOf(s, r.id), store: s, id: r.id, op: 'put', updatedAt: now });
    });
  }
  const ss = tx.objectStore('settings');
  ss.clear();
  ss.put({ key: 'main', value: { ...DEFAULT_SETTINGS, ...settings }, updatedAt: now });
  outbox.put({ key: 'settings/main', store: 'settings', id: 'main', op: 'put', updatedAt: now });
  await done(tx);
  emit();
}

/* ---------- واجهة المزامنة ---------- */
export async function getOutbox() {
  return getAll('outbox');
}

/** يحذف عنصر الصندوق الصادر فقط إن لم يتغير منذ قراءته */
export async function clearOutbox(key, updatedAt) {
  const db = await openDB();
  const tx = db.transaction('outbox', 'readwrite');
  const cur = await req(tx.objectStore('outbox').get(key));
  if (cur && cur.updatedAt === updatedAt) tx.objectStore('outbox').delete(key);
  await done(tx);
}

/** عند أول تفعيل للسحابة: كل البيانات المحلية تُرسل */
export async function enqueueAllLocal() {
  const db = await openDB();
  const tx = db.transaction([...STORES, 'settings', 'outbox'], 'readwrite');
  const outbox = tx.objectStore('outbox');
  for (const s of STORES) {
    const rows = await req(tx.objectStore(s).getAll());
    for (const r of rows) {
      const key = keyOf(s, r.id);
      if (!(await req(outbox.get(key)))) outbox.put({ key, store: s, id: r.id, op: 'put', updatedAt: r.updatedAt || r.createdAt || Date.now() });
    }
  }
  const st = await req(tx.objectStore('settings').get('main'));
  if (st && !(await req(outbox.get('settings/main')))) {
    outbox.put({ key: 'settings/main', store: 'settings', id: 'main', op: 'put', updatedAt: st.updatedAt || Date.now() });
  }
  await done(tx);
}

export async function buildPayload(e) {
  if (e.op === 'put') {
    const db = await openDB();
    const rec = await req(db.transaction(e.store).objectStore(e.store).get(e.store === 'settings' ? 'main' : e.id));
    if (rec) {
      return JSON.parse(
        JSON.stringify({
          store: e.store,
          id: e.id,
          deleted: false,
          data: e.store === 'settings' ? rec.value : rec,
          updatedAt: Math.max(e.updatedAt, rec.updatedAt || 0),
        })
      );
    }
  }
  return { store: e.store, id: e.id, deleted: true, data: null, updatedAt: e.updatedAt };
}

/** يطبّق تعديلًا قادمًا من السحابة إذا كان أحدث من النسخة المحلية (دون تسجيله في الصندوق الصادر).
 *  يعيد {op:'add'|'edit'|'del', rec} أو null إن لم يُطبَّق شيء */
export async function applyRemote({ store, id, deleted, data, updatedAt }) {
  if (!STORES.includes(store) && store !== 'settings') return null;
  const db = await openDB();
  const tx = db.transaction([store, 'outbox'], 'readwrite');
  const key = keyOf(store, id);
  const idKey = store === 'settings' ? 'main' : id;
  const local = await req(tx.objectStore(store).get(idKey));
  const pend = await req(tx.objectStore('outbox').get(key));
  const localTs = Math.max(pend?.updatedAt || 0, local?.updatedAt || local?.createdAt || 0);
  if (updatedAt <= localTs) {
    await done(tx);
    return null;
  }
  if (deleted) tx.objectStore(store).delete(idKey);
  else tx.objectStore(store).put(store === 'settings' ? { key: 'main', value: data, updatedAt } : { ...data, id, updatedAt });
  tx.objectStore('outbox').delete(key);
  await done(tx);
  return { op: deleted ? 'del' : local ? 'edit' : 'add', rec: local || null };
}
