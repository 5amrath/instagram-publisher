import { useState, useEffect, useRef, useCallback } from 'react';

const S = {
  page: { minHeight: '100vh', background: '#000', color: '#fff', fontFamily: "'Inter', -apple-system, sans-serif" },
  wrap: { maxWidth: '860px', margin: '0 auto', padding: '3rem 2rem' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' },
  title: { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.25em', color: '#fff', margin: 0 },
  ts: { fontSize: '0.62rem', color: '#333', letterSpacing: '0.04em' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '1px', background: '#111', border: '1px solid #111', borderRadius: '8px', overflow: 'hidden', marginBottom: '1px' },
  card: { background: '#000', padding: '1.25rem 1rem', textAlign: 'center' },
  cval: (color) => ({ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }),
  clbl: { fontSize: '0.55rem', letterSpacing: '0.18em', color: '#3a3a3a', marginTop: '0.4rem' },
  prog: { background: '#000', border: '1px solid #111', borderRadius: '8px', padding: '1rem 1.25rem', marginBottom: '1px' },
  bar: { background: '#111', borderRadius: '2px', height: '3px', overflow: 'hidden', marginTop: '0.4rem' },
  barFill: (pct, color) => ({ height: '100%', width: Math.min(pct, 100) + '%', background: color || (pct >= 100 ? '#ff4444' : '#fff'), borderRadius: '2px', transition: 'width 0.6s ease' }),
  panel: { background: '#000', border: '1px solid #111', borderRadius: '8px', padding: '1.5rem 1.25rem', marginBottom: '1px' },
  row: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' },
  pill: (on) => ({ padding: '0.3rem 0.7rem', fontSize: '0.72rem', fontWeight: 600, border: on ? '1px solid rgba(255,255,255,0.9)' : '1px solid #1f1f1f', borderRadius: '20px', background: on ? '#fff' : 'transparent', color: on ? '#000' : '#444', cursor: 'pointer', transition: 'all 0.1s' }),
  btn: (variant, disabled) => {
    const v = disabled
      ? { bg: 'transparent', color: '#2a2a2a', border: '#1f1f1f' }
      : variant === 'danger' ? { bg: 'transparent', color: '#ff5050', border: '#ff5050' }
      : variant === 'outline' ? { bg: 'transparent', color: '#fff', border: '#333' }
      : { bg: '#fff', color: '#000', border: '#fff' };
    return { padding: '0.55rem 1.5rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', border: '1px solid ' + v.border, borderRadius: '6px', background: v.bg, color: v.color, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' };
  },
  lbl: { fontSize: '0.58rem', letterSpacing: '0.18em', color: '#333', fontWeight: 600 },
  log: { marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '180px', overflowY: 'auto' },
  logRow: (t) => ({ fontSize: '0.68rem', padding: '0.35rem 0.65rem', borderRadius: '4px', background: t === 'ok' ? 'rgba(0,200,81,0.06)' : t === 'sched' ? 'rgba(100,140,255,0.06)' : t === 'proc' ? 'rgba(255,180,0,0.06)' : 'rgba(255,60,60,0.06)', color: t === 'ok' ? '#00c86a' : t === 'sched' ? '#6a8fff' : t === 'proc' ? '#f0b429' : '#ff5050', borderLeft: '2px solid ' + (t === 'ok' ? '#00c86a' : t === 'sched' ? '#6a8fff' : t === 'proc' ? '#f0b429' : '#ff5050') }),
  qRow: { display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.45rem 0', borderBottom: '1px solid #0d0d0d' },
  footer: { fontSize: '0.6rem', color: '#2a2a2a', textAlign: 'center', marginTop: '1.5rem', letterSpacing: '0.08em' },
};

function Spinner() {
  return <span style={{ width: 10, height: 10, border: '1.5px solid #333', borderTopColor: '#888', borderRadius: '50%', display: 'inline-block', animation: '_spin 0.7s linear infinite' }} />;
}

function Countdown({ target }) {
  const [secs, setSecs] = useState(() => Math.max(0, Math.round((new Date(target) - Date.now()) / 1000)));
  useEffect(() => {
    const t = setInterval(() => {
      setSecs(Math.max(0, Math.round((new Date(target) - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [target]);
  if (secs <= 0) return <span style={{ color: '#f0b429', fontSize: '0.63rem' }}>now</span>;
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  const str = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  return <span style={{ color: '#6a8fff', fontSize: '0.63rem', fontVariantNumeric: 'tabular-nums' }}>{str}</span>;
}

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, pending: 0, posted: 0, failed: 0, scheduled: 0, postedToday: 0, dailyLimit: 25 });
  const [schedData, setSchedData] = useState({ scheduled: [], count: 0, nextPost: null });
  const [count, setCount] = useState(5);
  const [schedCount, setSchedCount] = useState(null);
  const [posting, setPosting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [log, setLog] = useState([]);
  const [schedLog, setSchedLog] = useState([]);
  const [ts, setTs] = useState('');
  const timer = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const [s, sc] = await Promise.all([
        fetch('/.netlify/functions/get-queue-stats').then(r => r.json()).catch(() => null),
        fetch('/.netlify/functions/get-schedule').then(r => r.json()).catch(() => null),
      ]);
      if (s) setStats(s);
      if (sc) setSchedData(sc);
      setTs(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (_) {}
  }, []);

  useEffect(() => { refresh(); timer.current = setInterval(refresh, 8000); return () => clearInterval(timer.current); }, [refresh]);
  useEffect(() => {
    if (!posting && !scheduling) return;
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [posting, scheduling, refresh]);

  const handlePost = async () => {
    if (posting) return;
    setPosting(true);
    setLog([{ t: 'proc', msg: `Starting — posting reel #1 now, rest scheduling...` }]);
    try {
      const res = await fetch('/.netlify/functions/force-post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count }),
      });
      const data = await res.json();
      if (!data.results || data.results.length === 0) {
        setLog([{ t: 'err', msg: data.message || data.error || 'No posts available' }]);
      } else {
        const entries = data.results.map(r => {
          if (r.success === true) return { t: 'ok', msg: `✓ Posted → ${r.igId}` };
          if (r.success === null) return { t: 'sched', msg: r.note || 'Scheduled for auto-post' };
          return { t: 'err', msg: r.error || 'Failed' };
        });
        setLog(entries);
      }
      refresh();
    } catch (e) {
      setLog([{ t: 'err', msg: e.message }]);
    } finally {
      setPosting(false);
    }
  };

  const handleSchedule = async () => {
    if (scheduling) return;
    setScheduling(true);
    setSchedLog([{ t: 'proc', msg: 'Scheduling posts...' }]);
    try {
      const body = schedCount ? { count: schedCount } : {};
      const res = await fetch('/.netlify/functions/schedule-day', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) {
        setSchedLog([{ t: 'err', msg: data.error }]);
      } else if (data.scheduled === 0) {
        setSchedLog([{ t: 'err', msg: data.message || 'Nothing to schedule' }]);
      } else {
        const first = data.firstPost ? new Date(data.firstPost).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '?';
        const last = data.lastPost ? new Date(data.lastPost).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '?';
        setSchedLog([
          { t: 'ok', msg: `${data.scheduled} posts scheduled for today` },
          { t: 'sched', msg: `First: ${first} · Last: ${last} · Every ~${data.intervalMinutes}min` },
        ]);
      }
      refresh();
    } catch (e) {
      setSchedLog([{ t: 'err', msg: e.message }]);
    } finally {
      setScheduling(false);
    }
  };

  const handleClear = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      const res = await fetch('/.netlify/functions/reset-scheduled', { method: 'POST' });
      const data = await res.json();
      setSchedLog([{ t: 'ok', msg: data.message || 'Schedule cleared' }]);
      refresh();
    } catch (e) {
      setSchedLog([{ t: 'err', msg: e.message }]);
    } finally {
      setClearing(false);
    }
  };

  const pct = stats.dailyLimit > 0 ? (stats.postedToday / stats.dailyLimit) * 100 : 0;
  const combinedPct = stats.dailyLimit > 0 ? ((stats.postedToday + schedData.count) / stats.dailyLimit) * 100 : 0;
  const noMore = stats.pending === 0 && schedData.count === 0;
  const limitFull = (stats.postedToday + schedData.count) >= stats.dailyLimit;

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={S.head}>
          <p style={S.title}>DASHBOARD</p>
          <span style={S.ts}>{ts ? `synced ${ts}` : 'syncing...'}</span>
        </div>

        <div style={S.grid}>
          {[
            { label: 'TOTAL', val: stats.total, color: '#fff' },
            { label: 'PENDING', val: stats.pending, color: '#f0b429' },
            { label: 'POSTED', val: stats.posted, color: '#00c86a' },
            { label: 'SCHEDULED', val: stats.scheduled, color: '#6a8fff' },
            { label: 'FAILED', val: stats.failed, color: '#ff5050' },
          ].map(c => (
            <div key={c.label} style={S.card}>
              <div style={S.cval(c.color)}>{c.val}</div>
              <div style={S.clbl}>{c.label}</div>
            </div>
          ))}
        </div>

        <div style={S.prog}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={S.lbl}>TODAY</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: pct >= 100 ? '#ff5050' : '#fff' }}>
              {stats.postedToday}
              <span style={{ color: '#333', fontWeight: 400 }}>/{stats.dailyLimit}</span>
              {schedData.count > 0 && <span style={{ color: '#6a8fff', fontWeight: 400, fontSize: '0.65rem' }}> +{schedData.count} queued</span>}
            </span>
          </div>
          {schedData.count > 0 && <div style={S.bar}><div style={S.barFill(combinedPct, '#1e2f5c')} /></div>}
          <div style={S.bar}><div style={S.barFill(pct)} /></div>
        </div>

        {/* SCHEDULE TODAY */}
        <div style={S.panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={S.lbl}>SCHEDULE TODAY</span>
            {schedData.nextPost && (
              <span style={{ fontSize: '0.62rem', color: '#444' }}>next in <Countdown target={schedData.nextPost} /></span>
            )}
          </div>
          <div style={S.row}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button onClick={() => setSchedCount(null)} style={S.pill(schedCount === null)}>AUTO</button>
              {[5, 10, 15, 20, 25].map(n => (
                <button key={n} onClick={() => setSchedCount(n)} style={S.pill(schedCount === n)}>{n}</button>
              ))}
            </div>
            <button onClick={handleSchedule} disabled={scheduling || stats.pending === 0 || limitFull} style={S.btn('white', scheduling || stats.pending === 0 || limitFull)}>
              {scheduling ? <><Spinner /> SCHEDULING</> : 'SCHEDULE'}
            </button>
            {schedData.count > 0 && (
              <button onClick={handleClear} disabled={clearing} style={S.btn('danger', clearing)}>
                {clearing ? <><Spinner /> CLEARING</> : 'CLEAR'}
              </button>
            )}
          </div>
          {schedLog.length > 0 && (
            <div style={S.log}>{schedLog.map((l, i) => <div key={i} style={S.logRow(l.t)}>{l.msg}</div>)}</div>
          )}
          {schedData.scheduled && schedData.scheduled.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ ...S.lbl, marginBottom: '0.5rem' }}>QUEUE · {schedData.count} POSTS</div>
              <div style={{ maxHeight: '210px', overflowY: 'auto' }}>
                {schedData.scheduled.map((post, i) => (
                  <div key={post.id} style={S.qRow}>
                    <span style={{ fontSize: '0.6rem', color: '#2a2a2a', width: 18, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: '0.67rem', color: '#555', flexShrink: 0, width: 48, fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(post.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ fontSize: '0.6rem', flexShrink: 0, width: 60 }}>
                      {new Date(post.scheduled_at) <= new Date()
                        ? <span style={{ color: '#f0b429' }}>● posting</span>
                        : <Countdown target={post.scheduled_at} />}
                    </span>
                    <span style={{ fontSize: '0.63rem', color: '#2a2a2a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {post.caption ? post.caption.substring(0, 55) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {limitFull && <p style={{ fontSize: '0.63rem', color: '#333', marginTop: '0.75rem', margin: '0.75rem 0 0' }}>Today's quota fully scheduled. Clear to reschedule.</p>}
        </div>

        {/* POST NOW */}
        <div style={S.panel}>
          <span style={S.lbl}>POST NOW</span>
          <div style={S.row}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[1, 3, 5, 10, 15, 20, 25, 50].map(n => (
                <button key={n} onClick={() => setCount(n)} style={S.pill(count === n)}>{n}</button>
              ))}
            </div>
            <button onClick={handlePost} disabled={posting || (stats.pending === 0 && schedData.count === 0)} style={S.btn(posting ? 'outline' : 'white', posting || (stats.pending === 0 && schedData.count === 0))}>
              {posting ? <><Spinner /> POSTING</> : `POST ${count}`}
            </button>
          </div>
          {log.length > 0 && (
            <div style={S.log}>{log.map((l, i) => <div key={i} style={S.logRow(l.t)}>{l.msg}</div>)}</div>
          )}
          <p style={{ fontSize: '0.6rem', color: '#1a1a1a', margin: '0.75rem 0 0' }}>
            Posts #1 immediately · schedules rest for auto-post every 90s
          </p>
        </div>

        {stats.pending > 0 && (
          <p style={S.footer}>{stats.pending} pending · auto-post every 10min · stats refresh every 8s</p>
        )}
        {stats.pending === 0 && stats.total > 0 && (
          <p style={S.footer}>Queue empty — upload more reels</p>
        )}
      </div>
      <style>{`@keyframes _spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
