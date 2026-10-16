import { useApp } from '../ctx';
import { Money, Qty } from '../Common';
import { ConsumptionChart, CostChart, DuesPaymentsChart } from '../Charts';

const ALL = [null, null];

export default function Dashboard() {
  const { rows, totals, paid, loss, balance, unpaidKwh, adjTotal, settings, fd, openModal } = useApp();
  const last = rows[rows.length - 1];
  const lastPeriod = last && !last.isOpening ? last : null;
  const credit = balance.lt(0);
  const settled = balance.isZero();

  return (
    <>
      <section className="hero">
        <div className="hero-main">
          <p className="hero-label">إجمالي الاستهلاك حتى الآن — {settings.meterName}</p>
          {last ? <div className="hero-total"><Qty v={totals.consumption} /></div> : <p className="hero-empty">لا توجد قراءات بعد</p>}
          <p className="hero-date">{last ? <>قراءة العداد <b className="num">{last.reading}</b> · {fd(last.date)}</> : 'ابدأ بتسجيل قراءة العداد الحالية كقراءة افتتاحية.'}</p>
        </div>
        <div className={`due-card three ${settled ? 'ok' : credit ? 'credit' : 'due'}`}>
          <div className="due-col">
            <span>استهلاك آخر قراءة</span>
            <div className="due-amount kwh">{lastPeriod ? <Qty v={lastPeriod.consumption} /> : '—'}</div>
          </div>
          <div className="due-col">
            <span>{credit ? 'رصيد دائن لصالحك' : 'المبلغ المطلوب'}</span>
            <div className="due-amount"><Money v={credit ? balance.abs() : balance} /></div>
          </div>
          <div className="due-col">
            <span>الاستهلاك المتبقي</span>
            <div className="due-amount kwh"><Qty v={unpaidKwh} /></div>
          </div>
        </div>
        <div className="hero-actions">
          <button type="button" className="btn amber" onClick={() => openModal('reading')}>+ إضافة قراءة</button>
          <button type="button" className="btn light" onClick={() => openModal('payment')}>+ إضافة دفعة</button>
        </div>
      </section>

      <section className="cells" aria-label="ملخص">
        <div className="cell"><span>تكلفة آخر فترة</span><b>{lastPeriod ? <Money v={lastPeriod.cost} /> : '—'}</b></div>
        <div className="cell"><span>إجمالي قيمة الكهرباء</span><b><Money v={totals.cost.plus(adjTotal)} /></b></div>
        <div className="cell"><span>إجمالي المدفوعات</span><b><Money v={paid} /></b></div>
        {!loss.isZero() && <div className="cell"><span>منها فاقد (لا يُحسب من الاستهلاك)</span><b><Money v={loss} /></b></div>}
        <div className="cell"><span>متوسط الاستهلاك اليومي</span><b>{totals.avgDaily ? <Qty v={totals.avgDaily} /> : '—'}</b></div>
      </section>

      <div className="charts">
        <ConsumptionChart bounds={ALL} limit={12} />
        <CostChart bounds={ALL} limit={12} />
        <DuesPaymentsChart bounds={ALL} />
      </div>
    </>
  );
}
