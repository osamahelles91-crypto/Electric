import { useState } from 'react';
import { useApp } from '../ctx';
import { Field } from '../ui';
import { parseNum, D, isValidDate, todayStr, fmtDate } from '../calc';

export default function Settings() {
  const { settings, saveSettings, readings, addOpening, notify } = useApp();
  const [f, setF] = useState({ ...settings, decimals: String(settings.decimals) });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const price = parseNum(f.price);
  const opening = f.openingReading === '' ? '' : parseNum(f.openingReading);
  const errors = {
    price: price == null || price.startsWith('-') ? 'أدخل سعرًا صالحًا (صفر أو أكثر).' : null,
    opening: opening === null || (opening && opening.startsWith('-')) ? 'قراءة غير صالحة.' : null,
    startDate: f.startDate && !isValidDate(f.startDate) ? 'تاريخ غير صالح.' : null,
  };
  const bad = Object.values(errors).some(Boolean) || !f.currency.trim();

  const submit = async (e) => {
    e.preventDefault();
    if (bad) return;
    const next = {
      meterName: f.meterName.trim() || 'العداد',
      price: D(price).toFixed(),
      currency: f.currency.trim(),
      decimals: Number(f.decimals),
      startDate: f.startDate,
      openingReading: opening || '',
      dateFormat: f.dateFormat,
    };
    const ok = await saveSettings(next);
    if (ok && opening && readings.length === 0) {
      await addOpening({ date: next.startDate || todayStr(), reading: opening, price: next.price, notes: 'قراءة افتتاحية', kind: 'normal' });
    } else if (ok && opening && readings.length > 0) {
      notify('حُفظت الإعدادات. القراءة الافتتاحية لا تُضاف تلقائيًا لأن هناك قراءات مسجلة.');
    }
  };

  return (
    <>
      <div className="page-head"><h1>الإعدادات</h1></div>
      <form className="panel form-grid" onSubmit={submit} noValidate>
        <Field label="اسم العداد"><input value={f.meterName} onChange={set('meterName')} /></Field>
        <Field label="سعر الكيلوواط ساعة الافتراضي" error={errors.price} hint="يُستخدم للقراءات الجديدة فقط. تبقى أسعار القراءات السابقة كما هي.">
          <input inputMode="decimal" value={f.price} onChange={set('price')} />
        </Field>
        <Field label="العملة"><input list="currencies" value={f.currency} onChange={set('currency')} />
          <datalist id="currencies">{['شيكل', 'دينار', 'ريال', 'درهم', 'جنيه', 'ليرة', 'دولار'].map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="عدد المنازل العشرية للمبالغ">
          <select value={f.decimals} onChange={set('decimals')}>{[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </Field>
        <Field label="تاريخ بدء تسجيل البيانات" error={errors.startDate} hint="لا يمكن تسجيل قراءة قبل هذا التاريخ. اتركه فارغًا لعدم التقييد.">
          <input type="date" value={f.startDate} onChange={set('startDate')} />
        </Field>
        <Field
          label="القراءة الافتتاحية (اختياري)"
          error={errors.opening}
          hint={readings.length ? 'تُضاف كقراءة فعلية فقط عندما لا توجد قراءات مسجلة.' : 'تُسجَّل كأول قراءة بتاريخ بدء التسجيل (أو اليوم).'}
        >
          <input inputMode="decimal" value={f.openingReading} onChange={set('openingReading')} />
        </Field>
        <Field label="تنسيق التاريخ">
          <select value={f.dateFormat} onChange={set('dateFormat')}>
            {['DMY', 'YMD', 'MDY'].map((k) => <option key={k} value={k}>{{ DMY: 'يوم/شهر/سنة', YMD: 'سنة-شهر-يوم', MDY: 'شهر/يوم/سنة' }[k]} — {fmtDate('2026-03-25', k)}</option>)}
          </select>
        </Field>
        <div className="form-actions"><button type="submit" className="btn primary" disabled={bad}>حفظ الإعدادات</button></div>
      </form>
    </>
  );
}
