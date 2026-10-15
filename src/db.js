// تخزين دائم داخل المتصفح باستخدام IndexedDB (جهاز واحد). لا توجد مزامنة سحابية.
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
const VERSION = 1;
export const STORES = ['readings', 'payments', 'adjustments'];

let dbp = null;

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
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  const id = await req(tx.objectStore(store).add({ ...obj, createdAt: obj.createdAt || Date.now() }));
  await done(tx);
  return id;
}
export async function putRec(store, obj) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(obj);
  await done(tx);
}
export async function delRec(store, id) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(id);
  await done(tx);
}
export async function getSettings() {
  const db = await openDB();
  const rec = await req(db.transaction('settings').objectStore('settings').get('main'));
  return { ...DEFAULT_SETTINGS, ...(rec?.value || {}) };
}
export async function saveSettings(value) {
  const db = await openDB();
  const tx = db.transaction('settings', 'readwrite');
  tx.objectStore('settings').put({ key: 'main', value });
  await done(tx);
}

/** استبدال كل البيانات دفعة واحدة داخل معاملة واحدة (تُلغى كلها عند أي خطأ) */
export async function replaceAll({ settings, readings, payments, adjustments }) {
  const db = await openDB();
  const tx = db.transaction([...STORES, 'settings'], 'readwrite');
  STORES.forEach((s) => tx.objectStore(s).clear());
  tx.objectStore('settings').clear();
  readings.forEach((r) => tx.objectStore('readings').put(r));
  payments.forEach((r) => tx.objectStore('payments').put(r));
  adjustments.forEach((r) => tx.objectStore('adjustments').put(r));
  tx.objectStore('settings').put({ key: 'main', value: { ...DEFAULT_SETTINGS, ...settings } });
  await done(tx);
}
