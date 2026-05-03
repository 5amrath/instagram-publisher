import { useState, useCallback, useEffect } from 'react';
import './App.css';
import PostComposer from './components/PostComposer';
import Dashboard from './components/Dashboard';
import PostHistory from './components/PostHistory';
import Settings from './components/Settings';

export default function App() {
  const [tab, setTab] = useState('upload');
  const [toasts, setToasts] = useState([]);

  // Bulk state lifted here so it persists across tab switches
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkCaption, setBulkCaption] = useState('');
  const [bulkProgress, setBulkProgress] = useState({ total: 0, done: 0, failed: 0, running: false });

  const showToast = useCallback((msg, type = 'info') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800);
  }, []);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'upload',    label: 'Upload', badge: bulkFiles.length || null },
    { id: 'history',   label: 'History' },
    { id: 'settings',  label: 'Settings' },
  ];

  return (
    <div className="app-layout">
      <nav className="navbar">
        <span className="nav-brand">Ascend Publisher</span>
        <div className="nav-links">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`nav-btn${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.badge ? <span className="nav-badge">{t.badge > 99 ? '99+' : t.badge}</span> : null}
            </button>
          ))}
        </div>
      </nav>

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
        {tab === 'history'  && <PostHistory showToast={showToast} />}
        {tab === 'settings' && <Settings showToast={showToast} />}
      </main>

      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' && '✓ '}
            {t.type === 'error'   && '✕ '}
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
