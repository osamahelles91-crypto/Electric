import { useApp } from './ctx';
import { fmtFixed, fmtQty } from './calc';

export function Money({ v, cls = '' }) {
  const { settings } = useApp();
  return (
    <span className={`money ${cls}`}>
      <span className="num">{fmtFixed(v, settings.decimals)}</span> <small>{settings.currency}</small>
    </span>
  );
}

export function Qty({ v, unit = true }) {
  return (
    <span className="money">
      <span className="num">{fmtQty(v)}</span>
      {unit && <small> ك.و.س</small>}
    </span>
  );
}

export const RANGES = [
  ['7d', 'آخر 7 أيام'],
  ['30d', 'آخر 30 يومًا'],
  ['3m', 'آخر 3 أشهر'],
  ['6m', 'آخر 6 أشهر'],
  ['12m', 'آخر 12 شهرًا'],
  ['all', 'جميع البيانات'],
  ['custom', 'فترة محددة'],
];

export function RangeFilter({ range, setRange, from, setFrom, to, setTo }) {
  return (
    <div className="range">
      <div className="chips" role="group" aria-label="نطاق الرسوم">
        {RANGES.map(([k, l]) => (
          <button type="button" key={k} className={`chip ${range === k ? 'on' : ''}`} onClick={() => setRange(k)}>{l}</button>
        ))}
      </div>
      {range === 'custom' && (
        <div className="range-custom">
          <label>من <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>إلى <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      )}
    </div>
  );
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}
