import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const MAX_CAPTION = 2200;

const HASHTAG_PRESETS = [
  { label: '🏠 Real Estate', tags: '#realestate #property #investment #realestateinvesting #deals' },
  { label: '💰 Finance', tags: '#finance #investing #money #wealthbuilding #financialfreedom' },
  { label: '🚀 Business', tags: '#business #entrepreneur #startup #growth #success' },
  { label: '🏡 Listings', tags: '#forsale #newlisting #homeforsale #luxuryhomes #realty' },
];

export default function PostComposer({ onPostPublished, showToast }) {
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [scheduleMode, setScheduleMode] = useState('now');
  const [scheduleTime, setScheduleTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [mediaType, setMediaType] = useState('IMAGE');

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    setMediaType(isVideo ? 'VIDEO' : 'IMAGE');
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'], 'video/*': ['.mp4', '.mov'] },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024,
  });

  const insertHashtags = (preset) => {
    const space = caption.endsWith('\n') || caption === '' ? '' : '\n\n';
    setCaption(prev => prev + space + preset.tags);
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
  };

  const handlePublish = async () => {
    if (!mediaFile) { showToast('Please select an image or video first', 'error'); return; }
    if (scheduleMode === 'later' && !scheduleTime) { showToast('Please pick a schedule time', 'error'); return; }

    setLoading(true);
    try {
      // Step 1: Upload media to imgbb to get a public URL
      setLoadingStep('Uploading media...');
      const formData = new FormData();
      formData.append('image', mediaFile);
      const uploadRes = await axios.post('/api/upload-media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { url: mediaUrl } = uploadRes.data;

      // Step 2: Create Instagram media container
      setLoadingStep('Creating Instagram post...');
      const publishRes = await axios.post('/api/publish', {
        mediaUrl,
        mediaType,
        caption,
        scheduleTime: scheduleMode === 'later' ? new Date(scheduleTime).toISOString() : null,
      });

      onPostPublished({
        id: publishRes.data.id,
        mediaPreview,
        caption,
        publishedAt: new Date().toISOString(),
        scheduled: scheduleMode === 'later' ? scheduleTime : null,
        mediaType,
      });

      // Reset form
      setCaption('');
      clearMedia();
      setScheduleMode('now');
      setScheduleTime('');

    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Something went wrong';
      showToast(`Failed: ${msg}`, 'error');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const minDateTime = new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16);
  const charsLeft = MAX_CAPTION - caption.length;

  return (
    <div className="composer">
      <div className="composer-grid">
        {/* Left: Media Upload */}
        <div className="composer-left">
          <label className="field-label">Media</label>
          {!mediaPreview ? (
            <div {...getRootProps()} className={`dropzone ${isDragActive ? 'drag-active' : ''}`}>
              <input {...getInputProps()} />
              <div className="dropzone-inner">
                <div className="dropzone-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
                <p className="dropzone-text">
                  {isDragActive ? 'Drop it here...' : 'Drag & drop or click to upload'}
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
              <button className="remove-media" onClick={clearMedia} title="Remove">✕</button>
              <span className="media-badge">{mediaType}</span>
            </div>
          )}
        </div>

        {/* Right: Caption + Controls */}
        <div className="composer-right">
          <div className="field-group">
            <div className="field-header">
              <label className="field-label">Caption</label>
              <span className={`char-count ${charsLeft < 100 ? 'warn' : ''}`}>
                {charsLeft.toLocaleString()} left
              </span>
            </div>
            <textarea
              className="caption-input"
              placeholder="Write your caption... ✍️"
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

          <div className="field-group">
            <label className="field-label">Publish time</label>
            <div className="schedule-toggle">
              <button
                className={`schedule-opt ${scheduleMode === 'now' ? 'active' : ''}`}
                onClick={() => setScheduleMode('now')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                Publish now
              </button>
              <button
                className={`schedule-opt ${scheduleMode === 'later' ? 'active' : ''}`}
                onClick={() => setScheduleMode('later')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Schedule
              </button>
            </div>
            {scheduleMode === 'later' && (
              <input
                type="datetime-local"
                className="datetime-input"
                value={scheduleTime}
                min={minDateTime}
                onChange={e => setScheduleTime(e.target.value)}
              />
            )}
          </div>

          <button
            className={`publish-btn ${loading ? 'loading' : ''}`}
            onClick={handlePublish}
            disabled={loading || !mediaFile}
          >
            {loading ? (
              <>
                <span className="spinner" />
                {loadingStep}
              </>
            ) : scheduleMode === 'later' ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Schedule Post
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                Publish to Instagram
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
