import { useState, useEffect, useRef } from 'react';

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, pending: 0, posted: 0, failed: 0, scheduled: 0, postedToday: 0, dailyLimit: 25 });
  const [postCount, setPostCount] = useState(5);
  const [isPosting, setIsPosting] = useState(false);
  const [postLog, setPostLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const intervalRef = useRef(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('/.netlify/functions/get-queue-stats');
      const data = await res.json();
      setStats(data);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    intervalRef.current = setInterval(fetchStats, 15000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // While posting, refresh stats every 5s
  useEffect(() => {
    if (isPosting) {
      const t = setInterval(fetchStats, 5000);
      return () => clearInterval(t);
    }
  }, [isPosting]);

  const handlePost = async () => {
    if (isPosting) return;
    setIsPosting(true);
    setPostLog([]);
    try {
      const res = await fetch('/.netlify/functions/force-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: postCount }),
      });
      const data = await res.json();
      setPostLog(data.results || []);
      fetchStats();
    } catch (e) {
      setPostLog([{ success: false, error: e.message }]);
    } finally {
      setIsPosting(false);
    }
  };

  const pct = stats.dailyLimit > 0 ? Math.round((stats.postedToday / stats.dailyLimit) * 100) : 0;

  return (
    <div style={{ padding: '2.5rem 2rem', maxWidth: '860px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.2em', color: '#fff', margin: 0 }}>DASHBOARD</h2>
        <span style={{ fontSize: '0.65rem', color: '#444', letterSpacing: '0.05em' }}>
          {lastRefresh ? 'updated ' + lastRefresh.toLocaleTimeString() : 'loading...'}
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'TOTAL', val: stats.total, color: '#fff' },
          { label: 'PENDING', val: stats.pending, color: '#f5c518' },
          { label: 'POSTED', val: stats.posted, color: '#00c851' },
          { label: 'SCHEDULED', val: stats.scheduled, color: '#5bc0de' },
          { label: 'FAILED', val: stats.failed, color: '#ff4444' },
        ].map(s => (
          <div key={s.label} style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '6px', padding: '1rem 0.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>
              {loading ? '—' : s.val}
            </div>
            <div style={{ fontSize: '0.6rem', letterSpacing: '0.12em', color: '#555', marginTop: '0.4rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Daily progress */}
      <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '6px', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: '#555' }}>TODAY'S POSTS</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: pct >= 100 ? '#ff4444' : '#fff' }}>
            {stats.postedToday} / {stats.dailyLimit}
          </span>
        </div>
        <div style={{ background: '#1a1a1a', borderRadius: '3px', height: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: pct + '%', background: pct >= 100 ? '#ff4444' : '#fff', borderRadius: '3px', transition: 'width 0.5s' }} />
        </div>
      </div>

      {/* Post Now */}
      <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '6px', padding: '1.5rem 1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.65rem', letterSpacing: '0.15em', color: '#555', marginBottom: '1rem' }}>MANUAL POST TRIGGER</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Count pills */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {[1, 3, 5, 10, 15, 20, 25, 50].map(n => (
              <button key={n} onClick={() => setPostCount(n)} style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.75rem', fontWeight: 600,
                border: postCount === n ? '1px solid #fff' : '1px solid #2a2a2a',
                borderRadius: '4px',
                background: postCount === n ? '#fff' : 'transparent',
                color: postCount === n ? '#000' : '#555',
                cursor: 'pointer', transition: 'all 0.12s',
              }}>{n}</button>
            ))}
          </div>

          {/* Post button */}
          <button onClick={handlePost} disabled={isPosting || stats.pending === 0}
            style={{
              padding: '0.6rem 1.75rem', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em',
              border: '1px solid ' + (isPosting ? '#333' : '#fff'),
              borderRadius: '5px',
              background: isPosting ? 'transparent' : '#fff',
              color: isPosting ? '#555' : '#000',
              cursor: (isPosting || stats.pending === 0) ? 'not-allowed' : 'pointer',
              opacity: stats.pending === 0 ? 0.4 : 1,
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}>
            {isPosting ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', border: '2px solid #555', borderTopColor: '#aaa', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                POSTING...
              </span>
            ) : `POST ${postCount} NOW`}
          </button>
        </div>

        {/* Result log */}
        {postLog.length > 0 && (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {postLog.map((r, i) => (
              <div key={i} style={{
                fontSize: '0.72rem', padding: '0.4rem 0.6rem', borderRadius: '4px',
                background: r.success === true ? 'rgba(0,200,81,0.08)' : r.success === null ? 'rgba(91,192,222,0.08)' : 'rgba(255,68,68,0.08)',
                color: r.success === true ? '#00c851' : r.success === null ? '#5bc0de' : '#ff4444',
                border: '1px solid ' + (r.success === true ? '#00c85122' : r.success === null ? '#5bc0de22' : '#ff444422'),
              }}>
                {r.success === true && `✓ Posted → IG: ${r.igId}`}
                {r.success === null && `⏳ ${r.note || 'Processing — will publish shortly'}`}
                {r.success === false && `✗ ${r.error || 'Failed'}`}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status note */}
      {stats.pending > 0 && !isPosting && (
        <div style={{ fontSize: '0.7rem', color: '#333', textAlign: 'center', letterSpacing: '0.05em' }}>
          {stats.pending} reel{stats.pending !== 1 ? 's' : ''} in queue · auto-scheduler fires every 10 min
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
