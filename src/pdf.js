import { fmtFixed, fmtQty, D, todayStr } from './calc';
import { downloadBlob } from './csv';

const W = 794; // عرض A4 بالبكسل عند 96dpi
const H = 1123;
const FIRST_ROWS = 22;
const NEXT_ROWS = 25;
const KIND = { correction: 'تصحيح', replacement: 'استبدال عداد' };

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function chunk(rows) {
  const pages = [];
  let i = 0;
  pages.push(rows.slice(0, FIRST_ROWS));
  i = FIRST_ROWS;
  while (i < rows.length) {
    pages.push(rows.slice(i, i + NEXT_ROWS));
    i += NEXT_ROWS;
  }
  return pages;
}

const CSS = `
.pg{position:absolute;left:-10000px;top:0;width:${W}px;height:${H}px;background:#fff;color:#12212e;direction:rtl;box-sizing:border-box;font-family:'IBM Plex Sans Arabic',Tahoma,'Segoe UI',system-ui,sans-serif;overflow:hidden}
.pg *{box-sizing:border-box}
.band{background:linear-gradient(135deg,#12212e,#1d3448);color:#fff;padding:26px 36px 22px;position:relative}
.band:after{content:"";position:absolute;inset-inline-start:0;bottom:0;width:100%;height:5px;background:linear-gradient(90deg,#f0b429,#ffd666,#f0b429)}
.brand{display:flex;align-items:center;gap:14px}
.bolt{width:50px;height:50px;border-radius:14px;background:#f0b429;color:#12212e;display:flex;align-items:center;justify-content:center;font-size:28px}
.band h1{margin:0;font-size:25px;font-weight:800}
.band p{margin:4px 0 0;color:#b9c8d6;font-size:13px}
.meta{display:flex;gap:10px;margin-top:16px;font-size:12px;color:#d7e3ee}
.meta span{background:rgba(255,255,255,.1);border-radius:999px;padding:4px 12px}
.mini{background:#12212e;color:#fff;padding:12px 36px;font-size:13px;display:flex;justify-content:space-between;border-bottom:4px solid #f0b429}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:18px 36px 6px}
.card{border-radius:12px;padding:10px 12px;background:#f4f7fa;border:1px solid #e1e8ee}
.card small{display:block;color:#5d7284;font-size:11px;margin-bottom:4px}
.card b{font-size:17px;font-weight:800}
.card b i{font-style:normal;font-size:11px;font-weight:600;color:#5d7284}
.card.amber{background:#fff6dc;border-color:#f0d78a}
.card.navy{background:#12212e;border-color:#12212e;color:#f0b429}
.card.navy small{color:#b9c8d6}
.sec{padding:10px 36px 0;font-size:11px;color:#5d7284}
table{width:${W - 72}px;margin:8px 36px 0;border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:13px}
th{background:#12212e;color:#fff;font-weight:700;height:36px;padding:0 3px;white-space:nowrap;text-align:center;font-size:12px}
th:first-child{border-top-right-radius:10px}th:last-child{border-top-left-radius:10px}
td{height:34px;padding:0 8px;text-align:center;border-bottom:1px solid #e8eef3;overflow:hidden;white-space:nowrap}
tr.z td{background:#f7fafc}
td.n{color:#8497a8;font-size:11px}
td.r{font-weight:800;font-size:14px}
td.c{font-weight:800;color:#0f6b46}
.bar{display:flex;align-items:center;gap:8px;direction:ltr;justify-content:flex-end}
.bar i{display:block;height:9px;border-radius:5px;background:linear-gradient(90deg,#f0b429,#e08a00)}
.bar b{min-width:46px;text-align:left}
.tag{display:inline-block;margin-inline-start:6px;padding:1px 8px;border-radius:999px;font-size:10px;font-weight:700;vertical-align:middle}
.tag.o{background:#e6ecf1;color:#4b6173}.tag.k{background:#dbeaff;color:#1c4f94}.tag.p{background:#eadcff;color:#5b2fa0}
.foot{position:absolute;bottom:0;left:0;right:0;height:44px;padding:0 36px;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#7a8d9d;border-top:2px solid #f0b429;background:#fff}
`;

function pageHtml({ rows, idx, total, ctx, maxCons }) {
  const { settings, fd, shown, sums, paid, balance, period } = ctx;
  const cur = esc(settings.currency);
  const dec = settings.decimals;
  const head = idx === 0
    ? `<div class="band">
         <div class="brand"><div class="bolt">⚡</div><div><h1>تقرير قراءات الكهرباء</h1><p>${esc(settings.meterName)}</p></div></div>
         <div class="meta"><span>الفترة: ${esc(period)}</span><span>عدد القراءات: ${shown}</span><span>تاريخ التقرير: ${esc(fd(todayStr()))}</span></div>
       </div>
       <div class="cards">
         <div class="card"><small>استهلاك الجدول</small><b>${fmtQty(sums.cons)} <i>ك.و.س</i></b></div>
         <div class="card"><small>قيمة الجدول</small><b>${fmtFixed(sums.cost, dec)} <i>${cur}</i></b></div>
         <div class="card amber"><small>إجمالي المدفوعات</small><b>${fmtFixed(paid, dec)} <i>${cur}</i></b></div>
         <div class="card navy"><small>${balance.lt(0) ? 'رصيد لصالحك' : 'المتبقي للدفع'}</small><b>${fmtFixed(balance.abs(), dec)} <i>${cur}</i></b></div>
       </div>`
    : `<div class="mini"><span>⚡ تقرير قراءات الكهرباء — ${esc(settings.meterName)}</span><span>${esc(period)}</span></div>`;
  const body = rows.map((r, i) => {
    const w = r.isOpening || !maxCons.gt(0) ? 0 : Math.max(3, Math.round(r.consumption.div(maxCons).times(100).toNumber()));
    const tag = r.isOpening ? '<span class="tag o">افتتاحية</span>' : KIND[r.kind] ? `<span class="tag ${r.kind === 'correction' ? 'k' : 'p'}">${KIND[r.kind]}</span>` : '';
    return `<tr class="${i % 2 ? 'z' : ''}">
      <td class="n">${r.n}</td>
      <td>${esc(fd(r.date))}${tag}</td>
      <td class="r">${esc(fmtQty(r.reading))}</td>
      <td>${r.isOpening ? '—' : `<div class="bar"><b>${esc(fmtQty(r.consumption))}</b><i style="width:${Math.round(w * 0.9)}px"></i></div>`}</td>
      <td>${r.isOpening ? '—' : r.days}</td>
      <td>${esc(r.price)}</td>
      <td class="c">${r.isOpening ? '—' : esc(fmtFixed(r.cost, dec))}</td>
    </tr>`;
  }).join('');
  return `<div class="pg"><style>${CSS}</style>${head}
    <table><colgroup><col style="width:40px"><col style="width:140px"><col style="width:95px"><col style="width:190px"><col style="width:72px"><col style="width:68px"><col style="width:117px"></colgroup>
    <thead><tr><th>#</th><th>التاريخ</th><th>قراءة العداد</th><th>الاستهلاك (ك.و.س)</th><th>المدة (يوم)</th><th>السعر</th><th>التكلفة (${cur})</th></tr></thead>
    <tbody>${body}</tbody></table>
    <div class="foot"><span>مراقب استهلاك الكهرباء</span><span>صفحة ${idx + 1} من ${total}</span></div></div>`;
}

/** يصدّر الجدول (كما هو معروض) إلى ملف PDF بتصميم مرتّب. يُرسم النص بالمتصفح نفسه ليظهر العربي سليمًا */
export async function exportReadingsPdf({ shown, settings, fd, paid, balance }) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const real = shown.filter((r) => !r.isOpening);
  const sums = {
    cons: real.reduce((a, r) => a.plus(r.consumption), D(0)),
    cost: real.reduce((a, r) => a.plus(r.cost), D(0)),
  };
  const maxCons = real.reduce((m, r) => (r.consumption.gt(m) ? r.consumption : m), D(0));
  const dates = shown.map((r) => r.date).sort();
  const period = dates.length ? `${fd(dates[0])} ← ${fd(dates[dates.length - 1])}` : '—';
  const ctx = { settings, fd, shown: shown.length, sums, paid, balance, period };
  const pages = chunk(shown);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;';
  document.body.appendChild(host);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    for (let i = 0; i < pages.length; i += 1) {
      host.innerHTML = pageHtml({ rows: pages[i], idx: i, total: pages.length, ctx, maxCons });
      const el = host.querySelector('.pg');
      el.style.left = '0';
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, width: W, height: H, windowWidth: W });
      if (i) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, ph, undefined, 'FAST');
    }
    await downloadBlob(`القراءات-${todayStr()}.pdf`, pdf.output('blob'));
  } finally {
    host.remove();
  }
}
