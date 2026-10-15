import { useMemo } from 'react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { useApp } from './ctx';
import { inRange, monthKey, monthLabel } from './calc';

ChartJS.register(...registerables);
ChartJS.defaults.font.family = "'IBM Plex Sans Arabic', Tahoma, system-ui, sans-serif";
ChartJS.defaults.font.size = 12;
ChartJS.defaults.color = '#586878';

const C = { amber: '#D9961A', teal: '#0E7C73', brick: '#B3402C', blue: '#2F5D8A', grey: '#9AA8B5' };
const n = (d) => Number(d.toFixed(3));

function options(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { rtl: true, textDirection: 'rtl', labels: { boxWidth: 12, usePointStyle: true } },
      tooltip: { rtl: true, textDirection: 'rtl', bodyAlign: 'right', titleAlign: 'right' },
    },
    scales: {
      x: { grid: { display: false }, ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 8 } },
      y: { beginAtZero: true, grid: { color: '#DDE3E8' } },
    },
    ...extra,
  };
}

function Frame({ title, note, empty, children }) {
  return (
    <section className="panel chart-panel">
      <h3>{title}</h3>
      {note && <p className="note">{note}</p>}
      <div className="chart-box">{empty ? <p className="empty">لا توجد بيانات في هذه الفترة.</p> : children}</div>
    </section>
  );
}

function useBase(bounds) {
  const app = useApp();
  return useMemo(() => {
    const periods = app.rows.filter((r) => !r.isOpening && inRange(r.date, bounds));
    return { ...app, periods };
  }, [app, bounds]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function ConsumptionChart({ bounds }) {
  const { periods, fd } = useBase(bounds);
  const data = { labels: periods.map((r) => fd(r.date)), datasets: [{ label: 'الاستهلاك (ك.و.س)', data: periods.map((r) => n(r.consumption)), backgroundColor: C.amber, borderRadius: 3 }] };
  return <Frame title="استهلاك الكهرباء حسب الفترة" empty={!periods.length}><Chart type="bar" data={data} options={options()} /></Frame>;
}

export function MonthlyChart({ bounds }) {
  const { periods } = useBase(bounds);
  const m = {};
  periods.forEach((r) => { const k = monthKey(r.date); m[k] = (m[k] || 0) + Number(r.consumption.toFixed(3)); });
  const keys = Object.keys(m).sort();
  const data = { labels: keys.map(monthLabel), datasets: [{ label: 'الاستهلاك الشهري (ك.و.س)', data: keys.map((k) => Number(m[k].toFixed(3))), backgroundColor: C.blue, borderRadius: 3 }] };
  return <Frame title="الاستهلاك الشهري" note="تُنسب كل فترة إلى الشهر الذي تقع فيه قراءة نهايتها." empty={!keys.length}><Chart type="bar" data={data} options={options()} /></Frame>;
}

export function CostChart({ bounds }) {
  const { periods, fd, settings } = useBase(bounds);
  const data = { labels: periods.map((r) => fd(r.date)), datasets: [{ label: `التكلفة (${settings.currency})`, data: periods.map((r) => n(r.cost)), backgroundColor: C.brick, borderRadius: 3 }] };
  return <Frame title="تكلفة الكهرباء حسب الفترة" empty={!periods.length}><Chart type="bar" data={data} options={options()} /></Frame>;
}

export function CompareChart({ bounds }) {
  const { periods, fd } = useBase(bounds);
  const list = periods.filter((r) => r.cmp);
  const data = {
    labels: list.map((r) => fd(r.date)),
    datasets: [
      { label: 'الفترة السابقة', data: list.map((r) => n(r.cmp.prevConsumption)), backgroundColor: C.grey, borderRadius: 3 },
      { label: 'الفترة الحالية', data: list.map((r) => n(r.consumption)), backgroundColor: C.amber, borderRadius: 3 },
    ],
  };
  return <Frame title="مقارنة الاستهلاك بين الفترات" note="تظهر المقارنة بدءًا من القراءة الثالثة." empty={!list.length}><Chart type="bar" data={data} options={options()} /></Frame>;
}

export function DuesPaymentsChart({ bounds }) {
  const { periods, payments, adjustments, ledger, settings } = useBase(bounds);
  const due = {};
  const paid = {};
  periods.forEach((r) => { const k = monthKey(r.date); due[k] = (due[k] || 0) + Number(r.cost.toFixed(6)); });
  adjustments.filter((a) => inRange(a.date, bounds)).forEach((a) => { const k = monthKey(a.date); due[k] = (due[k] || 0) + Number(a.amount); });
  payments.filter((p) => inRange(p.date, bounds)).forEach((p) => { const k = monthKey(p.date); paid[k] = (paid[k] || 0) + Number(p.amount); });
  const keys = [...new Set([...Object.keys(due), ...Object.keys(paid)])].sort();
  const endBal = keys.map((k) => {
    const upto = ledger.filter((e) => monthKey(e.date) <= k);
    return upto.length ? n(upto[upto.length - 1].balance) : 0;
  });
  const data = {
    labels: keys.map(monthLabel),
    datasets: [
      { type: 'bar', label: `المستحقات (${settings.currency})`, data: keys.map((k) => Number((due[k] || 0).toFixed(3))), backgroundColor: C.brick, borderRadius: 3 },
      { type: 'bar', label: 'المدفوعات', data: keys.map((k) => Number((paid[k] || 0).toFixed(3))), backgroundColor: C.teal, borderRadius: 3 },
      { type: 'line', label: 'الرصيد في نهاية الشهر', data: endBal, borderColor: C.blue, backgroundColor: C.blue, tension: 0.25, pointRadius: 3 },
    ],
  };
  const opts = options();
  opts.scales.y.beginAtZero = false;
  return <Frame title="المستحقات والمدفوعات والرصيد" note="الرصيد الموجب مستحق عليك، والسالب رصيد دائن لصالحك." empty={!keys.length}><Chart type="bar" data={data} options={opts} /></Frame>;
}

export function BalanceChart({ bounds }) {
  const { ledger, fd } = useBase(bounds);
  const list = ledger.filter((e) => inRange(e.date, bounds));
  const data = { labels: list.map((e) => fd(e.date)), datasets: [{ label: 'الرصيد المالي', data: list.map((e) => n(e.balance)), borderColor: C.blue, backgroundColor: 'rgba(47,93,138,.12)', fill: true, stepped: true, pointRadius: 3 }] };
  const opts = options();
  opts.scales.y.beginAtZero = false;
  return <Frame title="تطور الرصيد المالي" empty={!list.length}><Chart type="line" data={data} options={opts} /></Frame>;
}
