import { useMemo } from 'react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { useApp } from './ctx';
import { inRange, monthKey, monthLabel } from './calc';

ChartJS.register(...registerables);
ChartJS.defaults.font.family = "'IBM Plex Sans Arabic', Tahoma, system-ui, sans-serif";
ChartJS.defaults.font.size = 12;
ChartJS.defaults.color = '#586878';

const C = { amber: '#D9961A', teal: '#0E7C73', brick: '#B3402C', blue: '#2F5D8A', grey: '#A9B5C0' };
const n = (d) => Number(d.toFixed(3));
const compact = (v) => Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });

// يكتب قيمة كل عمود فوقه عندما يكون عدد الأعمدة قليلًا ليُقرأ دون لمس الرسم
const valueLabels = {
  id: 'valueLabels',
  afterDatasetsDraw(chart) {
    const bars = chart.data.datasets.map((_, i) => chart.getDatasetMeta(i)).filter((m) => m.type === 'bar' && !m.hidden);
    const total = bars.reduce((a, m) => a + m.data.length, 0);
    if (!bars.length || total > 14) return;
    const { ctx } = chart;
    ctx.save();
    ctx.fillStyle = '#14202B';
    ctx.font = "600 11px 'IBM Plex Sans Arabic', Tahoma, sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    bars.forEach((meta) => {
      meta.data.forEach((el, j) => {
        const v = chart.data.datasets[meta.index].data[j];
        if (v) ctx.fillText(compact(v), el.x, el.y - 3);
      });
    });
    ctx.restore();
  },
};

function options(fullLabels, extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 20 } },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', align: 'end', rtl: true, textDirection: 'rtl', labels: { boxWidth: 12, usePointStyle: true, padding: 14 } },
      tooltip: {
        rtl: true, textDirection: 'rtl', bodyAlign: 'right', titleAlign: 'right', padding: 10,
        callbacks: { title: (items) => (fullLabels ? fullLabels[items[0].dataIndex] : items[0].label) },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 7, font: { size: 11 } } },
      y: { beginAtZero: true, grid: { color: '#E1E7EC' }, ticks: { maxTicksLimit: 5, callback: (v) => compact(v) } },
    },
    ...extra,
  };
}

function Frame({ title, note, empty, count = 0, children }) {
  const wide = count > 12;
  return (
    <section className="panel chart-panel">
      <h3>{title}</h3>
      {note && <p className="note">{note}</p>}
      {empty ? (
        <p className="empty">لا توجد بيانات في هذه الفترة.</p>
      ) : (
        <div className="chart-scroll">
          <div className="chart-box" style={wide ? { minWidth: count * 46 } : undefined}>{children}</div>
        </div>
      )}
    </section>
  );
}

function useBase(bounds, limit) {
  const app = useApp();
  return useMemo(() => {
    let periods = app.rows.filter((r) => !r.isOpening && inRange(r.date, bounds));
    const cut = limit && periods.length > limit;
    if (cut) periods = periods.slice(-limit);
    const short = (d) => {
      const [y, m, dd] = d.split('-');
      return app.settings.dateFormat === 'YMD' ? `${m}-${dd}` : app.settings.dateFormat === 'MDY' ? `${m}/${dd}` : `${dd}/${m}`;
    };
    return { ...app, periods, cut, short };
  }, [app, bounds, limit]);
}

const limitNote = (cut, limit) => (cut ? `تُعرض آخر ${limit} فترات فقط. لعرض الكل افتح صفحة الرسوم.` : null);

export function ConsumptionChart({ bounds, limit }) {
  const { periods, fd, short, cut } = useBase(bounds, limit);
  const data = { labels: periods.map((r) => short(r.date)), datasets: [{ label: 'الاستهلاك (ك.و.س)', data: periods.map((r) => n(r.consumption)), backgroundColor: C.amber, borderRadius: 4, maxBarThickness: 44 }] };
  return <Frame title="استهلاك الكهرباء حسب الفترة" note={limitNote(cut, limit)} count={periods.length} empty={!periods.length}><Chart type="bar" data={data} options={options(periods.map((r) => fd(r.date)))} plugins={[valueLabels]} /></Frame>;
}

export function MonthlyChart({ bounds }) {
  const { periods } = useBase(bounds);
  const m = {};
  periods.forEach((r) => { const k = monthKey(r.date); m[k] = (m[k] || 0) + Number(r.consumption.toFixed(3)); });
  const keys = Object.keys(m).sort();
  const data = { labels: keys.map(monthLabel), datasets: [{ label: 'الاستهلاك الشهري (ك.و.س)', data: keys.map((k) => Number(m[k].toFixed(3))), backgroundColor: C.blue, borderRadius: 4, maxBarThickness: 44 }] };
  return <Frame title="الاستهلاك الشهري" note="تُنسب كل فترة إلى الشهر الذي تقع فيه قراءة نهايتها." count={keys.length} empty={!keys.length}><Chart type="bar" data={data} options={options()} plugins={[valueLabels]} /></Frame>;
}

export function CostChart({ bounds, limit }) {
  const { periods, fd, short, settings, cut } = useBase(bounds, limit);
  const data = { labels: periods.map((r) => short(r.date)), datasets: [{ label: `التكلفة (${settings.currency})`, data: periods.map((r) => n(r.cost)), backgroundColor: C.brick, borderRadius: 4, maxBarThickness: 44 }] };
  return <Frame title="تكلفة الكهرباء حسب الفترة" note={limitNote(cut, limit)} count={periods.length} empty={!periods.length}><Chart type="bar" data={data} options={options(periods.map((r) => fd(r.date)))} plugins={[valueLabels]} /></Frame>;
}

export function CompareChart({ bounds, limit }) {
  const { periods, fd, short, cut } = useBase(bounds, limit);
  const list = periods.filter((r) => r.cmp);
  const data = {
    labels: list.map((r) => short(r.date)),
    datasets: [
      { label: 'الفترة السابقة', data: list.map((r) => n(r.cmp.prevConsumption)), backgroundColor: C.grey, borderRadius: 4, maxBarThickness: 30 },
      { label: 'الفترة الحالية', data: list.map((r) => n(r.consumption)), backgroundColor: C.amber, borderRadius: 4, maxBarThickness: 30 },
    ],
  };
  return <Frame title="مقارنة الاستهلاك بين الفترات" note={limitNote(cut, limit) || 'تظهر المقارنة بدءًا من القراءة الثالثة.'} count={list.length} empty={!list.length}><Chart type="bar" data={data} options={options(list.map((r) => fd(r.date)))} plugins={[valueLabels]} /></Frame>;
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
      { type: 'bar', label: `المستحقات (${settings.currency})`, data: keys.map((k) => Number((due[k] || 0).toFixed(3))), backgroundColor: C.brick, borderRadius: 4, maxBarThickness: 30 },
      { type: 'bar', label: 'المدفوعات', data: keys.map((k) => Number((paid[k] || 0).toFixed(3))), backgroundColor: C.teal, borderRadius: 4, maxBarThickness: 30 },
      { type: 'line', label: 'الرصيد في نهاية الشهر', data: endBal, borderColor: C.blue, backgroundColor: C.blue, tension: 0.25, pointRadius: 4, borderWidth: 2 },
    ],
  };
  const opts = options();
  opts.scales.y.beginAtZero = false;
  return <Frame title="المستحقات والمدفوعات والرصيد" note="الرصيد الموجب مستحق عليك، والسالب رصيد دائن لصالحك." count={keys.length} empty={!keys.length}><Chart type="bar" data={data} options={opts} plugins={[valueLabels]} /></Frame>;
}

export function BalanceChart({ bounds }) {
  const { ledger, fd, short } = useBase(bounds);
  const list = ledger.filter((e) => inRange(e.date, bounds));
  const data = { labels: list.map((e) => short(e.date)), datasets: [{ label: 'الرصيد المالي', data: list.map((e) => n(e.balance)), borderColor: C.blue, backgroundColor: 'rgba(47,93,138,.12)', fill: true, stepped: true, pointRadius: 4, borderWidth: 2 }] };
  const opts = options(list.map((e) => fd(e.date)));
  opts.scales.y.beginAtZero = false;
  return <Frame title="تطور الرصيد المالي" count={list.length} empty={!list.length}><Chart type="line" data={data} options={opts} /></Frame>;
}
