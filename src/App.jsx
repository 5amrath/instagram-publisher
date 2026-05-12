import { useState, useCallback, useEffect } from 'react';
import './App.css';
import PostComposer from './components/PostComposer';
import Dashboard from './components/Dashboard';
import PostHistory from './components/PostHistory';
import Settings from './components/Settings';
import ProductResearch from './components/ProductResearch';
import AITools from './components/AITools';
import DailyPlanner from './components/DailyPlanner';
import CreatorTracker from './components/CreatorTracker';
import TikTokStudio from './components/TikTokStudio';
import TikTokMirror from './components/TikTokMirror';
import Analytics from './components/Analytics';
import Login from './components/Login';

const NAV_SECTIONS = [
  { label: 'PUBLISH', items: [
    { id: 'dashboard', label: 'Dashboard', icon: '⚡' },
    { id: 'upload', label: 'Upload', icon: '↑' },
    { id: 'history', label: 'History', icon: '×' },
    { id: 'analytics', label: 'Analytics', icon: '📊', badge: 'NEW' },
  ]},
  { label: 'TIKTOK', items: [
    { id: 'tiktok', label: 'TikTok Studio', icon: '🎬', badge: 'HOT' },
    { id: 'tiktok-mirror', label: 'TikTok Mirror', icon: '🔄', badge: 'NEW' },
  ]},
  { label: 'RESEARCH', items: [
    { id: 'products', label: 'Products', icon: '🛒' },
    { id: 'creators', label: 'Creators', icon: '👥' },
  ]},
  { label: 'AI', items: [
    { id: 'aitools', label: 'AI Tools', icon: '✨' },
  ]},
  { label: 'ORGANIZE', items: [
    { id: 'planner', label: 'Planner', icon: '🗓️' },
  ]},
  { label: 'SYSTEM', items: [
    { id: 'settings', label: 'Settings', icon: '○' },
  ]},
];

function Toast({ toasts }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: t.type === 'success' ? 'rgba(109,200,120,0.95)' : t.type === 'error' ? 'rgba(255,80,80,0.95)' : 'rgba(240,180,41,0.95)',
          color: '#111', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          animation: 'fadeIn 0.2s ease',
        }}>{t.msg}</div>
      ))}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkCaption, setBulkCaption] = useState('');
  const [bulkProgress, setBulkProgress] = useState({ total: 0, done: 0, failed: 0, active: false });
  const [toasts, setToasts] = useState([]);
  const [authed, setAuthed] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const tok = localStorage.getItem('ascend_token');
    if (!tok) { setCheckingAuth(false); return; }
    fetch('/.netlify/functions/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', token: tok }),
    }).then(r => r.json()).then(d => {
      if (d.valid) setAuthed(true);
      else localStorage.removeItem('ascend_token');
    }).catch(() => {}).finally(() => setCheckingAuth(false));
  }, []);

  const showToast = useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('ascend_token');
    setAuthed(false);
  };

  if (checkingAuth) {
    return <div style={{ minHeight: '100vh', background: 'var(--charcoal-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading…</div>;
  }

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />;
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard showToast={showToast} />;
      case 'upload': return <PostComposer showToast={showToast} bulkFiles={bulkFiles} setBulkFiles={setBulkFiles} bulkCaption={bulkCaption} setBulkCaption={setBulkCaption} bulkProgress={bulkProgress} setBulkProgress={setBulkProgress} />;
      case 'history': return <PostHistory showToast={showToast} />;
      case 'analytics': return <Analytics />;
      case 'tiktok': return <TikTokStudio showToast={showToast} />;
      case 'tiktok-mirror': return <TikTokMirror showToast={showToast} />;
      case 'products': return <ProductResearch showToast={showToast} />;
      case 'creators': return <CreatorTracker showToast={showToast} />;
      case 'aitools': return <AITools showToast={showToast} />;
      case 'planner': return <DailyPlanner showToast={showToast} />;
      case 'settings': return <Settings showToast={showToast} />;
      default: return <Dashboard showToast={showToast} />;
    }
  };

  const uploadCount = bulkFiles.length;

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">A</div>
          <span className="logo-text">ASCEND</span>
        </div>
        <div className="nav-items">
          {NAV_SECTIONS.map(sec => (
            <div key={sec.label} className="nav-section">
              <div className="nav-section-label">{sec.label}</div>
              {sec.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  className={'nav-item' + (page === item.id ? ' active' : '')}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  {item.id === 'upload' && uploadCount > 0 && (
                    <span className="nav-badge">{uploadCount > 99 ? '99+' : uploadCount}</span>
                  )}
                  {item.badge && !(item.id === 'upload' && uploadCount > 0) && (
                    <span className="nav-badge" style={{ background: item.badge === 'HOT' ? '#ff5050' : undefined }}>{item.badge}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div style={{ padding: '0 12px 16px', marginTop: 'auto' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '8px 0', background: 'transparent', border: '1px solid var(--charcoal-4)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>🔒 Lock</button>
        </div>
        <div className="sidebar-footer">@ascend.deals</div>
      </nav>
      <main className="main-content">
        {renderPage()}
      </main>
      <Toast toasts={toasts} />
    </div>
  );
}
