import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export default function Dashboard({ showToast }) {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get('/.netlify/functions/get-queue-stats');
      setStats(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const retryAll = async () => {
    try {
      const res = await axios.post('/.netlify/functions/retry-failed');
      showToast(`${res.data.retriedCount} posts re-queued`, 'success');
      fetchStats();
    } catch {
      showToast('Retry failed', 'error');
    }
  };

  if (loading) return <div className="center-msg"><span className="spinner" /> Loading stats...</div>;
  if (!stats)  return <div className="center-msg">Failed to load dashboard</div>;

  const dailyPct = stats.dailyLimit > 0
    ? Math.min(100, Math.round((stats.postedToday / stats.dailyLimit) * 100))
    : 0;
  const queueDays = stats.pending > 0
    ? Math.ceil(stats.pending / (stats.dailyLimit || 25))
    : 0;

  return (
    <div className="dashboard fade-in">
      <div className="page-header">
        <h2>Dashboard</h2>
        <button className="btn-ghost" onClick={fetchStats}>Refresh</button>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num yellow">{stats.pending || 0}</div>
          <div className="stat-lbl">In Queue</div>
        </div>
        <div className="stat-card">
          <div className="stat-num blue">{stats.scheduled || 0}</div>
          <div className="stat-lbl">Processing</div>
        </div>
        <div className="stat-card">
          <div className="stat-num green">{stats.posted || 0}</div>
          <div className="stat-lbl">Posted</div>
        </div>
        <div className="stat-card">
          <div className="stat-num red">{stats.failed || 0}</div>
          <div className="stat-lbl">Failed</div>
        </div>
      </div>

      {/* Today's progress */}
      <div className="card">
        <div className="card-row">
          <div>
            <span className="card-title">Today</span>
            <p className="card-desc">{stats.postedToday} of {stats.dailyLimit} Reels posted today</p>
          </div>
          <span style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: dailyPct >= 100 ? 'var(--red)' : dailyPct >= 80 ? 'var(--yellow)' : 'var(--t1)',
          }}>
            {dailyPct}%
          </span>
        </div>
        <div className="bar-track">
          <div
            className={`bar-fill${dailyPct >= 100 ? ' red' : dailyPct >= 80 ? ' yellow' : ''}`}
            style={{ width: dailyPct + '%' }}
          />
        </div>
        {dailyPct >= 100 && <p className="text-red text-sm mt-4">Daily limit reached. Resumes tomorrow at midnight.</p>}
      </div>

      {/* Queue info */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Queue</span>
          <span className="card-meta">{(stats.pending || 0) + (stats.posted || 0) + (stats.failed || 0)} total posts</span>
        </div>
        <p className="text-dim">
          {stats.pending > 0
            ? `${stats.pending} pending. Clears in ~${queueDays} day${queueDays !== 1 ? 's' : ''} at ${stats.dailyLimit}/day. Worker fires every 10 min.`
            : 'Queue empty. Upload Reels to get started.'}
        </p>
      </div>

      {/* Failed */}
      {(stats.failed || 0) > 0 && (
        <div className="card card-error">
          <div className="card-row">
            <div>
              <span className="card-title text-red">{stats.failed} Failed</span>
              <p className="card-desc">These Reels couldn't be published. Retry to re-queue them.</p>
            </div>
            <button className="btn-small btn-danger" onClick={retryAll}>Retry All</button>
          </div>
        </div>
      )}
    </div>
  );
}
