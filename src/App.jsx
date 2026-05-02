import React, { useState, useRef } from 'react';
import Dashboard from './components/Dashboard';
import PostComposer from './components/PostComposer';
import PostHistory from './components/PostHistory';
import Settings from './components/Settings';
import './App.css';

export default function App() {
  const [tab, setTab] = useState('upload');
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // ── Bulk state lifted here so it survives tab switches ──────────────────
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkCaption, setBulkCaption] = useState('');
  const [bulkProgress, setBulkProgress] = useState({ total: 0, done: 0, failed: 0, active: false });

  const showToast = (message, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="app">
      <nav className="nav">
        <span className="nav-logo">Insta Publisher</span>
        <div className="nav-tabs">
          {['dashboard', 'upload', 'history', 'settings'].map((t) => (
            <button
              key={t}
              className={`nav-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'upload' && bulkFiles.length > 0 && (
                <span className="nav-badge">{bulkFiles.length}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <main className="main">
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
        {tab === 'settings' && <Settings showToast={showToast} />}
      </main>

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <span className="toast-dot" />
          {toast.message}
        </div>
      )}
    </div>
  );
}
