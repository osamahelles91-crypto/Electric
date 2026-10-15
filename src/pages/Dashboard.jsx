import { useApp } from '../ctx';
import { Money, Qty } from '../Common';
import { ConsumptionChart, CostChart, DuesPaymentsChart } from '../Charts';

const ALL = [null, null];

function Odometer({ value }) {
  const chars = String(value).split('');
  return (
    <div className="odo" dir="ltr" aria-label={`آخر قراءة ${value}`}>
      {chars.map((c, i) => (c === '.' ? <span key={i} className="odo-dot">.</span> : <span key={i} className="odo-d">{c}</span>))}
      <span className="odo-unit">kWh</span>
    </div>
  );
}

export default function Dashboard() {
  const { rows, totals, paid, loss, balance, unpaidKwh, adjTotal, settings, fd, openModal } = useApp();
  const last = rows[rows.length - 1];
  const lastPeriod = last && !last.isOpening ? last : null;
  const credit = balance.lt(0);
  const settled = balance.isZero();

  return (
    <>
      <section className="hero">
        <div>
          <p className="hero-label">آخر قراءة — {settings.meterName}</p>
          {last ? <Odometer value={last.reading} /> : <p className="hero-empty">لا توجد قراءات بعد</p>}
          <p className="hero-date">{last ? `بتاريخ ${fd(last.date)}` : 'ابدأ بتسجيل قراءة العداد الحالية كقراءة افتتاحية.'}</p>
        </div>
        <div className={`due-card ${settled ? 'ok' : credit ? 'credit' : 'due'}`}>
          <div className="due-col">
            <span>{settled ? 'المبلغ المتبقي' : credit ? 'رصيد دائن لصالحك' : 'المبلغ المتبقي'}</span>
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
        <div className="cell"><span>تاريخ آخر قراءة</span><b className="num">{last ? fd(last.date) : '—'}</b></div>
        <div className="cell"><span>استهلاك آخر فترة</span><b>{lastPeriod ? <Qty v={lastPeriod.consumption} /> : '—'}</b></div>
        <div className="cell"><span>تكلفة آخر فترة</span><b>{lastPeriod ? <Money v={lastPeriod.cost} /> : '—'}</b></div>
        <div className="cell"><span>إجمالي استهلاك الكهرباء</span><b><Qty v={totals.consumption} /></b></div>
        <div className="cell"><span>إجمالي قيمة الكهرباء</span><b><Money v={totals.cost} /></b></div>
        <div className="cell"><span>إجمالي المدفوعات</span><b><Money v={paid} /></b></div>
        {!loss.isZero() && <div className="cell"><span>منها فاقد (لا يُحسب من الاستهلاك)</span><b><Money v={loss} /></b></div>}
        <div className={`cell ${settled ? 'ok' : credit ? 'credit' : 'due'}`}>
          <span>{settled ? 'حالة الحساب' : credit ? 'رصيد دائن لصالحك' : 'الرصيد المستحق'}</span>
          <b>{settled ? 'مسدد بالكامل' : <Money v={balance.abs()} />}</b>
        </div>
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
