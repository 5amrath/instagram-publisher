import { useState, useEffect, useCallback } from 'react';

const API = (path, opts) => fetch('/.netlify/functions/' + path, opts).then(r => r.json());
const fmt = n => { if (!n && n !== 0) return '\u2014'; if (n >= 1000000) return (n/1000000).toFixed(1)+'M'; if (n >= 1000) return (n/1000).toFixed(1)+'K'; return String(n); };
const fmtMoney = n => n ? '$'+Number(n).toLocaleString() : '\u2014';
const CATEGORIES = ['All','Beauty','Fashion','Health','Electronics','Home','Fitness','Food','Pet','Kids','Other'];
const STATUSES = ['tracking','hot','cold','testing','winning'];

export default function ProductResearch({ showToast }) {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState('grid');
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const emptyForm = { name:'', url:'', category:'Beauty', price:'', estimated_sales:'', revenue_estimate:'', views_7d:'', likes_7d:'', engagement_rate:'', growth_velocity:'', ad_saturation:'', creator_count:'', trending_score:'', platform:'tiktok', thumbnail_url:'', notes:'' };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ limit: 50 });
    if (search) p.set('search', search);
    if (category && category !== 'All') p.set('category', category);
    if (status) p.set('status', status);
    const data = await API('products-api?' + p.toString());
    setProducts(data.products || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [search, category, status]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.name) return showToast('Product name required', 'error');
    const data = await API('products-api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (data.success) { showToast('Product added!', 'success'); setShowAdd(false); setForm(emptyForm); load(); }
    else showToast(data.error || 'Error', 'error');
  };

  const handleDelete = async (id) => {
    const data = await API('products-api?id=' + id, { method: 'DELETE' });
    if (data.success) { showToast('Removed', 'success'); load(); if (selected?.id === id) setSelected(null); }
  };

  const handleAnalyze = async (product) => {
    setAiLoading(true);
    setSelected(product);
    const inp = product.name + ' | Price: $' + product.price + ' | Category: ' + product.category + ' | Views: ' + fmt(product.views_7d) + ' | Engagement: ' + product.engagement_rate + '%';
    const data = await API('ai-tools', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'product_analysis', input: inp }) });
    setAiResult(data.result || data.error || 'No result');
    setAiLoading(false);
  };

  const statusColor = s => ({ tracking:'#4A9EFF', hot:'#FF4444', cold:'#888', testing:'#C9A84C', winning:'#22C55E' }[s] || '#888');
  const scoreColor = s => s >= 7 ? '#22C55E' : s >= 4 ? '#C9A84C' : '#FF4444';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Product Research</h1>
          <p className="page-subtitle">{total} products tracked &middot; TikTok Shop intelligence</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Product</button>
      </div>
      <div className="filter-bar">
        <input className="search-input" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="filter-pills">
          {CATEGORIES.map(c => (
            <button key={c} className={'pill' + (category === (c === 'All' ? '' : c) ? ' active' : '')} onClick={() => setCategory(c === 'All' ? '' : c)}>{c}</button>
          ))}
        </div>
        <div className="filter-pills">
          {['', ...STATUSES].map(s => (
            <button key={s} className={'pill' + (status === s ? ' active' : '')} onClick={() => setStatus(s)}>{s || 'All Status'}</button>
          ))}
        </div>
        <div className="view-toggle">
          <button className={'icon-btn' + (view === 'grid' ? ' active' : '')} onClick={() => setView('grid')}>⊞</button>
          <button className={'icon-btn' + (view === 'table' ? ' active' : '')} onClick={() => setView('table')}>☰</button>
        </div>
      </div>
      {loading ? <div className="loading-state">Loading products...</div> : products.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <div className="empty-title">No products yet</div>
          <div className="empty-sub">Add your first TikTok Shop product to start tracking</div>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Product</button>
        </div>
      ) : view === 'grid' ? (
        <div className="product-grid">
          {products.map(p => (
            <div key={p.id} className="product-card" onClick={() => setSelected(p)}>
              <div className="product-card-top">
                {p.thumbnail_url ? <img src={p.thumbnail_url} alt={p.name} className="product-thumb" /> : <div className="product-thumb-placeholder">📦</div>}
                <div className="product-meta">
                  <span className="product-category">{p.category}</span>
                  <span className="status-pill" style={{ background: statusColor(p.status)+'22', color: statusColor(p.status) }}>{p.status}</span>
                </div>
              </div>
              <div className="product-name">{p.name}</div>
              <div className="product-price">{p.price ? '$'+p.price : '\u2014'}</div>
              <div className="product-stats-row">
                <div className="product-stat"><span className="stat-val">{fmt(p.views_7d)}</span><span className="stat-label">Views/7d</span></div>
                <div className="product-stat"><span className="stat-val">{p.engagement_rate}%</span><span className="stat-label">Eng.</span></div>
                <div className="product-stat"><span className="stat-val" style={{ color: scoreColor(p.trending_score) }}>{p.trending_score || 0}</span><span className="stat-label">Score</span></div>
              </div>
              <div className="product-revenue">{fmtMoney(p.revenue_estimate)} est. revenue</div>
              <div className="product-actions">
                <button className="btn-sm" onClick={e => { e.stopPropagation(); handleAnalyze(p); }}>🤖 Analyze</button>
                <button className="btn-sm btn-danger" onClick={e => { e.stopPropagation(); handleDelete(p.id); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Views 7d</th><th>Engagement</th><th>Score</th><th>Revenue</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} onClick={() => setSelected(p)} className="table-row-clickable">
                  <td><strong>{p.name}</strong></td>
                  <td>{p.category}</td>
                  <td>{p.price ? '$'+p.price : '\u2014'}</td>
                  <td>{fmt(p.views_7d)}</td>
                  <td>{p.engagement_rate}%</td>
                  <td style={{ color: scoreColor(p.trending_score), fontWeight: 700 }}>{p.trending_score || 0}</td>
                  <td>{fmtMoney(p.revenue_estimate)}</td>
                  <td><span className="status-pill" style={{ background: statusColor(p.status)+'22', color: statusColor(p.status) }}>{p.status}</span></td>
                  <td><button className="btn-sm" onClick={e => { e.stopPropagation(); handleDelete(p.id); }}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <div className="side-panel">
          <div className="side-panel-header">
            <h3>{selected.name}</h3>
            <button className="icon-btn" onClick={() => { setSelected(null); setAiResult(''); }}>×</button>
          </div>
          <div className="side-panel-body">
            <div className="detail-stats-grid">
              <div className="detail-stat"><div className="detail-val">{fmt(selected.views_7d)}</div><div className="detail-label">Views 7d</div></div>
              <div className="detail-stat"><div className="detail-val">{fmt(selected.likes_7d)}</div><div className="detail-label">Likes 7d</div></div>
              <div className="detail-stat"><div className="detail-val">{selected.engagement_rate}%</div><div className="detail-label">Engagement</div></div>
              <div className="detail-stat"><div className="detail-val">{selected.creator_count}</div><div className="detail-label">Creators</div></div>
              <div className="detail-stat"><div className="detail-val">{selected.ad_saturation}%</div><div className="detail-label">Ad Sat.</div></div>
              <div className="detail-stat"><div className="detail-val" style={{ color: scoreColor(selected.trending_score) }}>{selected.trending_score}</div><div className="detail-label">Score</div></div>
            </div>
            {selected.url && <a href={selected.url} target="_blank" rel="noreferrer" className="btn-sm" style={{ display:'inline-block', margin:'8px 0' }}>🔗 View Product</a>}
            {selected.notes && <p style={{ color:'var(--text-muted)', fontSize:13, margin:'8px 0' }}>{selected.notes}</p>}
            <button className="btn-primary" style={{ width:'100%', margin:'12px 0' }} onClick={() => handleAnalyze(selected)} disabled={aiLoading}>{aiLoading ? '🤖 Analyzing...' : '🤖 AI Analysis'}</button>
            {aiResult && <div className="ai-output"><pre style={{ whiteSpace:'pre-wrap', fontFamily:'inherit', fontSize:13, lineHeight:1.6 }}>{aiResult}</pre></div>}
          </div>
        </div>
      )}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Add Product</h3><button className="icon-btn" onClick={() => setShowAdd(false)}>×</button></div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group"><label>Product Name *</label><input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Viral Face Roller" /></div>
                <div className="form-group"><label>URL</label><input value={form.url} onChange={e => setForm(f => ({...f, url: e.target.value}))} /></div>
                <div className="form-group"><label>Category</label><select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}>{CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}</select></div>
                <div className="form-group"><label>Price ($)</label><input type="number" value={form.price} onChange={e => setForm(f => ({...f, price: e.target.value}))} /></div>
                <div className="form-group"><label>Est. Sales</label><input type="number" value={form.estimated_sales} onChange={e => setForm(f => ({...f, estimated_sales: e.target.value}))} /></div>
                <div className="form-group"><label>Revenue Est. ($)</label><input type="number" value={form.revenue_estimate} onChange={e => setForm(f => ({...f, revenue_estimate: e.target.value}))} /></div>
                <div className="form-group"><label>Views 7d</label><input type="number" value={form.views_7d} onChange={e => setForm(f => ({...f, views_7d: e.target.value}))} /></div>
                <div className="form-group"><label>Likes 7d</label><input type="number" value={form.likes_7d} onChange={e => setForm(f => ({...f, likes_7d: e.target.value}))} /></div>
                <div className="form-group"><label>Engagement (%)</label><input type="number" step="0.1" value={form.engagement_rate} onChange={e => setForm(f => ({...f, engagement_rate: e.target.value}))} /></div>
                <div className="form-group"><label>Growth Velocity</label><input type="number" value={form.growth_velocity} onChange={e => setForm(f => ({...f, growth_velocity: e.target.value}))} /></div>
                <div className="form-group"><label>Ad Saturation (%)</label><input type="number" value={form.ad_saturation} onChange={e => setForm(f => ({...f, ad_saturation: e.target.value}))} /></div>
                <div className="form-group"><label>Creator Count</label><input type="number" value={form.creator_count} onChange={e => setForm(f => ({...f, creator_count: e.target.value}))} /></div>
                <div className="form-group"><label>Trending Score (0-10)</label><input type="number" min="0" max="10" step="0.1" value={form.trending_score} onChange={e => setForm(f => ({...f, trending_score: e.target.value}))} /></div>
                <div className="form-group"><label>Thumbnail URL</label><input value={form.thumbnail_url} onChange={e => setForm(f => ({...f, thumbnail_url: e.target.value}))} /></div>
              </div>
              <div className="form-group"><label>Notes</label><textarea rows={3} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleAdd}>Add Product</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
