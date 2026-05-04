import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, pending: 0, posted: 0, failed: 0, scheduled: 0 });
  const [postCount, setPostCount] = useState(5);
  const [isPosting, setIsPosting] = useState(false);
  const [postResult, setPostResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await fetch('/.netlify/functions/get-queue-stats');
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Failed to fetch stats', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleForcePost = async () => {
    if (isPosting) return;
    setIsPosting(true);
    setPostResult(null);
    try {
      const res = await fetch('/.netlify/functions/force-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: postCount }),
      });
      const data = await res.json();
      setPostResult(data);
      // Refresh stats after posting
      setTimeout(fetchStats, 2000);
    } catch (e) {
      setPostResult({ message: 'Error: ' + e.message });
    } finally {
      setIsPosting(false);
    }
  };

  const statCards = [
    { label: 'TOTAL', value: stats.total || 0, color: '#fff' },
    { label: 'PENDING', value: stats.pending || 0, color: '#f5c518' },
    { label: 'POSTED', value: stats.posted || 0, color: '#00c851' },
    { label: 'SCHEDULED', value: stats.scheduled || 0, color: '#5bc0de' },
    { label: 'FAILED', value: stats.failed || 0, color: '#ff4444' },
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.15em', marginBottom: '2rem', color: '#fff' }}>
        DASHBOARD
      </h2>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2.5rem' }}>
        {statCards.map(card => (
          <div key={card.label} style={{
            background: '#111',
            border: '1px solid #222',
            borderRadius: '8px',
            padding: '1.25rem 1rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: card.color, lineHeight: 1 }}>
              {loading ? '—' : card.value}
            </div>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.15em', color: '#666', marginTop: '0.5rem' }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Force Post Section */}
      <div style={{
        background: '#111',
        border: '1px solid #222',
        borderRadius: '8px',
        padding: '1.5rem 2rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.15em', color: '#888', marginBottom: '0.35rem' }}>
            MANUAL POST TRIGGER
          </div>
          <div style={{ fontSize: '0.85rem', color: '#555' }}>
            Force-post pending reels right now — bypasses the 10-minute scheduler
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Count selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.65rem', letterSpacing: '0.1em', color: '#666' }}>
              HOW MANY TO POST
            </label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[1, 3, 5, 10, 15, 20, 25, 50].map(n => (
                <button
                  key={n}
                  onClick={() => setPostCount(n)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: postCount === n ? '1px solid #fff' : '1px solid #333',
                    borderRadius: '4px',
                    background: postCount === n ? '#fff' : '#0a0a0a',
                    color: postCount === n ? '#000' : '#555',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Post Now button */}
          <button
            onClick={handleForcePost}
            disabled={isPosting || stats.pending === 0}
            style={{
              padding: '0.75rem 2rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              border: '1px solid #fff',
              borderRadius: '6px',
              background: isPosting ? '#111' : '#fff',
              color: isPosting ? '#555' : '#000',
              cursor: (isPosting || stats.pending === 0) ? 'not-allowed' : 'pointer',
              opacity: (isPosting || stats.pending === 0) ? 0.5 : 1,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              alignSelf: 'flex-end',
            }}
          >
            {isPosting ? 'POSTING…' : `POST ${postCount} NOW`}
          </button>
        </div>

        {/* Result message */}
        {postResult && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '4px',
            background: postResult.results && postResult.results.some(r => r.success) ? 'rgba(0,200,81,0.1)' : 'rgba(255,68,68,0.1)',
            border: '1px solid ' + (postResult.results && postResult.results.some(r => r.success) ? '#00c85133' : '#ff444433'),
            fontSize: '0.8rem',
            color: '#aaa',
          }}>
            {postResult.message}
            {postResult.results && (
              <div style={{ marginTop: '0.4rem' }}>
                {postResult.results.map((r, i) => (
                  <div key={i} style={{ color: r.success ? '#00c851' : '#ff4444', fontSize: '0.75rem' }}>
                    {r.success ? `✓ Post #${r.postId} → IG: ${r.igId}` : `✗ Post #${r.postId || '?'}: ${r.error}`}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Note about no valid token */}
      {stats.pending > 0 && (
        <div style={{ fontSize: '0.75rem', color: '#444', textAlign: 'center' }}>
          {stats.pending} post{stats.pending !== 1 ? 's' : ''} waiting in queue — auto-scheduler runs every 10 min
        </div>
      )}
    </div>
  );
}
