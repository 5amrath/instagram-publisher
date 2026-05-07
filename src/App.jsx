import { useState, useCallback } from 'react';
import './App.css';
import PostComposer from './components/PostComposer';
import Dashboard from './components/Dashboard';
import PostHistory from './components/PostHistory';
import Settings from './components/Settings';
import ProductResearch from './components/ProductResearch';
import AITools from './components/AITools';
import DailyPlanner from './components/DailyPlanner';
import CreatorTracker from './components/CreatorTracker';

const NAV_SECTIONS = [
  { label: 'PUBLISH', items: [
    { id: 'dashboard', label: 'Dashboard', icon: '⚡' },
    { id: 'upload', label: 'Upload', icon: '↑' },
    { id: 'history', label: 'History', icon: '⧖' },
  ]},
  { label: 'RESEARCH', items: [
    { id: 'products', label: 'Products', icon: '📦' },
    { id: 'creators', label: 'Creators', icon: '👥' },
  ]},
  { label: 'AI', items: [
    { id: 'ai', label: 'AI Tools', icon: '✨' },
  ]},
  { label: 'ORGANIZE', items: [
    { id: 'planner', label: 'Planner', icon: '📅' },
  ]},
  { label: 'SYSTEM', items: [
    { id: 'settings', label: 'Settings', icon: '⚙' },
  ]},
];

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [toasts, setToasts] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkCaption, setBulkCaption] = useState('');
  const [bulkProgress, setBulkProgress] = useState({ total: 0, done: 0, failed: 0, running: false });

  const showToast = useCallback((msg, type = 'info') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800);
  }, []);

  const currentLabel = NAV_SECTIONS.flatMap(s => s.items).find(i => i.id === tab)?.label || '';

  return (
    <div className={'app-shell ' + (sidebarOpen ? 'sidebar-open' : 'sidebar-closed')}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-logo">A</span>
          {sidebarOpen && <span className="brand-name">ASCEND</span>}
        </div>
        <nav className="sidebar-nav">
          {NAV_SECTIONS.map(section => (
            <div key={section.label} className="nav-section">
              {sidebarOpen && <div className="nav-section-label">{section.label}</div>}
              {section.items.map(item => (
                <button
                  key={item.id}
                  className={'sidebar-link ' + (tab === item.id ? 'active' : '')}
                  onClick={() => setTab(item.id)}
                  title={!sidebarOpen ? item.label : ''}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {sidebarOpen && <span className="nav-label">{item.label}</span>}
                  {item.id === 'upload' && bulkFiles.length > 0 && (
                    <span className="nav-badge">{bulkFiles.length > 99 ? '99+' : bulkFiles.length}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>
          {sidebarOpen ? '←' : '→'}
        </button>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-page">{currentLabel}</span>
          </div>
          <div className="topbar-right">
            <span className="topbar-account">@ascend.deals</span>
          </div>
        </header>
        <main className="page-content">
          {tab === 'dashboard' && <Dashboard showToast={showToast} />}
          {tab === 'upload' && (
            <PostComposer
              showToast={showToast}
              bulkFiles={bulkFiles}
              setBulkFiles={setBulkFiles}
              bulkCaption={bulkCaption}
              setBulkCaption={setBulkCaption}
              bulkProgress={bulkProgress}
              setBulkProgress={setBulkProgress}
            />
          )}
          {tab === 'history' && <PostHistory showToast={showToast} />}
          {tab === 'products' && <ProductResearch showToast={showToast} />}
          {tab === 'creators' && <CreatorTracker showToast={showToast} />}
          {tab === 'ai' && <AITools showToast={showToast} />}
          {tab === 'planner' && <DailyPlanner showToast={showToast} />}
          {tab === 'settings' && <Settings showToast={showToast} />}
        </main>
      </div>

      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={'toast ' + t.type}>
            {t.type === 'success' && <span style={{ color: 'var(--emerald-lt)' }}>✓</span>}
            {t.type === 'error' && <span style={{ color: 'var(--red-lt)' }}>✕</span>}
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
