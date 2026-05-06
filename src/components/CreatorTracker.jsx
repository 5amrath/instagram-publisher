import { useState, useEffect, useCallback } from 'react';

const API = (path, opts) => fetch(`/.netlify/functions/${path}`, opts).then(r => r.json());

const fmt = n => {
    if (!n) return '0';
    if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n/1000).toFixed(1) + 'K';
    return n.toString();
};

export default function CreatorTracker({ showToast }) {
    const [creators, setCreators] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [platform, setPlatform] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [selected, setSelected] = useState(null);
    const [aiResult, setAiResult] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [form, setForm] = useState({ username: '', platform: 'tiktok', followers: '', avg_views: '', engagement_rate: '', niche: '', profile_url: '', notes: '' });

  const load = useCallback(async () => {
        setLoading(true);
        const p = new URLSearchParams({ limit: 50 });
        if (search) p.set('search', search);
        if (platform) p.set('platform', platform);
        const data = await API(`creators-api?${p}`);
        setCreators(data.creators || []);
        setTotal(data.total || 0);
        setLoading(false);
  }, [search, platform]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
        if (!form.username.trim()) return showToast('Username required', 'error');
        const data = await API('creators-api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
        if (data.success) { showToast('Creator added!', 'success'); setShowAdd(false); setForm({ username: '', platform: 'tiktok', followers: '', avg_views: '', engagement_rate: '', niche: '', profile_url: '', notes: '' }); load(); }
        else showToast(data.error || 'Error', 'error');
  };

  const handleDelete = async (id) => {
        await API(`creators-api?id=${id}`, { method: 'DELETE' });
        setCreators(cs => cs.filter(c => c.id !== id));
        if (selected?.id === id) setSelected(null);
        showToast('Removed', 'success');
  };

  const analyzeCreator = async (creator) => {
        setAiLoading(true);
        const data = await API('ai-tools', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'trend_prediction', input: `Creator: @${creator.username} | Niche: ${creator.niche} | Followers: ${fmt(creator.followers)} | Avg Views: ${fmt(creator.avg_views)} | Engagement: ${creator.engagement_rate}%` }) });
        setAiResult(data.result || data.error);
        setAiLoading(false);
  };

  const engColor = r => r >= 5 ? '#22C55E' : r >= 2 ? '#C9A84C' : '#888';

  return (
        <div className="page-container">
              <div className="page-header">
                      <div>
                                <h1 className="page-title">Creator Tracker</h1>h1>
                                <p className="page-subtitle">{total} creators tracked</p>p>
                      </div>div>
                      <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Creator</button>button>
              </div>div>
        
              <div className="filter-bar">
                      <input className="search-input" placeholder="Search creators..." value={search} onChange={e => setSearch(e.target.value)} />
                      <div className="filter-pills">
                        {['', 'tiktok', 'instagram', 'youtube'].map(p => (
                      <button key={p} className={`pill ${platform === p ? 'active' : ''}`} onClick={() => setPlatform(p)}>{p || 'All Platforms'}</button>button>
                    ))}
                      </div>div>
              </div>div>
        
          {loading ? <div className="loading-state">Loading creators...</div>div> : creators.length === 0 ? (
                <div className="empty-state">
                          <div className="empty-icon">👤</div>div>
                          <div className="empty-title">No creators yet</div>div>
                          <div className="empty-sub">Track competitor and collaborator accounts</div>div>
                          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Creator</button>button>
                </div>div>
              ) : (
                <div className="table-wrap">
                          <table className="data-table">
                                      <thead><tr><th>Username</th>th><th>Platform</th>th><th>Followers</th>th><th>Avg Views</th>th><th>Engagement</th>th><th>Niche</th>th><th>Actions</th>th></tr>tr></thead>thead>
                                      <tbody>
                                        {creators.map(c => (
                          <tr key={c.id} className="table-row-clickable" onClick={() => { setSelected(c); setAiResult(''); }}>
                                            <td>
                                                                <div style={{ fontWeight: 600 }}>@{c.username}</div>div>
                                              {c.profile_url && <a href={c.profile_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--gold)' }} onClick={e => e.stopPropagation()}>↗ Profile</a>a>}
                                            </td>td>
                                            <td><span className="status-pill">{c.platform}</span>span></td>td>
                                            <td style={{ fontWeight: 600 }}>{fmt(c.followers)}</td>td>
                                            <td>{fmt(c.avg_views)}</td>td>
                                            <td style={{ color: engColor(c.engagement_rate), fontWeight: 600 }}>{c.engagement_rate}%</td>td>
                                            <td>{c.niche || '—'}</td>td>
                                            <td>
                                                                <div style={{ display: 'flex', gap: 6 }}>
                                                                                      <button className="btn-sm" onClick={e => { e.stopPropagation(); setSelected(c); analyzeCreator(c); }}>🤖</button>button>
                                                                                      <button className="btn-sm btn-danger" onClick={e => { e.stopPropagation(); handleDelete(c.id); }}>×</button>button>
                                                                </div>div>
                                            </td>td>
                          </tr>tr>
                        ))}
                                      </tbody>tbody>
                          </table>table>
                </div>div>
              )}
        
          {/* Side Panel */}
          {selected && (
                  <div className="side-panel">
                            <div className="side-panel-header">
                                        <h3>@{selected.username}</h3>h3>
                                        <button className="icon-btn" onClick={() => { setSelected(null); setAiResult(''); }}>×</button>button>
                            </div>div>
                            <div className="side-panel-body">
                                        <div className="detail-stats-grid">
                                                      <div className="detail-stat"><div className="detail-val">{fmt(selected.followers)}</div>div><div className="detail-label">Followers</div>div></div>div>
                                                      <div className="detail-stat"><div className="detail-val">{fmt(selected.avg_views)}</div>div><div className="detail-label">Avg Views</div>div></div>div>
                                                      <div className="detail-stat"><div className="detail-val" style={{ color: engColor(selected.engagement_rate) }}>{selected.engagement_rate}%</div>div><div className="detail-label">Engagement</div>div></div>div>
                                                      <div className="detail-stat"><div className="detail-val">{selected.platform}</div>div><div className="detail-label">Platform</div>div></div>div>
                                        </div>div>
                              {selected.niche && <p style={{ color: 'var(--text-muted)', margin: '8px 0' }}>Niche: {selected.niche}</p>p>}
                              {selected.notes && <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '8px 0' }}>{selected.notes}</p>p>}
                                        <button className="btn-primary" style={{ width: '100%', margin: '12px 0' }} onClick={() => analyzeCreator(selected)} disabled={aiLoading}>{aiLoading ? '🤖 Analyzing...' : '🤖 Analyze Creator'}</button>button>
                              {aiResult && <div className="ai-output"><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6 }}>{aiResult}</pre>pre></div>div>}
                            </div>div>
                  </div>div>
              )}
        
          {/* Add Modal */}
          {showAdd && (
                  <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                            <div className="modal" onClick={e => e.stopPropagation()}>
                                        <div className="modal-header"><h3>Add Creator</h3>h3><button className="icon-btn" onClick={() => setShowAdd(false)}>×</button>button></div>div>
                                        <div className="modal-body">
                                                      <div className="form-grid">
                                                                      <div className="form-group"><label>Username *</label>label><input value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))} placeholder="@username" /></div>div>
                                                                      <div className="form-group"><label>Platform</label>label><select value={form.platform} onChange={e => setForm(f => ({...f, platform: e.target.value}))}><option value="tiktok">TikTok</option>option><option value="instagram">Instagram</option>option><option value="youtube">YouTube</option>option></select>select></div>div>
                                                                      <div className="form-group"><label>Followers</label>label><input type="number" value={form.followers} onChange={e => setForm(f => ({...f, followers: e.target.value}))} /></div>div>
                                                                      <div className="form-group"><label>Avg Views</label>label><input type="number" value={form.avg_views} onChange={e => setForm(f => ({...f, avg_views: e.target.value}))} /></div>div>
                                                                      <div className="form-group"><label>Engagement Rate (%)</label>label><input type="number" step="0.1" value={form.engagement_rate} onChange={e => setForm(f => ({...f, engagement_rate: e.target.value}))} /></div>div>
                                                                      <div className="form-group"><label>Niche</label>label><input value={form.niche} onChange={e => setForm(f => ({...f, niche: e.target.value}))} placeholder="e.g. Beauty, Fashion..." /></div>div>
                                                                      <div className="form-group"><label>Profile URL</label>label><input value={form.profile_url} onChange={e => setForm(f => ({...f, profile_url: e.target.value}))} placeholder="https://..." /></div>div>
                                                      </div>div>
                                                      <div className="form-group"><label>Notes</label>label><textarea rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} /></div>div>
                                        </div>div>
                                        <div className="modal-footer"><button className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>button><button className="btn-primary" onClick={handleAdd}>Add Creator</button>button></div>div>
                            </div>div>
                  </div>div>
              )}
        </div>div>
      );
}</div>
