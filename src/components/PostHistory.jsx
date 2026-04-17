import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function truncate(str, n) {
  if (!str) return '(no caption)';
  return str.length > n ? str.slice(0, n) + '...' : str;
}

const STATUS_MAP = {
  pending: { label: 'Pending', className: 'status-pending' },
  scheduled: { label: 'Processing', className: 'status-scheduled' },
  posted: { label: 'Posted', className: 'status-posted' },
  failed: { label: 'Failed', className: 'status-failed' },
};

const FILTERS = ['all', 'pending', 'posted', 'failed'];

export default function PostHistory({ showToast }) {
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const fetchPosts = useCallback(async () => {
    try {
      const params = filter !== 'all' ? `?status=${filter}&limit=100` : '?limit=100';
      const res = await axios.get(`/api/get-posts${params}`);
      setPosts(res.data.posts || []);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchPosts();
  }, [fetchPosts]);

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await axios.post('/api/delete-post', { id });
      setPosts(prev => prev.filter(p => p.id !== id));
      showToast('Post removed from queue', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete', 'error');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <span className="spinner" /> Loading posts...
      </div>
    );
  }

  return (
    <div className="history">
      <div className="history-header">
        <h2>Post History</h2>
        <div className="history-controls">
          <div className="filter-group">
            {FILTERS.map(f => (
              <button
                key={f}
                className={`filter-btn ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button className="refresh-btn" onClick={fetchPosts}>Refresh</button>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <h2>No posts found</h2>
          <p>{filter !== 'all' ? `No ${filter} posts.` : 'Upload content to get started.'}</p>
        </div>
      ) : (
        <div className="post-table-wrap">
          <table className="post-table">
            <thead>
              <tr>
                <th>Preview</th>
                <th>Caption</th>
                <th>Status</th>
                <th>Created</th>
                <th>Posted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {posts.map(post => {
                const statusInfo = STATUS_MAP[post.status] || { label: post.status, className: '' };
                return (
                  <tr key={post.id}>
                    <td>
                      <div className="table-thumb-wrap">
                        <img src={post.media_url} alt="" className="table-thumb" />
                      </div>
                    </td>
                    <td className="table-caption">{truncate(post.caption, 80)}</td>
                    <td>
                      <span className={`status-badge ${statusInfo.className}`}>{statusInfo.label}</span>
                      {post.error_message && (
                        <span className="error-tooltip" title={post.error_message}>?</span>
                      )}
                    </td>
                    <td className="table-date">{formatDate(post.created_at)}</td>
                    <td className="table-date">{formatDate(post.posted_at)}</td>
                    <td>
                      {(post.status === 'pending' || post.status === 'failed') && (
                        <button
                          className="delete-btn"
                          onClick={() => handleDelete(post.id)}
                          disabled={deleting === post.id}
                        >
                          {deleting === post.id ? '...' : 'Remove'}
                        </button>
                      )}
                      {post.ig_post_id && (
                        <a
                          href={`https://www.instagram.com/p/${post.ig_post_id}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="view-link"
                        >
                          View
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
