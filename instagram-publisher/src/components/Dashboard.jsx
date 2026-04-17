import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export default function Dashboard({ showToast }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get('/api/get-queue-stats');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleRetryFailed = async () => {
    setRetrying(true);
    try {
      const res = await axios.post('/api/retry-failed');
      showToast(`${res.data.retriedCount} failed posts re-queued`, 'success');
      fetchStats();
    } catch (err) {
      showToast('Failed to retry posts', 'error');
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <span className="spinner" /> Loading dashboard...
      </div>
    );
  }

  if (!stats) {
    return <div className="dashboard-error">Failed to load dashboard data.</div>;
  }

  const dailyPct = stats.dailyLimit > 0 ? Math.round((stats.postedToday / stats.dailyLimit) * 100) : 0;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <button className="refresh-btn" onClick={fetchStats}>Refresh</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-pending">
          <div className="stat-number">{stats.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card stat-scheduled">
          <div className="stat-number">{stats.scheduled}</div>
          <div className="stat-label">Processing</div>
        </div>
        <div className="stat-card stat-posted">
          <div className="stat-number">{stats.posted}</div>
          <div className="stat-label">Posted</div>
        </div>
        <div className="stat-card stat-failed">
          <div className="stat-number">{stats.failed}</div>
          <div className="stat-label">Failed</div>
        </div>
      </div>

      <div className="daily-progress-card">
        <div className="daily-header">
          <span className="daily-title">Today's Posts</span>
          <span className="daily-count">{stats.postedToday} / {stats.dailyLimit}</span>
        </div>
        <div className="daily-bar-track">
          <div
            className={`daily-bar-fill ${dailyPct >= 100 ? 'full' : dailyPct >= 80 ? 'warn' : ''}`}
            style={{ width: `${Math.min(dailyPct, 100)}%` }}
          />
        </div>
        {dailyPct >= 100 && (
          <p className="daily-limit-msg">Daily limit reached. Auto-posting paused until tomorrow.</p>
        )}
      </div>

      <div className="queue-info-card">
        <div className="queue-info-header">
          <span className="queue-info-title">Queue Status</span>
          <span className="queue-info-total">{stats.total} total posts</span>
        </div>
        <div className="queue-info-body">
          <p>
            Worker runs every 10 minutes. {stats.pending > 0
              ? `Next post will be published within ~10 minutes.`
              : `No pending posts in queue.`}
          </p>
          {stats.pending > 0 && (
            <p className="queue-eta">
              Estimated queue completion: ~{Math.ceil(stats.pending / (stats.dailyLimit || 25))} day{Math.ceil(stats.pending / (stats.dailyLimit || 25)) !== 1 ? 's' : ''} at current limit
            </p>
          )}
        </div>
      </div>

      {stats.failed > 0 && (
        <div className="failed-card">
          <div className="failed-header">
            <span>{stats.failed} failed post{stats.failed !== 1 ? 's' : ''}</span>
            <button className="retry-btn" onClick={handleRetryFailed} disabled={retrying}>
              {retrying ? 'Retrying...' : 'Retry All'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
