import { useState, useCallback, useRef, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const MAX_CAPTION = 2200;
const MAX_CONCURRENT = 3;
const MAX_FILES = 1000;

const HASHTAG_PRESETS = [
  { label: 'Deals',          tags: '#deals #discount #musthave #trending #viral #affiliate #ascenddeals' },
  { label: 'Looksmax',       tags: '#looksmaxxing #skincare #glowup #mog #selfcare #grooming #ascenddeals' },
  { label: 'Forward Growth', tags: '#forwardgrowth #posture #jawline #mewing #mog #ascenddeals #fyp' },
  { label: 'Skincare',       tags: '#skincare #acnetreatment #glowup #routine #clearsky #ascenddeals' },
  { label: 'Fitness',        tags: '#fitness #gym #gains #testosterone #physique #bulk #ascenddeals' },
];

const CAPTION_TEMPLATES = [
  { label: 'Hook + CTA',        text: '' },
  { label: 'Before/After',      text: 'before vs after. the results speak for themselves.\n\nlink in bio' },
  { label: 'Problem/Solution',  text: "you've been doing it wrong this whole time.\n\nhere's what actually works.\n\nlink in bio" },
  { label: 'Social Proof',      text: "this is why everyone is switching.\n\ndon't get left behind.\n\nlink in bio" },
  { label: 'Urgency',           text: "this won't last long.\n\ngrab it before it's gone.\n\nlink in bio" },
];

function detectType(file) {
  if (file.type && file.type.startsWith('video/')) return 'VIDEO';
  const ext = (file.name || '').toLowerCase().split('.').pop();
  return ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext) ? 'VIDEO' : 'IMAGE';
}

export default function PostComposer({
  showToast,
  bulkFiles, setBulkFiles,
  bulkCaption, setBulkCaption,
  bulkProgress, setBulkProgress,
}) {
  const [mode, setMode] = useState('single');

  // Single upload state
  const [mediaFile, setMediaFile]       = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType]       = useState('VIDEO');
  const [caption, setCaption]           = useState('');
  const [loading, setLoading]           = useState(false);
  const [loadingStep, setLoadingStep]   = useState('');
  const [aiLoading, setAiLoading]       = useState(false);

  // Bulk per-file statuses
  const [fileStatuses, setFileStatuses] = useState([]);
  const abortRef = useRef(false);

  // Caption quality score
  const captionQuality = useMemo(() => {
    const c = mode === 'single' ? caption : bulkCaption;
    if (!c || !c.trim()) return { level: 'none', label: '' };
    const hashtags = (c.match(/#\w+/g) || []).length;
    const hasCTA   = /link in bio|check.*out|grab it|shop now/i.test(c);
    let score = 0;
    if (c.length > 20) score++;
    if (c.length > 60) score++;
    if (hashtags >= 3) score++;
    if (hashtags >= 6) score++;
    if (c.includes('\n')) score++;
    if (hasCTA) score++;
    if (score >= 5) return { level: 'good',  label: 'Strong caption' };
    if (score >= 3) return { level: 'ok',    label: 'Could be stronger' };
    return { level: 'weak', label: 'Add hooks & hashtags' };
  }, [caption, bulkCaption, mode]);

  // Dropzone — single
  const onDropSingle = useCallback((files) => {
    const file = files[0];
    if (!file) return;
    setMediaType(detectType(file));
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  }, []);

  const singleDrop = useDropzone({
    onDrop: onDropSingle,
    accept: { 'image/*': ['.jpg','.jpeg','.png','.webp'], 'video/*': ['.mp4','.mov','.avi','.webm'] },
    maxFiles: 1,
    maxSize: 500 * 1024 * 1024,
    disabled: mode !== 'single',
  });

  // Dropzone — bulk (supports folder drop via webkitGetAsEntry)
  const onDropBulk = useCallback((acceptedFiles) => {
    setBulkFiles(prev => {
      const combined = [...prev, ...acceptedFiles].slice(0, MAX_FILES);
      return combined;
    });
  }, [setBulkFiles]);

  const bulkDrop = useDropzone({
    onDrop: onDropBulk,
    accept: { 'image/*': ['.jpg','.jpeg','.png','.webp'], 'video/*': ['.mp4','.mov','.avi','.webm'] },
    maxFiles: MAX_FILES,
    maxSize: 500 * 1024 * 1024,
    disabled: mode !== 'bulk',
    multiple: true,
    noClick: false,
  });

  // Handle folder drops
  const handleBulkDrop = useCallback((e) => {
    e.preventDefault();
    const items = Array.from(e.dataTransfer.items || []);
    const allFiles = [];
    let pending = 0;
    const done = () => {
      pending--;
      if (pending <= 0) {
        setBulkFiles(prev => [...prev, ...allFiles].slice(0, MAX_FILES));
        showToast(`Added ${allFiles.length} files`, 'success');
      }
    };
    const readEntry = (entry) => {
      if (entry.isFile) {
        pending++;
        entry.file(f => { allFiles.push(f); done(); }, () => done());
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readAll = () => {
          reader.readEntries(entries => {
            if (!entries.length) return;
            entries.forEach(readEntry);
            readAll();
          });
        };
        readAll();
      }
    };
    items.forEach(item => {
      const entry = item.webkitGetAsEntry?.();
      if (entry) readEntry(entry);
    });
    if (pending === 0) showToast('No supported files found', 'error');
  }, [setBulkFiles, showToast]);

  const clearMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType('VIDEO');
  };

  const uploadFile = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await axios.post('/.netlify/functions/upload-media', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
    });
    return res.data;
  };

  // ---- Single upload handlers ----
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
          const aiRes = await axios.post('/.netlify/functions/analyze-frame', { imageUrl: upload.thumbnailUrl });
          finalCaption = aiRes.data.caption || '';
          if (finalCaption) setCaption(finalCaption);
        } catch (e) { console.error('Frame analysis failed', e); }
      }

      const isVid = upload.mediaType === 'VIDEO';
      setLoadingStep(isVid ? 'Publishing Reel to Instagram...' : 'Publishing post...');
      await axios.post('/.netlify/functions/publish', {
        mediaUrl:  upload.url,
        videoUrl:  upload.videoUrl,
        mediaType: upload.mediaType,
        caption:   finalCaption,
      });

      showToast(isVid ? '🎬 Reel published!' : 'Post published!', 'success');
      setCaption('');
      clearMedia();
    } catch (err) {
      showToast('Failed: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleAddToQueue = async () => {
    if (!mediaFile) return showToast('Select a file first', 'error');
    setLoading(true);
    try {
      setLoadingStep('Uploading...');
      const upload = await uploadFile(mediaFile);
      setLoadingStep('Adding to queue...');
      await axios.post('/.netlify/functions/save-post', {
        mediaUrl:     upload.url,
        videoUrl:     upload.videoUrl,
        thumbnailUrl: upload.thumbnailUrl,
        mediaType:    upload.mediaType,
        caption,
      });
      showToast('Added to queue ✓', 'success');
      setCaption('');
      clearMedia();
    } catch (err) {
      showToast('Failed: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // ---- Bulk upload ----
  const handleBulkUpload = async () => {
    if (!bulkFiles.length) return showToast('Add files first', 'error');
    abortRef.current = false;
    const total = bulkFiles.length;
    let done = 0, failed = 0;
    setBulkProgress({ total, done: 0, failed: 0, running: true });
    setFileStatuses(bulkFiles.map(f => ({ name: f.name, status: 'pending' })));

    const queue = [...bulkFiles];
    let active = 0;

    await new Promise((resolve) => {
      const next = () => {
        while (queue.length > 0 && active < MAX_CONCURRENT && !abortRef.current) {
          const idx = bulkFiles.length - queue.length;
          const file = queue.shift();
          active++;
          setFileStatuses(prev => prev.map((f, i) => i === idx ? { ...f, status: 'uploading' } : f));

          (async () => {
            try {
              const upload = await uploadFile(file);
              await axios.post('/.netlify/functions/save-post', {
                mediaUrl:     upload.url,
                videoUrl:     upload.videoUrl,
                thumbnailUrl: upload.thumbnailUrl,
                mediaType:    upload.mediaType,
                caption:      bulkCaption,
              });
              done++;
              setFileStatuses(prev => prev.map((f, i) => i === idx ? { ...f, status: 'done' } : f));
            } catch {
              failed++;
              setFileStatuses(prev => prev.map((f, i) => i === idx ? { ...f, status: 'failed' } : f));
            } finally {
              active--;
              setBulkProgress({ total, done, failed, running: true });
              if (queue.length === 0 && active === 0) resolve();
              else next();
            }
          })();
        }
        if (queue.length === 0 && active === 0) resolve();
      };
      next();
    });

    setBulkProgress({ total, done, failed, running: false });
    if (failed > 0) showToast(`${done} queued, ${failed} failed`, 'error');
    else showToast(`All ${done} files queued!`, 'success');
    setBulkFiles([]);
    setFileStatuses([]);
  };

  const handleAI = async () => {
    setAiLoading(true);
    try {
      const res = await axios.post('/.netlify/functions/generate-caption', {});
      if (mode === 'single') setCaption(res.data.caption);
      else setBulkCaption(res.data.caption);
    } catch { showToast('AI caption failed', 'error'); }
    finally { setAiLoading(false); }
  };

  const addHashtags = (tags) => {
    const setter = mode === 'single' ? setCaption : setBulkCaption;
    setter(prev => prev + (prev.endsWith('\n') || prev === '' ? '' : '\n\n') + tags);
  };

  const applyTemplate = (text) => {
    if (!text) return;
    const setter = mode === 'single' ? setCaption : setBulkCaption;
    setter(text);
  };

  const cap = mode === 'single' ? caption : bulkCaption;
  const pct = bulkProgress.total > 0
    ? Math.round(((bulkProgress.done + bulkProgress.failed) / bulkProgress.total) * 100)
    : 0;
  const bulkVideoCount = bulkFiles.filter(f => detectType(f) === 'VIDEO').length;

  return (
    <div className="composer fade-in">
      <div className="mode-toggle">
        <button className={`mode-btn${mode === 'single' ? ' active' : ''}`} onClick={() => setMode('single')}>Single</button>
        <button className={`mode-btn${mode === 'bulk'   ? ' active' : ''}`} onClick={() => setMode('bulk')}>Bulk Upload</button>
      </div>

      {mode === 'single' ? (
        <div className="composer-grid">
          {/* Left: drop zone */}
          <div>
            <label className="field-label">Video / Image</label>
            {!mediaPreview ? (
              <div {...singleDrop.getRootProps()} className={`dropzone${singleDrop.isDragActive ? ' drag-active' : ''}`}>
                <input {...singleDrop.getInputProps()} />
                <div className="dropzone-inner">
                  <div className="dropzone-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="44" height="44">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <p className="dropzone-text">{singleDrop.isDragActive ? 'Drop here' : 'Drop video or click to browse'}</p>
                  <p className="dropzone-hint">MP4 · MOV · JPG · PNG — up to 500MB</p>
                </div>
              </div>
            ) : (
              <div className="media-preview-wrap">
                {mediaType === 'VIDEO'
                  ? <video src={mediaPreview} controls className="media-preview" />
                  : <img src={mediaPreview} alt="" className="media-preview" />
                }
                <button className="remove-media" onClick={clearMedia}>✕</button>
                <span className={`media-badge${mediaType === 'VIDEO' ? ' video' : ''}`}>
                  {mediaType === 'VIDEO' ? 'REEL' : 'IMAGE'}
                </span>
              </div>
            )}
          </div>

          {/* Right: caption + actions */}
          <div>
            <div className="field-group">
              <div className="field-header">
                <label className="field-label">Caption</label>
                <div className="field-actions">
                  <button className="ai-btn" onClick={handleAI} disabled={aiLoading}>
                    {aiLoading ? '...' : '✦ AI Caption'}
                  </button>
                  <span className={`char-count${MAX_CAPTION - cap.length < 100 ? ' warn' : ''}`}>
                    {(MAX_CAPTION - caption.length).toLocaleString()}
                  </span>
                </div>
              </div>
              <textarea
                className="caption-input"
                placeholder="Write a caption, or leave blank — AI will analyze the first frame and write one automatically..."
                value={caption}
                onChange={e => setCaption(e.target.value.slice(0, MAX_CAPTION))}
                rows={6}
              />
              {captionQuality.level !== 'none' && (
                <div className="caption-quality">
                  <span className={`quality-dot ${captionQuality.level}`} />
                  <span className="text-dim">{captionQuality.label}</span>
                </div>
              )}
              <div className="hashtag-presets">
                {HASHTAG_PRESETS.map(p => (
                  <button key={p.label} className="preset-btn" onClick={() => addHashtags(p.tags)}>{p.label}</button>
                ))}
              </div>
            </div>

            <div className="template-section mb-16">
              <label className="field-label">Templates</label>
              <div className="template-row">
                {CAPTION_TEMPLATES.map(t => (
                  <button key={t.label} className="template-btn" onClick={() => applyTemplate(t.text)}>{t.label}</button>
                ))}
              </div>
            </div>

            {loading && <div className="loading-bar"><span className="spinner" /> {loadingStep}</div>}

            <div className="action-row">
              <button className="btn-primary" onClick={handlePublishNow} disabled={loading || !mediaFile}>
                {loading ? 'Publishing...' : 'Publish Now'}
              </button>
              <button className="btn-secondary" onClick={handleAddToQueue} disabled={loading || !mediaFile}>
                Add to Queue
              </button>
            </div>
            <p className="hint mt-8">Leave caption blank — AI analyzes the first frame and writes a viral hook + hashtags.</p>
          </div>
        </div>
      ) : (
        /* BULK MODE */
        <div className="bulk-layout">
          <div className="bulk-left">
            <label className="field-label">Videos & Images — up to {MAX_FILES.toLocaleString()}</label>
            <div
              {...bulkDrop.getRootProps()}
              className={`dropzone dropzone-bulk${bulkDrop.isDragActive ? ' drag-active' : ''}`}
              onDrop={e => { handleBulkDrop(e); }}
            >
              <input {...bulkDrop.getInputProps()} />
              <div className="dropzone-inner">
                <div className="dropzone-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="38" height="38">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <p className="dropzone-text">{bulkDrop.isDragActive ? 'Drop here' : 'Drop folder or files'}</p>
                <p className="dropzone-hint">Drag entire folder with 1000 videos · or click to browse</p>
              </div>
            </div>

            {bulkFiles.length > 0 && (
              <>
                <div className="upload-stats">
                  <div className="upload-stat"><strong>{bulkFiles.length}</strong> total</div>
                  <div className="upload-stat"><strong>{bulkVideoCount}</strong> videos</div>
                  <div className="upload-stat"><strong>{bulkFiles.length - bulkVideoCount}</strong> images</div>
                </div>
                <div className="bulk-info">
                  <span className="text-dim">{bulkFiles.length} file{bulkFiles.length !== 1 ? 's' : ''} ready</span>
                  <button className="text-btn danger" onClick={() => { setBulkFiles([]); setFileStatuses([]); }}>Clear all</button>
                </div>
                {/* Per-file status list (top 12) */}
                {fileStatuses.length > 0 && (
                  <div className="file-list">
                    {fileStatuses.slice(0, 12).map((f, i) => (
                      <div key={i} className={`file-item ${f.status}`}>
                        {f.status === 'uploading' && <span className="spinner" />}
                        <span className="file-name">{f.name}</span>
                        <span className={`file-status${f.status === 'done' ? ' ok' : f.status === 'failed' ? ' err' : ''}`}>
                          {f.status === 'done' ? '✓' : f.status === 'failed' ? '✕' : f.status === 'uploading' ? '' : '—'}
                        </span>
                      </div>
                    ))}
                    {fileStatuses.length > 12 && (
                      <div className="text-dim" style={{padding:'4px 10px'}}>+{fileStatuses.length - 12} more</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="bulk-right">
            <div className="field-group">
              <div className="field-header">
                <label className="field-label">Caption (all posts)</label>
                <button className="ai-btn" onClick={handleAI} disabled={aiLoading}>{aiLoading ? '...' : '✦ AI'}</button>
              </div>
              <textarea
                className="caption-input"
                placeholder="Leave blank — each Reel's first frame will be analyzed by AI to write a unique viral caption automatically..."
                value={bulkCaption}
                onChange={e => setBulkCaption(e.target.value.slice(0, MAX_CAPTION))}
                rows={5}
              />
              <div className="hashtag-presets">
                {HASHTAG_PRESETS.map(p => (
                  <button key={p.label} className="preset-btn" onClick={() => addHashtags(p.tags)}>{p.label}</button>
                ))}
              </div>
            </div>

            <p className="hint">
              Leave caption blank — the auto-poster uses GPT-4o vision to read each video's first frame and write a unique viral caption per Reel.
            </p>

            {(bulkProgress.running || bulkProgress.done > 0) && (
              <div className="progress-section">
                <div className="progress-track"><div className="progress-fill" style={{width: pct + '%'}} /></div>
                <div className="progress-info">
                  <span>{bulkProgress.done}/{bulkProgress.total} queued</span>
                  {bulkProgress.failed > 0 && <span className="text-red">{bulkProgress.failed} failed</span>}
                  <span>{pct}%</span>
                </div>
              </div>
            )}

            <div className="action-row">
              {bulkProgress.running ? (
                <button className="btn-danger" onClick={() => { abortRef.current = true; }}>Cancel Upload</button>
              ) : (
                <button className="btn-primary" onClick={handleBulkUpload} disabled={!bulkFiles.length}>
                  Queue {bulkFiles.length || ''} File{bulkFiles.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
