import { useState } from 'react';

const API = (path, body) => fetch('/.netlify/functions/' + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
}).then(r => r.json());

const TOOLS = [
  { id: 'caption', label: 'Caption Generator', icon: '\u270d\ufe0f', desc: 'Viral captions with hooks & hashtags', placeholder: 'Describe your video content or product...' },
  { id: 'hook', label: 'Hook Generator', icon: '\ud83c\udfa3', desc: '5 scroll-stopping opening lines', placeholder: 'What is your video about?' },
  { id: 'script', label: 'Script Writer', icon: '\ud83d\udcdd', desc: 'Full 30-60s TikTok video script', placeholder: 'Product or topic to script...' },
  { id: 'ad_copy', label: 'Ad Copy', icon: '\ud83d\udce2', desc: '3 high-converting ad copy variations', placeholder: 'Product name and key benefits...' },
  { id: 'product_analysis', label: 'Product Analysis', icon: '\ud83d\udd0d', desc: 'Deep TikTok Shop opportunity analysis', placeholder: 'Product name, price, category...' },
  { id: 'trend_prediction', label: 'Trend Prediction', icon: '\ud83d\udcc8', desc: 'Viral potential and timing predictions', placeholder: 'Product, niche, or trend to analyze...' },
  { id: 'hashtags', label: 'Hashtag Sets', icon: '#\ufe0f\u20e3', desc: 'Optimized hashtag strategy', placeholder: 'Content topic or product...' },
];

export default function AITools({ showToast }) {
  const [activeTool, setActiveTool] = useState(TOOLS[0]);
  const [input, setInput] = useState('');
  const [context, setContext] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState(false);
  const [tokensUsed, setTokensUsed] = useState(0);

  const run = async () => {
    if (!input.trim()) return showToast('Enter some input first', 'error');
    setLoading(true);
    setResult('');
    const data = await API('ai-tools', { type: activeTool.id, input: input.trim(), context });
    if (data.success) {
      setResult(data.result);
      setTokensUsed(prev => prev + (data.tokens || 0));
      setHistory(h => [{ tool: activeTool.label, input: input.slice(0, 60), result: data.result, tokens: data.tokens, time: new Date().toLocaleTimeString() }, ...h].slice(0, 10));
      showToast(activeTool.label + ' complete!', 'success');
    } else {
      showToast(data.error || 'AI error', 'error');
    }
    setLoading(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Copied!', 'success');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Tools</h1>
          <p className="page-subtitle">7 AI-powered tools &middot; {tokensUsed.toLocaleString()} tokens used this session</p>
        </div>
      </div>
      <div className="ai-layout">
        <div className="ai-sidebar">
          <div className="ai-tool-list">
            {TOOLS.map(tool => (
              <button key={tool.id} className={'ai-tool-btn' + (activeTool.id === tool.id ? ' active' : '')} onClick={() => { setActiveTool(tool); setResult(''); setInput(''); }}>
                <span className="tool-icon">{tool.icon}</span>
                <div className="tool-info">
                  <div className="tool-name">{tool.label}</div>
                  <div className="tool-desc">{tool.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="ai-main">
          <div className="ai-input-section">
            <div className="ai-tool-header">
              <span className="tool-icon-lg">{activeTool.icon}</span>
              <div>
                <h2 className="ai-tool-title">{activeTool.label}</h2>
                <p className="ai-tool-desc">{activeTool.desc}</p>
              </div>
            </div>
            <div className="form-group">
              <label>Input</label>
              <textarea className="ai-textarea" rows={4} value={input} onChange={e => setInput(e.target.value)} placeholder={activeTool.placeholder} />
            </div>
            {(activeTool.id === 'caption' || activeTool.id === 'script') && (
              <div className="form-group">
                <label>Context (optional)</label>
                <input value={context} onChange={e => setContext(e.target.value)} placeholder="e.g. TikTok Shop, beauty niche, female audience 18-35..." />
              </div>
            )}
            <button className="btn-primary" style={{ width: '100%' }} onClick={run} disabled={loading}>
              {loading ? activeTool.icon + ' Generating...' : activeTool.icon + ' Generate'}
            </button>
          </div>
          {result && (
            <div className="ai-result-section">
              <div className="ai-result-header">
                <span>Result</span>
                <button className="btn-sm" onClick={copy}>{copied ? '\u2713 Copied!' : 'Copy'}</button>
              </div>
              <div className="ai-result-body">
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{result}</pre>
              </div>
            </div>
          )}
        </div>
        {history.length > 0 && (
          <div className="ai-history">
            <div className="ai-history-title">Recent</div>
            {history.map((h, i) => (
              <div key={i} className="ai-history-item" onClick={() => setResult(h.result)}>
                <div className="history-tool">{h.tool}</div>
                <div className="history-input">{h.input}</div>
                <div className="history-meta">{h.time} &middot; {h.tokens} tokens</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
