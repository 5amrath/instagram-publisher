import { useState, useEffect } from 'react';
import axios from 'axios';

const LIMITS = [10, 15, 20, 25, 30, 40, 50];

export default function Settings({ showToast }) {
  const [limit,   setLimit]   = useState(25);
  const [saving,  setSaving]  = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get('/.netlify/functions/get-queue-stats');
        setLimit(res.data.dailyLimit || 25);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const saveLimit = async (val) => {
    setSaving(true);
    try {
      await axios.post('/.netlify/functions/update-settings', { key: 'daily_limit', value: String(val) });
      setLimit(val);
      showToast(`Limit set to ${val}/day`, 'success');
    } catch {
      showToast('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="center-msg"><span className="spinner" /> Loading...</div>;

  return (
    <div className="settings fade-in">
      <h2 className="page-title">Settings</h2>

      {/* Daily limit */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Daily Reels Limit</h3>
        </div>
        <p className="text-dim mb-12">Max Reels the auto-poster publishes per day. Instagram allows 50/day.</p>
        <div className="limit-row">
          {LIMITS.map(n => (
            <button
              key={n}
              className={`limit-btn${limit === n ? ' active' : ''}`}
              onClick={() => saveLimit(n)}
              disabled={saving}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-dim mt-8">Current: <strong style={{color:'var(--t1)'}}>{limit}/day</strong></p>
      </div>

      <div className="settings-grid">
        {/* Worker info */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Auto-Post Worker</h3></div>
          <div className="info-grid">
            <div className="info-row"><span className="info-key">Frequency</span><span className="info-val">Every 10 min</span></div>
            <div className="info-row"><span className="info-key">Posts per run</span><span className="info-val">1</span></div>
            <div className="info-row"><span className="info-key">Max retries</span><span className="info-val">3</span></div>
            <div className="info-row"><span className="info-key">AI captions</span><span className="info-val">GPT-4o-mini vision</span></div>
            <div className="info-row"><span className="info-key">Video host</span><span className="info-val">Cloudinary</span></div>
            <div className="info-row"><span className="info-key">Queue order</span><span className="info-val">FIFO (oldest first)</span></div>
          </div>
        </div>

        {/* IG limits */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">Instagram Rules</h3></div>
          <div className="info-grid">
            <div className="info-row"><span className="info-key">API limit</span><span className="info-val">50 posts/day</span></div>
            <div className="info-row"><span className="info-key">Caption</span><span className="info-val">2,200 chars max</span></div>
            <div className="info-row"><span className="info-key">Hashtags</span><span className="info-val">30 max</span></div>
            <div className="info-row"><span className="info-key">Reels format</span><span className="info-val">MP4, 3–90 sec</span></div>
            <div className="info-row"><span className="info-key">Image format</span><span className="info-val">JPEG / PNG</span></div>
            <div className="info-row"><span className="info-key">API version</span><span className="info-val">Graph v21.0</span></div>
          </div>
        </div>
      </div>

      {/* Token reminder */}
      <div className="card">
        <div className="card-header"><h3 className="card-title">Access Token</h3></div>
        <p className="text-dim">
          Your Instagram Page token is long-lived and won't expire unless your Facebook password changes.
          If you see "Session expired" errors, generate a new Page token from the Graph API Explorer and update it in Netlify env vars.
        </p>
      </div>
    </div>
  );
}
