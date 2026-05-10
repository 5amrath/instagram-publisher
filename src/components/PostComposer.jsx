import { useState, useRef, useCallback } from 'react';

const CAPTION_TEMPLATES = {
  'Hook + CTA': 'this changed everything for me\n\nlink in bio\n\n#fyp #viral #ascenddeals #looksmax',
  'Before/After': 'before vs after using this\n\nlink in bio\n\n#fyp #glowup #ascenddeals #looksmax',
  'Problem/Solution': 'struggling with this? try this instead\n\nlink in bio\n\n#fyp #skincare #ascenddeals',
  'Social Proof': 'everyone is sleeping on this product\n\nlink in bio\n\n#fyp #viral #ascenddeals',
  'Urgency': 'grab this before the price goes up\n\nlink in bio\n\n#fyp #deals #ascenddeals',
};

const NICHE_TAGS = {
  Deals: '#ascenddeals #deals #fyp #viral #looksmax',
  Looksmax: '#looksmax #mog #glow #ascenddeals #fyp',
  'Forward Growth': '#selfimprovement #grooming #ascenddeals #fyp',
  Skincare: '#skincare #glowup #ascenddeals #fyp #routine',
  Fitness: '#fitness #gains #ascenddeals #fyp #gym',
};

function Spinner() { return <span className="spinner" />; }

export default function PostComposer({ showToast, bulkFiles, setBulkFiles, bulkCaption, setBulkCaption, bulkProgress, setBulkProgress }) {
  const [mode, setMode] = useState('bulk');
  const [caption, setCaption] = useState('');
  const [singleFile, setSingleFile] = useState(null);
  const [singlePreview, setSinglePreview] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [queuing, setQueuing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [bulkDrag, setBulkDrag] = useState(false);
  const singleRef = useRef(null);
  const bulkRef = useRef(null);

  const handleSingleFile = (file) => {
    if (!file) return;
    setSingleFile(file);
    const url = URL.createObjectURL(file);
    setSinglePreview(url);
  };

  const handleBulkDrop = useCallback((e) => {
    e.preventDefault(); setBulkDrag(false);
    const items = e.dataTransfer.items || [];
    const files = [];
    const processEntry = (entry) => new Promise((res) => {
      if (entry.isFile) {
        entry.file(f => { if (f.type.startsWith('video/')) files.push(f); res(); });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        reader.readEntries(entries => Promise.all(entries.map(processEntry)).then(res));
      } else res();
    });
    Promise.all(Array.from(items).map(i => i.webkitGetAsEntry && processEntry(i.webkitGetAsEntry()))).then(() => {
      if (files.length === 0) {
        Array.from(e.dataTransfer.files).forEach(f => { if (f.type.startsWith('video/')) files.push(f); });
      }
      setBulkFiles(prev => [...prev, ...files]);
      showToast(files.length + ' video' + (files.length !== 1 ? 's' : '') + ' added', 'success');
    });
  }, [setBulkFiles, showToast]);

  const uploadToCloudinary = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', 'instagram-publisher');
    fd.append('resource_type', 'video');
    const cloudName = 'degyziumu';
    const res = await fetch('https://api.cloudinary.com/v1_1/' + cloudName + '/video/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!data.secure_url) throw new Error(data.error?.message || 'Upload failed');
    return { videoUrl: data.secure_url, thumbUrl: data.eager?.[0]?.secure_url || null, publicId: data.public_id };
  };

  const handlePublishNow = async () => {
    if (!singleFile) { showToast('Select a video first', 'error'); return; }
    setPublishing(true);
    try {
      const { videoUrl, thumbUrl } = await uploadToCloudinary(singleFile);
      const res = await fetch('/.netlify/functions/publish-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl, thumbUrl, caption }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast('Posted to Instagram!', 'success');
      setSingleFile(null); setSinglePreview(null); setCaption('');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setPublishing(false); }
  };

  const handleAddToQueue = async () => {
    if (!singleFile) { showToast('Select a video first', 'error'); return; }
    setQueuing(true);
    try {
      const { videoUrl, thumbUrl } = await uploadToCloudinary(singleFile);
      const res = await fetch('/.netlify/functions/add-to-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl, thumbUrl, caption }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showToast('Added to queue!', 'success');
      setSingleFile(null); setSinglePreview(null); setCaption('');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setQueuing(false); }
  };

  const handleBulkUpload = async () => {
    if (bulkFiles.length === 0) { showToast('Add videos first', 'error'); return; }
    setBulkProgress({ total: bulkFiles.length, done: 0, failed: 0, running: true });
    let done = 0; let failed = 0;
    for (const file of bulkFiles) {
      try {
        const { videoUrl, thumbUrl } = await uploadToCloudinary(file);
        await fetch('/.netlify/functions/add-to-queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrl, thumbUrl, caption: bulkCaption }),
        });
        done++;
      } catch { failed++; }
      setBulkProgress({ total: bulkFiles.length, done, failed, running: true });
    }
    setBulkProgress({ total: bulkFiles.length, done, failed, running: false });
    showToast(done + ' videos queued' + (failed ? ', ' + failed + ' failed' : ''), done > 0 ? 'success' : 'error');
    if (done > 0) setBulkFiles([]);
  };

  const pct = bulkProgress.total > 0 ? Math.round((bulkProgress.done / bulkProgress.total) * 100) : 0;

  return (
    <div className="fade-in" style={{ maxWidth: 860 }}>
      <div className="page-header">
        <div className="page-title">Upload</div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: 'var(--charcoal-3)', borderRadius: 9, padding: 3, width: 'fit-content' }}>
        {['single', 'bulk'].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '6px 20px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
            background: mode === m ? 'var(--charcoal-1)' : 'transparent',
            color: mode === m ? 'var(--creme)' : 'var(--text-muted)',
            transition: 'all 0.13s',
          }}>{m === 'single' ? 'Single' : 'Bulk Upload'}</button>
        ))}
      </div>

      {mode === 'single' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('video/')) handleSingleFile(f); }}
              onClick={() => singleRef.current?.click()}
              style={{
                border: '2px dashed ' + (dragOver ? 'var(--gold)' : 'var(--charcoal-5)'),
                borderRadius: 12, padding: singlePreview ? 0 : '40px 20px',
                textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s',
                background: dragOver ? 'var(--gold-dim)' : 'var(--charcoal-2)',
                overflow: 'hidden', marginBottom: 14,
                minHeight: singlePreview ? 0 : 180,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {singlePreview ? (
                <video src={singlePreview} style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 10 }} controls />
              ) : (
                <>
                  <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.4 }}>↑</div>
                  <div style={{ fontSize: 13, color: 'var(--creme)', fontWeight: 600 }}>Drop video or click to browse</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>MP4 · MOV · up to 500MB</div>
                </>
              )}
            </div>
            <input ref={singleRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={e => handleSingleFile(e.target.files[0])} />
            {singleFile && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{singleFile.name}</span>
                <span>{(singleFile.size / 1024 / 1024).toFixed(1)}MB</span>
              </div>
            )}
          </div>
          <div>
            <div className="section-label">Caption</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {Object.keys(NICHE_TAGS).map(k => (
                <button key={k} className="pill" style={{ fontSize: 11 }} onClick={() => setCaption(c => c + (c ? '\n' : '') + NICHE_TAGS[k])}>{k}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {Object.keys(CAPTION_TEMPLATES).map(k => (
                <button key={k} className="pill" style={{ fontSize: 11, borderColor: 'var(--gold-border)', color: 'var(--gold-light)' }} onClick={() => setCaption(CAPTION_TEMPLATES[k])}>{k}</button>
              ))}
            </div>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Write a caption, or leave blank — AI will analyze the first frame and write one automatically..."
              rows={6}
              style={{ width: '100%', background: 'var(--charcoal-3)', border: '1px solid var(--creme-border)', borderRadius: 8, padding: '10px 12px', color: 'var(--creme)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
            />
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', marginBottom: 14 }}>{caption.length} / 2200</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handlePublishNow} disabled={publishing || queuing || !singleFile}>
                {publishing ? <><Spinner /> Publishing…</> : '⚡ Publish Now'}
              </button>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={handleAddToQueue} disabled={publishing || queuing || !singleFile}>
                {queuing ? <><Spinner /> Adding…</> : '+ Add to Queue'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              Leave caption blank — AI analyzes the first frame and writes a viral hook + hashtags
            </p>
          </div>
        </div>
      )}

      {mode === 'bulk' && (
        <div>
          <div
            onDragOver={e => { e.preventDefault(); setBulkDrag(true); }}
            onDragLeave={() => setBulkDrag(false)}
            onDrop={handleBulkDrop}
            onClick={() => bulkRef.current?.click()}
            style={{
              border: '2px dashed ' + (bulkDrag ? 'var(--gold)' : 'var(--charcoal-5)'),
              borderRadius: 14, padding: '50px 30px', textAlign: 'center', cursor: 'pointer',
              background: bulkDrag ? 'var(--gold-dim)' : 'var(--charcoal-2)', transition: 'all 0.15s', marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 38, marginBottom: 12, opacity: 0.4 }}>📁</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--creme)', marginBottom: 6 }}>
              {bulkDrag ? 'Drop your folder here' : 'Drop a folder or videos'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Drag an entire folder with 1000+ videos — all get queued automatically
            </div>
            <div style={{ fontSize: 11, color: 'var(--charcoal-6)', marginTop: 6 }}>MP4 · MOV · WebM</div>
          </div>
          <input ref={bulkRef} type="file" accept="video/*" multiple style={{ display: 'none' }} onChange={e => { const f = Array.from(e.target.files).filter(x => x.type.startsWith('video/')); setBulkFiles(prev => [...prev, ...f]); if (f.length) showToast(f.length + ' videos added', 'success'); }} />

          {bulkFiles.length > 0 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="section-label" style={{ margin: 0 }}>{bulkFiles.length} videos ready</span>
                <button className="btn-sm" onClick={() => setBulkFiles([])} style={{ color: 'var(--red-lt)' }}>Clear all</button>
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {bulkFiles.slice(0, 50).map((f, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', background: 'var(--charcoal-3)', borderRadius: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--creme)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>{(f.size/1024/1024).toFixed(1)}MB</span>
                    <button onClick={() => setBulkFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, marginLeft: 6, padding: '0 2px' }}>×</button>
                  </div>
                ))}
                {bulkFiles.length > 50 && <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 8px' }}>+ {bulkFiles.length - 50} more...</div>}
              </div>
            </div>
          )}

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="section-label">Shared Caption (Optional)</div>
            <textarea
              value={bulkCaption}
              onChange={e => setBulkCaption(e.target.value)}
              placeholder="Leave blank — AI auto-generates unique captions for each video from its first frame"
              rows={3}
              style={{ width: '100%', background: 'var(--charcoal-3)', border: '1px solid var(--creme-border)', borderRadius: 8, padding: '9px 12px', color: 'var(--creme)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
            />
          </div>

          {bulkProgress.running && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Uploading...</span>
                <span style={{ fontSize: 13, color: 'var(--gold-light)', fontVariantNumeric: 'tabular-nums' }}>{bulkProgress.done}/{bulkProgress.total}</span>
              </div>
              <div style={{ height: 6, background: 'var(--charcoal-4)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: pct + '%', background: 'linear-gradient(90deg, var(--gold), var(--gold-light))', borderRadius: 99, transition: 'width 0.3s ease' }} />
              </div>
              {bulkProgress.failed > 0 && <div style={{ fontSize: 11, color: 'var(--red-lt)', marginTop: 6 }}>{bulkProgress.failed} failed</div>}
            </div>
          )}

          {!bulkProgress.running && bulkProgress.total > 0 && !bulkProgress.running && (
            <div style={{ fontSize: 13, color: bulkProgress.failed > 0 ? 'var(--gold-light)' : 'var(--emerald-lt)', marginBottom: 14, fontWeight: 600 }}>
              ✓ {bulkProgress.done} videos queued successfully{bulkProgress.failed > 0 ? ' · ' + bulkProgress.failed + ' failed' : ''}
            </div>
          )}

          <button className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: 14 }} onClick={handleBulkUpload} disabled={bulkProgress.running || bulkFiles.length === 0}>
            {bulkProgress.running ? <><Spinner /> Uploading {bulkProgress.done}/{bulkProgress.total}…</> : '🚀 Upload & Queue ' + (bulkFiles.length > 0 ? bulkFiles.length + ' Videos' : 'All Videos')}
          </button>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
            Videos upload to cloud, then queue for auto-scheduling · AI writes captions from first frame
          </p>
        </div>
      )}
    </div>
  );
}
