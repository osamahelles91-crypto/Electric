import { useState } from 'react';
import { useApp } from '../ctx';
import { D, parseNum, todayStr, isValidDate } from '../calc';
import { Modal, Field } from '../ui';

export default function AdjustmentForm({ rec, onClose }) {
  const { saveAdjustment } = useApp();
  const editing = !!rec?.id;
  const [date, setDate] = useState(rec?.date || todayStr());
  const [amount, setAmount] = useState(rec?.amount ?? '');
  const [description, setDescription] = useState(rec?.description || '');
  const [busy, setBusy] = useState(false);

  const av = parseNum(amount);
  const valid = isValidDate(date) && av != null && !D(av).isZero() && description.trim().length > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    const ok = await saveAdjustment({
      ...(editing ? { id: rec.id, createdAt: rec.createdAt } : {}),
      date, amount: av, description: description.trim(),
    });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      title={editing ? 'تعديل التصحيح المالي' : 'إضافة تصحيح مالي'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>إلغاء</button>
          <button type="submit" form="adj-form" className="btn primary" disabled={!valid || busy}>حفظ التصحيح</button>
        </>
      }
    >
      <form id="adj-form" onSubmit={submit} noValidate>
        <Field label="التاريخ"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="المبلغ" hint="موجب يزيد المستحق (رسوم/غرامة)، وسالب يخفضه (خصم/تسوية).">
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="مثال: -15" />
        </Field>
        <Field label="الوصف"><input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      </form>
    </Modal>
  );
}
