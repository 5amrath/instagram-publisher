import { useState, useEffect } from 'react';
import axios from 'axios';

const LIMITS = [10, 15, 20, 25, 30, 40, 50];

export default function Settings({ showToast }) {
  const [limit,        setLimit]        = useState(25);
  const [saving,       setSaving]       = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [shortToken,   setShortToken]   = useState('');
  const [refreshing,   setRefreshing]   = useState(false);
  const [newToken,     setNewToken]     = useState('');

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

  const handleRefreshToken = async () => {
    if (!shortToken.trim()) return showToast('Paste your short-lived token first', 'error');
    setRefreshing(true);
    setNewToken('');
    try {
      const res = await axios.post('/.netlify/functions/refresh-token', { shortToken: shortToken.trim() });
      if (res.data.pageToken) {
        setNewToken(res.data.pageToken);
        showToast('Got 60-day token! Copy it and update in Netlify env vars.', 'success');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      if (msg.includes('FACEBOOK_APP_SECRET')) {
        showToast('Add FACEBOOK_APP_ID and FACEBOOK_APP_SECRET to Netlify env vars first', 'error');
      } else {
        showToast('Error: ' + msg, 'error');
      }
    } finally {
      setRefreshing(false);
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

      {/* Token refresh */}
      <div className="card">
        <div className="card-header"><h3 className="card-title">Refresh Instagram Token</h3></div>
        <p className="text-dim mb-12">
          If posts are failing with "Session expired", generate a new short-lived token from the{' '}
          <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" style={{color:'var(--t2)'}}>Graph API Explorer</a>
          {' '}and paste it below. This will exchange it for a 60-day token.
        </p>
        <p className="text-dim mb-12" style={{fontSize:11}}>
          Requires: FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in Netlify env vars (from developers.facebook.com → App Settings → Basic).
        </p>
        <textarea
          className="caption-input"
          placeholder="Paste short-lived user token from Graph API Explorer..."
          value={shortToken}
          onChange={e => setShortToken(e.target.value)}
          rows={3}
          style={{fontSize:12, fontFamily:'monospace'}}
        />
        <div className="action-row" style={{marginTop:10}}>
          <button className="btn-primary" onClick={handleRefreshToken} disabled={refreshing || !shortToken.trim()}>
            {refreshing ? <><span className="spinner" style={{marginRight:8}} /> Exchanging...</> : 'Get 60-Day Token'}
          </button>
        </div>
        {newToken && (
          <div style={{marginTop:14}}>
            <p className="text-dim mb-12" style={{color:'var(--green)'}}>✓ 60-day Page token generated. Copy it and update INSTAGRAM_ACCESS_TOKEN in Netlify → Site configuration → Environment variables:</p>
            <textarea
              className="caption-input"
              value={newToken}
              readOnly
              rows={3}
              style={{fontSize:11, fontFamily:'monospace'}}
              onFocus={e => e.target.select()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
