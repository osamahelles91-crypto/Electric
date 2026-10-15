import { useApp } from '../ctx';
import { Money, Qty, Empty } from '../Common';

const TYPE = { consumption: 'تكلفة استهلاك', payment: 'دفعة', adjustment: 'تصحيح مالي' };

export default function Ledger() {
  const { ledger, adjustments, fd, openModal, deleteAdjustment, ask } = useApp();

  const desc = (e) => {
    if (e.type === 'consumption') {
      return <>استهلاك <Qty v={e.ref.consumption} /> × <span className="num">{e.ref.price}</span> ({e.ref.days} يوم)</>;
    }
    if (e.type === 'payment') {
      const hasLoss = e.ref.loss && e.ref.loss !== '0';
      return `${e.ref.method}${hasLoss ? ` (إجمالي ${e.ref.amount}، منه فاقد ${e.ref.loss} لا يخفّض المستحق)` : ''}${e.ref.notes ? ' - ' + e.ref.notes : ''}`;
    }
    return e.ref.description;
  };

  const removeAdj = async (a) => {
    const ok = await ask({ title: 'حذف التصحيح المالي', message: 'سيُعاد حساب الرصيد بعد الحذف.', confirmText: 'حذف', danger: true });
    if (ok) deleteAdjustment(a.id);
  };

  return (
    <>
      <div className="page-head">
        <h1>سجل الحسابات</h1>
        <button type="button" className="btn ghost" onClick={() => openModal('adjustment')}>+ تصحيح مالي</button>
      </div>
      {!ledger.length ? (
        <Empty>لا توجد عمليات مالية بعد. تظهر التكلفة بعد القراءة الثانية، وتظهر الدفعات عند تسجيلها.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>التاريخ</th><th>نوع العملية</th><th>الوصف</th><th>المبلغ المستحق</th><th>المبلغ المدفوع</th><th>الرصيد التراكمي</th></tr></thead>
            <tbody>
              {ledger.map((e) => (
                <tr key={e.key}>
                  <td className="num">{fd(e.date)}</td>
                  <td><span className={`badge ${e.type === 'payment' ? 'ok' : e.type === 'adjustment' ? 'warn' : ''}`}>{TYPE[e.type]}</span></td>
                  <td className="notes">{desc(e)}</td>
                  <td>{e.type === 'payment' ? '—' : <Money v={e.due} />}</td>
                  <td>{e.type === 'payment' ? <Money v={e.paid} /> : '—'}</td>
                  <td className={e.balance.lt(0) ? 'credit-text' : ''}>
                    <Money v={e.balance} />
                    {e.balance.lt(0) && <small> (دائن)</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adjustments.length > 0 && (
        <section className="panel">
          <h3>التصحيحات المالية</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>التاريخ</th><th>المبلغ</th><th>الوصف</th><th /><th /></tr></thead>
              <tbody>
                {adjustments.map((a) => (
                  <tr key={a.id}>
                    <td className="num">{fd(a.date)}</td>
                    <td><Money v={a.amount} /></td>
                    <td className="notes">{a.description}</td>
                    <td><button type="button" className="btn small ghost" onClick={() => openModal('adjustment', a)}>تعديل</button></td>
                    <td><button type="button" className="btn small danger" onClick={() => removeAdj(a)}>حذف</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
