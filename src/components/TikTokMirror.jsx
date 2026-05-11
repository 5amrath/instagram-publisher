import { useState, useEffect } from 'react';

const s = {
  card: { background: 'var(--charcoal-2)', borderRadius: 14, padding: 20, marginBottom: 16 },
  label: { fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 6, fontWeight: 600 },
  input: { width: '100%', background: 'var(--charcoal-3)', border: '1px solid var(--charcoal-5)', borderRadius: 8, color: 'var(--creme)', padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' },
  btn: (col) => ({ padding: '10px 20px', borderRadius: 8, border: 'none', background: col, color: col === 'var(--gold)' ? '#1a1a1a' : 'var(--creme)', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }),
  pill: (c) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: c === 'posted' ? 'rgba(100,200,100,0.15)' : c === 'pending' ? 'rgba(255,200,80,0.15)' : 'rgba(120,120,120,0.15)', color: c === 'posted' ? '#6dc878' : c === 'pending' ? '#f0b429' : 'var(--text-muted)' }),
};

export default function TikTokMirror({ showToast }) {
  const [accounts, setAccounts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState({ total: 0, mirrored: 0, pending: 0 });
  const [username, setUsername] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mirrorAll, setMirrorAll] = useState(false);
  const [tab, setTab] = useState('posts');
  const [manualUrl, setManualUrl] = useState('');
  const [manualCaption, setManualCaption] = useState('');
  const [manualThumb, setManualThumb] = useState('');
  const [addingManual, setAddingManual] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [statsR, postsR, accsR] = await Promise.all([
        fetch('/.netlify/functions/tiktok-api?action=stats').then(r => r.json()),
        fetch('/.netlify/functions/tiktok-api?action=posts').then(r => r.json()),
        fetch('/.netlify/functions/tiktok-api?action=accounts').then(r => r.json()),
      ]);
      setStats(statsR);
      setPosts(postsR.posts || []);
      setAccounts(accsR.accounts || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const connectAccount = async () => {
    if (!username.trim()) { showToast('Enter a TikTok username', 'error'); return; }
    setConnecting(true);
    try {
      const res = await fetch('/.netlify/functions/tiktok-api', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect', username: username.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast('@' + username.trim() + ' connected!', 'success');
      setUsername(''); load();
    } catch (e) { showToast(e.message, 'error'); }
    setConnecting(false);
  };

  const disconnectAccount = async (u) => {
    await fetch('/.netlify/functions/tiktok-api', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disconnect', username: u }),
    });
    showToast('Disconnected', 'success'); load();
  };

  const mirrorPost = async (id) => {
    const res = await fetch('/.netlify/functions/tiktok-api', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mirror', postId: id }),
    });
    const data = await res.json();
    if (data.error) { showToast(data.error, 'error'); return; }
    showToast('Queued to Instagram!', 'success'); load();
  };

  const mirrorAllPosts = async () => {
    setMirrorAll(true);
    const res = await fetch('/.netlify/functions/tiktok-api', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mirror-all' }),
    });
    const data = await res.json();
    if (data.error) { showToast(data.error, 'error'); }
    else showToast(data.queued + ' posts queued to Instagram!', 'success');
    setMirrorAll(false); load();
  };

  const addManualPost = async () => {
    if (!manualUrl.trim()) { showToast('Enter a video URL', 'error'); return; }
    setAddingManual(true);
    try {
      const res = await fetch('/.netlify/functions/tiktok-api', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-post', tiktokId: 'manual_' + Date.now(), author: accounts[0]?.username || 'manual', caption: manualCaption, videoUrl: manualUrl.trim(), thumbnailUrl: manualThumb.trim() || null }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast('Post saved!', 'success');
      setManualUrl(''); setManualCaption(''); setManualThumb(''); setShowManual(false); load();
    } catch (e) { showToast(e.message, 'error'); }
    setAddingManual(false);
  };

  const toggleAutoMirror = async (username, enabled) => {
    await fetch('/.netlify/functions/tiktok-api', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle-auto-mirror', username, enabled }),
    });
    load();
  };

  return (
    <div className="fade-in" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div className="page-title">TikTok → Instagram Mirror</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Auto-mirror your TikTok posts to Instagram Reels</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'TOTAL POSTS', value: stats.total, color: 'var(--creme)' },
          { label: 'MIRRORED', value: stats.mirrored, color: '#6dc878' },
          { label: 'PENDING MIRROR', value: stats.pending, color: '#f0b429' },
        ].map(({ label, value, color }) => (
          <div key={label} style={s.card}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Connect Account */}
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--creme)', fontSize: 15 }}>📱 Connect TikTok Account</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Add your TikTok username to track & mirror posts</div>
          </div>
          {stats.pending > 0 && (
            <button onClick={mirrorAllPosts} disabled={mirrorAll} style={s.btn('var(--gold)')}>
              {mirrorAll ? 'Queuing...' : '⚡ Mirror All ' + stats.pending + ' Pending'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={s.label}>TIKTOK USERNAME</div>
            <input style={s.input} value={username} onChange={e => setUsername(e.target.value)} placeholder="@yourhandle" onKeyDown={e => e.key === 'Enter' && connectAccount()} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button onClick={connectAccount} disabled={connecting} style={s.btn('var(--gold)')}>{connecting ? 'Connecting...' : 'Connect'}</button>
          </div>
        </div>
        {accounts.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {accounts.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--charcoal-4)' }}>
                <div>
                  <span style={{ color: 'var(--creme)', fontWeight: 600 }}>@{a.username}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 10 }}>Connected {new Date(a.connected_at).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
                    <input type="checkbox" checked={a.auto_mirror} onChange={e => toggleAutoMirror(a.username, e.target.checked)} />
                    Auto-mirror
                  </label>
                  <button onClick={() => disconnectAccount(a.username)} style={{ ...s.btn('var(--charcoal-4)'), padding: '6px 12px', fontSize: 12 }}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: 'var(--charcoal-3)', borderRadius: 9, padding: 3, width: 'fit-content' }}>
        {['posts', 'add manual'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: tab === t ? 'var(--charcoal-1)' : 'transparent', color: tab === t ? 'var(--creme)' : 'var(--text-muted)', transition: 'all 0.13s' }}>
            {t === 'posts' ? '📱 TikTok Posts' : '+ Add Video URL'}
          </button>
        ))}
      </div>

      {tab === 'add manual' && (
        <div style={s.card}>
          <div style={{ fontWeight: 700, color: 'var(--creme)', marginBottom: 14 }}>Add Video by URL</div>
          <div style={{ marginBottom: 10 }}><div style={s.label}>VIDEO URL (Cloudinary, direct MP4, etc)</div><input style={s.input} value={manualUrl} onChange={e => setManualUrl(e.target.value)} placeholder="https://..." /></div>
          <div style={{ marginBottom: 10 }}><div style={s.label}>THUMBNAIL URL (optional)</div><input style={s.input} value={manualThumb} onChange={e => setManualThumb(e.target.value)} placeholder="https://..." /></div>
          <div style={{ marginBottom: 14 }}><div style={s.label}>CAPTION</div><textarea style={{ ...s.input, minHeight: 70, resize: 'vertical' }} value={manualCaption} onChange={e => setManualCaption(e.target.value)} placeholder="Leave blank for AI caption..." /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={addManualPost} disabled={addingManual} style={s.btn('var(--gold)')}>{addingManual ? 'Saving...' : 'Save & Queue to Instagram'}</button>
          </div>
        </div>
      )}

      {tab === 'posts' && (
        <div>
          {loading && <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Loading posts...</div>}
          {!loading && posts.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 32 }}>📱</div>
              <div style={{ color: 'var(--creme)', fontWeight: 700, marginTop: 10 }}>No TikTok posts yet</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>Connect your TikTok account above, then add posts via the Add Video URL tab or use the auto-sync feature.</div>
            </div>
          )}
          {posts.map(p => (
            <div key={p.id} style={{ ...s.card, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              {p.thumbnail_url ? (
                <img src={p.thumbnail_url} alt="thumb" style={{ width: 60, height: 80, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} onError={e => { e.target.style.display = 'none'; }} />
              ) : (
                <div style={{ width: 60, height: 80, background: 'var(--charcoal-4)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🎥</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>@{p.author}</span>
                    <div style={{ color: 'var(--creme)', fontSize: 13, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.caption || '(no caption)'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <span style={s.pill(p.mirrored_to_instagram ? 'posted' : 'pending')}>{p.mirrored_to_instagram ? '✓ Mirrored' : 'Pending'}</span>
                    {!p.mirrored_to_instagram && (
                      <button onClick={() => mirrorPost(p.id)} style={{ ...s.btn('var(--gold)'), padding: '5px 12px', fontSize: 12 }}>→ Mirror</button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{new Date(p.created_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
