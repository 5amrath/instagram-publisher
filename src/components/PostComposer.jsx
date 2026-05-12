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

  // Upload via our backend Netlify function (uses server-side Cloudinary API key)
  const uploadToBackend = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/.netlify/functions/upload-media', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Upload failed');
    return { videoUrl: data.videoUrl || data.url, thumbUrl: data.thumbnailUrl || null, publicId: data.publicId };
  };

  const handlePublishNow = async () => {
    if (!singleFile) { showToast('Select a video first', 'error'); return; }
    setPublishing(true);
    try {
      const { videoUrl, thumbUrl } = await uploadToBackend(singleFile);
      const res = await fetch('/.netlify/functions/publish', {
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
      const { videoUrl, thumbUrl } = await uploadToBackend(singleFile);
      const res = await fetch('/.netlify/functions/save-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl, thumbnailUrl: thumbUrl, caption, mediaType: 'VIDEO' }),
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
    setBulkProgress({ total: bulkFiles.length, done: 0, failed: 0, active: true });
    let done = 0, failed = 0;
    const BATCH = 3;
    for (let i = 0; i < bulkFiles.length; i += BATCH) {
      const batch = bulkFiles.slice(i, i + BATCH);
      await Promise.all(batch.map(async (file) => {
        try {
          const { videoUrl, thumbUrl } = await uploadToBackend(file);
          await fetch('/.netlify/functions/save-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoUrl, thumbnailUrl: thumbUrl, caption: bulkCaption || '', mediaType: 'VIDEO' }),
          });
          done++;
        } catch (e) {
          failed++;
          console.error('Upload failed:', file.name, e.message);
        }
        setBulkProgress(p => ({ ...p, done: p.done + 1 }));
      }));
    }
    showToast(done + ' queued, ' + failed + ' failed', done > 0 ? 'success' : 'error');
    setBulkProgress(p => ({ ...p, active: false }));
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
            padding: '6px 20px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12.5,
            fontWeight: 600, fontFamily: 'inherit',
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
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎥</div>
                  <div style={{ color: 'var(--creme)', fontWeight: 600 }}>Drop video here</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>MP4 · MOV · WebM</div>
                </>
              )}
            </div>
            <input ref={singleRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleSingleFile(f); }} />

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>CAPTION TEMPLATES</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {Object.entries(CAPTION_TEMPLATES).map(([k, v]) => (
                  <button key={k} onClick={() => setCaption(v)} style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid var(--charcoal-5)',
                    background: 'transparent', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer',
                  }}>{k}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>NICHE HASHTAGS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {Object.entries(NICHE_TAGS).map(([k, v]) => (
                  <button key={k} onClick={() => setCaption(c => c + '\n' + v)} style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid var(--charcoal-5)',
                    background: 'transparent', color: 'var(--gold)', fontSize: 11, cursor: 'pointer',
                  }}>{k}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--text-muted)' }}>CAPTION</div>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Leave blank — AI generates from first frame"
              style={{
                width: '100%', minHeight: 220, background: 'var(--charcoal-2)', border: '1px solid var(--charcoal-5)',
                borderRadius: 10, color: 'var(--creme)', padding: 12, fontSize: 13,
                fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={handleAddToQueue} disabled={queuing || publishing} style={{
                flex: 1, padding: '12px 0', background: 'var(--charcoal-3)', border: '1px solid var(--charcoal-5)',
                borderRadius: 9, color: 'var(--creme)', fontWeight: 600, cursor: 'pointer', fontSize: 13,
              }}>{queuing ? <Spinner /> : '⊕ Add to Queue'}</button>
              <button onClick={handlePublishNow} disabled={queuing || publishing} style={{
                flex: 1, padding: '12px 0', background: 'var(--gold)', border: 'none',
                borderRadius: 9, color: '#1a1a1a', fontWeight: 700, cursor: 'pointer', fontSize: 13,
              }}>{publishing ? <Spinner /> : '⚡ Post Now'}</button>
            </div>
            {singleFile && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                {singleFile.name} — {(singleFile.size / 1024 / 1024).toFixed(1)} MB
              </div>
            )}
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
              borderRadius: 14, padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
              background: bulkDrag ? 'var(--gold-dim)' : 'var(--charcoal-2)',
              transition: 'all 0.15s', marginBottom: 14, minHeight: 160,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
            <div style={{ color: 'var(--creme)', fontWeight: 700, fontSize: 15 }}>Drop a folder or videos</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 5 }}>Drag an entire folder with 1000+ videos — all get queued automatically</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 3 }}>MP4 · MOV · WebM</div>
          </div>
          <input ref={bulkRef} type="file" accept="video/*" multiple style={{ display: 'none' }} onChange={e => { const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('video/')); setBulkFiles(prev => [...prev, ...files]); if (files.length) showToast(files.length + ' videos added', 'success'); }} />

          {bulkFiles.length > 0 && (
            <div style={{ background: 'var(--charcoal-2)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--creme)', letterSpacing: 1 }}>{bulkFiles.length} VIDEOS READY</span>
                <button onClick={() => setBulkFiles([])} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--charcoal-5)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>Clear all</button>
              </div>
              {bulkFiles.slice(0, 5).map((f, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--charcoal-4)', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button onClick={() => setBulkFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>×</button>
                  </div>
                </div>
              ))}
              {bulkFiles.length > 5 && <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: 6 }}>+ {bulkFiles.length - 5} more...</div>}
            </div>
          )}

          <div style={{ background: 'var(--charcoal-2)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: 1 }}>SHARED CAPTION (OPTIONAL)</div>
            <textarea
              value={bulkCaption}
              onChange={e => setBulkCaption(e.target.value)}
              placeholder="Leave blank — AI auto-generates unique captions for each video from its first frame"
              style={{
                width: '100%', minHeight: 80, background: 'var(--charcoal-3)', border: '1px solid var(--charcoal-5)',
                borderRadius: 8, color: 'var(--creme)', padding: 10, fontSize: 13,
                fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>

          {bulkProgress.active && (
            <div style={{ background: 'var(--charcoal-2)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: 'var(--creme)' }}>Uploading... {bulkProgress.done}/{bulkProgress.total}</span>
                <span style={{ color: 'var(--gold)' }}>{pct}%</span>
              </div>
              <div style={{ background: 'var(--charcoal-4)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{ width: pct + '%', height: '100%', background: 'var(--gold)', transition: 'width 0.3s', borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{bulkProgress.failed > 0 ? bulkProgress.failed + ' failed' : 'Uploading to cloud, then saving to queue...'}</div>
            </div>
          )}

          {!bulkProgress.active && bulkProgress.total > 0 && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: bulkProgress.failed === bulkProgress.total ? 'rgba(255,80,80,0.1)' : 'rgba(100,200,100,0.1)', marginBottom: 12, fontSize: 13 }}>
              <span style={{ color: bulkProgress.done > 0 ? '#6dc878' : '#ff5050' }}>
                ✓ {bulkProgress.done} videos queued successfully · {bulkProgress.failed} failed
              </span>
            </div>
          )}

          <button
            onClick={handleBulkUpload}
            disabled={bulkProgress.active || bulkFiles.length === 0}
            style={{
              width: '100%', padding: '14px 0', background: bulkFiles.length === 0 ? 'var(--charcoal-4)' : 'var(--gold)',
              border: 'none', borderRadius: 10, color: bulkFiles.length === 0 ? 'var(--text-muted)' : '#1a1a1a',
              fontWeight: 700, fontSize: 14, cursor: bulkFiles.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s', fontFamily: 'inherit',
            }}
          >
            '🚀 Upload & Queue ' + (bulkFiles.length > 0 ? bulkFiles.length + ' Videos' : 'All Videos')
          </button>
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            Videos upload to cloud, then queue for auto-scheduling · AI writes captions from first frame
          </div>
        </div>
      )}
    </div>
  );
}
