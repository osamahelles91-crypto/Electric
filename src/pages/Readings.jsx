import { useMemo, useState } from 'react';
import { useApp } from '../ctx';
import { Money, Qty, Empty } from '../Common';
import { totalsOf, fmtQty, fmtFixed } from '../calc';
import { toCSV, download } from '../csv';

const KIND = { correction: 'تصحيح قراءة سابقة', replacement: 'استبدال عداد' };

export default function Readings() {
  const { rows, settings, fd, openModal, deleteReading, readings, ask, notify } = useApp();
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const shown = useMemo(() => {
    const t = q.trim();
    return rows
      .filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
      .filter((r) => !t || r.notes.includes(t) || String(r.reading).includes(t) || fd(r.date).includes(t))
      .reverse();
  }, [rows, q, from, to, fd]);

  const sum = totalsOf([...shown].reverse().map((r, i) => ({ ...r, isOpening: r.isOpening })));

  const remove = async (r) => {
    const rest = readings.filter((x) => x.id !== r.id);
    const { computeRows } = await import('../calc');
    if (computeRows(rest).some((x) => x.error)) {
      notify('لا يمكن حذف هذه القراءة لأن ما بعدها سيصبح أقل من سابقتها. عدّل القراءات اللاحقة أولًا.', 'err');
      return;
    }
    const ok = await ask({
      title: 'حذف القراءة',
      message: `سيُحذف سجل ${fd(r.date)} وتُعاد حسابات الفترة التالية له. هل تريد المتابعة؟`,
      confirmText: 'حذف',
      danger: true,
    });
    if (ok) deleteReading(r.id);
  };

  const exportCsv = () => {
    const dec = settings.decimals;
    const head = ['رقم القراءة', 'التاريخ', 'قراءة العداد', 'الاستهلاك (ك.و.س)', 'المدة (يوم)', 'متوسط يومي', 'السعر', 'التكلفة', 'الملاحظات'];
    const body = [...shown].reverse().map((r) => [
      r.n, r.date, r.reading, r.isOpening ? '' : r.consumption.toFixed(), r.isOpening ? '' : r.days,
      r.avgDaily ? r.avgDaily.toDecimalPlaces(3).toFixed() : '', r.price, r.isOpening ? '' : r.cost.toFixed(dec),
      [r.isOpening ? 'قراءة افتتاحية' : KIND[r.kind], r.notes].filter(Boolean).join(' - '),
    ]);
    download('القراءات.csv', toCSV(head, body));
  };

  return (
    <>
      <div className="page-head">
        <h1>جدول القراءات</h1>
        <div className="row-btns">
          <button type="button" className="btn ghost" onClick={exportCsv} disabled={!rows.length}>تصدير CSV</button>
          <button type="button" className="btn primary" onClick={() => openModal('reading')}>+ إضافة قراءة</button>
        </div>
      </div>

      <div className="toolbar">
        <input type="search" placeholder="بحث في الملاحظات أو القراءة…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label>من <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>إلى <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        {(q || from || to) && <button type="button" className="btn ghost" onClick={() => { setQ(''); setFrom(''); setTo(''); }}>مسح التصفية</button>}
      </div>

      {!shown.length ? (
        <Empty>{rows.length ? 'لا توجد قراءات مطابقة للتصفية.' : 'لم تسجل أي قراءة بعد. اضغط «إضافة قراءة» لتبدأ.'}</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>التاريخ</th><th>قراءة العداد</th><th>الاستهلاك</th><th>المدة</th>
                <th>متوسط يومي</th><th>السعر</th><th>التكلفة</th><th>ملاحظات</th><th /><th />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.n}</td>
                  <td className="num">{fd(r.date)}</td>
                  <td className="num strong">{r.reading}</td>
                  <td>{r.isOpening ? '—' : <Qty v={r.consumption} unit={false} />}</td>
                  <td>{r.isOpening ? '—' : <><span className="num">{r.days}</span> يوم</>}</td>
                  <td>{r.avgDaily ? <span className="num">{fmtQty(r.avgDaily)}</span> : '—'}</td>
                  <td className="num">{r.price}</td>
                  <td>{r.isOpening ? '—' : <Money v={r.cost} />}</td>
                  <td className="notes">
                    {r.isOpening && <span className="badge">قراءة افتتاحية</span>}
                    {KIND[r.kind] && !r.isOpening && <span className="badge warn">{KIND[r.kind]}</span>}
                    {r.notes}
                  </td>
                  <td><button type="button" className="btn small ghost" onClick={() => openModal('reading', r)}>تعديل</button></td>
                  <td><button type="button" className="btn small danger" onClick={() => remove(r)}>حذف</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {shown.length > 0 && (
        <section className="summary">
          <div><span>إجمالي الاستهلاك</span><b><Qty v={sum.consumption} /></b></div>
          <div><span>إجمالي تكلفة الكهرباء</span><b><Money v={sum.cost} /></b></div>
          <div><span>عدد القراءات</span><b className="num">{shown.length}</b></div>
          <div><span>متوسط الاستهلاك اليومي</span><b>{sum.avgDaily ? <Qty v={sum.avgDaily} /> : '—'}</b></div>
        </section>
      )}
    </>
  );
}
