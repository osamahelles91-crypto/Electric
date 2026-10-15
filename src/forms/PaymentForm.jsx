import { useState } from 'react';
import { useApp } from '../ctx';
import { D, parseNum, todayStr, isValidDate, netOf } from '../calc';
import { Modal, Field } from '../ui';
import { Money } from '../Common';

const METHODS = ['نقدًا', 'تحويل بنكي', 'بطاقة', 'شيك', 'تطبيق دفع', 'أخرى'];

export default function PaymentForm({ rec, onClose }) {
  const { savePayment, balance } = useApp();
  const editing = !!rec?.id;
  const [date, setDate] = useState(rec?.date || todayStr());
  const [amount, setAmount] = useState(rec?.amount ?? '');
  const [method, setMethod] = useState(rec?.method || METHODS[0]);
  const [notes, setNotes] = useState(rec?.notes || '');
  const [loss, setLoss] = useState(rec?.loss && rec.loss !== '0' ? rec.loss : '');
  const [busy, setBusy] = useState(false);

  const av = parseNum(amount);
  const lv = loss.trim() === '' ? '0' : parseNum(loss);
  const lossBad = lv == null || lv.startsWith('-') || (av != null && lv != null && D(lv).gt(D(av)));
  const valid = isValidDate(date) && av != null && D(av).gt(0) && !lossBad;
  const after = valid ? balance.plus(editing ? netOf(rec) : 0).minus(D(av).minus(D(lv))) : null;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    const ok = await savePayment({
      ...(editing ? { id: rec.id, createdAt: rec.createdAt } : {}),
      date, amount: av, loss: lv, method, notes: notes.trim(),
    });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      title={editing ? 'تعديل الدفعة' : 'إضافة دفعة'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>إلغاء</button>
          <button type="submit" form="payment-form" className="btn primary" disabled={!valid || busy}>حفظ الدفعة</button>
        </>
      }
    >
      <form id="payment-form" onSubmit={submit} noValidate>
        <Field label="تاريخ الدفع"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="مبلغ الدفعة" error={amount && !valid ? 'أدخل مبلغًا أكبر من صفر.' : null}>
          <input inputMode="decimal" autoFocus={!editing} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="منها فاقد (اختياري)" error={lossBad ? 'أدخل مبلغًا صالحًا لا يتجاوز مبلغ الدفعة.' : null} hint="جزء من الدفعة يُدفع لكنه لا يُحسب من استهلاك الكهرباء، فلا يخفّض المستحق ولا الاستهلاك.">
          <input inputMode="decimal" value={loss} onChange={(e) => setLoss(e.target.value)} placeholder="0" />
        </Field>
        <Field label="طريقة الدفع">
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => <option key={m}>{m}</option>)}
            {!METHODS.includes(method) && <option>{method}</option>}
          </select>
        </Field>
        <Field label="ملاحظات (اختياري)"><input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        {after && (
          <div className="preview">
            <p>
              {after.gt(0) ? <>الرصيد المستحق بعد الدفعة: <Money v={after} /></> :
               after.lt(0) ? <>رصيد دائن لصالحك بعد الدفعة: <Money v={after.abs()} /></> : 'سيصبح الحساب مسددًا بالكامل.'}
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
}
