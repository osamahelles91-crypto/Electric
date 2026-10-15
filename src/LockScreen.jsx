import { useEffect, useState } from 'react';
import { getLock, verify } from './lock';

/** يحيط بالتطبيق: يعرض شاشة الدخول إن كان القفل مفعّلًا */
export default function LockGate({ children }) {
  const [st, setSt] = useState('loading'); // loading | locked | open
  const [user, setUser] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getLock().then((l) => setSt(l.enabled ? 'locked' : 'open'));
  }, []);

  if (st === 'open') return children;
  if (st === 'loading') return null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    if (await verify(user, pw)) setSt('open');
    else {
      setErr('اسم المستخدم أو كلمة المرور غير صحيحة.');
      setPw('');
    }
    setBusy(false);
  };

  return (
    <div className="lock-wrap">
      <form className="lock-card" onSubmit={submit} noValidate>
        <div className="lock-mark" aria-hidden="true">⚡</div>
        <h1>مراقب استهلاك الكهرباء</h1>
        <p className="note">سجّل الدخول للمتابعة</p>
        <label>اسم المستخدم
          <input dir="ltr" autoCapitalize="none" autoCorrect="off" autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} autoFocus />
        </label>
        <label>كلمة المرور
          <input type="password" dir="ltr" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        {err && <div className="alert warn" role="alert">{err}</div>}
        <button type="submit" className="btn primary" disabled={busy || !user || !pw}>دخول</button>
      </form>
    </div>
  );
}
