import { Search } from 'lucide-react';
import { useState } from 'react';
import { trackEvent } from '../lib/analytics.js';

export default function SaveAnalysisButton({ disabled, snapshot }) {
  const [status, setStatus] = useState('');

  const analyzeNow = () => {
    if (!snapshot) return;

    trackEvent('analyze_click');
    setStatus('已更新分析結果。');
    document.getElementById('charts')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => setStatus(''), 1800);
  };

  return (
    <div className="save-analysis">
      <button type="button" onClick={analyzeNow} disabled={disabled}>
        <Search size={16} />
        立即分析
      </button>
      {status ? <small>{status}</small> : null}
    </div>
  );
}
