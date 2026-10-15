import { useEffect, useState } from 'react';
import { AppProvider, useApp } from './ctx';
import { Modal } from './ui';
import Dashboard from './pages/Dashboard';
import Readings from './pages/Readings';
import Payments from './pages/Payments';
import Compare from './pages/Compare';
import Ledger from './pages/Ledger';
import ChartsPage from './pages/ChartsPage';
import Settings from './pages/Settings';
import Backup from './pages/Backup';
import ReadingForm from './forms/ReadingForm';
import PaymentForm from './forms/PaymentForm';
import AdjustmentForm from './forms/AdjustmentForm';

const PAGES = [
  ['home', 'لوحة التحكم', Dashboard],
  ['readings', 'القراءات', Readings],
  ['payments', 'المدفوعات', Payments],
  ['compare', 'المقارنة', Compare],
  ['ledger', 'سجل الحسابات', Ledger],
  ['charts', 'الرسوم', ChartsPage],
  ['settings', 'الإعدادات', Settings],
  ['backup', 'النسخ الاحتياطي', Backup],
];

function useHashPage() {
  const read = () => {
    const h = window.location.hash.replace('#/', '');
    return PAGES.some(([k]) => k === h) ? h : 'home';
  };
  const [page, setPage] = useState(read);
  useEffect(() => {
    const on = () => setPage(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return page;
}

function Shell() {
  const page = useHashPage();
  const { settings, modal, closeModal, openModal, confirmSt, closeConfirm, toast } = useApp();
  const Page = PAGES.find(([k]) => k === page)[2];

  useEffect(() => { window.scrollTo(0, 0); }, [page]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">⚡</span>
          <div><strong>مراقب استهلاك الكهرباء</strong><small>{settings.meterName}</small></div>
        </div>
        <nav className="nav" aria-label="التنقل الرئيسي">
          {PAGES.map(([k, label]) => (
            <a key={k} href={`#/${k}`} className={page === k ? 'on' : ''} aria-current={page === k ? 'page' : undefined}>{label}</a>
          ))}
        </nav>
      </header>

      <main className="page"><Page /></main>

      <div className="quickbar">
        <button type="button" className="btn amber" onClick={() => openModal('reading')}>+ إضافة قراءة</button>
        <button type="button" className="btn dark" onClick={() => openModal('payment')}>+ إضافة دفعة</button>
      </div>

      {modal?.type === 'reading' && <ReadingForm key={modal.rec?.id ?? 'new'} rec={modal.rec} onClose={closeModal} />}
      {modal?.type === 'payment' && <PaymentForm key={modal.rec?.id ?? 'new'} rec={modal.rec} onClose={closeModal} />}
      {modal?.type === 'adjustment' && <AdjustmentForm key={modal.rec?.id ?? 'new'} rec={modal.rec} onClose={closeModal} />}

      {confirmSt && (
        <Modal
          title={confirmSt.title}
          onClose={() => closeConfirm(false)}
          footer={
            <>
              <button type="button" className="btn ghost" onClick={() => closeConfirm(false)}>إلغاء</button>
              <button type="button" className={`btn ${confirmSt.danger ? 'danger-solid' : 'primary'}`} onClick={() => closeConfirm(true)}>{confirmSt.confirmText || 'تأكيد'}</button>
            </>
          }
        >
          <p>{confirmSt.message}</p>
        </Modal>
      )}

      {toast && <div key={toast.id} className={`toast ${toast.kind}`} role="status">{toast.msg}</div>}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
