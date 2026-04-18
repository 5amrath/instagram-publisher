import React from 'react';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function truncate(str, n) {
  if (!str) return '(no caption)';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

export default function PostHistory({ posts }) {
  if (posts.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <h2>No posts yet</h2>
        <p>Posts you publish or schedule will appear here.</p>
      </div>
    );
  }

  return (
    <div className="history">
      <div className="history-header">
        <h2>Published Posts</h2>
        <span className="history-count">{posts.length} post{posts.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="post-grid">
        {posts.map((post) => (
          <div key={post.id} className="post-card">
            <div className="post-media">
              {post.mediaType === 'VIDEO' ? (
                <video src={post.mediaPreview} className="post-thumb" muted />
              ) : (
                <img src={post.mediaPreview} alt="Post" className="post-thumb" />
              )}
              <span className="post-type-badge">{post.mediaType}</span>
              {post.scheduled && (
                <span className="scheduled-badge">Scheduled</span>
              )}
            </div>
            <div className="post-info">
              <p className="post-caption">{truncate(post.caption, 120)}</p>
              <div className="post-meta">
                <span className="post-date">
                  {post.scheduled
                    ? `Scheduled: ${formatDate(post.scheduled)}`
                    : `Published: ${formatDate(post.publishedAt)}`
                  }
                </span>
                {post.id && (
                  <a
                    href={`https://www.instagram.com/p/${post.id}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="post-link"
                  >
                    View on Instagram ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
