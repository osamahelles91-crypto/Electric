import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { D, computeRows, totalsOf, balanceOf, buildLedger, parseNum, daysBetween, unpaidConsumption, sumNet } from '../src/calc';
import * as db from '../src/db';
import { buildBackup, validateBackup } from '../src/backup';

let id = 0;
const R = (date, reading, price = '0.5', extra = {}) => ({ id: ++id, date, reading: String(reading), price: String(price), notes: '', kind: 'normal', createdAt: id, ...extra });
const P = (date, amount) => ({ id: ++id, date, amount: String(amount), method: 'نقدًا', notes: '', createdAt: id });
const eq = (d, v) => expect(d.toString()).toBe(String(v));

describe('الاختبارات الإلزامية', () => {
  beforeEach(() => { id = 0; });

  it('1) قراءة افتتاحية 1000 ثم 1100 بسعر 0.5', () => {
    const rows = computeRows([R('2026-01-01', 1000), R('2026-02-01', 1100)]);
    expect(rows[0].isOpening).toBe(true);
    eq(rows[0].cost, 0);
    eq(rows[1].consumption, 100);
    eq(rows[1].cost, 50);
  });

  it('2) قراءة 1250 → 150 و75، إجمالي 250 و125', () => {
    const rows = computeRows([R('2026-01-01', 1000), R('2026-02-01', 1100), R('2026-03-01', 1250)]);
    eq(rows[2].consumption, 150);
    eq(rows[2].cost, 75);
    const t = totalsOf(rows);
    eq(t.consumption, 250);
    eq(t.cost, 125);
  });

  it('3) تغيير السعر إلى 0.7 لا يغيّر الفترات القديمة', () => {
    const rows = computeRows([R('2026-01-01', 1000), R('2026-02-01', 1100), R('2026-03-01', 1250), R('2026-04-01', 1300, '0.7')]);
    eq(rows[3].consumption, 50);
    eq(rows[3].cost, 35);
    eq(rows[1].cost, 50);
    eq(rows[2].cost, 75);
  });

  it('4 و5) المدفوعات والرصيد المستحق ثم الدائن', () => {
    const rows = computeRows([R('2026-01-01', 1000), R('2026-02-01', 1100), R('2026-03-01', 1250), R('2026-04-01', 1300, '0.7')]);
    eq(totalsOf(rows).cost, 160);
    const p1 = [P('2026-04-05', 100)];
    eq(balanceOf(rows, p1), 60);
    const p2 = [...p1, P('2026-04-06', 80)];
    eq(balanceOf(rows, p2), -20);
    const ledger = buildLedger(rows, p2);
    eq(ledger[ledger.length - 1].balance, -20);
    expect(ledger.filter((e) => e.type === 'consumption')).toHaveLength(3);
  });

  it('6) تعديل قراءة قديمة يعيد حساب الفترات المتأثرة ويحفظ الأسعار التاريخية', () => {
    const rs = [R('2026-01-01', 1000), R('2026-02-01', 1100), R('2026-03-01', 1250, '0.5'), R('2026-04-01', 1300, '0.7')];
    rs[1].reading = '1120';
    const rows = computeRows(rs);
    eq(rows[1].consumption, 120);
    eq(rows[1].cost, 60);
    eq(rows[2].consumption, 130);
    eq(rows[2].cost, 65);
    eq(rows[3].cost, 35);
    eq(rows[3].price, '0.7');
  });

  it('6ب) إدخال قراءة بتاريخ سابق يعيد توزيع الفترات', () => {
    const rows = computeRows([R('2026-01-01', 1000), R('2026-03-01', 1300), R('2026-02-01', 1100)]);
    eq(rows[1].consumption, 100);
    eq(rows[2].consumption, 200);
  });

  it('7) بقاء البيانات بعد إغلاق التطبيق وإعادة فتحه', async () => {
    await db.addRec('readings', R('2026-01-01', 1000));
    await db.addRec('readings', R('2026-02-01', 1100));
    await db.addRec('payments', P('2026-02-02', 25));
    await db.saveSettings({ ...db.DEFAULT_SETTINGS, price: '0.7', meterName: 'عداد الشقة' });
    await db.closeDB();
    const readings = await db.getAll('readings');
    const payments = await db.getAll('payments');
    const settings = await db.getSettings();
    expect(readings.length).toBeGreaterThanOrEqual(2);
    expect(payments[0].amount).toBe('25');
    expect(settings.price).toBe('0.7');
    expect(settings.meterName).toBe('عداد الشقة');
  });

  it('8) قراءة أقل من السابقة تُرفض ولا يُسجَّل استهلاك سالب', () => {
    const rows = computeRows([R('2026-01-01', 1000), R('2026-02-01', 900)]);
    expect(rows[1].error).toBe('lower');
    eq(rows[1].consumption, 0);
    eq(rows[1].cost, 0);
  });
});

describe('حالات إضافية', () => {
  beforeEach(() => { id = 0; });

  it('الاستهلاك المتبقي يصبح صفرًا عند سداد كامل المبلغ', () => {
    const rows = computeRows([R('2026-01-01', 1000, '1'), R('2026-02-01', 1100, '1')]);
    const pay = [P('2026-02-02', 100)];
    eq(balanceOf(rows, pay), 0);
    eq(unpaidConsumption(rows, sumNet(pay)), 0);
    eq(unpaidConsumption(rows, sumNet([P('2026-02-02', 40)])), 60);
    eq(unpaidConsumption(rows, 0), 100);
  });

  it('الفاقد يُدفع ولا يخفّض المستحق ولا الاستهلاك', () => {
    const rows = computeRows([R('2026-01-01', 1000, '1'), R('2026-02-01', 1100, '1')]);
    const pay = [{ ...P('2026-02-02', 100), loss: '10' }];
    eq(balanceOf(rows, pay), 10);
    eq(unpaidConsumption(rows, sumNet(pay)), 10);
    eq(buildLedger(rows, pay).at(-1).balance, 10);
  });

  it('توزيع الدفعات على الفترات بأسعارها (الأقدم أولًا)', () => {
    const rows = computeRows([R('2026-01-01', 1000), R('2026-02-01', 1100, '0.5'), R('2026-03-01', 1150, '0.7')]);
    eq(unpaidConsumption(rows, 60).toDecimalPlaces(3), '35.714');
  });

  it('عدة قراءات في اليوم نفسه تتبع تاريخ اليوم وتُرتَّب بوقت الإدخال', () => {
    const rows = computeRows([R('2026-01-01', 1000), R('2026-01-05', 1100), R('2026-01-05', 1130), R('2026-01-05', 1140)]);
    eq(rows[2].consumption, 30);
    expect(rows[2].days).toBe(0);
    expect(rows[2].avgDaily).toBeNull();
    eq(rows[3].consumption, 10);
    eq(totalsOf(rows).consumption, 140);
    expect(validateBackup(buildBackup({ settings: db.DEFAULT_SETTINGS, readings: rows.map(({ id: i, date, reading, price, notes, kind, createdAt }) => ({ id: i, date, reading, price, notes, kind, createdAt })), payments: [], adjustments: [] })).ok).toBe(true);
  });

  it('دقة الفاصلة العائمة', () => {
    const rows = computeRows([R('2026-01-01', '0.1', '0.1'), R('2026-01-11', '0.3', '0.1')]);
    eq(rows[1].consumption, '0.2');
    eq(rows[1].cost, '0.02');
  });

  it('مثال الوصف: 12500 → 12850 بسعر 0.60', () => {
    const rows = computeRows([R('2026-01-01', 12500, '0.60'), R('2026-01-31', 12850, '0.60')]);
    eq(rows[1].consumption, 350);
    eq(rows[1].cost, 210);
    expect(rows[1].days).toBe(30);
    eq(rows[1].avgDaily.toDecimalPlaces(4), '11.6667');
  });

  it('المقارنة: 200 ثم 250 = +50 (25%) وفترة سابقة صفر بلا نسبة', () => {
    const rows = computeRows([R('2026-01-01', 1000), R('2026-02-01', 1200), R('2026-03-01', 1450)]);
    eq(rows[2].cmp.diff, 50);
    eq(rows[2].cmp.pct, 25);
    const z = computeRows([R('2026-01-01', 1000), R('2026-02-01', 1000), R('2026-03-01', 1100)]);
    expect(z[2].cmp.pct).toBeNull();
  });

  it('استبدال العداد وتصحيح القراءة', () => {
    const rep = computeRows([R('2026-01-01', 1000), R('2026-02-01', 20, '0.5', { kind: 'replacement', oldFinal: '1100', newStart: '0' })]);
    eq(rep[1].consumption, 120);
    const cor = computeRows([R('2026-01-01', 1000), R('2026-02-01', 900, '0.5', { kind: 'correction' })]);
    eq(cor[1].consumption, 0);
    expect(cor[1].error).toBeNull();
  });

  it('التواريخ لا تتأثر بالمنطقة الزمنية', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('تحليل الأرقام العربية', () => {
    expect(parseNum('١٢٥٠٫٥')).toBe('1250.5');
    expect(parseNum('abc')).toBeNull();
  });

  it('النسخ الاحتياطي: تحقق وقبول ورفض', () => {
    const data = { settings: db.DEFAULT_SETTINGS, readings: [R('2026-01-01', 1000), R('2026-02-01', 1100)], payments: [P('2026-02-02', 10)], adjustments: [] };
    const good = validateBackup(JSON.parse(JSON.stringify(buildBackup(data))));
    expect(good.ok).toBe(true);
    expect(good.summary.readings).toBe(2);
    expect(validateBackup({ foo: 1 }).ok).toBe(false);
    const bad = buildBackup({ ...data, readings: [R('2026-01-01', 1000), R('2026-02-01', 500)] });
    expect(validateBackup(bad).ok).toBe(false);
  });
});
