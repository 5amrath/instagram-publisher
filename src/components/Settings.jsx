import React, { useState, useEffect } from 'react';
import axios from 'axios';

const LIMIT_OPTIONS = [10, 15, 20, 25, 30, 40, 50];

export default function Settings({ showToast }) {
  const [dailyLimit, setDailyLimit] = useState(25);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await axios.get('/api/get-queue-stats');
        setDailyLimit(res.data.dailyLimit || 25);
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSave = async (value) => {
    setSaving(true);
    try {
      await axios.post('/api/update-settings', { key: 'daily_limit', value: String(value) });
      setDailyLimit(value);
      showToast(`Daily limit set to ${value}`, 'success');
    } catch (err) {
      showToast('Failed to save setting', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-loading">
        <span className="spinner" /> Loading settings...
      </div>
    );
  }

  return (
    <div className="settings">
      <h2 className="settings-title">Settings</h2>

      <div className="settings-card">
        <div className="settings-card-header">
          <h3>Daily Post Limit</h3>
          <p className="settings-desc">
            Maximum number of posts the auto-poster will publish per day.
            Instagram recommends staying under 25 for new accounts.
          </p>
        </div>
        <div className="limit-grid">
          {LIMIT_OPTIONS.map(opt => (
            <button
              key={opt}
              className={`limit-btn ${dailyLimit === opt ? 'active' : ''}`}
              onClick={() => handleSave(opt)}
              disabled={saving}
            >
              {opt}
            </button>
          ))}
        </div>
        <p className="settings-current">Current: <strong>{dailyLimit} posts/day</strong></p>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <h3>Auto-Post Schedule</h3>
          <p className="settings-desc">
            The worker runs every 10 minutes via Netlify Scheduled Functions.
            It processes 1 post per run to stay within Instagram rate limits.
          </p>
        </div>
        <div className="schedule-info">
          <div className="schedule-row">
            <span className="schedule-key">Frequency</span>
            <span className="schedule-val">Every 10 minutes</span>
          </div>
          <div className="schedule-row">
            <span className="schedule-key">Posts per run</span>
            <span className="schedule-val">1</span>
          </div>
          <div className="schedule-row">
            <span className="schedule-key">Max retries</span>
            <span className="schedule-val">3 attempts before marking failed</span>
          </div>
          <div className="schedule-row">
            <span className="schedule-key">AI Captions</span>
            <span className="schedule-val">Auto-generated when caption is empty (GPT-4o-mini)</span>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <h3>Instagram Rules</h3>
          <p className="settings-desc">
            Key limits to keep your account safe.
          </p>
        </div>
        <div className="schedule-info">
          <div className="schedule-row">
            <span className="schedule-key">Max posts/day (API)</span>
            <span className="schedule-val">50 (Instagram hard limit)</span>
          </div>
          <div className="schedule-row">
            <span className="schedule-key">Caption length</span>
            <span className="schedule-val">2,200 characters max</span>
          </div>
          <div className="schedule-row">
            <span className="schedule-key">Hashtags</span>
            <span className="schedule-val">30 max per post</span>
          </div>
          <div className="schedule-row">
            <span className="schedule-key">Image formats</span>
            <span className="schedule-val">JPEG, PNG (aspect ratio 4:5 to 1.91:1)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
