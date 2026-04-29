import React, { useState, useCallback } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import PostComposer from './components/PostComposer';
import PostHistory from './components/PostHistory';
import Settings from './components/Settings';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'upload', label: 'Upload' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <div className="app">
      <nav className="nav">
        <span className="nav-logo">Insta Publisher</span>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`nav-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="main">
        {tab === 'dashboard' && <Dashboard showToast={showToast} />}
        {tab === 'upload' && <PostComposer showToast={showToast} />}
        {tab === 'history' && <PostHistory showToast={showToast} />}
        {tab === 'settings' && <Settings showToast={showToast} />}
      </main>

      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span className="toast-dot" />
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
