import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const PAGE_SIZE = 25;

export default function PostHistory({ showToast }) {
  const [posts, setPosts]       = useState([]);
  const [filter, setFilter]     = useState('all');
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [retrying, setRetrying] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/.netlify/functions/get-posts');
      const data = res.data; setPosts(Array.isArray(data) ? data : (data?.posts || data?.data || []));
    } catch { showToast('Failed to load posts', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await axios.delete(`/.netlify/functions/delete-post?id=${id}`);
      setPosts(p => p.filter(x => x.id !== id));
      showToast('Removed from queue', 'success');
    } catch { showToast('Delete failed', 'error'); }
    finally { setDeleting(null); }
  };

  const handleRetry = async (id) => {
    setRetrying(id);
    try {
      await axios.post('/.netlify/functions/retry-failed', { id });
      await load();
      showToast('Reset to pending', 'success');
    } catch {
      // Fallback: update directly
      try {
        await axios.patch(`/.netlify/functions/update-post?id=${id}`, { status: 'pending' });
        await load();
        showToast('Reset to pending', 'success');
      } catch { showToast('Retry failed', 'error'); }
    }
    finally { setRetrying(null); }
  };

  const filtered = posts.filter(p => {
    const matchStatus = filter === 'all' || p.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || (p.caption || '').toLowerCase().includes(q) || (p.ig_post_id || '').includes(q);
    return matchStatus && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = {
    all: posts.length,
    posted: posts.filter(p => p.status === 'posted').length,
    pending: posts.filter(p => p.status === 'pending').length,
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    failed: posts.filter(p => p.status === 'failed').length,
  };

  const statusLabel = (s) => {
    if (s === 'posted')    return 'posted';
    if (s === 'pending')   return 'pending';
    if (s === 'scheduled') return 'scheduled';
    if (s === 'failed')    return 'failed';
    return s;
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <span className="page-title">History</span>
        <button className="btn-ghost" onClick={load}>↻ Refresh</button>
      </div>

      {/* Search + filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <input
            type="text"
            placeholder="Search captions…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ paddingLeft: '2rem', width: '100%' }}
          />
          <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--ash)', fontSize: '0.75rem', pointerEvents: 'none' }}>⌕</span>
        </div>
        <div className="pill-group">
          {['all', 'posted', 'pending', 'scheduled', 'failed'].map(f => (
            <button key={f} className={`pill ${filter === f ? 'active' : ''}`} onClick={() => { setFilter(f); setPage(1); }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span style={{ marginLeft: '4px', opacity: 0.55, fontSize: '0.62rem' }}>{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--ash)' }}>
          <span className="spinner" style={{ width: 20, height: 20 }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 9h6M9 13h6M9 17h3"/></svg>
          <div>{search || filter !== 'all' ? 'No posts match your filters' : 'No posts yet'}</div>
        </div>
      ) : (
        <>
          <div style={{ background: 'var(--charcoal-2)', borderRadius: '12px', border: '1px solid rgba(245,240,232,0.05)', overflow: 'hidden' }}>
            {paged.map((post, i) => (
              <div key={post.id}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 1.1rem', borderBottom: i < paged.length - 1 ? '1px solid rgba(245,240,232,0.04)' : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,240,232,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => setExpanded(expanded === post.id ? null : post.id)}
                >
                  {/* Thumbnail */}
                  {post.thumbnail_url
                    ? <img src={post.thumbnail_url} alt="" style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(245,240,232,0.06)' }} />
                    : <div style={{ width: 42, height: 42, borderRadius: 8, background: 'var(--charcoal-3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '1.1rem', opacity: 0.3 }}>▶</span>
                      </div>
                  }

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--cream)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {post.caption ? post.caption.substring(0, 70) + (post.caption.length > 70 ? '…' : '') : <span style={{ color: 'var(--ash)' }}>No caption</span>}
                    </div>
                    <div style={{ fontSize: '0.63rem', color: 'var(--ash)', marginTop: '0.2rem', display: 'flex', gap: '0.75rem' }}>
                      <span>{post.posted_at ? new Date(post.posted_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : post.scheduled_at ? `Scheduled ${new Date(post.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not scheduled'}</span>
                      {post.media_type && <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>{post.media_type === 'REELS' ? 'Reel' : post.media_type}</span>}
                    </div>
                  </div>

                  {/* Status + actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                    <span className={`status-badge ${statusLabel(post.status)}`}>{statusLabel(post.status)}</span>
                    {post.ig_post_id && (
                      <a href={`https://www.instagram.com/reel/${post.ig_post_id}/`} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ color: 'var(--ash)', fontSize: '0.72rem', textDecoration: 'none', background: 'rgba(245,240,232,0.05)', padding: '0.2rem 0.5rem', borderRadius: 6, border: '1px solid rgba(245,240,232,0.08)', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--cream)'; e.currentTarget.style.borderColor = 'rgba(245,240,232,0.18)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--ash)'; e.currentTarget.style.borderColor = 'rgba(245,240,232,0.08)'; }}
                      >↗ IG</a>
                    )}
                    {post.status === 'failed' && (
                      <button className="btn-ghost" style={{ fontSize: '0.68rem', color: 'var(--gold-light)' }}
                        onClick={e => { e.stopPropagation(); handleRetry(post.id); }} disabled={retrying === post.id}>
                        {retrying === post.id ? <span className="spinner" /> : '↺ Retry'}
                      </button>
                    )}
                    <button className="btn-ghost" style={{ fontSize: '0.72rem', color: 'var(--ash)', opacity: 0.6 }}
                      onClick={e => { e.stopPropagation(); handleDelete(post.id); }} disabled={deleting === post.id}>
                      {deleting === post.id ? <span className="spinner" /> : '✕'}
                    </button>
                  </div>
                </div>

                {/* Expanded caption */}
                {expanded === post.id && post.caption && (
                  <div style={{ padding: '0.75rem 1.1rem 0.9rem 5rem', background: 'rgba(245,240,232,0.015)', borderBottom: i < paged.length - 1 ? '1px solid rgba(245,240,232,0.04)' : 'none' }}>
                    <p style={{ fontSize: '0.76rem', color: 'var(--ghost)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{post.caption}</p>
                    {post.error_message && (
                      <p style={{ fontSize: '0.68rem', color: 'var(--red-lt)', marginTop: '0.5rem', background: 'rgba(192,57,43,0.08)', padding: '0.4rem 0.6rem', borderRadius: 6 }}>
                        Error: {post.error_message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button className="btn-secondary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.72rem' }} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>←</button>
              <span style={{ fontSize: '0.72rem', color: 'var(--ash)', minWidth: 80, textAlign: 'center' }}>Page {page} / {totalPages}</span>
              <button className="btn-secondary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.72rem' }} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>→</button>
            </div>
          )}

          <p style={{ fontSize: '0.62rem', color: 'var(--charcoal-4)', textAlign: 'center', marginTop: '1rem' }}>
            {filtered.length} post{filtered.length !== 1 ? 's' : ''} {filter !== 'all' ? `· filtered by ${filter}` : ''}
          </p>
        </>
      )}
    </div>
  );
}
