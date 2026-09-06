import { useState } from 'react';
import { capture } from '../lib/analytics';

export function IssueReport({ title, url }: { title: string; url: string }) {
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [status, setStatus] = useState('');
  return <details style={{ padding: 16, background: 'var(--sr-surface-paper)', color: 'var(--sr-text-primary-on-light)' }}>
    <summary>Prepare a bug report</summary>
    <p>Add context, then paste the report into GitHub, Jira, or your team chat. These fields stay in this tab.</p>
    <label style={{ display: 'block', marginTop: 12 }}>Steps to reproduce<textarea rows={3} style={{ display: 'block', width: '100%', padding: 8, border: '1px solid var(--sr-border-light)' }} value={steps} onChange={e => setSteps(e.target.value)} /></label>
    <label style={{ display: 'block', marginTop: 12 }}>Expected result<textarea rows={3} style={{ display: 'block', width: '100%', padding: 8, border: '1px solid var(--sr-border-light)' }} value={expected} onChange={e => setExpected(e.target.value)} /></label>
    <label style={{ display: 'block', marginTop: 12 }}>Actual result<textarea rows={3} style={{ display: 'block', width: '100%', padding: 8, border: '1px solid var(--sr-border-light)' }} value={actual} onChange={e => setActual(e.target.value)} /></label>
    <button type="button" onClick={async () => {
      try {
        await navigator.clipboard.writeText(`# ${title}\n\nRecording: ${url}\n\n## Steps to reproduce\n${steps}\n\n## Expected result\n${expected}\n\n## Actual result\n${actual}`);
        setStatus('Report copied. Check the capture’s sharing setting before sending.');
        capture('issue_report_copied', { surface: 'share_page' });
      } catch { setStatus('Could not copy. Please allow clipboard access and retry.'); }
    }}>Copy report</button><p role="status">{status}</p>
  </details>;
}
