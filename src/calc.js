import Decimal from 'decimal.js';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export const D = (v) => new Decimal(v === '' || v == null ? 0 : v);

const AR = '٠١٢٣٤٥٦٧٨٩';
const FA = '۰۱۲۳۴۵۶۷۸۹';

/** يحوّل إدخال المستخدم (أرقام عربية/هندية، فاصلة عشرية) إلى نص رقمي صالح أو null */
export function parseNum(input) {
  if (input == null) return null;
  let t = String(input).trim();
  if (!t) return null;
  t = t
    .replace(/[٠-٩]/g, (d) => AR.indexOf(d))
    .replace(/[۰-۹]/g, (d) => FA.indexOf(d))
    .replace(/[٫،,]/g, '.')
    .replace(/\s/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return t;
}

/* ---------- التواريخ (نصوص YYYY-MM-DD دون أي اعتماد على المنطقة الزمنية) ---------- */
const pad = (n) => String(n).padStart(2, '0');
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const parts = (s) => s.split('-').map(Number);
export function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  const [y, m, d] = parts(s);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
export function daysBetween(a, b) {
  const [y1, m1, d1] = parts(a);
  const [y2, m2, d2] = parts(b);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 864e5);
}
export function addDays(s, n) {
  const [y, m, d] = parts(s);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export function addMonths(s, n) {
  const [y, m, d] = parts(s);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10);
}
export function fmtDate(s, fmt = 'DMY') {
  if (!s || !isValidDate(s)) return s || '—';
  const [y, m, d] = s.split('-');
  if (fmt === 'YMD') return `${y}-${m}-${d}`;
  if (fmt === 'MDY') return `${m}/${d}/${y}`;
  return `${d}/${m}/${y}`;
}
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const monthLabel = (key) => {
  const [y, m] = key.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
};

/* ---------- التنسيق ---------- */
const group = (i) => i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
export function fmtFixed(v, dec = 2) {
  const d = v instanceof Decimal ? v : D(v);
  let s = d.toFixed(dec);
  let neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  if (/^[0.]*$/.test(s)) neg = false;
  const [i, f] = s.split('.');
  return (neg ? '-' : '') + group(i) + (f ? '.' + f : '');
}
export function fmtQty(v) {
  const d = D(v).toDecimalPlaces(3);
  let s = d.toFixed();
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  const [i, f] = s.split('.');
  return (neg ? '-' : '') + group(i) + (f ? '.' + f : '');
}

/* ---------- الحسابات ---------- */
export function sortReadings(rs) {
  return [...rs].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0) || (a.id || 0) - (b.id || 0)
  );
}

/**
 * يحسب فترات الاستهلاك من القراءات المخزنة.
 * أنواع القراءة: normal | correction (تصحيح قراءة سابقة: استهلاك صفر) | replacement (استبدال عداد)
 * أول قراءة زمنيًا تُعامل دائمًا كقراءة افتتاحية.
 */
export function computeRows(readings) {
  const s = sortReadings(readings);
  const rows = [];
  s.forEach((r, i) => {
    const row = {
      ...r,
      n: i + 1,
      isOpening: i === 0,
      consumption: D(0),
      days: 0,
      avgDaily: null,
      cost: D(0),
      error: null,
    };
    if (i > 0) {
      const p = s[i - 1];
      const cur = D(r.reading);
      const prev = D(p.reading);
      row.days = daysBetween(p.date, r.date);
      let c = D(0);
      if (r.kind === 'replacement') {
        if (r.oldFinal == null || r.oldFinal === '' || D(r.oldFinal).lt(prev) || cur.lt(D(r.newStart ?? 0))) {
          row.error = 'replacement';
        } else {
          c = D(r.oldFinal).minus(prev).plus(cur.minus(D(r.newStart ?? 0)));
        }
      } else if (r.kind === 'correction') {
        c = D(0);
      } else {
        c = cur.minus(prev);
        if (c.lt(0)) {
          row.error = 'lower';
          c = D(0);
        }
      }
      row.consumption = c;
      row.cost = c.times(D(r.price));
      row.avgDaily = row.days > 0 ? c.div(row.days) : null;
    }
    rows.push(row);
  });
  // مقارنة كل فترة بالفترة السابقة (الفترات تبدأ من القراءة الثانية)
  rows.forEach((r, i) => {
    r.cmp = null;
    if (i >= 2) {
      const p = rows[i - 1];
      const diff = r.consumption.minus(p.consumption);
      r.cmp = {
        prevConsumption: p.consumption,
        prevDays: p.days,
        prevAvg: p.avgDaily,
        diff,
        pct: p.consumption.isZero() ? null : diff.div(p.consumption).times(100),
      };
    }
  });
  return rows;
}

export function totalsOf(rows) {
  const periods = rows.filter((r) => !r.isOpening);
  const consumption = periods.reduce((a, r) => a.plus(r.consumption), D(0));
  const cost = periods.reduce((a, r) => a.plus(r.cost), D(0));
  const days = periods.reduce((a, r) => a + r.days, 0);
  return {
    consumption,
    cost,
    days,
    count: rows.length,
    avgDaily: days > 0 ? consumption.div(days) : null,
  };
}

export const sumPayments = (payments) => payments.reduce((a, p) => a.plus(D(p.amount)), D(0));
export const sumAdjustments = (adjs) => adjs.reduce((a, p) => a.plus(D(p.amount)), D(0));

/** الرصيد = إجمالي تكلفة الاستهلاك (+ التصحيحات) − إجمالي المدفوعات */
export function balanceOf(rows, payments, adjustments = []) {
  return totalsOf(rows).cost.plus(sumAdjustments(adjustments)).minus(sumPayments(payments));
}

export function buildLedger(rows, payments, adjustments = []) {
  const ev = [];
  rows.forEach((r) => {
    if (!r.isOpening) {
      ev.push({ key: `r${r.id}`, date: r.date, order: 0, seq: r.createdAt || 0, id: r.id, type: 'consumption', ref: r, due: r.cost, paid: D(0) });
    }
  });
  adjustments.forEach((a) =>
    ev.push({ key: `a${a.id}`, date: a.date, order: 0, seq: a.createdAt || 0, id: a.id, type: 'adjustment', ref: a, due: D(a.amount), paid: D(0) })
  );
  payments.forEach((p) =>
    ev.push({ key: `p${p.id}`, date: p.date, order: 1, seq: p.createdAt || 0, id: p.id, type: 'payment', ref: p, due: D(0), paid: D(p.amount) })
  );
  ev.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order || a.seq - b.seq || a.id - b.id));
  let bal = D(0);
  return ev.map((e) => {
    bal = bal.plus(e.due).minus(e.paid);
    return { ...e, balance: bal };
  });
}

/* ---------- نطاقات التصفية للرسوم ---------- */
export function rangeBounds(range, from, to) {
  const t = todayStr();
  switch (range) {
    case '7d': return [addDays(t, -7), null];
    case '30d': return [addDays(t, -30), null];
    case '3m': return [addMonths(t, -3), null];
    case '6m': return [addMonths(t, -6), null];
    case '12m': return [addMonths(t, -12), null];
    case 'custom': return [from || null, to || null];
    default: return [null, null];
  }
}
export const inRange = (date, [a, b]) => (!a || date >= a) && (!b || date <= b);
export const monthKey = (date) => date.slice(0, 7);
