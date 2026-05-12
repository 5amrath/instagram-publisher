import { useState } from 'react';

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <div style={{ minHeight: '100vh', background: '#0C0C0C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 20px' }}>
        <div style={{ background: '#141414', border: '1px solid rgba(242,237,228,0.08)', borderRadius: 20, padding: '52px 44px 44px', boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg,#C9A84C,#E0BF6A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 20px', boxShadow: '0 8px 32px rgba(201,168,76,0.35)' }}>
              <span style={{ color: '#0C0C0C', fontWeight: 900, fontSize: 22 }}>A</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.3em', color: 'rgba(242,237,228,0.4)', textTransform: 'uppercase', marginBottom: 10 }}>ASCEND</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#F2EDE4', letterSpacing: '-0.03em', lineHeight: 1 }}>Publisher</div>
            <div style={{ fontSize: 12, color: '#5E5C58', marginTop: 8 }}>Private workspace</div>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', color: '#5E5C58', textTransform: 'uppercase', marginBottom: 8 }}>Password</div>
              <div style={{ position: 'relative' }}>
                <input
                  type={show ? 'text' : 'password'}
                  value={pw}
                  onChange={e => setPw(e.target.value)}
                  placeholder="Enter your password"
                  autoFocus
                  style={{ width: '100%', background: '#1C1C1C', border: error ? '1px solid #F87171' : '1px solid rgba(242,237,228,0.08)', borderRadius: 10, color: '#F2EDE4', padding: '13px 44px 13px 16px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.15s' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(201,168,76,0.5)'}
                  onBlur={e => e.target.style.borderColor = error ? '#F87171' : 'rgba(242,237,228,0.08)'}
                />
                <button type="button" onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#5E5C58', fontSize: 16, padding: 0, lineHeight: 1 }}>
                  {show ? '🙈' : '👁️'}
                </button>
              </div>
              {error && <div style={{ color: '#F87171', fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>⚠️ {error}</div>}
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px 0', background: loading ? '#5E5C58' : 'linear-gradient(135deg,#C9A84C,#E0BF6A)', border: 'none', borderRadius: 10, color: '#0C0C0C', fontWeight: 900, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', letterSpacing: '0.05em', transition: 'all 0.15s', boxShadow: loading ? 'none' : '0 4px 20px rgba(201,168,76,0.3)' }}>
              {loading ? 'Signing in\u2026' : 'Sign In'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 28, paddingTop: 24, borderTop: '1px solid rgba(242,237,228,0.06)' }}>
            <div style={{ fontSize: 11, color: '#3A3A3A', lineHeight: 1.6 }}>
              Secured access &mdash; owner only
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
