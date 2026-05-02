import { useState } from 'react';
import './App.css';
import PostComposer from './components/PostComposer';
import Dashboard from './components/Dashboard';
import PostHistory from './components/PostHistory';
import Settings from './components/Settings';

export default function App() {
  const [tab, setTab] = useState('upload');
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkProgress, setBulkProgress] = useState({ total: 0, done: 0, running: false });

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'upload', label: 'Upload', badge: bulkFiles.length || null },
    { id: 'history', label: 'History' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="app-shell">
      <nav className="nav">
        <div className="nav-brand">Insta Publisher</div>
        <div className="nav-links">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`nav-link ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.badge ? <span className="nav-badge">{t.badge}</span> : null}
            </button>
          ))}
        </div>
      </nav>

      <main className="main-content">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'upload' && (
          <PostComposer
            bulkFiles={bulkFiles}
            setBulkFiles={setBulkFiles}
            bulkProgress={bulkProgress}
            setBulkProgress={setBulkProgress}
          />
        )}
        {tab === 'history' && <PostHistory />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
