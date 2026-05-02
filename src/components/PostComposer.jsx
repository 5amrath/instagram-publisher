import React, { useState, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';

const MAX_CAPTION = 2200;
const MAX_CONCURRENT = 3;
const MAX_FILES = 1000;

const HASHTAG_PRESETS = [
  { label: 'Deals', tags: '#deals #discount #save #musthave #trending #viral #affiliate' },
  { label: 'Looksmax', tags: '#looksmaxxing #skincare #glowup #selfcare #grooming #mog' },
  { label: 'Forward Growth', tags: '#forwardgrowth #maxila #posture #jawline #mewing #mog' },
  { label: 'Skincare', tags: '#skincare #acnetreatment #clearsky #glowup #routine #bp' },
  { label: 'Fitness', tags: '#fitness #gym #gains #testosterone #physique #bulk' },
];

const CAPTION_TEMPLATES = [
  { label: 'Hook + CTA', text: '' },
  { label: 'Before/After', text: 'Before vs After. The results speak for themselves.\n\nLink in bio.' },
  { label: 'Problem/Solution', text: "You've been doing it wrong this whole time.\n\nHere's what actually works.\n\nLink in bio." },
  { label: 'Social Proof', text: "This is why everyone is switching.\n\nDon't get left behind.\n\nLink in bio." },
  { label: 'Urgency', text: "This won't last long.\n\nGrab it before it's gone.\n\nLink in bio." },
];

const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'm4v'];
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

function detectType(file) {
  if (file.type && file.type.startsWith('video/')) return 'VIDEO';
  const ext = file.name.toLowerCase().split('.').pop();
  if (VIDEO_EXTS.includes(ext)) return 'VIDEO';
  return 'IMAGE';
}

function isMediaFile(file) {
  const ext = file.name.toLowerCase().split('.').pop();
  return VIDEO_EXTS.includes(ext) || IMAGE_EXTS.includes(ext);
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Props: showToast + lifted bulk state from App
export default function PostComposer({
  showToast,
  bulkFiles, setBulkFiles,
  bulkCaption, setBulkCaption,
  bulkProgress, setBulkProgress,
}) {
  const [mode, setMode] = useState('single');

  // Single upload state (local — fine to reset)
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState('VIDEO');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Per-file status map for bulk  { filename -> 'pending'|'uploading'|'done'|'failed' }
  const [fileStatus, setFileStatus] = useState({});
  const abortRef = useRef(false);
  const bulkDropRef = useRef(null);
  const singleDropRef = useRef(null);
  const singleFileInputRef = useRef(null);
  const bulkFileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const captionQuality = useMemo(() => {
    const c = mode === 'single' ? caption : bulkCaption;
    if (!c || c.trim().length === 0) return { level: 'none', label: '' };
    const len = c.trim().length;
    const hasHashtags = (c.match(/#\w+/g) || []).length;
    const hasNewlines = c.includes('\n');
    const hasCTA = /link in bio|check . out|grab it|shop now|tap link/i.test(c);
    let score = 0;
    if (len > 20) score++;
    if (len > 60) score++;
    if (hasHashtags >= 3) score++;
    if (hasHashtags >= 6) score++;
    if (hasNewlines) score++;
    if (hasCTA) score++;
    if (score >= 5) return { level: 'good', label: 'Strong caption' };
    if (score >= 3) return { level: 'ok', label: 'Could be stronger' };
    return { level: 'weak', label: 'Add more hooks/hashtags' };
  }, [caption, bulkCaption, mode]);

  // ── Single handlers ───────────────────────────────────────────────────────
  const handleSingleDrop = (e) => {
    e.preventDefault();
    const file = Array.from(e.dataTransfer.files || []).find(isMediaFile);
    if (file) { setMediaType(detectType(file)); setMediaFile(file); setMediaPreview(URL.createObjectURL(file)); }
  };

  const handleSingleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) { setMediaType(detectType(file)); setMediaFile(file); setMediaPreview(URL.createObjectURL(file)); }
  };

  const clearMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null); setMediaPreview(null); setMediaType('VIDEO');
    if (singleFileInputRef.current) singleFileInputRef.current.value = '';
  };

  // ── Folder/file drop for bulk ─────────────────────────────────────────────
  const collectFilesFromEntry = async (entry) => {
    const files = [];
    if (entry.isFile) {
      const file = await new Promise((res) => entry.file(res));
      if (isMediaFile(file)) files.push(file);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      let batch;
      do {
        batch = await new Promise((res) => reader.readEntries(res));
        for (const child of batch) files.push(...(await collectFilesFromEntry(child)));
      } while (batch.length > 0);
    }
    return files;
  };

  const handleBulkDrop = useCallback(async (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const items = Array.from(e.dataTransfer.items || []);
    const allFiles = [];
    if (items.length > 0 && items[0].webkitGetAsEntry) {
      for (const item of items) {
        const entry = item.webkitGetAsEntry();
        if (entry) allFiles.push(...(await collectFilesFromEntry(entry)));
      }
    } else {
      allFiles.push(...Array.from(e.dataTransfer.files || []).filter(isMediaFile));
    }
    if (allFiles.length === 0) { showToast('No video/image files found', 'error'); return; }
    const toAdd = allFiles.slice(0, MAX_FILES);
    setBulkFiles((prev) => [...prev, ...toAdd].slice(0, MAX_FILES));
    showToast(`Added ${toAdd.length} file${toAdd.length !== 1 ? 's' : ''}`, 'success');
  }, []);

  const handleBulkFileInput = (e) => {
    const files = Array.from(e.target.files || []).filter(isMediaFile);
    if (!files.length) return;
    setBulkFiles((prev) => [...prev, ...files].slice(0, MAX_FILES));
    showToast(`Added ${files.length} file${files.length !== 1 ? 's' : ''}`, 'success');
    e.target.value = '';
  };

  // ── Upload single file ────────────────────────────────────────────────────
  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await axios.post('/api/upload-media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000, // 10 min per file
    });
    return res.data;
  };

  // ── Single publish ────────────────────────────────────────────────────────
  const handlePublishNow = async () => {
    if (!mediaFile) return showToast('Select a file first', 'error');
    setLoading(true);
    try {
      setLoadingStep('Uploading to Cloudinary...');
      const upload = await uploadFile(mediaFile);
      let finalCaption = caption;
      if (!finalCaption.trim() && upload.thumbnailUrl) {
        setLoadingStep('Analyzing first frame with AI...');
        try {
          const aiRes = await axios.post('/api/analyze-frame', { imageUrl: upload.thumbnailUrl });
          finalCaption = aiRes.data.caption || '';
          if (finalCaption) setCaption(finalCaption);
        } catch {}
      }
      setLoadingStep(upload.mediaType === 'VIDEO' ? 'Publishing Reel...' : 'Publishing...');
      await axios.post('/api/publish', { mediaUrl: upload.url, videoUrl: upload.videoUrl, mediaType: upload.mediaType, caption: finalCaption });
      showToast(upload.mediaType === 'VIDEO' ? 'Reel published!' : 'Post published!', 'success');
      setCaption(''); clearMedia();
    } catch (err) {
      showToast(`Failed: ${err.response?.data?.error || err.message}`, 'error');
    } finally { setLoading(false); setLoadingStep(''); }
  };

  const handleAddToQueue = async () => {
    if (!mediaFile) return showToast('Select a file first', 'error');
    setLoading(true);
    try {
      setLoadingStep('Uploading...');
      const upload = await uploadFile(mediaFile);
      setLoadingStep('Saving to queue...');
      await axios.post('/api/save-post', { mediaUrl: upload.url, videoUrl: upload.videoUrl, thumbnailUrl: upload.thumbnailUrl, mediaType: upload.mediaType, caption });
      showToast('Added to queue!', 'success');
      setCaption(''); clearMedia();
    } catch (err) {
      showToast(`Failed: ${err.response?.data?.error || err.message}`, 'error');
    } finally { setLoading(false); setLoadingStep(''); }
  };

  // ── Bulk queue ────────────────────────────────────────────────────────────
  const handleBulkUpload = async () => {
    if (bulkFiles.length === 0) return showToast('Add files first', 'error');
    abortRef.current = false;
    const total = bulkFiles.length;
    let done = 0, failed = 0;
    const initStatus = {};
    bulkFiles.forEach(f => { initStatus[f.name + f.size] = 'pending'; });
    setFileStatus(initStatus);
    setBulkProgress({ total, done: 0, failed: 0, active: true });

    const queue = [...bulkFiles];
    let active = 0;

    await new Promise((resolve) => {
      const next = async () => {
        while (queue.length > 0 && active < MAX_CONCURRENT && !abortRef.current) {
          const file = queue.shift();
          const key = file.name + file.size;
          active++;
          setFileStatus(s => ({ ...s, [key]: 'uploading' }));
          (async () => {
            try {
              const upload = await uploadFile(file);
              await axios.post('/api/save-post', { mediaUrl: upload.url, videoUrl: upload.videoUrl, thumbnailUrl: upload.thumbnailUrl, mediaType: upload.mediaType, caption: bulkCaption });
              done++;
              setFileStatus(s => ({ ...s, [key]: 'done' }));
            } catch (err) {
              failed++;
              setFileStatus(s => ({ ...s, [key]: 'failed' }));
              console.error('Upload failed:', file.name, err.message);
            } finally {
              active--;
              setBulkProgress({ total, done, failed, active: true });
              if (queue.length === 0 && active === 0) resolve();
              else next();
            }
          })();
        }
        if (queue.length === 0 && active === 0) resolve();
      };
      next();
    });

    setBulkProgress({ total, done, failed, active: false });
    if (!abortRef.current) setBulkFiles([]);
    showToast(failed > 0 ? `${done} queued, ${failed} failed` : `All ${done} queued!`, failed > 0 ? 'error' : 'success');
  };

  const handleAI = async () => {
    setAiLoading(true);
    try {
      const res = await axios.post('/api/generate-caption', {});
      if (mode === 'single') setCaption(res.data.caption);
      else setBulkCaption(res.data.caption);
    } catch { showToast('AI caption failed', 'error'); }
    finally { setAiLoading(false); }
  };

  const addHashtags = (tags) => {
    const setter = mode === 'single' ? setCaption : setBulkCaption;
    setter((prev) => prev + (prev.endsWith('\n') || !prev ? '' : '\n\n') + tags);
  };

  const pct = bulkProgress.total > 0 ? Math.round(((bulkProgress.done + bulkProgress.failed) / bulkProgress.total) * 100) : 0;
  const bulkVideoCount = bulkFiles.filter(f => detectType(f) === 'VIDEO').length;

  // Visible file list for bulk (first 20)
  const visibleFiles = bulkFiles.slice(0, 20);
  const cap = mode === 'single' ? caption : bulkCaption;

  return (
    <div className="composer fade-in">
      <div className="mode-toggle">
        <button className={`mode-btn ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>Single</button>
        <button className={`mode-btn ${mode === 'bulk' ? 'active' : ''}`} onClick={() => setMode('bulk')}>
          Bulk Upload {bulkFiles.length > 0 ? `(${bulkFiles.length})` : ''}
        </button>
      </div>

      {mode === 'single' ? (
        <div className="composer-grid">
          <div className="composer-left">
            <label className="field-label">Video / Image</label>
            {!mediaPreview ? (
              <div
                ref={singleDropRef}
                className="dropzone"
                onDragOver={e => e.preventDefault()}
                onDrop={handleSingleDrop}
                onClick={() => singleFileInputRef.current?.click()}
              >
                <input ref={singleFileInputRef} type="file" accept="video/*,image/*" style={{ display:'none' }} onChange={handleSingleFileInput} />
                <div className="dropzone-inner">
                  <div className="dropzone-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="44" height="44">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <p className="dropzone-text">Drop video or click to browse</p>
                  <p className="dropzone-hint">MP4, MOV, JPG, PNG — up to 500MB</p>
                </div>
              </div>
            ) : (
              <div className="media-preview-wrap">
                {mediaType === 'VIDEO' ? <video src={mediaPreview} controls className="media-preview" /> : <img src={mediaPreview} alt="" className="media-preview" />}
                <button className="remove-media" onClick={clearMedia}>✕</button>
                <span className={`media-badge ${mediaType === 'VIDEO' ? 'video' : ''}`}>{mediaType === 'VIDEO' ? 'REEL' : 'IMAGE'}</span>
              </div>
            )}
          </div>

          <div className="composer-right">
            <div className="field-group">
              <div className="field-header">
                <label className="field-label">Caption</label>
                <div className="field-actions">
                  <button className="ai-btn" onClick={handleAI} disabled={aiLoading}>{aiLoading ? 'Working...' : '✦ AI Caption'}</button>
                  <span className={`char-count ${MAX_CAPTION - caption.length < 100 ? 'warn' : ''}`}>{(MAX_CAPTION - caption.length).toLocaleString()}</span>
                </div>
              </div>
              <textarea className="caption-input" placeholder="Write a caption or leave blank — AI will analyze the first frame..." value={caption} onChange={e => setCaption(e.target.value.slice(0, MAX_CAPTION))} rows={7} />
              {captionQuality.level !== 'none' && (
                <div className="caption-quality"><span className={`quality-dot ${captionQuality.level}`} /><span className="text-dim">{captionQuality.label}</span></div>
              )}
              <div className="hashtag-presets">{HASHTAG_PRESETS.map(p => <button key={p.label} className="preset-btn" onClick={() => addHashtags(p.tags)}>{p.label}</button>)}</div>
            </div>
            <div className="template-section">
              <label className="field-label">Caption Templates</label>
              <div className="template-row">{CAPTION_TEMPLATES.map(t => <button key={t.label} className="template-btn" onClick={() => t.text && (mode === 'single' ? setCaption(t.text) : setBulkCaption(t.text))}>{t.label}</button>)}</div>
            </div>
            {loading && <div className="loading-bar"><span className="spinner" /> {loadingStep}</div>}
            <div className="action-row">
              <button className="btn-primary" onClick={handlePublishNow} disabled={loading || !mediaFile}>{loading ? 'Publishing...' : 'Publish Now'}</button>
              <button className="btn-secondary" onClick={handleAddToQueue} disabled={loading || !mediaFile}>Add to Queue</button>
            </div>
            <p className="hint" style={{marginTop:8}}>Leave caption blank and AI will analyze the video's first frame automatically.</p>
          </div>
        </div>
      ) : (
        <div className="bulk-layout">
          <div className="bulk-left">
            <label className="field-label">Drop a folder or select files (up to {MAX_FILES.toLocaleString()})</label>
            <div
              ref={bulkDropRef}
              className={`dropzone dropzone-bulk ${isDragging ? 'drag-active' : ''}`}
              onDragEnter={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={e => { e.preventDefault(); if (!bulkDropRef.current?.contains(e.relatedTarget)) setIsDragging(false); }}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect='copy'; }}
              onDrop={handleBulkDrop}
            >
              <div className="dropzone-inner">
                <div className="dropzone-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                {isDragging ? <p className="dropzone-text" style={{color:'white'}}>Drop now!</p> : (
                  <>
                    <p className="dropzone-text">Drop a folder containing your videos</p>
                    <p className="dropzone-hint">Entire folder scanned — subfolders included</p>
                  </>
                )}
              </div>
            </div>

            <div className="bulk-browse-row">
              <input ref={bulkFileInputRef} type="file" accept="video/*,image/*" multiple style={{display:'none'}} onChange={handleBulkFileInput} />
              <button className="btn-ghost" onClick={() => bulkFileInputRef.current?.click()} disabled={bulkProgress.active}>Browse Files</button>
              <span className="text-dim" style={{fontSize:12}}>or drag a folder above</span>
            </div>

            {bulkFiles.length > 0 && (
              <>
                <div className="upload-stats">
                  <div className="upload-stat"><strong>{bulkFiles.length}</strong> files</div>
                  <div className="upload-stat"><strong>{bulkVideoCount}</strong> videos</div>
                  <div className="upload-stat"><strong>{formatBytes(bulkFiles.reduce((a,f)=>a+(f.size||0),0))}</strong></div>
                </div>
                <div className="bulk-info">
                  <span className="text-dim">{bulkFiles.length} file{bulkFiles.length!==1?'s':''} ready</span>
                  <button className="text-btn danger" onClick={() => { setBulkFiles([]); setFileStatus({}); }}>Clear all</button>
                </div>

                {/* File list with status */}
                <div className="bulk-file-list">
                  {visibleFiles.map((f, i) => {
                    const key = f.name + f.size;
                    const st = fileStatus[key] || 'pending';
                    return (
                      <div key={i} className={`bulk-file-row ${st}`}>
                        <span className="bulk-file-icon">{detectType(f)==='VIDEO' ? '▶' : '🖼'}</span>
                        <span className="bulk-file-name">{f.name.length > 32 ? f.name.slice(0,29)+'...' : f.name}</span>
                        <span className="bulk-file-size">{formatBytes(f.size)}</span>
                        <span className={`bulk-file-status ${st}`}>
                          {st === 'pending' ? '·' : st === 'uploading' ? <span className="spinner-sm"/> : st === 'done' ? '✓' : '✕'}
                        </span>
                      </div>
                    );
                  })}
                  {bulkFiles.length > 20 && <div className="bulk-more">+{bulkFiles.length-20} more files</div>}
                </div>
              </>
            )}
          </div>

          <div className="bulk-right">
            <div className="field-group">
              <div className="field-header">
                <label className="field-label">Caption (all posts)</label>
                <button className="ai-btn" onClick={handleAI} disabled={aiLoading}>{aiLoading ? '...' : '✦ AI'}</button>
              </div>
              <textarea className="caption-input" placeholder="Leave blank — AI analyzes each video's first frame and writes a unique caption..." value={bulkCaption} onChange={e => setBulkCaption(e.target.value.slice(0,MAX_CAPTION))} rows={5} />
              <div className="hashtag-presets">{HASHTAG_PRESETS.map(p => <button key={p.label} className="preset-btn" onClick={() => addHashtags(p.tags)}>{p.label}</button>)}</div>
            </div>

            <p className="hint">Files stay here even if you switch tabs. Leave caption blank for per-video AI captions.</p>

            {(bulkProgress.active || bulkProgress.total > 0) && (
              <div className="progress-section">
                <div className="progress-track"><div className="progress-fill" style={{width:`${pct}%`}} /></div>
                <div className="progress-info">
                  <span>{bulkProgress.done}/{bulkProgress.total} queued</span>
                  {bulkProgress.failed > 0 && <span className="text-red">{bulkProgress.failed} failed</span>}
                  <span>{pct}%</span>
                  {!bulkProgress.active && bulkProgress.done > 0 && <span style={{color:'var(--green)'}}>✓ Done</span>}
                </div>
              </div>
            )}

            <div className="action-row">
              {bulkProgress.active ? (
                <button className="btn-danger" onClick={() => { abortRef.current = true; }}>Cancel</button>
              ) : (
                <button className="btn-primary" onClick={handleBulkUpload} disabled={bulkFiles.length === 0}>
                  Queue {bulkFiles.length > 0 ? bulkFiles.length.toLocaleString() : ''} File{bulkFiles.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
