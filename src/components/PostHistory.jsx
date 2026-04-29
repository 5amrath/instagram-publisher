import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const STATUS = {
  pending: { label: 'Pending', cls: 'badge-yellow' },
  scheduled: { label: 'Processing', cls: 'badge-blue' },
  posted: { label: 'Posted', cls: 'badge-green' },
  failed: { label: 'Failed', cls: 'badge-red' },
};

const FILTERS = ['all', 'pending', 'posted', 'failed'];

function timeAgo(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  const now = new Date();
  const s = Math.floor((now - d) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function trunc(s, n) { return !s ? '(no caption)' : s.length > n ? s.slice(0, n) + '...' : s; }

export default function PostHistory({ showToast }) {
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      const p = filter !== 'all' ? `?status=${filter}&limit=100` : '?limit=100';
      const res = await axios.get(`/.netlify/functions/get-posts${p}`);
      setPosts(res.data.posts || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { setLoading(true); fetch_(); }, [fetch_]);

  const handleDelete = async (id) => {
    try {
      await axios.post('/.netlify/functions/delete-post', { id });
      setPosts((p) => p.filter((x) => x.id !== id));
      showToast('Removed', 'success');
    } catch (err) { showToast(err.response?.data?.error || 'Failed', 'error'); }
  };

  if (loading) return <div className="center-msg"><span className="spinner" /> Loading...</div>;

  return (
    <div className="history fade-in">
      <div className="page-header">
        <h2>History</h2>
        <div className="header-actions">
          <div className="filter-bar">
            {FILTERS.map((f) => (
              <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn-ghost" onClick={fetch_}>Refresh</button>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <h3>No posts</h3>
          <p>{filter !== 'all' ? `No ${filter} posts.` : 'Upload Reels to get started.'}</p>
        </div>
      ) : (
        <div className="post-list">
          {posts.map((post) => {
            const st = STATUS[post.status] || { label: post.status, cls: '' };
            const isVid = post.media_type === 'VIDEO' || post.media_type === 'REELS';
            const thumbSrc = post.thumbnail_url || post.media_url;
            return (
              <div key={post.id} className="post-row">
                <div className="post-thumb">
                  {thumbSrc ? <img src={thumbSrc} alt="" /> : <div className="thumb-placeholder" />}
                  {isVid && <span className="thumb-tag">REEL</span>}
                </div>
                <div className="post-body">
                  <p className="post-caption">{trunc(post.caption, 90)}</p>
                  <div className="post-meta">
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                    <span className="text-dim">{timeAgo(post.created_at)}</span>
                    {post.posted_at && <span className="text-dim">Posted {timeAgo(post.posted_at)}</span>}
                    {post.error_message && <span className="text-red text-sm" title={post.error_message}>Error</span>}
                  </div>
                </div>
                <div className="post-actions">
                  {(post.status === 'pending' || post.status === 'failed') && (
                    <button className="btn-ghost-sm" onClick={() => handleDelete(post.id)}>Remove</button>
                  )}
                  {post.ig_post_id && (
                    <a href={`https://www.instagram.com/p/${post.ig_post_id}/`} target="_blank" rel="noopener noreferrer" className="btn-ghost-sm">View</a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
