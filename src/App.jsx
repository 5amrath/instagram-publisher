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

const NAV = [
  { section: 'PUBLISH', items: [
    { id: 'dashboard', label: 'Dashboard', icon: '⚡' },
    { id: 'upload',    label: 'Upload',    icon: '↑' },
    { id: 'history',   label: 'History',   icon: '⦻' },
    { id: 'analytics', label: 'Analytics', icon: '📊', badge: 'NEW' },
  ]},
  { section: 'TIKTOK', items: [
    { id: 'tiktok',        label: 'TikTok Studio', icon: '🎬', badge: 'HOT' },
    { id: 'tiktok-mirror', label: 'TT Mirror',     icon: '🔄', badge: 'NEW' },
  ]},
  { section: 'RESEARCH', items: [
    { id: 'products', label: 'Products', icon: '🛒' },
    { id: 'creators', label: 'Creators', icon: '👥' },
  ]},
  { section: 'AI', items: [
    { id: 'aitools', label: 'AI Tools', icon: '✨' },
  ]},
  { section: 'ORGANIZE', items: [
    { id: 'planner', label: 'Planner', icon: '🗓️' },
  ]},
  { section: 'SYSTEM', items: [
    { id: 'settings', label: 'Settings', icon: '○' },
  ]},
];

const PAGE_TITLES = {
  dashboard: 'Dashboard', upload: 'Upload', history: 'History', analytics: 'Analytics',
  tiktok: 'TikTok Studio', 'tiktok-mirror': 'TikTok Mirror', products: 'Product Research',
  creators: 'Creator Tracker', aitools: 'AI Tools', planner: 'Planner', settings: 'Settings',
};

function Toast({ toasts }) {
  return (
    <div className='toast-wrap'>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: '12px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
          background: t.type === 'success' ? 'rgba(52,211,153,0.95)' : t.type === 'error' ? 'rgba(248,113,113,0.95)' : 'rgba(201,168,76,0.95)',
          color: '#0A0A0A', boxShadow: '0 6px 24px rgba(0,0,0,0.5)', display:'flex', alignItems:'center', gap:8,
        }}>
          <span>{t.type==='success'?'✔️':t.type==='error'?'⚠️':'ℹ️'}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkCaption, setBulkCaption] = useState('');
  const [bulkProgress, setBulkProgress] = useState({ total:0, done:0, failed:0, active:false });
  const [toasts, setToasts] = useState([]);
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const tok = localStorage.getItem('ascend_token');
    if (!tok) { setChecking(false); return; }
    fetch('/.netlify/functions/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', token: tok }),
    }).then(r => r.json()).then(d => {
      if (d.valid) setAuthed(true); else localStorage.removeItem('ascend_token');
    }).catch(() => {}).finally(() => setChecking(false));
  }, []);

  const showToast = useCallback((msg, type='info') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  const logout = () => { localStorage.removeItem('ascend_token'); setAuthed(false); };

  if (checking) return (
    <div style={{ minHeight:'100vh', background:'#0A0A0A', display:'flex', alignItems:'center', justifyContent:'center', color:'#5A5855', fontFamily:'Inter,sans-serif', letterSpacing:'0.1em', fontSize:13 }}>
      LOADING…
    </div>
  );
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  const renderPage = () => {
    switch (page) {
      case 'dashboard':     return <Dashboard showToast={showToast} />;
      case 'upload':        return <PostComposer showToast={showToast} bulkFiles={bulkFiles} setBulkFiles={setBulkFiles} bulkCaption={bulkCaption} setBulkCaption={setBulkCaption} bulkProgress={bulkProgress} setBulkProgress={setBulkProgress} />;
      case 'history':       return <PostHistory showToast={showToast} />;
      case 'analytics':     return <Analytics />;
      case 'tiktok':        return <TikTokStudio showToast={showToast} />;
      case 'tiktok-mirror': return <TikTokMirror showToast={showToast} />;
      case 'products':      return <ProductResearch showToast={showToast} />;
      case 'creators':      return <CreatorTracker showToast={showToast} />;
      case 'aitools':       return <AITools showToast={showToast} />;
      case 'planner':       return <DailyPlanner showToast={showToast} />;
      case 'settings':      return <Settings showToast={showToast} />;
      default:              return <Dashboard showToast={showToast} />;
    }
  };

  return (
    <div className='app-layout'>
      {/* SIDEBAR */}
      <nav className='sidebar'>
        <div className='sidebar-logo'>
          <div className='logo-mark'>A</div>
          <span className='logo-text'>ASCEND</span>
        </div>
        <div className='nav-items'>
          {NAV.map(sec => (
            <div key={sec.section} className='nav-section'>
              <div className='nav-section-label'>{sec.section}</div>
              {sec.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  className={'nav-item' + (page === item.id ? ' active' : '')}
                >
                  <span className='nav-icon'>{item.icon}</span>
                  <span className='nav-label'>{item.label}</span>
                  {item.id === 'upload' && bulkFiles.length > 0 ? (
                    <span className='nav-badge'>{bulkFiles.length > 99 ? '99+' : bulkFiles.length}</span>
                  ) : item.badge ? (
                    <span className='nav-badge' style={item.badge === 'HOT' ? { background: '#F87171', color: '#fff' } : {}}>{item.badge}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ))}
        </div>
        <button onClick={logout} style={{ margin:'0 12px 8px', padding:'9px 12px', background:'transparent', border:'1px solid rgba(240,235,225,0.07)', borderRadius:9, color:'#5A5855', fontSize:12, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:8, width:'calc(100% - 24px)' }}>
          <span>🔒</span> Lock
        </button>
        <div className='sidebar-footer'>@ascend.deals</div>
      </nav>
      {/* MAIN */}
      <main className='main-content'>
        <div style={{ padding:'32px 36px 56px' }}>
          {renderPage()}
        </div>
      </main>
      <Toast toasts={toasts} />
    </div>
  );
}
