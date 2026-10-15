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

const PAGES = {
  home: ['الرئيسية', Dashboard],
  readings: ['القراءات', Readings],
  payments: ['المدفوعات', Payments],
  compare: ['المقارنة', Compare],
  ledger: ['سجل الحسابات', Ledger],
  charts: ['الرسوم', ChartsPage],
  settings: ['الإعدادات', Settings],
  backup: ['النسخ الاحتياطي', Backup],
};
const MORE = ['compare', 'ledger', 'charts', 'settings', 'backup'];

const PATHS = {
  home: 'M3 11l9-8 9 8M5 9.5V20h14V9.5',
  readings: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 13l4-4M12 5V3',
  payments: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h3',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  compare: 'M5 20V11M12 20V4M19 20v-6',
  ledger: 'M4 6h16M4 12h16M4 18h10',
  charts: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  backup: 'M12 4v11M7.5 11L12 15.5 16.5 11M5 20h14',
  plus: 'M12 5v14M5 12h14',
};

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth={name === 'more' ? 3 : 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

function useHashPage() {
  const read = () => {
    const h = window.location.hash.replace('#/', '');
    return PAGES[h] ? h : 'home';
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
  const [sheet, setSheet] = useState(null); // 'more' | 'add' | null
  const Page = PAGES[page][1];

  useEffect(() => { window.scrollTo(0, 0); setSheet(null); }, [page]);

  const go = (k) => { window.location.hash = `#/${k}`; setSheet(null); };
  const add = (type) => { setSheet(null); openModal(type); };
  const inMore = MORE.includes(page);

  const Tab = ({ k }) => (
    <button type="button" className={`tab ${page === k ? 'on' : ''}`} onClick={() => go(k)} aria-current={page === k ? 'page' : undefined}>
      <Icon name={k} /><span>{PAGES[k][0]}</span>
    </button>
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">⚡</span>
          <div><strong>مراقب استهلاك الكهرباء</strong><small>{settings.meterName}</small></div>
          {inMore && <span className="where">{PAGES[page][0]}</span>}
        </div>
        <nav className="nav" aria-label="التنقل الرئيسي">
          {Object.keys(PAGES).map((k) => (
            <a key={k} href={`#/${k}`} className={page === k ? 'on' : ''} aria-current={page === k ? 'page' : undefined}>{PAGES[k][0]}</a>
          ))}
        </nav>
      </header>

      <main className="page"><Page /></main>

      {sheet && <div className="scrim" onClick={() => setSheet(null)} />}

      {sheet === 'add' && (
        <div className="pop" role="menu">
          <button type="button" role="menuitem" onClick={() => add('reading')}><Icon name="readings" /> إضافة قراءة</button>
          <button type="button" role="menuitem" onClick={() => add('payment')}><Icon name="payments" /> إضافة دفعة</button>
        </div>
      )}

      {sheet === 'more' && (
        <div className="more-sheet" role="menu">
          {MORE.map((k) => (
            <button type="button" role="menuitem" key={k} className={page === k ? 'on' : ''} onClick={() => go(k)}>
              <Icon name={k} /><span>{PAGES[k][0]}</span>
            </button>
          ))}
        </div>
      )}

      <nav className="bottombar" aria-label="التنقل">
        <Tab k="home" />
        <Tab k="readings" />
        <div className="fab-slot">
          <button type="button" className={`fab ${sheet === 'add' ? 'open' : ''}`} onClick={() => setSheet(sheet === 'add' ? null : 'add')} aria-label="إضافة" aria-expanded={sheet === 'add'}>
            <Icon name="plus" />
          </button>
        </div>
        <Tab k="payments" />
        <button type="button" className={`tab ${inMore || sheet === 'more' ? 'on' : ''}`} onClick={() => setSheet(sheet === 'more' ? null : 'more')} aria-expanded={sheet === 'more'}>
          <Icon name="more" /><span>المزيد</span>
        </button>
      </nav>

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
