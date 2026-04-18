import React, { useState } from 'react';
import PostComposer from './components/PostComposer';
import PostHistory from './components/PostHistory';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('compose');
  const [publishedPosts, setPublishedPosts] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const onPostPublished = (post) => {
    setPublishedPosts(prev => [post, ...prev]);
    showToast('Post published to @ascend.deals!', 'success');
    setActiveTab('history');
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/>
              </svg>
            </div>
            <div>
              <div className="brand-name">Ascend Deals</div>
              <div className="brand-handle">@ascend.deals Publisher</div>
            </div>
          </div>
          <nav className="tab-nav">
            <button
              className={`tab-btn ${activeTab === 'compose' ? 'active' : ''}`}
              onClick={() => setActiveTab('compose')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              New Post
            </button>
            <button
              className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              History
              {publishedPosts.length > 0 && (
                <span className="badge">{publishedPosts.length}</span>
              )}
            </button>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'compose' && (
          <PostComposer onPostPublished={onPostPublished} showToast={showToast} />
        )}
        {activeTab === 'history' && (
          <PostHistory posts={publishedPosts} />
        )}
      </main>

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <span className="toast-icon">
            {toast.type === 'success' ? '✓' : '✕'}
          </span>
          {toast.message}
        </div>
      )}
    </div>
  );
}
