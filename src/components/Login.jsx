import { useState, useEffect } from 'react';

export default function Login({ onLogin }) {
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);

  const handleLogin = async (e) => {
    e && e.preventDefault();
    if (!pw.trim()) { setError('Enter password'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/.netlify/functions/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', password: pw }),
      });
      const data = await res.json();
      if (data.error) { setError('Incorrect password'); setLoading(false); return; }
      localStorage.setItem('ascend_token', data.token);
      onLogin(data.token);
    } catch (e) {
      setError('Login failed. Check connection.');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--charcoal-1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'inherit',
    }}>
      <div style={{
        background: 'var(--charcoal-2)', borderRadius: 18, padding: '48px 40px',
        width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        border: '1px solid var(--charcoal-4)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 16px', boxShadow: '0 4px 20px rgba(212,175,55,0.3)' }}>⚡</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--creme)', letterSpacing: 1 }}>ASCEND PUBLISHER</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Private — owner access only</div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 6 }}>PASSWORD</div>
            <div style={{ position: 'relative' }}>
              <input
                type={show ? 'text' : 'password'}
                value={pw}
                onChange={e => setPw(e.target.value)}
                placeholder="Enter your password"
                autoFocus
                style={{
                  width: '100%', background: 'var(--charcoal-3)', border: error ? '1px solid #ff5050' : '1px solid var(--charcoal-5)',
                  borderRadius: 10, color: 'var(--creme)', padding: '12px 42px 12px 14px',
                  fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
                }}
              />
              <button type="button" onClick={() => setShow(s => !s)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: 0,
              }}>{show ? '🙈' : '👁️'}</button>
            </div>
            {error && <div style={{ color: '#ff5050', fontSize: 12, marginTop: 6 }}>{error}</div>}
          </div>

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '13px 0', background: 'var(--gold)', border: 'none',
            borderRadius: 10, color: '#1a1a1a', fontWeight: 800, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'opacity 0.15s', opacity: loading ? 0.7 : 1,
          }}>{loading ? 'Signing in...' : 'Sign In'}</button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text-muted)' }}>
          Default password: <code style={{ color: 'var(--gold)' }}>ascend2024</code><br />
          <span style={{ fontSize: 10 }}>Change via SITE_PASSWORD env var in Netlify</span>
        </div>
      </div>
    </div>
  );
}
