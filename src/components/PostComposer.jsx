import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const MAX_CAPTION = 2200;
const MAX_CONCURRENT = 5;
const MAX_FILES = 1000;

const HASHTAG_PRESETS = [
  { label: 'Deals', tags: '#deals #discount #save #musthave #trending #viral #affiliate' },
  { label: 'Looksmax', tags: '#looksmaxxing #skincare #glowup #selfcare #grooming #beauty' },
  { label: 'Tech', tags: '#tech #gadgets #innovation #smart #futuretech #techdeals' },
  { label: 'Fitness', tags: '#fitness #gym #health #gains #workout #supplements #fitlife' },
  { label: 'Lifestyle', tags: '#lifestyle #upgrade #quality #essentials #modern #aesthetic' },
];

export default function PostComposer({ showToast }) {
  // Single post mode
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [mediaType, setMediaType] = useState('IMAGE');

  // Bulk mode
  const [mode, setMode] = useState('single'); // 'single' | 'bulk'
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkCaption, setBulkCaption] = useState('');
  const [bulkProgress, setBulkProgress] = useState({ total: 0, uploaded: 0, failed: 0, inProgress: false });
  const abortRef = useRef(false);

  // AI caption
  const [aiLoading, setAiLoading] = useState(false);

  const onDropSingle = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    setMediaType(isVideo ? 'VIDEO' : 'IMAGE');
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  }, []);

  const onDropBulk = useCallback((acceptedFiles) => {
    const limited = acceptedFiles.slice(0, MAX_FILES);
    setBulkFiles(prev => {
      const combined = [...prev, ...limited].slice(0, MAX_FILES);
      return combined;
    });
  }, []);

  const { getRootProps: getSingleRootProps, getInputProps: getSingleInputProps, isDragActive: isSingleDrag } = useDropzone({
    onDrop: onDropSingle,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'], 'video/*': ['.mp4', '.mov'] },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024,
    disabled: mode !== 'single',
  });

  const { getRootProps: getBulkRootProps, getInputProps: getBulkInputProps, isDragActive: isBulkDrag } = useDropzone({
    onDrop: onDropBulk,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: MAX_FILES,
    maxSize: 100 * 1024 * 1024,
    disabled: mode !== 'bulk',
    multiple: true,
  });

  const clearMedia = () => {
    setMediaFile(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
  };

  const handlePublishSingle = async () => {
    if (!mediaFile) { showToast('Select an image or video first', 'error'); return; }
    setLoading(true);
    try {
      setLoadingStep('Uploading media...');
      const formData = new FormData();
      formData.append('image', mediaFile);
      const uploadRes = await axios.post('/api/upload-media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { url: mediaUrl } = uploadRes.data;

      setLoadingStep('Publishing to Instagram...');
      await axios.post('/api/publish', {
        mediaUrl,
        mediaType,
        caption,
      });

      showToast('Post published to Instagram', 'success');
      setCaption('');
      clearMedia();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Something went wrong';
      showToast(`Failed: ${msg}`, 'error');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleQueueSingle = async () => {
    if (!mediaFile) { showToast('Select an image or video first', 'error'); return; }
    setLoading(true);
    try {
      setLoadingStep('Uploading media...');
      const formData = new FormData();
      formData.append('image', mediaFile);
      const uploadRes = await axios.post('/api/upload-media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setLoadingStep('Saving to queue...');
      await axios.post('/api/save-post', {
        mediaUrl: uploadRes.data.url,
        caption,
      });

      showToast('Added to queue — auto-post will handle it', 'success');
      setCaption('');
      clearMedia();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Something went wrong';
      showToast(`Failed: ${msg}`, 'error');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleBulkUpload = async () => {
    if (bulkFiles.length === 0) { showToast('Add files first', 'error'); return; }
    abortRef.current = false;

    const total = bulkFiles.length;
    setBulkProgress({ total, uploaded: 0, failed: 0, inProgress: true });

    let uploaded = 0;
    let failed = 0;
    const queue = [...bulkFiles];
    let activeWorkers = 0;

    const processNext = () => {
      return new Promise((resolve) => {
        const checkAndProcess = async () => {
          while (queue.length > 0 && activeWorkers < MAX_CONCURRENT && !abortRef.current) {
            const file = queue.shift();
            activeWorkers++;

            (async () => {
              try {
                const formData = new FormData();
                formData.append('image', file);
                const uploadRes = await axios.post('/api/upload-media', formData, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                  timeout: 60000,
                });

                await axios.post('/api/save-post', {
                  mediaUrl: uploadRes.data.url,
                  caption: bulkCaption,
                });

                uploaded++;
              } catch (err) {
                console.error('Bulk upload failed for', file.name, err.message);
                failed++;
              } finally {
                activeWorkers--;
                setBulkProgress({ total, uploaded, failed, inProgress: true });
                if (queue.length === 0 && activeWorkers === 0) {
                  resolve();
                } else {
                  checkAndProcess();
                }
              }
            })();
          }

          if (queue.length === 0 && activeWorkers === 0) {
            resolve();
          }
        };

        checkAndProcess();
      });
    };

    await processNext();

    setBulkProgress({ total, uploaded, failed, inProgress: false });
    setBulkFiles([]);

    if (abortRef.current) {
      showToast(`Upload cancelled. ${uploaded} saved, ${failed} failed.`, 'error');
    } else if (failed > 0) {
      showToast(`Done: ${uploaded} queued, ${failed} failed`, 'error');
    } else {
      showToast(`All ${uploaded} posts queued for auto-posting`, 'success');
    }
  };

  const handleAbort = () => {
    abortRef.current = true;
  };

  const removeBulkFile = (index) => {
    setBulkFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerateCaption = async () => {
    setAiLoading(true);
    try {
      const res = await axios.post('/api/generate-caption', { context: '' });
      if (mode === 'single') {
        setCaption(res.data.caption);
      } else {
        setBulkCaption(res.data.caption);
      }
    } catch (err) {
      showToast('AI caption failed — try again', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const insertHashtags = (preset) => {
    if (mode === 'single') {
      const space = caption.endsWith('\n') || caption === '' ? '' : '\n\n';
      setCaption(prev => prev + space + preset.tags);
    } else {
      const space = bulkCaption.endsWith('\n') || bulkCaption === '' ? '' : '\n\n';
      setBulkCaption(prev => prev + space + preset.tags);
    }
  };

  const currentCaption = mode === 'single' ? caption : bulkCaption;
  const setCurrentCaption = mode === 'single' ? setCaption : setBulkCaption;
  const charsLeft = MAX_CAPTION - currentCaption.length;
  const pct = bulkProgress.total > 0 ? Math.round(((bulkProgress.uploaded + bulkProgress.failed) / bulkProgress.total) * 100) : 0;

  return (
    <div className="composer">
      {/* Mode Toggle */}
      <div className="mode-toggle">
        <button className={`mode-btn ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>
          Single Post
        </button>
        <button className={`mode-btn ${mode === 'bulk' ? 'active' : ''}`} onClick={() => setMode('bulk')}>
          Bulk Upload
        </button>
      </div>

      {mode === 'single' ? (
        <div className="composer-grid">
          {/* Left: Media Upload */}
          <div className="composer-left">
            <label className="field-label">Media</label>
            {!mediaPreview ? (
              <div {...getSingleRootProps()} className={`dropzone ${isSingleDrag ? 'drag-active' : ''}`}>
                <input {...getSingleInputProps()} />
                <div className="dropzone-inner">
                  <div className="dropzone-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                  <p className="dropzone-text">
                    {isSingleDrag ? 'Drop it here...' : 'Drag & drop or click to upload'}
                  </p>
                  <p className="dropzone-hint">JPG, PNG, MP4, MOV — max 100MB</p>
                </div>
              </div>
            ) : (
              <div className="media-preview-wrap">
                {mediaType === 'IMAGE' ? (
                  <img src={mediaPreview} alt="Preview" className="media-preview" />
                ) : (
                  <video src={mediaPreview} controls className="media-preview" />
                )}
                <button className="remove-media" onClick={clearMedia} title="Remove">X</button>
                <span className="media-badge">{mediaType}</span>
              </div>
            )}
          </div>

          {/* Right: Caption + Controls */}
          <div className="composer-right">
            <div className="field-group">
              <div className="field-header">
                <label className="field-label">Caption</label>
                <div className="field-header-right">
                  <button className="ai-btn" onClick={handleGenerateCaption} disabled={aiLoading}>
                    {aiLoading ? 'Generating...' : 'AI Caption'}
                  </button>
                  <span className={`char-count ${charsLeft < 100 ? 'warn' : ''}`}>
                    {charsLeft.toLocaleString()} left
                  </span>
                </div>
              </div>
              <textarea
                className="caption-input"
                placeholder="Write your caption or use AI Caption..."
                value={caption}
                onChange={e => setCaption(e.target.value.slice(0, MAX_CAPTION))}
                rows={8}
              />
              <div className="hashtag-presets">
                <span className="presets-label">Quick hashtags:</span>
                {HASHTAG_PRESETS.map(p => (
                  <button key={p.label} className="preset-btn" onClick={() => insertHashtags(p)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="publish-actions">
              <button
                className={`publish-btn ${loading ? 'loading' : ''}`}
                onClick={handlePublishSingle}
                disabled={loading || !mediaFile}
              >
                {loading && loadingStep.includes('Publish') ? (
                  <><span className="spinner" />{loadingStep}</>
                ) : (
                  'Publish Now'
                )}
              </button>
              <button
                className={`queue-btn ${loading ? 'loading' : ''}`}
                onClick={handleQueueSingle}
                disabled={loading || !mediaFile}
              >
                {loading && loadingStep.includes('queue') ? (
                  <><span className="spinner" />{loadingStep}</>
                ) : (
                  'Add to Queue'
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* BULK MODE */
        <div className="bulk-section">
          <div className="bulk-grid">
            <div className="bulk-left">
              <label className="field-label">Upload Files (max {MAX_FILES})</label>
              <div {...getBulkRootProps()} className={`dropzone dropzone-bulk ${isBulkDrag ? 'drag-active' : ''}`}>
                <input {...getBulkInputProps()} />
                <div className="dropzone-inner">
                  <div className="dropzone-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <p className="dropzone-text">
                    {isBulkDrag ? 'Drop files here...' : 'Drop up to 1000 images or click to select'}
                  </p>
                  <p className="dropzone-hint">JPG, PNG — images only for bulk</p>
                </div>
              </div>

              {bulkFiles.length > 0 && (
                <div className="bulk-file-info">
                  <span className="bulk-count">{bulkFiles.length} file{bulkFiles.length !== 1 ? 's' : ''} selected</span>
                  <button className="clear-bulk-btn" onClick={() => setBulkFiles([])}>Clear All</button>
                </div>
              )}

              {bulkFiles.length > 0 && (
                <div className="bulk-preview-grid">
                  {bulkFiles.slice(0, 20).map((file, i) => (
                    <div key={i} className="bulk-thumb-wrap">
                      <img src={URL.createObjectURL(file)} alt="" className="bulk-thumb" />
                      <button className="bulk-thumb-remove" onClick={() => removeBulkFile(i)}>X</button>
                    </div>
                  ))}
                  {bulkFiles.length > 20 && (
                    <div className="bulk-thumb-more">+{bulkFiles.length - 20} more</div>
                  )}
                </div>
              )}
            </div>

            <div className="bulk-right">
              <div className="field-group">
                <div className="field-header">
                  <label className="field-label">Caption (applied to all)</label>
                  <div className="field-header-right">
                    <button className="ai-btn" onClick={handleGenerateCaption} disabled={aiLoading}>
                      {aiLoading ? 'Generating...' : 'AI Caption'}
                    </button>
                    <span className={`char-count ${charsLeft < 100 ? 'warn' : ''}`}>
                      {charsLeft.toLocaleString()} left
                    </span>
                  </div>
                </div>
                <textarea
                  className="caption-input"
                  placeholder="Leave blank for AI-generated captions per post..."
                  value={bulkCaption}
                  onChange={e => setBulkCaption(e.target.value.slice(0, MAX_CAPTION))}
                  rows={6}
                />
                <div className="hashtag-presets">
                  <span className="presets-label">Quick hashtags:</span>
                  {HASHTAG_PRESETS.map(p => (
                    <button key={p.label} className="preset-btn" onClick={() => insertHashtags(p)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="bulk-hint">
                Leave caption blank and the auto-poster will generate unique AI captions for each post.
              </p>

              {bulkProgress.inProgress && (
                <div className="progress-section">
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="progress-stats">
                    <span>{bulkProgress.uploaded} uploaded</span>
                    {bulkProgress.failed > 0 && <span className="progress-fail">{bulkProgress.failed} failed</span>}
                    <span>{pct}%</span>
                  </div>
                </div>
              )}

              <div className="publish-actions">
                {bulkProgress.inProgress ? (
                  <button className="cancel-btn" onClick={handleAbort}>Cancel Upload</button>
                ) : (
                  <button
                    className="publish-btn"
                    onClick={handleBulkUpload}
                    disabled={bulkFiles.length === 0}
                  >
                    Queue {bulkFiles.length} Post{bulkFiles.length !== 1 ? 's' : ''} for Auto-Post
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
