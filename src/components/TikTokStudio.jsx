import { useState, useEffect, useRef } from 'react';

// Viral hooks bank for TikTok
const HOOKS = [
  'POV: you found the product everyone is sleeping on',
  'this is why your content isn\'t going viral',
  'stop scrolling — this actually works',
  'the product that sold out twice this week',
  'nobody talks about this but it changes everything',
  'I tested this for 30 days. here\'s what happened',
  'this is what the algorithm wants right now',
  'looksmax tip that works in 7 days',
  'the reason you look the same every month',
  'drop everything and watch this',
  'the routine that got me 10k followers in a month',
  'why every guy needs this in 2026',
  'I almost didn\'t post this',
  'this product is going viral for a reason',
];

const SOUNDS = [
  { name: 'Aesthetic Chill', bpm: 90, vibe: 'calm', uses: '2.1M' },
  { name: 'Trending Phonk', bpm: 140, vibe: 'hype', uses: '5.4M' },
  { name: 'Lo-fi Study', bpm: 75, vibe: 'chill', uses: '3.8M' },
  { name: 'Sigma Edit', bpm: 128, vibe: 'cinematic', uses: '1.9M' },
  { name: 'Viral Bass Drop', bpm: 150, vibe: 'hype', uses: '4.2M' },
  { name: 'Soft Pop', bpm: 100, vibe: 'positive', uses: '6.1M' },
  { name: 'Dark Academia', bpm: 80, vibe: 'moody', uses: '1.1M' },
  { name: 'Viral Hook Beat', bpm: 120, vibe: 'energetic', uses: '8.3M' },
];

const TAG_SETS = {
  looksmax: '#looksmax #mog #glow #ascenddeals #fyp #viral #looksmaxxing #selfcare',
  skincare: '#skincare #glowup #routine #ascenddeals #fyp #viral #selfimprovement',
  grooming: '#grooming #mog #cleancut #ascenddeals #fyp #viral',
  deals: '#deals #ascenddeals #fyp #viral #tiktokmademebuyit #tiktokshop',
  fitness: '#fitness #gym #gains #ascenddeals #fyp #viral #physique',
  lifestyle: '#lifestyle #levelup #glow #ascenddeals #fyp #viral',
};

const CHECKLIST_ITEMS = [
  'Hook in first 1-2 seconds',
  'No dead air at the start',
  'Good lighting / clear face or product',
  'Caption written and reviewed',
  'Hashtags added (6-8 max)',
  'Sound matches video energy',
  'CTA at the end (link in bio)',
  'Video is between 7-30 seconds',
  'Thumbnail is eye-catching',
  'Posted during peak hours (6-9pm)',
];

function ViralScore({ caption, hook, tags }) {
  const score = Math.min(100, Math.round(
    (caption.length > 20 ? 20 : caption.length) +
    (hook ? 25 : 0) +
    (tags ? 20 : 0) +
    (caption.includes('link in bio') ? 15 : 0) +
    (caption.includes('#fyp') ? 10 : 0) +
    (caption.includes('#ascenddeals') ? 10 : 0)
  ));
  const color = score >= 80 ? 'var(--emerald-lt)' : score >= 55 ? 'var(--gold-light)' : 'var(--red-lt)';
  const label = score >= 80 ? 'High Viral Potential' : score >= 55 ? 'Moderate' : 'Needs Work';
  return (
    <div style={{ background: 'var(--charcoal-3)', borderRadius: 12, padding: '16px 20px', border: '1px solid var(--creme-border)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Viral Score</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 40, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{score}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Based on caption, hooks, tags</div>
        </div>
      </div>
      <div style={{ height: 5, background: 'var(--charcoal-4)', borderRadius: 99, overflow: 'hidden', marginTop: 12 }}>
        <div style={{ height: '100%', width: score + '%', background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

export default function TikTokStudio({ showToast }) {
  const [caption, setCaption] = useState('');
  const [selectedHook, setSelectedHook] = useState('');
  const [selectedTags, setSelectedTags] = useState('');
  const [checklist, setChecklist] = useState(() => CHECKLIST_ITEMS.map(() => false));
  const [sessionTimer, setSessionTimer] = useState(0);
  const [sessionRunning, setSessionRunning] = useState(false);
  const [postsThisSession, setPostsThisSession] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [hookShuffle, setHookShuffle] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (sessionRunning) {
      timerRef.current = setInterval(() => setSessionTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [sessionRunning]);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return (h > 0 ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  };

  const applyHook = (hook) => {
    setSelectedHook(hook);
    setCaption(hook + '\n\nlink in bio\n\n' + (selectedTags || '#fyp #viral #ascenddeals #looksmax'));
  };

  const applyTags = (tags) => {
    setSelectedTags(tags);
    const base = selectedHook || caption.split('\n')[0];
    setCaption(base + (base ? '\n\nlink in bio\n\n' : '') + tags);
  };

  const generateCaption = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/.netlify/functions/ai-tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'caption', input: 'TikTok Shop product video for @ascend.deals looksmax account', context: 'Male self-improvement, skincare, grooming, lifestyle' }),
      });
      const data = await res.json();
      if (data.result) { setCaption(data.result); showToast('Caption generated!', 'success'); }
      else throw new Error(data.error || 'Failed');
    } catch (e) { showToast('AI error: ' + e.message, 'error'); }
    finally { setGenerating(false); }
  };

  const copyCaption = () => {
    navigator.clipboard.writeText(caption).then(() => showToast('Caption copied!', 'success'));
  };

  const shuffleHook = () => {
    const next = (hookShuffle + 1) % HOOKS.length;
    setHookShuffle(next);
    applyHook(HOOKS[next]);
  };

  const toggleCheck = (i) => {
    setChecklist(prev => prev.map((v, j) => j === i ? !v : v));
  };

  const checksDone = checklist.filter(Boolean).length;
  const allDone = checksDone === CHECKLIST_ITEMS.length;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">🎥 TikTok Studio</div>
          <div className="page-meta">Your live posting command center</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {sessionRunning && (
            <div style={{ background: 'var(--charcoal-3)', border: '1px solid var(--creme-border)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'var(--gold-light)', fontWeight: 700 }}>
              ⏱ {formatTime(sessionTimer)}
            </div>
          )}
          <button
            className={sessionRunning ? 'btn-danger' : 'btn-primary'}
            onClick={() => { setSessionRunning(r => !r); if (!sessionRunning) { setSessionTimer(0); setPostsThisSession(0); } }}
          >
            {sessionRunning ? '⏹ End Session' : '▶ Start Session'}
          </button>
        </div>
      </div>

      {sessionRunning && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 20 }}>
          {[
            { label: 'Session Time', val: formatTime(sessionTimer), color: 'var(--gold-light)' },
            { label: 'Posts This Session', val: postsThisSession, color: 'var(--emerald-lt)' },
            { label: 'Checklist', val: checksDone + '/' + CHECKLIST_ITEMS.length, color: allDone ? 'var(--emerald-lt)' : 'var(--blue-lt)' },
          ].map(c => (
            <div key={c.label} style={{ background: 'var(--charcoal-2)', border: '1px solid var(--creme-border)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color, fontVariantNumeric: 'tabular-nums' }}>{c.val}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginTop: 4 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span className="section-label" style={{ margin: 0 }}>🎯 Hook Builder</span>
              <button className="btn-sm" onClick={shuffleHook}>↻ Shuffle Hook</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {HOOKS.map((h, i) => (
                <button key={i} className={'pill' + (selectedHook === h ? ' active' : '')} style={{ fontSize: 11 }} onClick={() => applyHook(h)}>
                  {h.length > 45 ? h.substring(0, 45) + '…' : h}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span className="section-label" style={{ margin: 0 }}>✍ Caption Builder</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-sm" onClick={generateCaption} disabled={generating}>{generating ? 'Generating…' : '✨ AI Generate'}</button>
                <button className="btn-sm" onClick={copyCaption}>📋 Copy</button>
              </div>
            </div>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Your caption will appear here. Pick a hook above, or use AI Generate…"
              rows={6}
              style={{ width: '100%', background: 'var(--charcoal-3)', border: '1px solid var(--creme-border)', borderRadius: 8, padding: '10px 12px', color: 'var(--creme)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{caption.length}/2200 characters</span>
              <button className="btn-primary" style={{ fontSize: 12, padding: '5px 14px' }} onClick={() => { copyCaption(); setPostsThisSession(p => p + 1); showToast('Caption copied — ready to post!', 'success'); }}>
                🚀 Copy & Count Post
              </button>
            </div>
          </div>

          <div className="card">
            <span className="section-label"># Hashtag Sets</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(TAG_SETS).map(([name, tags]) => (
                <button key={name} className={'pill' + (selectedTags === tags ? ' active' : '')} onClick={() => applyTags(tags)}>
                  {name}
                </button>
              ))}
            </div>
            {selectedTags && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--charcoal-3)', borderRadius: 7, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>{selectedTags}</div>
            )}
          </div>

          <div className="card">
            <span className="section-label">🎵 Sound Picks</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SOUNDS.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--charcoal-3)', borderRadius: 8, border: '1px solid var(--creme-border)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🎵</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--creme)' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.bpm} BPM · {s.vibe}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gold-light)', fontWeight: 600 }}>{s.uses} uses</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ViralScore caption={caption} hook={selectedHook} tags={selectedTags} />

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span className="section-label" style={{ margin: 0 }}>✓ Pre-Post Checklist</span>
              <span style={{ fontSize: 11, color: allDone ? 'var(--emerald-lt)' : 'var(--text-muted)', fontWeight: 600 }}>{checksDone}/{CHECKLIST_ITEMS.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {CHECKLIST_ITEMS.map((item, i) => (
                <button key={i} onClick={() => toggleCheck(i)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: '5px 0', textAlign: 'left', width: '100%' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: '2px solid ' + (checklist[i] ? 'var(--emerald-lt)' : 'var(--charcoal-6)'), background: checklist[i] ? 'var(--emerald-dim)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.13s' }}>
                    {checklist[i] && <span style={{ fontSize: 10, color: 'var(--emerald-lt)', fontWeight: 800 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 12.5, color: checklist[i] ? 'var(--text-muted)' : 'var(--creme)', textDecoration: checklist[i] ? 'line-through' : 'none', transition: 'all 0.13s' }}>{item}</span>
                </button>
              ))}
            </div>
            {allDone && (
              <div style={{ marginTop: 12, padding: '10px', background: 'var(--emerald-dim)', borderRadius: 8, textAlign: 'center', fontSize: 13, color: 'var(--emerald-lt)', fontWeight: 700, border: '1px solid rgba(52,211,153,0.2)' }}>
                🔥 You\'re ready to post!
              </div>
            )}
            <button className="btn-ghost" style={{ width: '100%', marginTop: 10, fontSize: 12 }} onClick={() => setChecklist(CHECKLIST_ITEMS.map(() => false))}>
              Reset Checklist
            </button>
          </div>

          <div className="card">
            <span className="section-label">⏰ Best Posting Times</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { time: '6:00 AM – 9:00 AM', strength: 70, label: 'Good' },
                { time: '12:00 PM – 2:00 PM', strength: 60, label: 'Moderate' },
                { time: '6:00 PM – 9:00 PM', strength: 100, label: 'Peak 🔥' },
                { time: '9:00 PM – 11:00 PM', strength: 80, label: 'Great' },
              ].map((t, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--creme)' }}>{t.time}</span>
                    <span style={{ fontSize: 11, color: t.strength === 100 ? 'var(--gold-light)' : 'var(--text-muted)', fontWeight: t.strength === 100 ? 700 : 400 }}>{t.label}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--charcoal-4)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: t.strength + '%', background: t.strength === 100 ? 'var(--gold)' : 'var(--blue-lt)', borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <span className="section-label">💡 Quick Tips</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'Hook must hit in first 1 second',
                'Use trending sounds = 3x more reach',
                'Reply to comments within 30 min',
                'Post 1-3x daily for best growth',
                'Repost every 90 days if it flopped',
              ].map((tip, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--gold)', flexShrink: 0 }}>→</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
