import { useMemo, useState } from 'react';
import { useApp } from '../ctx';
import { computeRows, parseNum, todayStr, isValidDate } from '../calc';
import { Modal, Field } from '../ui';
import { Money, Qty } from '../Common';

export default function ReadingForm({ rec, onClose }) {
  const { settings, readings, saveReading, fd } = useApp();
  const editing = !!rec?.id;
  const [date, setDate] = useState(rec?.date || todayStr());
  const [reading, setReading] = useState(rec?.reading ?? '');
  const [price, setPrice] = useState(rec?.price ?? settings.price);
  const [notes, setNotes] = useState(rec?.notes || '');
  const [mode, setMode] = useState(rec?.kind === 'replacement' || rec?.kind === 'correction' ? rec.kind : 'normal');
  const [oldFinal, setOldFinal] = useState(rec?.oldFinal ?? '');
  const [newStart, setNewStart] = useState(rec?.newStart ?? '0');
  const [busy, setBusy] = useState(false);

  const a = useMemo(() => {
    const rv = parseNum(reading);
    const pv = parseNum(price);
    const dateOk = isValidDate(date);
    const others = readings.filter((r) => r.id !== rec?.id);
    const dup = dateOk && others.some((r) => r.date === date);
    let candRow = null;
    let prevRow = null;
    let otherErrors = [];
    if (dateOk && rv != null && pv != null && !dup) {
      const cand = {
        id: -1, date, reading: rv, price: pv, notes, kind: mode,
        oldFinal: parseNum(oldFinal), newStart: parseNum(newStart) ?? '0',
        createdAt: rec?.createdAt ?? Date.now(),
      };
      const rows = computeRows([...others, cand]);
      const idx = rows.findIndex((r) => r.id === -1);
      candRow = rows[idx];
      prevRow = rows[idx - 1] || null;
      otherErrors = rows.filter((r) => r.id !== -1 && r.error);
    }
    return { rv, pv, dateOk, dup, candRow, prevRow, otherErrors };
  }, [date, reading, price, notes, mode, oldFinal, newStart, readings, rec]);

  const negative = (v) => v != null && v.startsWith('-');
  const lower = mode === 'normal' && a.candRow?.error === 'lower';
  const specialErr = mode === 'replacement' && a.candRow?.error === 'replacement';
  const canSave =
    a.dateOk && a.rv != null && !negative(a.rv) && a.pv != null && !negative(a.pv) && !a.dup &&
    a.candRow && !a.candRow.error && a.otherErrors.length === 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave || busy) return;
    setBusy(true);
    const kind = a.candRow.isOpening ? 'normal' : mode;
    const payload = {
      ...(editing ? { id: rec.id, createdAt: rec.createdAt } : {}),
      date, reading: a.rv, price: a.pv, notes: notes.trim(), kind,
      ...(kind === 'replacement' ? { oldFinal: parseNum(oldFinal), newStart: parseNum(newStart) ?? '0' } : {}),
    };
    const ok = await saveReading(payload);
    setBusy(false);
    if (ok) onClose();
  };

  const row = a.candRow;
  return (
    <Modal
      title={editing ? 'تعديل القراءة' : 'إضافة قراءة'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>إلغاء</button>
          <button type="submit" form="reading-form" className="btn primary" disabled={!canSave || busy}>حفظ القراءة</button>
        </>
      }
    >
      <form id="reading-form" onSubmit={submit} noValidate>
        <Field label="تاريخ القراءة" error={a.dup ? 'توجد قراءة مسجلة بهذا التاريخ. عدّلها بدل تكرارها.' : null}>
          <input type="date" value={date} min={settings.startDate || undefined} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field
          label="قراءة العداد (كيلوواط ساعة)"
          hint={a.prevRow ? <>القراءة السابقة: <b className="num">{a.prevRow.reading}</b> بتاريخ {fd(a.prevRow.date)}</> : null}
        >
          <input inputMode="decimal" autoFocus={!editing} value={reading} onChange={(e) => setReading(e.target.value)} placeholder="مثال: 12850" />
        </Field>
        <Field
          label={`سعر الكيلوواط ساعة (${settings.currency})`}
          hint="يُملأ من الإعدادات، ويمكنك تعديله لهذه الفترة فقط. لا يتغير السعر المحفوظ في القراءات الأخرى."
        >
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="ملاحظات (اختياري)">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {lower && (
          <div className="alert warn" role="alert">
            <b>القراءة أقل من القراءة السابقة ({a.candRow && a.prevRow ? a.prevRow.reading : ''}).</b>
            <p>لن يُسجَّل استهلاك سالب. صحّح الرقم إن كان خاطئًا، أو اختر حالة خاصة:</p>
            <div className="row-btns">
              <button type="button" className="btn ghost" onClick={() => setMode('correction')}>تصحيح قراءة سابقة</button>
              <button type="button" className="btn ghost" onClick={() => setMode('replacement')}>استبدال العداد</button>
            </div>
          </div>
        )}
        {mode === 'correction' && (
          <div className="alert info">
            <b>تصحيح قراءة سابقة:</b> يكون استهلاك هذه الفترة صفرًا وتصبح هذه القراءة نقطة الأساس للفترات القادمة.
            <div className="row-btns"><button type="button" className="btn ghost" onClick={() => setMode('normal')}>إلغاء الحالة الخاصة</button></div>
          </div>
        )}
        {mode === 'replacement' && (
          <div className="alert info">
            <b>استبدال العداد:</b> أدخل آخر قراءة للعداد القديم وقراءة العداد الجديد عند تركيبه، وقراءة اليوم هي قراءة العداد الجديد.
            <Field label="آخر قراءة للعداد القديم" error={specialErr && a.rv != null ? 'يجب ألا تقل عن القراءة السابقة، وألا تقل القراءة الحالية عن قراءة بدء العداد الجديد.' : null}>
              <input inputMode="decimal" value={oldFinal} onChange={(e) => setOldFinal(e.target.value)} />
            </Field>
            <Field label="قراءة العداد الجديد عند التركيب">
              <input inputMode="decimal" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            </Field>
            <div className="row-btns"><button type="button" className="btn ghost" onClick={() => setMode('normal')}>إلغاء الحالة الخاصة</button></div>
          </div>
        )}
        {a.otherErrors.length > 0 && (
          <div className="alert warn" role="alert">
            هذه القراءة تجعل قراءة {fd(a.otherErrors[0].date)} أقل مما قبلها. صحّح الرقم أو عدّل القراءة اللاحقة أولًا.
          </div>
        )}

        {row && !row.error && (
          <div className="preview">
            {row.isOpening ? (
              <p>قراءة افتتاحية: تُسجَّل كنقطة بداية ولا تُحتسب لها تكلفة.</p>
            ) : (
              <dl>
                <div><dt>الاستهلاك</dt><dd><Qty v={row.consumption} /></dd></div>
                <div><dt>المدة</dt><dd><span className="num">{row.days}</span> يوم</dd></div>
                <div><dt>التكلفة</dt><dd><Money v={row.cost} /></dd></div>
              </dl>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
