import { useApp } from '../ctx';
import { Money, Empty } from '../Common';
import { sortReadings } from '../calc';

export default function Payments() {
  const { payments, totals, adjTotal, paid, loss, balance, fd, openModal, deletePayment, ask } = useApp();
  const asc = [...payments].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0)));
  const numOf = new Map(asc.map((p, i) => [p.id, i + 1]));
  const list = [...asc].reverse();
  const due = totals.cost.plus(adjTotal);
  const credit = balance.lt(0);

  const remove = async (p) => {
    const ok = await ask({ title: 'حذف الدفعة', message: `ستُحذف دفعة ${fd(p.date)} ويُعاد حساب الرصيد تلقائيًا.`, confirmText: 'حذف', danger: true });
    if (ok) deletePayment(p.id);
  };
  void sortReadings;

  return (
    <>
      <div className="page-head">
        <h1>المدفوعات</h1>
        <button type="button" className="btn primary" onClick={() => openModal('payment')}>+ إضافة دفعة</button>
      </div>
      <section className="summary">
        <div><span>إجمالي المبالغ المستحقة</span><b><Money v={due} /></b></div>
        <div><span>إجمالي المدفوعات</span><b><Money v={paid} /></b></div>
        {!loss.isZero() && <div><span>منها فاقد (لا يُحسب من الاستهلاك)</span><b><Money v={loss} /></b></div>}
        <div className={balance.isZero() ? 'ok' : credit ? 'credit' : 'due'}>
          <span>{balance.isZero() ? 'حالة الحساب' : credit ? 'رصيد دائن لصالحك' : 'الرصيد المستحق'}</span>
          <b>{balance.isZero() ? 'مسدد بالكامل' : <Money v={balance.abs()} />}</b>
        </div>
      </section>
      {credit && <p className="note">الرصيد الدائن يُخصم تلقائيًا من الاستحقاقات القادمة عند تسجيل قراءات جديدة.</p>}

      {!list.length ? (
        <Empty>لا توجد مدفوعات مسجلة.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>رقم العملية</th><th>التاريخ</th><th>المبلغ</th><th>الفاقد</th><th>طريقة الدفع</th><th>ملاحظات</th><th /><th /></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td className="num">{numOf.get(p.id)}</td>
                  <td className="num">{fd(p.date)}</td>
                  <td><Money v={p.amount} /></td>
                  <td>{p.loss && p.loss !== '0' ? <Money v={p.loss} /> : '—'}</td>
                  <td>{p.method}</td>
                  <td className="notes">{p.notes}</td>
                  <td><button type="button" className="btn small ghost" onClick={() => openModal('payment', p)}>تعديل</button></td>
                  <td><button type="button" className="btn small danger" onClick={() => remove(p)}>حذف</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
