import { useMemo, useState } from 'react';
import { RangeFilter } from '../Common';
import { rangeBounds } from '../calc';
import { ConsumptionChart, MonthlyChart, CostChart, CompareChart, DuesPaymentsChart, BalanceChart } from '../Charts';

export default function ChartsPage() {
  const [range, setRange] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const bounds = useMemo(() => rangeBounds(range, from, to), [range, from, to]);
  return (
    <>
      <div className="page-head"><h1>الرسوم البيانية</h1></div>
      <RangeFilter range={range} setRange={setRange} from={from} setFrom={setFrom} to={to} setTo={setTo} />
      <div className="charts">
        <ConsumptionChart bounds={bounds} />
        <MonthlyChart bounds={bounds} />
        <CostChart bounds={bounds} />
        <CompareChart bounds={bounds} />
        <DuesPaymentsChart bounds={bounds} />
        <BalanceChart bounds={bounds} />
      </div>
    </>
  );
}
