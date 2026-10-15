import { useState } from 'react';
import { useApp } from '../ctx';
import { Field } from '../ui';
import * as sync from '../cloud/sync';

const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}`;

const PHASE = {
  syncing: 'جارٍ المزامنة…',
  synced: 'متزامن',
  offline: 'بلا اتصال — ستُرسل التعديلات عند عودة الإنترنت',
  error: 'خطأ في المزامنة',
};

export default function Cloud() {
  const { cloud, notify } = useApp();
  const [cfgText, setCfgText] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      notify('تم النسخ');
    } catch {
      notify('تعذّر النسخ تلقائيًا، حدّد النص وانسخه يدويًا.', 'err');
    }
  };

  const saveCfg = () => {
    const cfg = sync.parseConfig(cfgText);
    if (!cfg) {
      setMsg('لم أجد apiKey وprojectId وappId في النص. انسخ كتلة firebaseConfig كاملة من Firebase.');
      return;
    }
    sync.saveConfig(cfg);
    window.location.reload();
  };

  const auth = (mode) => async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await (mode === 'up' ? sync.signUp(email.trim(), pw) : sync.signIn(email.trim(), pw));
      setPw('');
    } catch (err) {
      setMsg(sync.arabicError(err));
    }
    setBusy(false);
  };

  const resetCfg = () => {
    sync.clearConfig();
    window.location.reload();
  };

  const rulesBox = (
    <details className="panel-sub">
      <summary>قواعد Firestore (انسخها في تبويب Rules)</summary>
      <pre dir="ltr">{RULES}</pre>
      <button type="button" className="btn ghost small" onClick={() => copy(RULES)}>نسخ القواعد</button>
    </details>
  );

  if (cloud.phase === 'nocfg') {
    return (
      <>
        <div className="page-head"><h1>السحابة</h1></div>
        <section className="panel">
          <h3>ربط حسابك على Firebase (مرة واحدة)</h3>
          <p>تُحفظ بياناتك في مشروع Firebase الخاص بك مجانًا، وتفتحها من أي جهاز بالبريد وكلمة المرور. التطبيق يعمل دون إنترنت ثم يزامن عند الاتصال.</p>
          <ol className="steps">
            <li>افتح <b dir="ltr">console.firebase.google.com</b> وأنشئ مشروعًا جديدًا (Add project).</li>
            <li>من <b>Build ← Authentication ← Sign-in method</b> فعّل <b>Email/Password</b>.</li>
            <li>من <b>Build ← Firestore Database</b> اضغط Create database (Production mode)، ثم من تبويب <b>Rules</b> الصق القواعد أدناه واضغط Publish.</li>
            <li>من <b>Project settings ← General ← Your apps</b> أضف تطبيق ويب (أيقونة <span dir="ltr">&lt;/&gt;</span>) وانسخ كتلة <span dir="ltr">firebaseConfig</span>.</li>
            <li>الصق الكتلة في الخانة التالية.</li>
          </ol>
          {rulesBox}
          <Field label="إعداد Firebase" error={msg}>
            <textarea dir="ltr" rows={7} value={cfgText} onChange={(e) => { setCfgText(e.target.value); setMsg(''); }} placeholder={'const firebaseConfig = {\n  apiKey: "...",\n  authDomain: "...",\n  projectId: "...",\n  appId: "..."\n};'} />
          </Field>
          <button type="button" className="btn primary" onClick={saveCfg} disabled={!cfgText.trim()}>حفظ الإعداد</button>
          <p className="note">إعداد الويب في Firebase ليس سريًا، لكن الوصول إلى بياناتك محمي بقواعد Firestore وبتسجيل الدخول.</p>
        </section>
      </>
    );
  }

  if (cloud.phase === 'signedout') {
    return (
      <>
        <div className="page-head"><h1>السحابة</h1></div>
        <form className="panel" onSubmit={auth('in')} noValidate>
          <h3>تسجيل الدخول</h3>
          <Field label="البريد الإلكتروني"><input type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="كلمة المرور (6 أحرف على الأقل)"><input type="password" dir="ltr" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          {msg && <div className="alert warn" role="alert">{msg}</div>}
          <div className="row-btns">
            <button type="submit" className="btn primary" disabled={busy || !email || pw.length < 6}>تسجيل الدخول</button>
            <button type="button" className="btn ghost" disabled={busy || !email || pw.length < 6} onClick={auth('up')}>إنشاء حساب جديد</button>
          </div>
          <p className="note">بعد الدخول تُرفع بياناتك الحالية على هذا الجهاز إلى حسابك وتُدمج مع ما في السحابة.</p>
        </form>
        {rulesBox}
        <button type="button" className="btn ghost small" onClick={resetCfg}>تغيير إعداد Firebase</button>
      </>
    );
  }

  return (
    <>
      <div className="page-head"><h1>السحابة</h1></div>
      <section className="panel">
        <div className={`sync-state ${cloud.phase}`}>
          <b>{PHASE[cloud.phase] || cloud.phase}</b>
          <span dir="ltr">{cloud.email}</span>
        </div>
        {cloud.error && <div className="alert warn" role="alert">{cloud.error}</div>}
        <dl className="kv">
          <div><dt>آخر مزامنة</dt><dd>{cloud.lastSync ? new Date(cloud.lastSync).toLocaleString('ar-EG-u-nu-latn') : '—'}</dd></div>
          <div><dt>تعديلات بانتظار الإرسال</dt><dd className="num">{cloud.pending}</dd></div>
        </dl>
        <div className="row-btns">
          <button type="button" className="btn primary" onClick={() => sync.syncNow()}>مزامنة الآن</button>
          <button type="button" className="btn ghost" onClick={() => sync.signOutNow()}>تسجيل الخروج</button>
        </div>
        <p className="note">عند تسجيل الخروج تبقى بياناتك على هذا الجهاز ولا تُحذف. عند التعديل من جهازين في الوقت نفسه يُعتمد الأحدث.</p>
      </section>
      {rulesBox}
    </>
  );
}
