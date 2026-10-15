// قفل التطبيق المحلي: اسم مستخدم وكلمة مرور تُطلب عند فتح التطبيق.
// منفصل عن حساب السحابة. الافتراضي: غير مفعّل. عند تفعيله من الإعدادات تكون البيانات الافتراضية admin / 1234 ما لم تُغيَّر.
const KEY = 'em-lock';

async function sha(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`em|${text}`));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `plain:${text}`;
  }
}

export function loadLock() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && typeof v === 'object') return v;
  } catch { /* ignore */ }
  return null; // null = الإعداد الافتراضي
}

/** {enabled, user, hash} — الافتراضي: غير مفعّل (admin/1234 إن فُعّل دون تغيير) */
export async function getLock() {
  const v = loadLock();
  if (v) return v;
  return { enabled: false, user: 'admin', hash: await sha('1234') };
}

export async function verify(user, pw) {
  const l = await getLock();
  return l.user.toLowerCase() === user.trim().toLowerCase() && l.hash === (await sha(pw));
}

export async function saveLock({ enabled, user, pw }) {
  const cur = await getLock();
  const next = { enabled, user: user.trim() || cur.user, hash: pw ? await sha(pw) : cur.hash };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}
