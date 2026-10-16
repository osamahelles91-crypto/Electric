import { useEffect, useState } from 'react';
import { useApp } from '../ctx';
import { getLock, saveLock } from '../lock';
import { Field, Modal } from '../ui';
import * as sync from '../cloud/sync';
import * as dbm from '../db';
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
        <Field label="سعر الكيلوواط ساعة الافتراضي" error={errors.price} hint="يُستخدم عند أول قراءة فقط. بعدها يُستعاد تلقائيًا آخر سعر أدخلته. تبقى أسعار القراءات السابقة كما هي.">
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
      <LockSettings />
      <ResetSection />
    </>
  );
}

function LockSettings() {
  const { notify } = useApp();
  const [enabled, setEnabled] = useState(false);
  const [user, setUser] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getLock().then((l) => { setEnabled(l.enabled); setUser(l.user); });
  }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!user.trim()) return setMsg('أدخل اسم مستخدم.');
    if (pw && pw.length < 4) return setMsg('كلمة المرور 4 أحرف أو أكثر.');
    await saveLock({ enabled, user, pw });
    setPw('');
    setMsg('');
    notify('حُفظ إعداد القفل');
  };

  return (
    <form className="panel form-grid" onSubmit={save} noValidate>
      <h3>قفل التطبيق</h3>
      <p className="note">القفل متوقف افتراضيًا. فعّله إن أردت طلب اسم مستخدم وكلمة مرور عند فتح التطبيق. إن لم تكتب كلمة مرور جديدة فالبيانات الافتراضية admin / 1234، فيُنصح بتغييرها. هذا القفل منفصل عن حساب السحابة.</p>
      <label className="check"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> طلب تسجيل الدخول عند فتح التطبيق</label>
      <Field label="اسم المستخدم"><input dir="ltr" autoCapitalize="none" value={user} onChange={(e) => setUser(e.target.value)} /></Field>
      <Field label="كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية)" error={msg}>
        <input type="password" dir="ltr" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </Field>
      <div className="form-actions"><button type="submit" className="btn primary">حفظ القفل</button></div>
    </form>
  );
}

const RESET_PW = '123456789';

function ResetSection() {
  const { cloud } = useApp();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const signed = ['syncing', 'synced', 'offline', 'error'].includes(cloud.phase);

  const close = () => { if (!busy) { setOpen(false); setPw(''); setErr(''); } };

  const run = async (e) => {
    e.preventDefault();
    if (pw !== RESET_PW) { setErr('كلمة السر غير صحيحة.'); return; }
    setBusy(true);
    setErr('');
    try {
      await sync.wipeCloud(); // يفشل قبل مسح أي شيء محليًا إذا تعذّر الاتصال
      await dbm.wipeLocal();
      try {
        localStorage.removeItem('em-activity');
      } catch { /* ignore */ }
      window.location.hash = '#/home';
      window.location.reload();
    } catch (x) {
      setErr(sync.arabicError(x));
      setBusy(false);
    }
  };

  return (
    <section className="panel danger-zone">
      <h3>تصفير التطبيق</h3>
      <p className="note">يمسح كل القراءات والدفعات والتصحيحات والإعدادات من هذا الجهاز{signed ? '، ومن السحابة، ومن أجهزتك الأخرى عند مزامنتها' : ''}. لا يمكن التراجع.</p>
      <button type="button" className="btn danger-solid" onClick={() => setOpen(true)}>تصفير التطبيق وقاعدة البيانات</button>
      {open && (
        <Modal
          title="تأكيد التصفير"
          onClose={close}
          footer={
            <>
              <button type="button" className="btn ghost" onClick={close} disabled={busy}>إلغاء</button>
              <button type="submit" form="reset-form" className="btn danger-solid" disabled={busy || !pw}>{busy ? 'جارٍ المسح…' : 'تصفير نهائي'}</button>
            </>
          }
        >
          <form id="reset-form" onSubmit={run} noValidate>
            <p>سيُحذف كل شيء نهائيًا{signed ? ' من الهاتف ومن السحابة' : ' من هذا الجهاز (لا يوجد حساب سحابة مسجَّل الدخول)'}. أدخل كلمة السر للمتابعة.</p>
            <Field label="كلمة السر" error={err}>
              <input type="password" dir="ltr" autoComplete="off" value={pw} onChange={(e) => { setPw(e.target.value); setErr(''); }} autoFocus />
            </Field>
          </form>
        </Modal>
      )}
    </section>
  );
}
