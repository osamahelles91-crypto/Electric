import { Fragment, useMemo, useState } from 'react';
import { useApp } from '../ctx';
import { Money, Qty, Empty } from '../Common';
import { totalsOf, fmtQty, computeRows } from '../calc';
import { toCSV, download } from '../csv';

const KIND = { correction: 'تصحيح قراءة سابقة', replacement: 'استبدال عداد' };
const timeOf = (ts) => (ts ? new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');

export default function Readings() {
  const { rows, settings, fd, openModal, deleteReading, readings, ask, notify } = useApp();
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [open, setOpen] = useState(null);

  const sameDay = useMemo(() => {
    const c = {};
    rows.forEach((r) => { c[r.date] = (c[r.date] || 0) + 1; });
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const t = q.trim();
    return rows
      .filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
      .filter((r) => !t || r.notes.includes(t) || String(r.reading).includes(t) || fd(r.date).includes(t))
      .reverse();
  }, [rows, q, from, to, fd]);

  const sum = totalsOf([...shown].reverse());

  const remove = async (r) => {
    const rest = readings.filter((x) => x.id !== r.id);
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
        <h1>القراءات</h1>
        <div className="row-btns">
          <button type="button" className="btn ghost" onClick={exportCsv} disabled={!rows.length}>تصدير CSV</button>
          <button type="button" className="btn primary" onClick={() => openModal('reading')}>+ إضافة قراءة</button>
        </div>
      </div>

      <div className="toolbar">
        <input type="search" placeholder="بحث…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label>من <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>إلى <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        {(q || from || to) && <button type="button" className="btn ghost" onClick={() => { setQ(''); setFrom(''); setTo(''); }}>مسح</button>}
      </div>

      {!shown.length ? (
        <Empty>{rows.length ? 'لا توجد قراءات مطابقة.' : 'لم تسجل أي قراءة بعد. اضغط «إضافة قراءة» لتبدأ.'}</Empty>
      ) : (
        <div className="table-wrap">
          <table className="simple">
            <thead>
              <tr><th>التاريخ</th><th>القراءة</th><th>الاستهلاك</th><th>التكلفة</th><th /></tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const isOpen = open === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr className={`tap ${isOpen ? 'open' : ''}`} onClick={() => setOpen(isOpen ? null : r.id)}>
                      <td>
                        <span className="num">{fd(r.date)}</span>
                        {sameDay[r.date] > 1 && <small className="time num">{timeOf(r.createdAt)}</small>}
                      </td>
                      <td className="num strong">{r.reading}</td>
                      <td>{r.isOpening ? <span className="badge">افتتاحية</span> : <Qty v={r.consumption} unit={false} />}</td>
                      <td>{r.isOpening ? '—' : <Money v={r.cost} />}</td>
                      <td className="acts" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="icon-act" aria-label="تعديل" onClick={() => openModal('reading', r)}>✎</button>
                        <button type="button" className="icon-act del" aria-label="حذف" onClick={() => remove(r)}>🗑</button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="detail">
                        <td colSpan={5}>
                          <dl>
                            <div><dt>المدة</dt><dd>{r.isOpening ? '—' : <><span className="num">{r.days}</span> يوم</>}</dd></div>
                            <div><dt>متوسط يومي</dt><dd>{r.avgDaily ? <span className="num">{fmtQty(r.avgDaily)}</span> : '—'}</dd></div>
                            <div><dt>سعر الكيلوواط</dt><dd className="num">{r.price}</dd></div>
                            <div><dt>ملاحظات</dt><dd>{[KIND[r.kind] && !r.isOpening ? KIND[r.kind] : null, r.notes].filter(Boolean).join(' - ') || '—'}</dd></div>
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {shown.length > 0 && <p className="note">اضغط على أي سطر لعرض التفاصيل.</p>}

      {shown.length > 0 && (
        <section className="summary">
          <div><span>إجمالي الاستهلاك</span><b><Qty v={sum.consumption} /></b></div>
          <div><span>إجمالي التكلفة</span><b><Money v={sum.cost} /></b></div>
          <div><span>عدد القراءات</span><b className="num">{shown.length}</b></div>
          <div><span>متوسط الاستهلاك اليومي</span><b>{sum.avgDaily ? <Qty v={sum.avgDaily} /> : '—'}</b></div>
        </section>
      )}
    </>
  );
}
