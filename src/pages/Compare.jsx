import { useApp } from '../ctx';
import { Qty, Empty } from '../Common';
import { fmtQty } from '../calc';

function Change({ cmp }) {
  const { diff, pct } = cmp;
  const up = diff.gt(0);
  const same = diff.isZero();
  const cls = same ? '' : up ? 'up' : 'down';
  return (
    <span className={`delta ${cls}`}>
      <span className="num">{up ? '+' : ''}{fmtQty(diff)}</span>
      {pct == null ? (
        <small> تعذّر حساب النسبة (الفترة السابقة صفر)</small>
      ) : (
        <small className="num"> ({up ? '+' : ''}{pct.toDecimalPlaces(1).toFixed()}% {same ? '' : up ? 'زيادة' : 'انخفاض'})</small>
      )}
    </span>
  );
}

export default function Compare() {
  const { rows, fd } = useApp();
  const list = rows.filter((r) => r.cmp).reverse();
  const latest = list[0];

  return (
    <>
      <div className="page-head"><h1>مقارنة الاستهلاك</h1></div>
      {!latest ? (
        <Empty>تحتاج إلى ثلاث قراءات على الأقل (فترتي استهلاك) لعرض المقارنة.</Empty>
      ) : (
        <>
          <section className="panel">
            <h3>آخر فترة مقابل التي قبلها</h3>
            <div className="versus">
              <div>
                <span>الفترة السابقة</span>
                <b><Qty v={latest.cmp.prevConsumption} /></b>
                <small><span className="num">{latest.cmp.prevDays}</span> يوم · <span className="num">{latest.cmp.prevAvg ? fmtQty(latest.cmp.prevAvg) : '—'}</span> يوميًا</small>
              </div>
              <div>
                <span>الفترة الحالية</span>
                <b><Qty v={latest.consumption} /></b>
                <small><span className="num">{latest.days}</span> يوم · <span className="num">{latest.avgDaily ? fmtQty(latest.avgDaily) : '—'}</span> يوميًا</small>
              </div>
              <div>
                <span>الفرق</span>
                <b><Change cmp={latest.cmp} /></b>
              </div>
            </div>
          </section>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الفترة (حتى)</th><th>الحالية</th><th>السابقة</th><th>الفرق والنسبة</th>
                  <th>مدة الحالية</th><th>مدة السابقة</th><th>متوسط يومي حالي</th><th>متوسط يومي سابق</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td className="num">{fd(r.date)}</td>
                    <td><Qty v={r.consumption} unit={false} /></td>
                    <td><Qty v={r.cmp.prevConsumption} unit={false} /></td>
                    <td><Change cmp={r.cmp} /></td>
                    <td><span className="num">{r.days}</span> يوم</td>
                    <td><span className="num">{r.cmp.prevDays}</span> يوم</td>
                    <td className="num">{r.avgDaily ? fmtQty(r.avgDaily) : '—'}</td>
                    <td className="num">{r.cmp.prevAvg ? fmtQty(r.cmp.prevAvg) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
