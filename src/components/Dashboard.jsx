import { useState, useEffect, useRef, useCallback } from 'react';

function Spinner() { return <span className="spinner" />; }

function Countdown({ target }) {
  const [secs, setSecs] = useState(() => Math.max(0, Math.round((new Date(target) - Date.now()) / 1000)));
  useEffect(() => {
    const t = setInterval(() => setSecs(Math.max(0, Math.round((new Date(target) - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (secs <= 0) return <span style={{ color: 'var(--gold-light)', fontSize: '0.65rem' }}>now</span>;
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  const str = h > 0 ? (h + 'h ' + m + 'm') : m > 0 ? (m + 'm ' + s + 's') : (s + 's');
  return <span style={{ color: 'var(--blue-lt)', fontSize: '0.65rem', fontVariantNumeric: 'tabular-nums' }}>{str}</span>;
}

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, pending: 0, posted: 0, failed: 0, scheduled: 0, postedToday: 0, dailyLimit: 50 });
  const [schedData, setSchedData] = useState({ scheduled: [], count: 0, nextPost: null });
  const [count, setCount] = useState(5);
  const [schedCount, setSchedCount] = useState(null);
  const [posting, setPosting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [log, setLog] = useState([]);
  const [schedLog, setSchedLog] = useState([]);
  const [ts, setTs] = useState('');
  const [showQueue, setShowQueue] = useState(false);
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
  useEffect(() => { if (!posting && !scheduling) return; const t = setInterval(refresh, 4000); return () => clearInterval(t); }, [posting, scheduling, refresh]);

  const handlePost = async () => {
    if (posting) return;
    setPosting(true);
    setLog([{ t: 'info', msg: 'Firing reel #1 now — scheduling ' + (count > 1 ? (count - 1) + ' more' : '') + '...' }]);
    try {
      const res = await fetch('/.netlify/functions/force-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      const data = await res.json();
      if (!data.results || data.results.length === 0) {
        setLog([{ t: 'err', msg: data.message || data.error || 'No posts available' }]);
      } else {
        setLog(data.results.map(r => {
          if (r.success === true) return { t: 'ok', msg: 'Posted → ' + r.igId };
          if (r.success === null) return { t: 'sched', msg: r.note || 'Scheduled' };
          return { t: 'err', msg: r.error || 'Failed' };
        }));
      }
      refresh();
    } catch (e) { setLog([{ t: 'err', msg: e.message }]); }
    finally { setPosting(false); }
  };

  const handleSchedule = async () => {
    if (scheduling) return;
    setScheduling(true);
    setSchedLog([{ t: 'info', msg: 'Scheduling posts across today...' }]);
    try {
      const body = schedCount ? { count: schedCount } : {};
      const data = await fetch('/.netlify/functions/schedule-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json());
      if (data.error) setSchedLog([{ t: 'err', msg: data.error }]);
      else if (!data.scheduled) setSchedLog([{ t: 'err', msg: data.message || 'Nothing scheduled' }]);
      else {
        const f = data.firstPost ? new Date(data.firstPost).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '?';
        const l = data.lastPost ? new Date(data.lastPost).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '?';
        setSchedLog([
          { t: 'ok', msg: data.scheduled + ' posts scheduled' },
          { t: 'sched', msg: f + ' → ' + l + ' · every ~' + data.intervalMinutes + ' min' },
        ]);
        setShowQueue(true);
      }
      refresh();
    } catch (e) { setSchedLog([{ t: 'err', msg: e.message }]); }
    finally { setScheduling(false); }
  };

  const handleClear = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      const data = await fetch('/.netlify/functions/reset-scheduled', { method: 'POST' }).then(r => r.json());
      setSchedLog([{ t: 'ok', msg: data.message || 'Schedule cleared' }]);
      setShowQueue(false);
      refresh();
    } catch (e) { setSchedLog([{ t: 'err', msg: e.message }]); }
    finally { setClearing(false); }
  };

  const pct = stats.dailyLimit > 0 ? (stats.postedToday / stats.dailyLimit) * 100 : 0;
  const combinedPct = stats.dailyLimit > 0 ? ((stats.postedToday + schedData.count) / stats.dailyLimit) * 100 : 0;
  const noMore = stats.pending === 0 && schedData.count === 0;
  const limitFull = (stats.postedToday + schedData.count) >= stats.dailyLimit;

  const statCards = [
    { label: 'Total', val: stats.total, color: 'var(--creme)' },
    { label: 'Pending', val: stats.pending, color: 'var(--gold-light)' },
    { label: 'Posted', val: stats.posted, color: 'var(--emerald-lt)' },
    { label: 'Scheduled', val: stats.scheduled, color: 'var(--blue-lt)' },
    { label: 'Failed', val: stats.failed, color: 'var(--red-lt)' },
  ];

  return (
    <div className="fade-in" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-meta">{ts ? 'Synced ' + ts : 'Syncing...'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {stats.pending > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stats.pending} pending · cron every min</span>}
        </div>
      </div>

      <div className="stats-strip">
        {statCards.map(c => (
          <div key={c.label} className="stat-cell">
            <div className="stat-cell-val" style={{ color: c.color }}>{c.val}</div>
            <div className="stat-cell-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
          <span className="section-label" style={{ margin: 0 }}>Today's Progress</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {schedData.count > 0 && (
              <span style={{ fontSize: 11, color: 'var(--blue-lt)', background: 'var(--blue-dim)', padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(96,165,250,0.2)' }}>
                +{schedData.count} queued
              </span>
            )}
            <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: pct >= 100 ? 'var(--red-lt)' : 'var(--creme)' }}>
              {stats.postedToday}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/{stats.dailyLimit}</span>
            </span>
          </div>
        </div>
        {schedData.count > 0 && (
          <div style={{ height: 2, background: 'var(--charcoal-4)', borderRadius: 99, overflow: 'hidden', marginBottom: 3 }}>
            <div style={{ height: '100%', width: Math.min(combinedPct, 100) + '%', background: 'rgba(96,165,250,0.5)', borderRadius: 99, transition: 'width 0.6s ease' }} />
          </div>
        )}
        <div style={{ height: 4, background: 'var(--charcoal-4)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: Math.min(pct, 100) + '%', background: pct >= 100 ? 'var(--red-lt)' : 'linear-gradient(90deg, var(--gold), var(--gold-light))', borderRadius: 99, transition: 'width 0.6s ease' }} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span className="section-label" style={{ margin: 0 }}>Schedule Today</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {schedData.nextPost && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                next in <Countdown target={schedData.nextPost} />
              </span>
            )}
            {schedData.count > 0 && (
              <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setShowQueue(q => !q)}>
                {showQueue ? 'Hide queue' : 'Show queue (' + schedData.count + ')'}
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="pill-group">
            <button className={'pill ' + (schedCount === null ? 'active' : '')} onClick={() => setSchedCount(null)}>Auto</button>
            {[5, 10, 15, 20, 25, 30, 40, 50, 75, 100].map(n => (
              <button key={n} className={'pill ' + (schedCount === n ? 'active' : '')} onClick={() => setSchedCount(n)}>{n}</button>
            ))}
          </div>
          <button onClick={handleSchedule} disabled={scheduling || stats.pending === 0 || limitFull} className="btn-primary" style={{ padding: '7px 20px' }}>
            {scheduling ? <><Spinner /> Scheduling…</> : 'Schedule'}
          </button>
          {schedData.count > 0 && (
            <button onClick={handleClear} disabled={clearing} className="btn-danger">
              {clearing ? <><Spinner /> Clearing</> : 'Clear'}
            </button>
          )}
        </div>
        {schedLog.length > 0 && (
          <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {schedLog.map((l, i) => <LogRow key={i} item={l} />)}
          </div>
        )}
        {showQueue && schedData.scheduled && schedData.scheduled.length > 0 && (
          <div style={{ marginTop: '1rem', background: 'var(--charcoal-3)', borderRadius: 10, border: '1px solid var(--creme-border)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--creme-border)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Queue · {schedData.count} Posts
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Auto-post fires every minute</span>
            </div>
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {schedData.scheduled.map((post, i) => (
                <div key={post.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderBottom: '1px solid rgba(245,240,232,0.03)' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 20, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 52, fontVariantNumeric: 'tabular-nums' }}>
                    {new Date(post.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ width: 60, flexShrink: 0 }}>
                    {new Date(post.scheduled_at) <= new Date()
                      ? <span style={{ color: 'var(--gold)', fontSize: 10 }}>● posting</span>
                      : <Countdown target={post.scheduled_at} />}
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(245,240,232,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {post.caption ? post.caption.substring(0, 55) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {limitFull && <p className="hint" style={{ marginTop: 10 }}>Daily quota fully scheduled — clear to reschedule.</p>}
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span className="section-label" style={{ margin: 0 }}>Post Now</span>
          <span className="hint">Posts #1 instantly · queues rest via auto-post</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="pill-group">
            {[1, 3, 5, 10, 15, 20, 25, 50, 75, 100].map(n => (
              <button key={n} className={'pill ' + (count === n ? 'active' : '')} onClick={() => setCount(n)}>{n}</button>
            ))}
          </div>
          <button onClick={handlePost} disabled={posting || noMore} className="btn-primary" style={{ padding: '7px 20px' }}>
            {posting ? <><Spinner /> Posting…</> : 'Post ' + count}
          </button>
        </div>
        {log.length > 0 && (
          <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
            {log.map((l, i) => <LogRow key={i} item={l} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function LogRow({ item }) {
  const colors = {
    ok: { bg: 'var(--emerald-dim)', color: 'var(--emerald-lt)', border: 'rgba(52,211,153,0.3)' },
    sched: { bg: 'var(--blue-dim)', color: 'var(--blue-lt)', border: 'rgba(96,165,250,0.25)' },
    info: { bg: 'rgba(201,168,76,0.07)', color: 'var(--gold-light)', border: 'rgba(201,168,76,0.2)' },
    err: { bg: 'var(--red-dim)', color: 'var(--red-lt)', border: 'rgba(248,113,113,0.25)' },
  };
  const c = colors[item.t] || colors.info;
  return (
    <div style={{ fontSize: 11.5, padding: '6px 10px', borderRadius: 7, background: c.bg, color: c.color, borderLeft: '2px solid ' + c.border }}>
      {item.msg}
    </div>
  );
}
