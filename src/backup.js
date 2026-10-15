import { DEFAULT_SETTINGS } from './db';
import { computeRows, isValidDate, parseNum } from './calc';

export const APP_ID = 'electricity-monitor';

export function buildBackup({ settings, readings, payments, adjustments }) {
  return {
    app: APP_ID,
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    readings,
    payments,
    adjustments,
  };
}

const num = (v) => (typeof v === 'number' ? String(v) : typeof v === 'string' ? parseNum(v) : null);

/** يتحقق من ملف النسخة الاحتياطية ويعيد بيانات منظفة أو قائمة أخطاء */
export function validateBackup(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object' || obj.app !== APP_ID) {
    return { ok: false, errors: ['الملف ليس نسخة احتياطية لهذا التطبيق.'] };
  }
  for (const k of ['readings', 'payments', 'adjustments']) {
    if (!Array.isArray(obj[k])) errors.push(`الحقل «${k}» مفقود أو غير صالح.`);
  }
  if (errors.length) return { ok: false, errors };

  const ids = { readings: new Set(), payments: new Set(), adjustments: new Set() };
  const checkId = (kind, r, label) => {
    if (!Number.isInteger(r.id) || r.id <= 0) errors.push(`${label}: المعرّف غير صالح.`);
    else if (ids[kind].has(r.id)) errors.push(`${label}: معرّف مكرر.`);
    else ids[kind].add(r.id);
  };

  const readings = obj.readings.map((r, i) => {
    const label = `قراءة رقم ${i + 1}`;
    checkId('readings', r, label);
    const reading = num(r.reading);
    const price = num(r.price);
    if (!isValidDate(r.date)) errors.push(`${label}: التاريخ غير صالح.`);
    if (reading == null || reading.startsWith('-')) errors.push(`${label}: قراءة العداد غير صالحة.`);
    if (price == null || price.startsWith('-')) errors.push(`${label}: السعر غير صالح.`);
    const kind = ['normal', 'correction', 'replacement'].includes(r.kind) ? r.kind : 'normal';
    const out = { id: r.id, date: r.date, reading, price, notes: String(r.notes || ''), kind, createdAt: Number(r.createdAt) || Date.now() };
    if (kind === 'replacement') {
      out.oldFinal = num(r.oldFinal);
      out.newStart = num(r.newStart) ?? '0';
    }
    return out;
  });

  const payments = obj.payments.map((p, i) => {
    const label = `دفعة رقم ${i + 1}`;
    checkId('payments', p, label);
    const amount = num(p.amount);
    if (!isValidDate(p.date)) errors.push(`${label}: التاريخ غير صالح.`);
    if (amount == null || amount.startsWith('-') || /^0(\.0+)?$/.test(amount)) errors.push(`${label}: المبلغ غير صالح.`);
    return { id: p.id, date: p.date, amount, method: String(p.method || ''), notes: String(p.notes || ''), createdAt: Number(p.createdAt) || Date.now() };
  });

  const adjustments = obj.adjustments.map((a, i) => {
    const label = `تصحيح مالي رقم ${i + 1}`;
    checkId('adjustments', a, label);
    const amount = num(a.amount);
    if (!isValidDate(a.date)) errors.push(`${label}: التاريخ غير صالح.`);
    if (amount == null) errors.push(`${label}: المبلغ غير صالح.`);
    return { id: a.id, date: a.date, amount, description: String(a.description || ''), createdAt: Number(a.createdAt) || Date.now() };
  });

  if (!errors.length) {
    computeRows(readings).forEach((r) => {
      if (r.error) errors.push(`القراءة بتاريخ ${r.date} تنتج استهلاكًا سالبًا أو بيانات استبدال ناقصة.`);
    });
  }

  const s = obj.settings && typeof obj.settings === 'object' ? obj.settings : {};
  const dec = Number(s.decimals);
  const settings = {
    ...DEFAULT_SETTINGS,
    ...s,
    price: num(s.price) ?? DEFAULT_SETTINGS.price,
    decimals: Number.isInteger(dec) && dec >= 0 && dec <= 4 ? dec : DEFAULT_SETTINGS.decimals,
    dateFormat: ['DMY', 'YMD', 'MDY'].includes(s.dateFormat) ? s.dateFormat : 'DMY',
  };

  return {
    ok: errors.length === 0,
    errors: errors.slice(0, 12),
    data: { settings, readings, payments, adjustments },
    summary: { readings: readings.length, payments: payments.length, adjustments: adjustments.length, exportedAt: obj.exportedAt || '' },
  };
}
