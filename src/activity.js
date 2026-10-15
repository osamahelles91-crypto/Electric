// سجل «ما وصلني من الأجهزة الأخرى» — يُحفظ محليًا فقط ولا يُزامَن.
const KEY = 'em-activity';

export function loadActivity() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
export function saveActivity(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50))); } catch { /* ignore */ }
}

const VERB = { add: 'أضاف', edit: 'عدّل', del: 'حذف' };

export function describeEvent(ev, { fd, currency }) {
  const who = ev.by || 'جهاز آخر';
  const v = VERB[ev.op] || 'عدّل';
  const d = ev.data || {};
  switch (ev.store) {
    case 'readings':
      return `${who} ${v} قراءة ${d.reading ?? ''} ك.و.س${d.date ? ` (${fd(d.date)})` : ''}`;
    case 'payments':
      return `${who} ${v} دفعة ${d.amount ?? ''} ${currency}${d.loss && d.loss !== '0' ? ` (منها فاقد ${d.loss})` : ''}${d.date ? ` (${fd(d.date)})` : ''}`;
    case 'adjustments':
      return `${who} ${v} تصحيحًا ماليًا ${d.amount ?? ''} ${currency}${d.description ? ` — ${d.description}` : ''}`;
    case 'settings':
      return `${who} غيّر الإعدادات`;
    default:
      return `${who} ${v} بيانات`;
  }
}

/** يحوّل أحداثًا واردة إلى عناصر سجل. إن كثرت تُلخَّص في عنصر واحد */
export function toItems(events, fmt) {
  if (!events.length) return [];
  const ts = Math.max(...events.map((e) => e.ts || 0)) || Date.now();
  const mk = (text) => ({ id: `${ts}-${Math.random().toString(36).slice(2, 7)}`, ts, text, read: false });
  if (events.length > 4) {
    const who = events[0].by || 'جهاز آخر';
    return [mk(`${who} أرسل ${events.length} تحديثات`)];
  }
  return events.map((e) => ({ ...mk(describeEvent(e, fmt)), ts: e.ts || ts }));
}
