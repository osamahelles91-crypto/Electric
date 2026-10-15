// CSV متوافق مع Excel: BOM لدعم العربية + سطر sep=, لضمان فصل الأعمدة في كل الإعدادات الإقليمية
export function toCSV(headers, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + 'sep=,\r\n' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
}

export function download(name, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
