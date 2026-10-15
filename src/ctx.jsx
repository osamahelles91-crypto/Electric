import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as db from './db';
import { computeRows, totalsOf, buildLedger, balanceOf, sumPayments, sumAdjustments, fmtFixed, fmtDate, todayStr } from './calc';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [state, setState] = useState({ loaded: false, readings: [], payments: [], adjustments: [], settings: db.DEFAULT_SETTINGS });
  const [modal, setModal] = useState(null); // {type, rec}
  const [confirmSt, setConfirmSt] = useState(null);
  const [toast, setToast] = useState(null);
  const [fatal, setFatal] = useState(null);

  const reload = useCallback(async () => {
    const [readings, payments, adjustments, settings] = await Promise.all([
      db.getAll('readings'),
      db.getAll('payments'),
      db.getAll('adjustments'),
      db.getSettings(),
    ]);
    setState({ loaded: true, readings, payments, adjustments, settings });
  }, []);

  useEffect(() => {
    reload().catch((e) => setFatal(e?.message || String(e)));
    try { navigator.storage?.persist?.(); } catch { /* ignore */ }
  }, [reload]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = useCallback((msg, kind = 'ok') => setToast({ msg, kind, id: Date.now() }), []);

  const run = useCallback(
    async (fn, okMsg) => {
      try {
        await fn();
        await reload();
        if (okMsg) notify(okMsg);
        return true;
      } catch (e) {
        notify('تعذّر الحفظ: ' + (e?.message || e), 'err');
        return false;
      }
    },
    [reload, notify]
  );

  const derived = useMemo(() => {
    const rows = computeRows(state.readings);
    return {
      rows,
      totals: totalsOf(rows),
      ledger: buildLedger(rows, state.payments, state.adjustments),
      balance: balanceOf(rows, state.payments, state.adjustments),
      paid: sumPayments(state.payments),
      adjTotal: sumAdjustments(state.adjustments),
    };
  }, [state]);

  const value = useMemo(() => {
    const { settings } = state;
    const upsert = (store, label) => (rec) =>
      run(() => (rec.id ? db.putRec(store, rec) : db.addRec(store, rec)), rec.id ? `تم تعديل ${label}` : `تمت إضافة ${label}`);
    const remove = (store, label) => (id) => run(() => db.delRec(store, id), `تم حذف ${label}`);
    return {
      ...state,
      ...derived,
      dec: settings.decimals,
      fd: (s) => fmtDate(s, settings.dateFormat),
      money: (v) => fmtFixed(v, settings.decimals),
      today: todayStr,
      notify,
      modal,
      openModal: (type, rec) => setModal({ type, rec }),
      closeModal: () => setModal(null),
      confirmSt,
      ask: (opts) => new Promise((resolve) => setConfirmSt({ ...opts, resolve })),
      closeConfirm: (v) => {
        confirmSt?.resolve(v);
        setConfirmSt(null);
      },
      toast,
      saveReading: upsert('readings', 'القراءة'),
      deleteReading: remove('readings', 'القراءة'),
      savePayment: upsert('payments', 'الدفعة'),
      deletePayment: remove('payments', 'الدفعة'),
      saveAdjustment: upsert('adjustments', 'التصحيح'),
      deleteAdjustment: remove('adjustments', 'التصحيح'),
      saveSettings: (s) => run(() => db.saveSettings(s), 'تم حفظ الإعدادات'),
      restoreAll: (data) => run(() => db.replaceAll(data), 'تمت استعادة البيانات'),
      addOpening: (rec) => run(() => db.addRec('readings', rec), 'تم تسجيل القراءة الافتتاحية'),
    };
  }, [state, derived, modal, confirmSt, toast, run, notify]);

  if (fatal) {
    return (
      <div className="fatal">
        <h1>تعذّر فتح قاعدة البيانات</h1>
        <p>{fatal}</p>
        <p>تأكد أن المتصفح لا يعمل في وضع التصفح الخاص وأن التخزين المحلي مسموح.</p>
      </div>
    );
  }
  if (!state.loaded) return <div className="fatal"><p>جارٍ التحميل…</p></div>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
