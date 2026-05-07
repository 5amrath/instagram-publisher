import { useState, useEffect } from 'react';
import axios from 'axios';

const DAILY_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

export default function Settings({ showToast }) {
  const [dailyLimit, setDailyLimit] = useState(50);
  const [savedLimit, setSavedLimit] = useState(50);
  const [saving, setSaving] = useState(false);
  const [accountInfo, setAccountInfo] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    axios.get('/.netlify/functions/account-info')
      .then(r => setAccountInfo(r.data))
      .catch(() => {})
      .finally(() => setLoadingAccount(false));
    axios.get('/.netlify/functions/get-queue-stats')
      .then(r => {
        setDailyLimit(r.data.dailyLimit || 50);
        setSavedLimit(r.data.dailyLimit || 50);
        setStats(r.data);
      })
      .catch(() => {});
  }, []);

  const saveDailyLimit = async (val) => {
    setSaving(true);
    try {
      await axios.post('/.netlify/functions/update-settings', { key: 'daily_limit', value: String(val) });
      setSavedLimit(val);
      showToast('Daily limit saved — ' + val + '/day', 'success');
    } catch {
      showToast('Failed to save', 'error');
    } finally { setSaving(false); }
  };

  const handleRefreshToken = async () => {
    setRefreshing(true);
    try {
      const res = await axios.post('/.netlify/functions/refresh-token', {});
      showToast(res.data.message || 'Token refreshed', 'success');
    } catch (e) {
      showToast(e.response?.data?.error || 'Refresh failed', 'error');
    } finally { setRefreshing(false); }
  };

  const tokenAge = accountInfo?.tokenAge;
  const tokenDaysLeft = tokenAge ? Math.max(0, 60 - Math.floor(tokenAge / 86400)) : null;

  return (
    <div className="fade-in" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <div className="page-title">Settings</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        <div className="card">
          <div className="section-label">Instagram Account</div>
          {loadingAccount ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
              <span className="spinner" /> Loading account info…
            </div>
          ) : accountInfo ? (
            <>
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">@{accountInfo.username || 'ascend.deals'}</div>
                  <div className="settings-row-desc">Connected Instagram Business Account</div>
                </div>
                <div className="settings-row-right">
                  {accountInfo.profile_picture_url && (
                    <img src={accountInfo.profile_picture_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid var(--creme-border)' }} />
                  )}
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Followers</div>
                  <div className="settings-row-desc">Total follower count</div>
                </div>
                <div className="settings-row-right">
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--creme)', fontVariantNumeric: 'tabular-nums' }}>
                    {accountInfo.followers_count?.toLocaleString() || '—'}
                  </span>
                </div>
              </div>
              {stats && (
                <div className="settings-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                  <div>
                    <div className="settings-row-label">Total Published Reels</div>
                    <div className="settings-row-desc">Posted via Ascend Publisher</div>
                  </div>
                  <div className="settings-row-right">
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--emerald-lt)', fontVariantNumeric: 'tabular-nums' }}>
                      {stats.posted?.toLocaleString() || '0'}
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Could not load account info. Check your access token.</p>
          )}
        </div>

        <div className="card">
          <div className="section-label">Access Token</div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Token Status</div>
              <div className="settings-row-desc">
                {tokenDaysLeft !== null
                  ? tokenDaysLeft > 10
                    ? 'Valid · expires in ~' + tokenDaysLeft + ' days'
                    : tokenDaysLeft > 0
                    ? 'Expiring soon — ' + tokenDaysLeft + ' days left'
                    : 'Token may be expired'
                  : '60-day long-lived token'}
              </div>
            </div>
            <div className="settings-row-right">
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '3px 10px', borderRadius: 99,
                background: tokenDaysLeft === null || tokenDaysLeft > 10 ? 'var(--emerald-dim)' : 'var(--gold-dim)',
                color: tokenDaysLeft === null || tokenDaysLeft > 10 ? 'var(--emerald-lt)' : 'var(--gold-light)',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                {tokenDaysLeft === null ? 'Active' : tokenDaysLeft > 10 ? tokenDaysLeft + 'd left' : tokenDaysLeft > 0 ? 'Expiring' : 'Check token'}
              </span>
            </div>
          </div>
          <div className="settings-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <div>
              <div className="settings-row-label">Refresh Token</div>
              <div className="settings-row-desc">Exchange for a new 60-day token</div>
            </div>
            <div className="settings-row-right">
              <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }} onClick={handleRefreshToken} disabled={refreshing}>
                {refreshing ? <><span className="spinner" /> Refreshing…</> : '↺ Refresh Token'}
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-label">Posting Limits</div>
          <div className="settings-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <div>
              <div className="settings-row-label">Daily Post Limit</div>
              <div className="settings-row-desc">Max posts per day. Instagram allows up to 50, we support up to 100 with queuing.</div>
            </div>
            <div className="settings-row-right" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <div className="pill-group" style={{ justifyContent: 'flex-end', flexWrap: 'wrap', maxWidth: 340 }}>
                {DAILY_OPTIONS.map(n => (
                  <button key={n} className={'pill ' + (dailyLimit === n ? 'active' : '')} onClick={() => { setDailyLimit(n); saveDailyLimit(n); }}>
                    {n}
                  </button>
                ))}
              </div>
              {saving && <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><span className="spinner" /> Saving…</span>}
              {!saving && dailyLimit === savedLimit && <span style={{ fontSize: 11, color: 'var(--emerald-lt)' }}>✓ Saved ({savedLimit}/day)</span>}
            </div>
          </div>
        </div>

        {stats && (
          <div className="card">
            <div className="section-label">Queue Overview</div>
            <div className="stats-strip" style={{ marginTop: 8 }}>
              {[
                { label: 'Total', val: stats.total, color: 'var(--creme)' },
                { label: 'Pending', val: stats.pending, color: 'var(--gold-light)' },
                { label: 'Posted', val: stats.posted, color: 'var(--emerald-lt)' },
                { label: 'Failed', val: stats.failed, color: 'var(--red-lt)' },
              ].map(c => (
                <div key={c.label} className="stat-cell" style={{ gridColumn: 'span 1' }}>
                  <div className="stat-cell-val" style={{ color: c.color, fontSize: 22 }}>{c.val}</div>
                  <div className="stat-cell-label">{c.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ background: 'transparent', border: '1px solid var(--creme-border)' }}>
          <div className="section-label">System Info</div>
          <div className="settings-row">
            <div className="settings-row-label">Auto-Poster Status</div>
            <span style={{ fontSize: 11, color: 'var(--emerald-lt)', fontWeight: 600, background: 'var(--emerald-dim)', padding: '2px 10px', borderRadius: 99, border: '1px solid rgba(52,211,153,0.2)' }}>
              ● Runs every minute
            </span>
          </div>
          <div className="settings-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <div className="settings-row-label">Platform</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Netlify · Neon DB · Instagram Graph API v21.0</span>
          </div>
        </div>

      </div>
    </div>
  );
}
