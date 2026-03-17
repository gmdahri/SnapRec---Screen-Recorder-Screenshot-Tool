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
      <div className="bg-white w-full max-w-[480px] rounded-2xl shadow-2xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 id="share-title" className="text-2xl font-bold">
            Share
          </h2>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600"
            onClick={() => setShareModal(false)}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
          Project link
        </label>
        <div className="flex gap-2 mb-8">
          <input readOnly value={url} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" />
          <button
            type="button"
            onClick={copy}
            className="bg-primary text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold">Public</p>
              <p className="text-sm text-slate-500">Anyone with the link can view</p>
            </div>
            <span className="text-xs text-primary font-medium">On</span>
          </div>
          <hr className="border-slate-100" />
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold">Unlisted</p>
              <p className="text-sm text-slate-500">Hidden from search</p>
            </div>
            <span className="text-xs text-slate-400">Off</span>
          </div>
        </div>
        <button
          type="button"
          className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-black"
          onClick={() => setShareModal(false)}
        >
          Done
        </button>
      </div>
    </div>
  );
}
