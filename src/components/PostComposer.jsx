import { useState, useRef, useCallback } from 'react';

const CATEGORY_TAGS = ['Deals', 'Looksmax', 'Forward Growth', 'Skincare', 'Fitness'];
const CAPTION_TEMPLATES = ['Hook + CTA', 'Before/After', 'Problem/Solution', 'Social Proof', 'Urgency'];

export default function PostComposer({
  bulkFiles, setBulkFiles,
  bulkProgress, setBulkProgress
}) {
  const [mode, setMode] = useState('single');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [captionScore, setCaptionScore] = useState(null);
  const [loadingCaption, setLoadingCaption] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [toast, setToast] = useState(null);
  const [fileStatuses, setFileStatuses] = useState({});
  const dropRef = useRef(null);
  const fileInputRef = useRef(null);
  const bulkInputRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  const scoreCaption = (text) => {
    if (!text || text.length < 20) return null;
    let score = 0;
    if (text.length > 80) score += 30;
    if (text.includes('#')) score += 25;
    if (text.toLowerCase().includes('link in bio')) score += 15;
    if (/pov:|this is why|stop |nobody talks about|the truth about/i.test(text)) score += 20;
    if (text.split('\n').length > 1) score += 10;
    return Math.min(score, 100);
  };

  const handleFileSelect = (f) => {
    if (!f) return;
    setFile(f);
    setCaption('');
    setCaptionScore(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const items = e.dataTransfer.items;
    if (mode === 'bulk') {
      const videos = [];
      const processEntry = (entry) => {
        return new Promise((resolve) => {
          if (entry.isFile) {
            entry.file((f) => {
              if (f.type.startsWith('video/')) videos.push(f);
              resolve();
            });
          } else if (entry.isDirectory) {
            const reader = entry.createReader();
            reader.readEntries(async (entries) => {
              for (const e2 of entries) await processEntry(e2);
              resolve();
            });
          } else resolve();
        });
      };
      const promises = [];
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry) promises.push(processEntry(entry));
      }
      Promise.all(promises).then(() => {
        setBulkFiles(prev => {
          const existing = new Set(prev.map(f => f.name + f.size));
          const newFiles = videos.filter(f => !existing.has(f.name + f.size));
          return [...prev, ...newFiles];
        });
        if (videos.length > 0) showToast(`Added ${videos.length} videos`);
      });
    } else {
      const f = e.dataTransfer.files[0];
      if (f?.type.startsWith('video/')) handleFileSelect(f);
    }
  }, [mode, setBulkFiles]);

  const generateCaption = async (mediaUrl) => {
    setLoadingCaption(true);
    try {
      const res = await fetch('/api/analyze-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thumbnailUrl: mediaUrl }),
      });
      const data = await res.json();
      if (data.caption) {
        setCaption(data.caption);
        setCaptionScore(scoreCaption(data.caption));
      }
    } catch (e) {
      showToast('Caption generation failed', 'error');
    } finally {
      setLoadingCaption(false);
    }
  };

  const uploadFile = async (f, onProgress) => {
    const formData = new FormData();
    formData.append('file', f);
    const res = await fetch('/api/upload-media', { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
  };

  const handleSingleUpload = async (action) => {
    if (!file) return showToast('Select a video first', 'error');

    const isModePublish = action === 'publish';
    if (isModePublish) setPublishing(true);
    else setQueueing(true);

    try {
      // Upload
      showToast('Uploading video...', 'info');
      const uploadData = await uploadFile(file);
      if (!uploadData.videoUrl && !uploadData.mediaUrl) throw new Error('Upload failed');

      // Auto-generate caption if empty
      let finalCaption = caption;
      if (!finalCaption.trim()) {
        const thumbnailUrl = uploadData.thumbnailUrl || uploadData.mediaUrl;
        if (thumbnailUrl) {
          setLoadingCaption(true);
          try {
            const res = await fetch('/api/analyze-frame', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ thumbnailUrl }),
            });
            const d = await res.json();
            finalCaption = d.caption || '';
            setCaption(finalCaption);
            setCaptionScore(scoreCaption(finalCaption));
          } catch {}
          setLoadingCaption(false);
        }
      }

      // Save to DB
      const saveRes = await fetch('/api/save-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: finalCaption,
          mediaUrl: uploadData.mediaUrl,
          videoUrl: uploadData.videoUrl,
          thumbnailUrl: uploadData.thumbnailUrl,
          mediaType: uploadData.mediaType || 'REELS',
        }),
      });
      const saveData = await saveRes.json();
      if (!saveData.id) throw new Error('Failed to save post');

      if (isModePublish) {
        // Immediate publish - uses queue mode to avoid 502
        showToast('Publishing via queue... will post within 10 min', 'info');
        await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postId: saveData.id,
            queueMode: true,
            videoUrl: uploadData.videoUrl,
            mediaUrl: uploadData.mediaUrl,
            mediaType: uploadData.mediaType || 'REELS',
            caption: finalCaption,
          }),
        });
        showToast('Queued! Will be posted within 10 minutes automatically.');
      } else {
        showToast('Added to queue! Will post automatically.');
      }

      setFile(null);
      setPreview(null);
      setCaption('');
      setCaptionScore(null);
    } catch (err) {
      showToast(err.message || 'Error occurred', 'error');
    } finally {
      setPublishing(false);
      setQueueing(false);
    }
  };

  const handleBulkQueue = async () => {
    if (bulkFiles.length === 0) return showToast('Drop some videos first', 'error');
    const total = bulkFiles.length;
    setBulkProgress({ total, done: 0, running: true });
    let done = 0;

    const CONCURRENCY = 2;
    const queue = [...bulkFiles];
    const statusMap = {};
    bulkFiles.forEach(f => { statusMap[f.name + f.size] = 'pending'; });
    setFileStatuses({ ...statusMap });

    const worker = async () => {
      while (queue.length > 0) {
        const f = queue.shift();
        const key = f.name + f.size;
        setFileStatuses(prev => ({ ...prev, [key]: 'uploading' }));
        try {
          const uploadData = await uploadFile(f);
          let cap = '';
          if (uploadData.thumbnailUrl || uploadData.mediaUrl) {
            try {
              const r = await fetch('/api/analyze-frame', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ thumbnailUrl: uploadData.thumbnailUrl || uploadData.mediaUrl }),
              });
              const d = await r.json();
              cap = d.caption || '';
            } catch {}
          }
          await fetch('/api/save-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              caption: cap,
              mediaUrl: uploadData.mediaUrl,
              videoUrl: uploadData.videoUrl,
              thumbnailUrl: uploadData.thumbnailUrl,
              mediaType: uploadData.mediaType || 'REELS',
            }),
          });
          setFileStatuses(prev => ({ ...prev, [key]: 'done' }));
          done++;
          setBulkProgress(prev => ({ ...prev, done }));
        } catch (e) {
          setFileStatuses(prev => ({ ...prev, [key]: 'failed' }));
          done++;
          setBulkProgress(prev => ({ ...prev, done }));
        }
      }
    };

    const workers = Array.from({ length: CONCURRENCY }, worker);
    await Promise.all(workers);
    setBulkProgress(prev => ({ ...prev, running: false }));
    showToast(`Queued ${total} videos! Auto-posting will begin.`);
  };

  const removeBulkFile = (f) => {
    setBulkFiles(prev => prev.filter(x => x !== f));
  };

  return (
    <div className="composer-wrap">
      {/* Mode Toggle */}
      <div className="mode-toggle">
        <button className={`mode-btn ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>
          Single
        </button>
        <button className={`mode-btn ${mode === 'bulk' ? 'active' : ''}`} onClick={() => setMode('bulk')}>
          Bulk Upload
          {bulkFiles.length > 0 && <span className="badge">{bulkFiles.length}</span>}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}

      {mode === 'single' ? (
        <div className="single-layout">
          {/* Left: Video Drop */}
          <div className="media-panel">
            <div
              className={`drop-zone ${file ? 'has-file' : ''}`}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              {preview ? (
                <>
                  <video src={preview} controls className="preview-video" />
                  <div className="reel-badge">REEL</div>
                  <button className="remove-btn" onClick={e => { e.stopPropagation(); setFile(null); setPreview(null); setCaption(''); }}>×</button>
                </>
              ) : (
                <div className="drop-placeholder">
                  <div className="drop-icon">▶</div>
                  <p>Drop video here</p>
                  <p className="drop-sub">or click to browse</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="video/*" style={{ display: 'none' }}
              onChange={e => handleFileSelect(e.target.files[0])} />
          </div>

          {/* Right: Caption */}
          <div className="caption-panel">
            <div className="caption-header">
              <span className="label">CAPTION</span>
              <div className="caption-actions">
                {caption && <span className="char-count">{caption.length}</span>}
                <button
                  className="ai-btn"
                  disabled={!file || loadingCaption}
                  onClick={async () => {
                    if (!file) return;
                    const fd = new FormData();
                    fd.append('file', file);
                    setLoadingCaption(true);
                    try {
                      const up = await fetch('/api/upload-media', { method: 'POST', body: fd });
                      const ud = await up.json();
                      await generateCaption(ud.thumbnailUrl || ud.mediaUrl);
                    } catch { showToast('Failed', 'error'); }
                    setLoadingCaption(false);
                  }}
                >
                  {loadingCaption ? '...' : '✦ AI Caption'}
                </button>
              </div>
            </div>

            <textarea
              className="caption-input"
              value={caption}
              onChange={e => { setCaption(e.target.value); setCaptionScore(scoreCaption(e.target.value)); }}
              placeholder="Write caption or click AI Caption to generate from video..."
              rows={6}
            />

            {captionScore !== null && (
              <div className={`score-bar ${captionScore >= 70 ? 'strong' : captionScore >= 40 ? 'ok' : 'weak'}`}>
                <span className="score-dot" />
                {captionScore >= 70 ? 'Strong caption' : captionScore >= 40 ? 'Good caption' : 'Weak caption'}
              </div>
            )}

            <div className="tag-row">
              {CATEGORY_TAGS.map(t => (
                <button key={t} className="tag-chip"
                  onClick={() => setCaption(prev => prev + (prev ? '\n' : '') + '#' + t.toLowerCase().replace(/\s/g, ''))}>
                  {t}
                </button>
              ))}
            </div>

            <div className="label" style={{ marginTop: '16px' }}>TEMPLATES</div>
            <div className="tag-row">
              {CAPTION_TEMPLATES.map(t => (
                <button key={t} className="tag-chip template-chip"
                  onClick={() => {
                    const templates = {
                      'Hook + CTA': 'pov: you found the best deal\nget it before it sells out\nlink in bio.\n#deals #ascenddeals #sale',
                      'Before/After': 'before vs after using this product\nyou will not believe the difference\nlink in bio.\n#transformation #deals #ascenddeals',
                      'Problem/Solution': 'struggling with this?\nthis is the solution nobody talks about\nlink in bio.\n#deals #ascenddeals #tips',
                      'Social Proof': 'everyone is getting this right now\nand for good reason\nlink in bio.\n#deals #ascenddeals #trending',
                      'Urgency': 'this price drops in 24 hours\nget it now before it is gone\nlink in bio.\n#deals #ascenddeals #sale',
                    };
                    setCaption(templates[t] || '');
                    setCaptionScore(scoreCaption(templates[t] || ''));
                  }}>
                  {t}
                </button>
              ))}
            </div>

            <p className="caption-hint">Leave blank — AI will generate from first frame automatically</p>

            <div className="action-row">
              <button
                className="btn-primary"
                disabled={publishing || !file}
                onClick={() => handleSingleUpload('publish')}
              >
                {publishing ? 'Queueing...' : 'Publish Now'}
              </button>
              <button
                className="btn-secondary"
                disabled={queueing || !file}
                onClick={() => handleSingleUpload('queue')}
              >
                {queueing ? 'Saving...' : 'Add to Queue'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bulk-layout">
          <div
            className="bulk-drop-zone"
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => bulkInputRef.current?.click()}
          >
            <div className="drop-icon">📁</div>
            <p>Drop a folder or videos here</p>
            <p className="drop-sub">Supports up to 1000 videos — subfolders included</p>
            <input ref={bulkInputRef} type="file" accept="video/*" multiple style={{ display: 'none' }}
              onChange={e => {
                const newFiles = Array.from(e.target.files).filter(f => f.type.startsWith('video/'));
                setBulkFiles(prev => {
                  const existing = new Set(prev.map(f => f.name + f.size));
                  return [...prev, ...newFiles.filter(f => !existing.has(f.name + f.size))];
                });
              }} />
          </div>

          {bulkFiles.length > 0 && (
            <div className="bulk-file-list">
              <div className="bulk-list-header">
                <span>{bulkFiles.length} videos ready</span>
                <button className="clear-btn" onClick={() => { setBulkFiles([]); setFileStatuses({}); }}>Clear all</button>
              </div>
              <div className="bulk-scroll">
                {bulkFiles.map((f, i) => {
                  const key = f.name + f.size;
                  const status = fileStatuses[key] || 'pending';
                  return (
                    <div key={key} className={`bulk-file-row bulk-${status}`}>
                      <span className="file-num">{i + 1}</span>
                      <span className="file-name">{f.name}</span>
                      <span className="file-size">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                      <span className="file-status">
                        {status === 'pending' && '·'}
                        {status === 'uploading' && <span className="spinner" />}
                        {status === 'done' && '✓'}
                        {status === 'failed' && '✕'}
                      </span>
                      {status === 'pending' && (
                        <button className="remove-file-btn" onClick={() => removeBulkFile(f)}>×</button>
                      )}
                    </div>
                  );
                })}
              </div>

              {bulkProgress?.running && (
                <div className="progress-bar-wrap">
                  <div className="progress-bar-track">
                    <div
                      className="progress-bar-fill"
                      style={{ width: bulkProgress.total > 0 ? `${(bulkProgress.done / bulkProgress.total) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="progress-text">{bulkProgress.done} / {bulkProgress.total}</span>
                </div>
              )}

              <button
                className="btn-primary bulk-queue-btn"
                disabled={bulkProgress?.running}
                onClick={handleBulkQueue}
              >
                {bulkProgress?.running
                  ? `Uploading ${bulkProgress.done}/${bulkProgress.total}...`
                  : `Queue ${bulkFiles.length} Videos`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
