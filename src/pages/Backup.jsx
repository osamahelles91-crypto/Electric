import { useRef, useState } from 'react';
import { useApp } from '../ctx';
import { toCSV, download } from '../csv';
import { buildBackup, validateBackup } from '../backup';
import { todayStr } from '../calc';

const KIND = { correction: 'تصحيح قراءة سابقة', replacement: 'استبدال عداد' };

export default function Backup() {
  const { rows, readings, payments, adjustments, settings, restoreAll, ask, notify } = useApp();
  const [report, setReport] = useState(null);
  const file = useRef(null);
  const dec = settings.decimals;

  const exportReadings = () =>
    download(
      'القراءات.csv',
      toCSV(
        ['رقم القراءة', 'التاريخ', 'قراءة العداد', 'الاستهلاك', 'المدة (يوم)', 'السعر', 'التكلفة', 'الملاحظات'],
        rows.map((r) => [r.n, r.date, r.reading, r.isOpening ? '' : r.consumption.toFixed(), r.isOpening ? '' : r.days, r.price, r.isOpening ? '' : r.cost.toFixed(dec), [r.isOpening ? 'قراءة افتتاحية' : KIND[r.kind], r.notes].filter(Boolean).join(' - ')])
      )
    );
  const exportPayments = () =>
    download('المدفوعات.csv', toCSV(['رقم العملية', 'التاريخ', 'المبلغ', 'الفاقد', 'طريقة الدفع', 'الملاحظات'], [...payments].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0))).map((p, i) => [i + 1, p.date, p.amount, p.loss || '0', p.method, p.notes])));
  const exportAll = () =>
    download(`نسخة-احتياطية-كهرباء-${todayStr()}.json`, JSON.stringify(buildBackup({ settings, readings, payments, adjustments }), null, 2), 'application/json');

  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    let obj;
    try {
      obj = JSON.parse(await f.text());
    } catch {
      setReport({ ok: false, errors: ['الملف ليس بصيغة JSON صالحة.'] });
      return;
    }
    const res = validateBackup(obj);
    setReport(res);
    if (!res.ok) return;
    const s = res.summary;
    const ok = await ask({
      title: 'استعادة البيانات',
      message: `تحذير: ستُستبدل كل البيانات الحالية (${readings.length} قراءة، ${payments.length} دفعة) بمحتوى الملف: ${s.readings} قراءة، ${s.payments} دفعة، ${s.adjustments} تصحيح. لا يمكن التراجع. يُنصح بتصدير نسخة احتياطية من بياناتك الحالية أولًا.`,
      confirmText: 'استبدال واستعادة',
      danger: true,
    });
    if (ok) {
      await restoreAll(res.data);
      setReport(null);
    } else notify('أُلغيت الاستعادة، ولم تتغير بياناتك.');
  };

  return (
    <>
      <div className="page-head"><h1>النسخ الاحتياطي</h1></div>
      <section className="panel">
        <h3>أين تُحفظ بياناتي؟</h3>
        <p>تُحفظ البيانات بشكل دائم على هذا الجهاز (قاعدة IndexedDB). لفتحها من أكثر من جهاز فعّل المزامنة من صفحة «السحابة». وفي كل الأحوال يُنصح بتصدير نسخة كاملة بين وقت وآخر.</p>
      </section>
      <section className="panel">
        <h3>التصدير</h3>
        <div className="row-btns">
          <button type="button" className="btn ghost" onClick={exportReadings} disabled={!rows.length}>تصدير القراءات (CSV)</button>
          <button type="button" className="btn ghost" onClick={exportPayments} disabled={!payments.length}>تصدير المدفوعات (CSV)</button>
          <button type="button" className="btn primary" onClick={exportAll}>تصدير نسخة احتياطية كاملة</button>
        </div>
      </section>
      <section className="panel">
        <h3>الاستعادة</h3>
        <p>اختر ملف نسخة احتياطية (JSON). يُفحص الملف أولًا، ثم يُطلب تأكيدك قبل استبدال البيانات الحالية.</p>
        <input ref={file} type="file" accept="application/json,.json" onChange={pick} hidden />
        <button type="button" className="btn ghost" onClick={() => file.current?.click()}>اختيار ملف الاستعادة</button>
        {report && !report.ok && (
          <div className="alert warn" role="alert">
            <b>الملف غير صالح ولم يتغير شيء:</b>
            <ul>{report.errors.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        )}
      </section>
    </>
  );
}
