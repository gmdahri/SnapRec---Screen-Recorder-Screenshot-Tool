import { useRef, useState, useMemo } from 'react';
import { useVideoEditor } from './VideoEditorContext';
import { fetchBlobWithAuth } from '../../hooks/useRecordings';

function safeFilename(name: string, ext: string) {
  const base = name
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'export';
  const e = ext.startsWith('.') ? ext : `.${ext}`;
  return `${base}${e}`;
}

export function ExportModal() {
  const {
    exportModal,
    setExportModal,
    currentProjectId,
    projectTitle,
    setStagedExport,
    stagedExportLabel,
    stagedExportFile,
    editorVideoSrc,
    trimStartSec,
    trimEndSec,
    videoDurationSec,
    zoomSegments,
    recordingMeta,
  } = useVideoEditor();

  const [err, setErr] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [fileBaseName, setFileBaseName] = useState('');
  const [fileExtension, setFileExtension] = useState<'webm' | 'mp4'>('webm');
  const fileRef = useRef<HTMLInputElement>(null);

  const defaultBase = useMemo(() => {
    const slug = projectTitle.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'video';
    const d = new Date().toISOString().slice(0, 10);
    return `${slug}-${d}`;
  }, [projectTitle]);

  const effectiveBase = fileBaseName.trim() || defaultBase;
  const trimHint =
    videoDurationSec > 0 && trimEndSec > trimStartSec
      ? `Trim in the editor: ${trimStartSec.toFixed(1)}s–${trimEndSec.toFixed(1)}s. Use Trim → Modify if you need that range as the file, then download.`
      : null;
  const zoomHint =
    'Zoom segments are preview-only in the editor; downloaded file does not include zoom yet.';
  const noAutoZoomGuard =
    zoomSegments.length === 0 &&
    recordingMeta &&
    (recordingMeta.pointerSamples?.length ?? 0) + (recordingMeta.clicks?.length ?? 0) > 0;

  if (exportModal === 'closed') return null;

  async function downloadCurrentVideo() {
    setErr(null);
    if (!editorVideoSrc) {
      setErr('No video loaded. Open a project first.');
      return;
    }
    setDownloading(true);
    try {
      let blob: Blob;
      if (editorVideoSrc.startsWith('blob:')) {
        const r = await fetch(editorVideoSrc);
        blob = await r.blob();
      } else {
        blob = await fetchBlobWithAuth(editorVideoSrc);
      }
      const ext =
        fileExtension === 'mp4' && blob.type.includes('mp4')
          ? 'mp4'
          : fileExtension === 'mp4'
            ? 'mp4'
            : blob.type.includes('webm')
              ? 'webm'
              : fileExtension;
      const name = safeFilename(effectiveBase, ext);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Download failed. Try Trim → Modify, then download again.');
    } finally {
      setDownloading(false);
    }
  }

  function downloadStagedFile() {
    if (!stagedExportFile) return;
    const url = URL.createObjectURL(stagedExportFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFilename(stagedExportLabel?.replace(/\.[^.]+$/, '') || 'video', stagedExportFile.name.split('.').pop() || 'webm');
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-title"
    >
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 id="export-title" className="text-lg font-semibold">
            Export
          </h2>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600 p-1 text-xl leading-none"
            onClick={() => setExportModal('closed')}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
          {/* Save to device */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Save video to your device</h3>
            <p className="text-sm text-slate-600">
              Downloads a copy of the video you’re editing. No upload—file is saved where your browser puts downloads
              (often Downloads folder).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">File name</label>
                <input
                  type="text"
                  value={fileBaseName}
                  onChange={(e) => setFileBaseName(e.target.value)}
                  placeholder={defaultBase}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Extension</label>
                <select
                  value={fileExtension}
                  onChange={(e) => setFileExtension(e.target.value as 'webm' | 'mp4')}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="webm">.webm (common for edited clips)</option>
                  <option value="mp4">.mp4 (if source is MP4)</option>
                </select>
              </div>
            </div>
            {trimHint && <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">{trimHint}</p>}
            {noAutoZoomGuard && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No auto-zoom detected for this recording — export will be flat. Add zoom in the Zoom panel if needed.
              </p>
            )}
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{zoomHint}</p>
            <button
              type="button"
              disabled={!editorVideoSrc || downloading}
              onClick={() => void downloadCurrentVideo()}
              className="w-full py-3 rounded-xl text-sm font-bold bg-primary text-white hover:opacity-95 disabled:opacity-50"
            >
              {downloading ? 'Preparing download…' : 'Download video'}
            </button>
          </section>

          <hr className="border-slate-100" />

          {/* Optional: replace project video on Save */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Use another file in this project</h3>
            <p className="text-sm text-slate-600">
              Pick a video from your computer. After you click <strong>Save</strong> in the header, that file becomes
              this project’s video online.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="text-sm w-full"
              onChange={() => setErr(null)}
            />
            {stagedExportFile && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex flex-wrap items-center gap-2">
                <span>
                  Ready on Save: <strong>{stagedExportLabel}</strong>
                </span>
                <button
                  type="button"
                  className="text-xs font-bold underline"
                  onClick={() => downloadStagedFile()}
                >
                  Download copy
                </button>
                <button
                  type="button"
                  className="text-xs font-bold underline"
                  onClick={() => {
                    setStagedExport(null);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                >
                  Remove
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200"
                onClick={() => setExportModal('closed')}
              >
                Close
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 text-white disabled:opacity-50"
                disabled={!currentProjectId}
                onClick={() => {
                  const f = fileRef.current?.files?.[0];
                  if (!currentProjectId) {
                    setErr('Open a project first.');
                    return;
                  }
                  if (!f) {
                    setErr('Choose a video file first.');
                    return;
                  }
                  setStagedExport(f);
                  setErr(null);
                }}
              >
                Use file on next Save
              </button>
            </div>
          </section>

          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</p>}
          <p className="text-[10px] text-slate-400">Project: {projectTitle}</p>
        </div>
      </div>
    </div>
  );
}
