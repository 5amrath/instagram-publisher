import React, { useState } from 'react';
import PostComposer from './components/PostComposer';
import PostHistory from './components/PostHistory';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import './App.css';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'upload', label: 'Upload' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/>
              </svg>
            </div>
            <div className="logo-text">
              <div className="logo-name">Ascend Deals</div>
              <div className="logo-sub">Reels Publisher</div>
            </div>
          </div>
          <nav className="nav">
            {TABS.map((t) => (
              <button key={t.id} className={`nav-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="main">
        <div className="fade-in" key={tab}>
          {tab === 'dashboard' && <Dashboard showToast={showToast} />}
          {tab === 'upload' && <PostComposer showToast={showToast} />}
          {tab === 'history' && <PostHistory showToast={showToast} />}
          {tab === 'settings' && <Settings showToast={showToast} />}
        </div>
      </main>

      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
