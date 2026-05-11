import { useState, useEffect } from 'react';

const card = { background: 'var(--charcoal-2)', borderRadius: 14, padding: 20, marginBottom: 16 };
const label = { fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 4 };

function BarChart({ data, keyField, valueField, color = 'var(--gold)', maxHeight = 100 }) {
  if (!data || data.length === 0) return <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 16 }}>No data yet</div>;
  const maxVal = Math.max(...data.map(d => Number(d[valueField]) || 0), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: maxHeight + 24, paddingTop: 8 }}>
      {data.map((d, i) => {
        const val = Number(d[valueField]) || 0;
        const h = Math.max((val / maxVal) * maxHeight, 2);
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div title={val} style={{ width: '100%', height: h, background: color, borderRadius: 3, transition: 'height 0.3s', minWidth: 4 }} />
            <div style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 24, textOverflow: 'clip', textAlign: 'center' }}>{d[keyField]}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/.netlify/functions/analytics?action=overview');
      const d = await res.json();
      setData(d);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading analytics...</div>;
  if (!data) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Failed to load analytics</div>;

  const stats = data.stats || {};
  const daily = data.daily || [];
  const hours = data.hours || [];
  const topPosts = data.topPosts || [];

  const hourData = Array.from({ length: 24 }, (_, i) => {
    const found = hours.find(h => Number(h.hour) === i);
    return { hour: i < 10 ? '0' + i : '' + i, count: found ? Number(found.count) : 0 };
  });

  const postedRate = stats.total > 0 ? Math.round((stats.posted / stats.total) * 100) : 0;

  return (
    <div className="fade-in" style={{ maxWidth: 960 }}>
      <div className="page-header">
        <div className="page-title">Analytics</div>
        <button onClick={load} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--charcoal-5)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>↻ Refresh</button>
      </div>

      {/* Top Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'TOTAL', value: stats.total, color: 'var(--creme)' },
          { label: 'POSTED', value: stats.posted, color: '#6dc878' },
          { label: 'PENDING', value: stats.pending, color: '#f0b429' },
          { label: 'THIS WEEK', value: stats.this_week, color: 'var(--gold)' },
          { label: 'TODAY', value: stats.today, color: '#64b5f6' },
        ].map(({ label: l, value, color }) => (
          <div key={l} style={card}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1 }}>{l}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color, marginTop: 4 }}>{value || 0}</div>
          </div>
        ))}
      </div>

      {/* Success Rate */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={label}>POST SUCCESS RATE</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, background: 'var(--charcoal-4)', borderRadius: 6, height: 12, overflow: 'hidden' }}>
            <div style={{ width: postedRate + '%', height: '100%', background: postedRate > 80 ? '#6dc878' : postedRate > 50 ? 'var(--gold)' : '#ff5050', borderRadius: 6, transition: 'width 0.5s' }} />
          </div>
          <div style={{ color: postedRate > 80 ? '#6dc878' : 'var(--gold)', fontWeight: 700, fontSize: 20, minWidth: 50 }}>{postedRate}%</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{stats.posted} posted of {stats.total} total · {stats.failed} failed</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Daily Posts Chart */}
        <div style={card}>
          <div style={label}>POSTS PER DAY (LAST 30 DAYS)</div>
          {daily.length > 0 ? (
            <BarChart data={daily.slice(-20)} keyField="day" valueField="posted" color="var(--gold)" maxHeight={80} />
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 16 }}>No posting history yet</div>
          )}
        </div>

        {/* Hourly Chart */}
        <div style={card}>
          <div style={label}>BEST POSTING HOURS</div>
          <BarChart data={hourData} keyField="hour" valueField="count" color="#64b5f6" maxHeight={80} />
        </div>
      </div>

      {/* Recent Posts */}
      <div style={card}>
        <div style={{ ...label, marginBottom: 12 }}>RECENTLY POSTED</div>
        {topPosts.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No posts yet</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
          {topPosts.map(p => (
            <div key={p.id} title={p.caption} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '9/16', background: 'var(--charcoal-3)' }}>
              {p.thumbnail_url && <img src={p.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 5px', background: 'rgba(0,0,0,0.7)', fontSize: 9, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{new Date(p.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Queue Health */}
      <div style={card}>
        <div style={label}>QUEUE HEALTH TIPS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
          {[
            { icon: '🟢', tip: 'Best times to post: 6-9 PM EST', detail: 'Peak Instagram engagement window' },
            { icon: '🔥', tip: 'Post 3-8x per day for max growth', detail: 'Consistent reels = algorithmic boost' },
            { icon: '🏷️', tip: 'Use 5-10 niche hashtags', detail: 'Mix broad + niche tags per reel' },
          ].map(({ icon, tip, detail }) => (
            <div key={tip} style={{ background: 'var(--charcoal-3)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
              <div style={{ color: 'var(--creme)', fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{tip}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
