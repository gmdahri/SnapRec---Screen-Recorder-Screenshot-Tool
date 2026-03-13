import { useEffect } from 'react';
import { useVideoEditor } from './VideoEditorContext';

export function UnsavedChangesModal() {
  const { unsavedLeaveTarget, cancelUnsavedLeave, confirmUnsavedLeave } = useVideoEditor();

  useEffect(() => {
    if (!unsavedLeaveTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelUnsavedLeave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [unsavedLeaveTarget, cancelUnsavedLeave]);

  if (!unsavedLeaveTarget) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-title"
      onClick={(e) => e.target === e.currentTarget && cancelUnsavedLeave()}
    >
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 pt-6 pb-2">
          <h2 id="unsaved-title" className="text-lg font-bold text-slate-900">
            Unsaved changes
          </h2>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            You have edits that aren’t saved yet. If you leave now, those changes will be lost unless you{' '}
            <strong>Save</strong> first from the top bar.
          </p>
        </div>
        <div className="px-6 py-4 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end bg-slate-50 border-t border-slate-100">
          <button
            type="button"
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 bg-white text-slate-800 hover:bg-slate-100"
            onClick={cancelUnsavedLeave}
          >
            Stay and keep editing
          </button>
          <button
            type="button"
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:opacity-95"
            onClick={confirmUnsavedLeave}
          >
            Leave without saving
          </button>
        </div>
      </div>
    </div>
  );
}
