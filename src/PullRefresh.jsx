import { useEffect, useRef, useState } from 'react';
import * as sync from './cloud/sync';

const TRIGGER = 60;
const MAX = 96;

/** اسحب الصفحة للأسفل وهي في أعلاها لمزامنة السحابة. تظهر أيقونة تحديث ثم نتيجة: نجاح أو سبب الفشل */
export default function PullRefresh() {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const st = useRef({ y: 0, on: false, pull: 0, busy: false });
  const timer = useRef(null);

  const run = async () => {
    st.current.busy = true;
    setBusy(true);
    setRes(null);
    let r;
    try {
      r = await sync.syncNow();
    } catch (e) {
      r = { ok: false, reason: sync.arabicError(e) };
    }
    st.current.busy = false;
    setBusy(false);
    setPull(0);
    setRes(r);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setRes(null), r.ok ? 3000 : 9000);
  };

  useEffect(() => {
    const blocked = () => document.body.style.overflow === 'hidden' || st.current.busy;
    const start = (e) => {
      if (blocked() || window.scrollY > 0 || e.touches.length !== 1) return;
      st.current.y = e.touches[0].clientY;
      st.current.on = true;
    };
    const move = (e) => {
      const s = st.current;
      if (!s.on) return;
      const dy = e.touches[0].clientY - s.y;
      if (dy <= 0 || window.scrollY > 0) {
        if (s.pull) { s.pull = 0; setPull(0); }
        return;
      }
      if (e.cancelable) e.preventDefault();
      s.pull = Math.min(MAX, dy * 0.5);
      setPull(s.pull);
    };
    const end = () => {
      const s = st.current;
      if (!s.on) return;
      s.on = false;
      if (s.pull >= TRIGGER) {
        setPull(TRIGGER);
        run();
      } else {
        s.pull = 0;
        setPull(0);
      }
    };
    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end, { passive: true });
    document.addEventListener('touchcancel', end, { passive: true });
    return () => {
      document.removeEventListener('touchstart', start);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end);
      document.removeEventListener('touchcancel', end);
      clearTimeout(timer.current);
    };
  }, []);

  const ready = pull >= TRIGGER;
  const h = busy ? TRIGGER : pull;
  return (
    <>
      <div className={`ptr ${busy ? 'busy' : ''} ${ready ? 'ready' : ''}`} style={{ height: h, transition: pull && !busy ? 'none' : 'height .25s' }} aria-hidden={!h}>
        {h > 8 && (
          <>
            <svg className="ptr-ico" style={{ transform: busy ? undefined : `rotate(${Math.min(180, (pull / TRIGGER) * 180)}deg)` }} viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5" />
            </svg>
            <span>{busy ? 'جارٍ المزامنة…' : ready ? 'اترك للتحديث' : 'اسحب للتحديث'}</span>
          </>
        )}
      </div>
      {res && (
        <div className={`ptr-res ${res.ok ? 'ok' : 'bad'}`} role="status" onClick={() => setRes(null)}>
          <b>{res.ok ? '✓ تمت المزامنة بنجاح' : '✕ لم تتم المزامنة'}</b>
          {!res.ok && <span>{res.reason}</span>}
        </div>
      )}
    </>
  );
}
