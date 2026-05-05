import { useState, useEffect, useRef, useCallback } from 'react';

const S = {
  page: { minHeight: '100vh', background: '#000', color: '#fff', fontFamily: "'Inter', -apple-system, sans-serif" },
  wrap: { maxWidth: '820px', margin: '0 auto', padding: '3rem 2rem' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' },
  title: { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.25em', color: '#fff', margin: 0 },
  ts: { fontSize: '0.62rem', color: '#333', letterSpacing: '0.04em' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '1px', background: '#111', border: '1px solid #111', borderRadius: '8px', overflow: 'hidden', marginBottom: '1px' },
  card: (active) => ({ background: '#000', padding: '1.25rem 1rem', textAlign: 'center', cursor: 'default' }),
  cval: (color) => ({ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }),
  clbl: { fontSize: '0.55rem', letterSpacing: '0.18em', color: '#3a3a3a', marginTop: '0.4rem' },
  prog: { background: '#000', border: '1px solid #111', borderRadius: '8px', padding: '1rem 1.25rem', marginBottom: '1px' },
  bar: { background: '#111', borderRadius: '2px', height: '3px', overflow: 'hidden', marginTop: '0.6rem' },
  barFill: (pct) => ({ height: '100%', width: Math.min(pct,100)+'%', background: pct>=100?'#ff4444':'#fff', borderRadius: '2px', transition: 'width 0.6s ease' }),
  panel: { background: '#000', border: '1px solid #111', borderRadius: '8px', padding: '1.5rem 1.25rem', marginBottom: '1px' },
  row: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' },
  pill: (on) => ({
    padding: '0.3rem 0.7rem', fontSize: '0.72rem', fontWeight: 600,
    border: on ? '1px solid rgba(255,255,255,0.9)' : '1px solid #1f1f1f',
    borderRadius: '20px', background: on ? '#fff' : 'transparent',
    color: on ? '#000' : '#444', cursor: 'pointer', transition: 'all 0.1s',
  }),
  btn: (active, disabled) => ({
    padding: '0.55rem 2rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em',
    border: '1px solid ' + (disabled ? '#1f1f1f' : active ? '#555' : '#fff'),
    borderRadius: '6px', background: disabled ? 'transparent' : active ? 'transparent' : '#fff',
    color: disabled ? '#2a2a2a' : active ? '#555' : '#000',
    cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
    display: 'flex', alignItems: 'center', gap: '0.5rem',
  }),
  lbl: { fontSize: '0.58rem', letterSpacing: '0.18em', color: '#333', fontWeight: 600 },
  log: { marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '160px', overflowY: 'auto' },
  logRow: (t) => ({
    fontSize: '0.68rem', padding: '0.35rem 0.65rem', borderRadius: '4px',
    background: t==='ok'?'rgba(0,200,81,0.06)':t==='proc'?'rgba(100,140,255,0.06)':'rgba(255,60,60,0.06)',
    color: t==='ok'?'#00c86a':t==='proc'?'#6a8fff':'#ff5050',
    borderLeft: '2px solid ' + (t==='ok'?'#00c86a':t==='proc'?'#6a8fff':'#ff5050'),
  }),
  footer: { fontSize: '0.6rem', color: '#2a2a2a', textAlign: 'center', marginTop: '1.5rem', letterSpacing: '0.08em' },
};

export default function Dashboard() {
  const [stats, setStats] = useState({ total:0, pending:0, posted:0, failed:0, scheduled:0, postedToday:0, dailyLimit:25 });
  const [count, setCount] = useState(5);
  const [posting, setPosting] = useState(false);
  const [log, setLog] = useState([]);
  const [ts, setTs] = useState('');
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const d = await (await fetch('/.netlify/functions/get-queue-stats')).json();
      setStats(d);
      setTs(new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}));
    } catch(_) {}
  }, []);

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, 8000);
    return () => clearInterval(timerRef.current);
  }, [refresh]);

  // While posting, refresh every 4s so stats update live
  useEffect(() => {
    if (!posting) return;
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [posting, refresh]);

  const handlePost = async () => {
    if (posting) return;
    setPosting(true);
    setLog([{ t: 'proc', msg: `Queuing ${count} reel${count!==1?'s':''}...` }]);
    try {
      const res = await fetch('/.netlify/functions/force-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      const data = await res.json();
      const entries = (data.results||[]).map(r => {
        if (r.success === true)  return { t:'ok',   msg: `Posted → ${r.igId}` };
        if (r.success === null)  return { t:'proc', msg: r.note||'Processing...' };
        return { t:'err', msg: r.error||'Failed' };
      });
      setLog(entries.length ? entries : [{ t:'err', msg: data.message||'No result' }]);
      refresh();
    } catch(e) {
      setLog([{ t:'err', msg: e.message }]);
    } finally {
      setPosting(false);
    }
  };

  const pct = stats.dailyLimit > 0 ? (stats.postedToday / stats.dailyLimit) * 100 : 0;
  const noMore = stats.pending === 0;

  return (
    <div style={S.page}>
      <div style={S.wrap}>

        {/* Header */}
        <div style={S.head}>
          <p style={S.title}>DASHBOARD</p>
          <span style={S.ts}>{ts ? `synced ${ts}` : 'syncing...'}</span>
        </div>

        {/* Stat cards */}
        <div style={S.grid}>
          {[
            { label:'TOTAL',     val: stats.total,      color:'#fff'    },
            { label:'PENDING',   val: stats.pending,    color:'#f0b429' },
            { label:'POSTED',    val: stats.posted,     color:'#00c86a' },
            { label:'SCHEDULED', val: stats.scheduled,  color:'#6a8fff' },
            { label:'FAILED',    val: stats.failed,     color:'#ff5050' },
          ].map(c => (
            <div key={c.label} style={S.card()}>
              <div style={S.cval(c.color)}>{c.val}</div>
              <div style={S.clbl}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Daily bar */}
        <div style={S.prog}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={S.lbl}>TODAY'S PROGRESS</span>
            <span style={{ fontSize:'0.72rem', fontWeight:700, color: pct>=100?'#ff5050':'#fff', fontVariantNumeric:'tabular-nums' }}>
              {stats.postedToday} <span style={{ color:'#333', fontWeight:400 }}>/ {stats.dailyLimit}</span>
            </span>
          </div>
          <div style={S.bar}><div style={S.barFill(pct)} /></div>
        </div>

        {/* Post trigger */}
        <div style={S.panel}>
          <span style={S.lbl}>POST NOW</span>
          <div style={S.row}>
            <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
              {[1,3,5,10,15,20,25,50].map(n => (
                <button key={n} onClick={()=>setCount(n)} style={S.pill(count===n)}>{n}</button>
              ))}
            </div>
            <button onClick={handlePost} disabled={posting||noMore} style={S.btn(posting, posting||noMore)}>
              {posting
                ? <><span style={{ width:10,height:10,border:'1.5px solid #444',borderTopColor:'#888',borderRadius:'50%',display:'inline-block',animation:'_spin 0.7s linear infinite' }} /> POSTING</>
                : `POST ${count}`}
            </button>
          </div>

          {/* Log */}
          {log.length > 0 && (
            <div style={S.log}>
              {log.map((l,i) => <div key={i} style={S.logRow(l.t)}>{l.msg}</div>)}
            </div>
          )}
        </div>

        {/* Note */}
        {!posting && stats.pending > 0 && (
          <p style={S.footer}>{stats.pending} reel{stats.pending!==1?'s':''} queued · auto-scheduler every 10 min · stats refresh every 8s</p>
        )}
        {stats.pending === 0 && stats.total > 0 && (
          <p style={S.footer}>Queue empty — upload more reels to continue</p>
        )}

      </div>
      <style>{`@keyframes _spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
