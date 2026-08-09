import { useState } from 'react';
import { useVideoEditor } from './VideoEditorContext';

export function ShareModal() {
  const { shareModal, setShareModal } = useVideoEditor();
  const [copied, setCopied] = useState(false);
  const url = 'https://snaprecorder.org/v/abcd123';
  if (!shareModal) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-title"
    >
      <div className="bg-[var(--sr-surface-panel-dark)] w-full max-w-[480px] rounded-[2px] shadow-2xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 id="share-title" className="text-2xl font-bold">
            Share
          </h2>
          <button
            type="button"
            className="text-[var(--sr-text-faint-on-dark)] hover:text-[var(--sr-text-muted-on-dark)]"
            onClick={() => setShareModal(false)}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <label className="text-xs font-semibold text-[var(--sr-text-faint-on-dark)] uppercase tracking-wider block mb-2">
          Project link
        </label>
        <div className="flex gap-2 mb-8">
          <input readOnly value={url} className="flex-1 bg-[var(--sr-surface-panel-dark)] border border-[var(--sr-border-dark)] rounded-[2px] px-4 py-3 text-sm" />
          <button
            type="button"
            onClick={copy}
            className="bg-[var(--sr-cyan)] text-white font-semibold px-6 py-3 rounded-[2px] hover:opacity-90"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold">Public</p>
              <p className="text-sm text-[var(--sr-text-faint-on-dark)]">Anyone with the link can view</p>
            </div>
            <span className="text-xs text-[var(--sr-cyan)] font-medium">On</span>
          </div>
          <hr className="border-[var(--sr-border-dark)]" />
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold">Unlisted</p>
              <p className="text-sm text-[var(--sr-text-faint-on-dark)]">Hidden from search</p>
            </div>
            <span className="text-xs text-[var(--sr-text-faint-on-dark)]">Off</span>
          </div>
        </div>
        <button
          type="button"
          className="w-full bg-[var(--sr-surface-carbon)] text-white font-bold py-4 rounded-[2px] hover:bg-black"
          onClick={() => setShareModal(false)}
        >
          Done
        </button>
      </div>
    </div>
  );
}
