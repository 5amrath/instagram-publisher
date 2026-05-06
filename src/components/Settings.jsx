import { useState, useEffect } from 'react';
import axios from 'axios';

const DAILY_OPTIONS = [5,10,15,20,25,30,40,50];

export default function Settings({ showToast }) {
  const [dailyLimit, setDailyLimit]       = useState(25);
  const [savedLimit, setSavedLimit]       = useState(25);
  const [saving, setSaving]               = useState(false);
  const [accountInfo, setAccountInfo]     = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [stats, setStats]                 = useState(null);

  useEffect(() => {
    // Load account info
    axios.get('/.netlify/functions/account-info')
      .then(r => setAccountInfo(r.data))
      .catch(() => {})
      .finally(() => setLoadingAccount(false));
    // Load current daily limit
    axios.get('/.netlify/functions/get-queue-stats')
      .then(r => { setDailyLimit(r.data.dailyLimit || 25); setSavedLimit(r.data.dailyLimit || 25); setStats(r.data); })
      .catch(() => {});
  }, []);

  const saveDailyLimit = async (val) => {
    setSaving(true);
    try {
      await axios.post('/.netlify/functions/update-settings', { key: 'daily_limit', value: String(val) });
      setSavedLimit(val);
      showToast('Daily limit saved', 'success');
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const handleRefreshToken = async () => {
    setRefreshing(true);
    try {
      const res = await axios.post('/.netlify/functions/refresh-token', {});
      showToast(res.data.message || 'Token refreshed', 'success');
    } catch (e) { showToast(e.response?.data?.error || 'Refresh failed', 'error'); }
    finally { setRefreshing(false); }
  };

  const tokenAge = accountInfo?.tokenAge;
  const tokenDaysLeft = tokenAge ? Math.max(0, 60 - Math.floor(tokenAge / 86400)) : null;

  return (
    <div className="fade-in">
      <div className="page-header">
        <span className="page-title">Settings</span>
      </div>

      <div className="settings-sections">

        {/* Account */}
        <div className="card">
          <span className="section-label">Instagram Account</span>
          {loadingAccount ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0', color: 'var(--ash)', fontSize: '0.78rem' }}>
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
                    <img src={accountInfo.profile_picture_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(245,240,232,0.1)' }} />
                  )}
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Followers</div>
                  <div className="settings-row-desc">Total follower count on connected account</div>
                </div>
                <div className="settings-row-right">
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--cream)', fontVariantNumeric: 'tabular-nums' }}>
                    {accountInfo.followers_count?.toLocaleString() || '—'}
                  </span>
                </div>
              </div>
              {stats && (
                <div className="settings-row">
                  <div>
                    <div className="settings-row-label">Total Published Reels</div>
                    <div className="settings-row-desc">Reels posted via Ascend Publisher</div>
                  </div>
                  <div className="settings-row-right">
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--emerald-lt)', fontVariantNumeric: 'tabular-nums' }}>
                      {stats.posted?.toLocaleString() || '0'}
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p style={{ fontSize: '0.78rem', color: 'var(--ash)', padding: '0.5rem 0' }}>Could not load account info. Check your access token.</p>
          )}
        </div>

        {/* Token */}
        <div className="card">
          <span className="section-label">Access Token</span>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Token Status</div>
              <div className="settings-row-desc">
                {tokenDaysLeft !== null
                  ? tokenDaysLeft > 10
                    ? `Valid · expires in ~${tokenDaysLeft} days`
                    : tokenDaysLeft > 0
                      ? `Expiring soon — ${tokenDaysLeft} days left`
                      : 'Token may be expired'
                  : '60-day long-lived token'}
              </div>
            </div>
            <div className="settings-row-right">
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '0.22rem 0.65rem', borderRadius: '99px',
                background: tokenDaysLeft === null ? 'rgba(45,122,91,0.15)' : tokenDaysLeft > 10 ? 'rgba(45,122,91,0.15)' : 'rgba(201,168,76,0.15)',
                color: tokenDaysLeft === null ? 'var(--emerald-lt)' : tokenDaysLeft > 10 ? 'var(--emerald-lt)' : 'var(--gold-light)',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                {tokenDaysLeft === null ? 'Active' : tokenDaysLeft > 10 ? `${tokenDaysLeft}d left` : tokenDaysLeft > 0 ? 'Expiring' : 'Check token'}
              </span>
            </div>
          </div>
          <div className="settings-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <div>
              <div className="settings-row-label">Refresh Token</div>
              <div className="settings-row-desc">Exchange for a new 60-day token using saved App credentials</div>
            </div>
            <div className="settings-row-right">
              <button className="btn-secondary" style={{ fontSize: '0.73rem', padding: '0.45rem 1.1rem' }} onClick={handleRefreshToken} disabled={refreshing}>
                {refreshing ? <><span className="spinner" /> Refreshing…</> : '↺ Refresh Token'}
              </button>
            </div>
          </div>
        </div>

        {/* Posting limits */}
        <div className="card">
          <span className="section-label">Posting Limits</span>
          <div className="settings-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <div>
              <div className="settings-row-label">Daily Post Limit</div>
              <div className="settings-row-desc">Max posts per day. Instagram API allows up to 50.</div>
            </div>
            <div className="settings-row-right" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: '0.6rem' }}>
              <div className="pill-group" style={{ justifyContent: 'flex-end' }}>
                {DAILY_OPTIONS.map(n => (
                  <button key={n} className={`pill ${dailyLimit === n ? 'active' : ''}`}
                    onClick={() => { setDailyLimit(n); saveDailyLimit(n); }}>
                    {n}
                  </button>
                ))}
              </div>
              {saving && <span style={{ fontSize: '0.65rem', color: 'var(--ash)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span className="spinner" /> Saving…</span>}
              {!saving && dailyLimit === savedLimit && <span style={{ fontSize: '0.62rem', color: 'var(--emerald-lt)' }}>✓ Saved ({savedLimit}/day)</span>}
            </div>
          </div>
        </div>

        {/* Queue stats */}
        {stats && (
          <div className="card">
            <span className="section-label">Queue Overview</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1px', borderRadius: '10px', overflow: 'hidden', background: 'rgba(245,240,232,0.04)', marginTop: '0.25rem' }}>
              {[
                { label: 'Total', val: stats.total, color: 'var(--cream)' },
                { label: 'Pending', val: stats.pending, color: 'var(--gold-light)' },
                { label: 'Posted', val: stats.posted, color: 'var(--emerald-lt)' },
                { label: 'Failed', val: stats.failed, color: 'var(--red-lt)' },
              ].map(c => (
                <div key={c.label} style={{ background: 'var(--charcoal-3)', padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: c.color, fontVariantNumeric: 'tabular-nums' }}>{c.val}</div>
                  <div style={{ fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ash)', marginTop: '0.3rem', fontWeight: 600 }}>{c.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="card" style={{ background: 'transparent', border: '1px solid rgba(245,240,232,0.05)' }}>
          <span className="section-label">System</span>
          <div className="settings-row">
            <div className="settings-row-label">Auto-Poster</div>
            <span style={{ fontSize: '0.62rem', color: 'var(--emerald-lt)', fontWeight: 600, background: 'rgba(45,122,91,0.1)', padding: '0.2rem 0.6rem', borderRadius: 99, border: '1px solid rgba(45,122,91,0.2)' }}>
              ● Runs every minute
            </span>
          </div>
          <div className="settings-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <div className="settings-row-label">Platform</div>
            <span style={{ fontSize: '0.72rem', color: 'var(--ash)' }}>Netlify · Neon DB · Instagram Graph API v21.0</span>
          </div>
        </div>

      </div>
    </div>
  );
}
