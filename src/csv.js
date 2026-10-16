// CSV متوافق مع Excel: BOM لدعم العربية + سطر sep=, لضمان فصل الأعمدة في كل الإعدادات الإقليمية
export function toCSV(headers, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + 'sep=,\r\n' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
}

import { Capacitor } from '@capacitor/core';

/** على أندرويد لا يعمل تنزيل الروابط داخل WebView، فنكتب الملف مؤقتًا ونفتح قائمة المشاركة (حفظ/Drive/واتساب...) */
async function saveNative(name, text, type) {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const safe = name.replace(/[\\/:*?"<>|]/g, '_');
  const res = await Filesystem.writeFile({ path: safe, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: safe, files: [res.uri], dialogTitle: 'حفظ الملف أو مشاركته' });
}

export async function download(name, text, type = 'text/csv;charset=utf-8') {
  if (Capacitor.isNativePlatform()) {
    try {
      await saveNative(name, text, type);
    } catch (e) {
      // إلغاء المشاركة من المستخدم ليس خطأ
      if (!/cancel/i.test(String(e?.message || e))) throw e;
    }
    return;
  }
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

/** يحفظ/يشارك ملفًا ثنائيًا (مثل PDF): على أندرويد عبر قائمة المشاركة، وعلى الويب كتنزيل */
export async function downloadBlob(name, blob) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const safe = name.replace(/[\\/:*?"<>|]/g, '_');
    const res = await Filesystem.writeFile({ path: safe, data: btoa(bin), directory: Directory.Cache });
    try {
      await Share.share({ title: safe, files: [res.uri], dialogTitle: 'حفظ الملف أو مشاركته' });
    } catch (e) {
      if (!/cancel/i.test(String(e?.message || e))) throw e;
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
