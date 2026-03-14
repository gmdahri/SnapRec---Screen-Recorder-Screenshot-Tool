import { useMemo } from 'react';
import { useVideoEditor } from './VideoEditorContext';
import { EDITOR_LEFT_PANEL_WIDTH, EDITOR_STORAGE_LIMIT_BYTES } from './editorLayout';

function formatStorageShort(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Nested gallery: Your media / Favorites + list (lives in right dock “Media gallery” tab) */
export function MediaGalleryNested({ omitTabRow = false }: { omitTabRow?: boolean } = {}) {
  const {
    clips,
    selectedClipId,
    setSelectedClipId,
    mediaLibraryTab,
    setMediaLibraryTab,
    favoriteClipIds,
    toggleFavoriteClip,
  } = useVideoEditor();

  const favoriteClips = useMemo(
    () => clips.filter((c) => favoriteClipIds.includes(c.id)),
    [clips, favoriteClipIds],
  );

  const usedBytes = useMemo(
    () => clips.reduce((sum, c) => sum + (c.sizeBytes ?? 0), 0),
    [clips],
  );
  const pct = Math.min(100, (usedBytes / EDITOR_STORAGE_LIMIT_BYTES) * 100);

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
      {!omitTabRow ? (
        <div className="flex border-b border-slate-100 px-2 pt-2 gap-1 shrink-0" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mediaLibraryTab === 'your'}
            onClick={() => setMediaLibraryTab('your')}
            className={`flex-1 py-2 px-1 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
              mediaLibraryTab === 'your'
                ? 'border-primary text-primary bg-violet-50/80'
                : 'border-transparent text-slate-500 hover:bg-slate-50'
            }`}
          >
            Your media <span className="opacity-70">({clips.length})</span>
          </button>
          <div
            className="flex-1 py-2 px-1 text-center rounded-t-lg text-slate-400 cursor-not-allowed text-xs font-semibold bg-slate-50"
            title="Coming soon"
          >
            Stock <span className="block text-[10px] text-amber-600">Soon</span>
          </div>
          <button
            type="button"
            role="tab"
            aria-selected={mediaLibraryTab === 'favorites'}
            onClick={() => setMediaLibraryTab('favorites')}
            className={`flex-1 py-2 px-1 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
              mediaLibraryTab === 'favorites'
                ? 'border-primary text-primary bg-violet-50/80'
                : 'border-transparent text-slate-500 hover:bg-slate-50'
            }`}
          >
            Favorites <span className="opacity-70">({favoriteClips.length})</span>
          </button>
        </div>
      ) : null}

      <div className="p-3 border-b border-slate-100 shrink-0">
        <button
          type="button"
          disabled
          className="w-full bg-slate-100 text-slate-500 py-2 rounded-xl text-sm font-medium cursor-not-allowed flex items-center justify-center gap-2"
        >
          + Import media <span className="text-amber-700 text-xs font-semibold">Soon</span>
        </button>
      </div>

      {mediaLibraryTab === 'your' && (
        <div className="flex-1 overflow-y-auto p-3 min-h-0 space-y-2">
          {clips.map((c) => (
            <div
              key={c.id}
              className={`flex rounded-xl border overflow-hidden ${
                selectedClipId === c.id ? 'border-primary bg-violet-50' : 'border-slate-200 bg-white'
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedClipId(c.id)}
                className="flex-1 flex gap-3 p-2 text-left min-w-0"
              >
                <div className="w-16 h-10 bg-slate-200 rounded-md shrink-0 flex items-center justify-center text-slate-400 text-xs">
                  ▶
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {c.durationLabel} · {c.res} · {c.fps}
                  </p>
                </div>
              </button>
              <button
                type="button"
                title="Favorite"
                onClick={() => toggleFavoriteClip(c.id)}
                className={`shrink-0 w-11 flex items-center justify-center text-lg border-l ${
                  favoriteClipIds.includes(c.id)
                    ? 'text-amber-500 bg-amber-50 border-amber-100'
                    : 'text-slate-300 border-slate-100 hover:bg-slate-50'
                }`}
                aria-pressed={favoriteClipIds.includes(c.id)}
              >
                ★
              </button>
            </div>
          ))}
        </div>
      )}

      {mediaLibraryTab === 'favorites' && (
        <div className="flex-1 overflow-y-auto p-3 min-h-0 space-y-2">
          {favoriteClips.length === 0 ? (
            <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
              <p className="text-sm text-slate-600">No favorites yet.</p>
              <p className="text-xs text-slate-500 mt-1">Star a clip under Your media.</p>
              <button
                type="button"
                className="mt-3 text-sm font-semibold text-primary"
                onClick={() => setMediaLibraryTab('your')}
              >
                Your media
              </button>
            </div>
          ) : (
            favoriteClips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedClipId(c.id);
                  setMediaLibraryTab('your');
                }}
                className="w-full flex gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-left"
              >
                <span className="text-amber-500 text-lg">★</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                  <p className="text-xs text-slate-500">
                    {c.durationLabel} · {c.res}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      <div className="p-3 border-t border-slate-200 bg-slate-50 shrink-0">
        <div className="flex justify-between text-xs text-slate-600 mb-1">
          <span>Storage</span>
          <span>
            {formatStorageShort(usedBytes)} / 100 MB
          </span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** Main media nav on the left (Your media, Stock, Favorites) */
export function LeftSidebarNav({ variant = 'media' }: { variant?: 'media' }) {
  const {
    projectTitle,
    hasTimelineContent,
    clips,
    mediaLibraryTab,
    setMediaLibraryTab,
    favoriteClipIds,
    setRightDockTab,
  } = useVideoEditor();

  const favCount = clips.filter((c) => favoriteClipIds.includes(c.id)).length;

  return (
    <aside
      className={`${EDITOR_LEFT_PANEL_WIDTH} bg-white border-r border-slate-200 flex flex-col hidden lg:flex min-h-0`}
    >
      <div className="p-4 border-b border-slate-200 bg-gradient-to-b from-violet-50/50 to-white">
        <h2 className="text-lg font-extrabold text-primary leading-tight">
          {variant === 'media' ? 'Media' : 'Project'}
        </h2>
        <p className="text-sm font-medium text-slate-800 truncate mt-1">{projectTitle}</p>
        <p className="text-xs text-slate-500 mt-2">Clips and favorites — add to the timeline.</p>
      </div>
      <ul className="p-2 space-y-1 flex-1 overflow-y-auto">
        <li>
          <button
            type="button"
            onClick={() => {
              setMediaLibraryTab('your');
              setRightDockTab('mediaGallery');
            }}
            className={`w-full text-left py-2.5 px-3 rounded-xl text-sm font-medium transition-colors flex justify-between items-center ${
              mediaLibraryTab === 'your' ? 'bg-violet-50 text-primary' : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            Your media
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
              {hasTimelineContent ? clips.length : 0}
            </span>
          </button>
        </li>
        <li>
          <div
            className="w-full py-2.5 px-3 rounded-xl text-sm text-slate-400 cursor-not-allowed flex justify-between items-center bg-slate-50"
            title="Coming soon"
          >
            Stock
            <span className="text-xs text-amber-700 font-semibold">Soon</span>
          </div>
        </li>
        <li>
          <button
            type="button"
            onClick={() => {
              setMediaLibraryTab('favorites');
              setRightDockTab('mediaGallery');
            }}
            className={`w-full text-left py-2.5 px-3 rounded-xl text-sm font-medium transition-colors flex justify-between items-center ${
              mediaLibraryTab === 'favorites' ? 'bg-violet-50 text-primary' : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            Favorites
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{favCount}</span>
          </button>
        </li>
      </ul>
    </aside>
  );
}

/** Right dock “Media gallery” tab: same block as former left column + clip lists (no duplicate tab row). */
export function MediaGalleryTabContent() {
  const {
    projectTitle,
    hasTimelineContent,
    clips,
    mediaLibraryTab,
    setMediaLibraryTab,
    favoriteClipIds,
  } = useVideoEditor();

  const favCount = clips.filter((c) => favoriteClipIds.includes(c.id)).length;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 p-4 border-b border-slate-200 bg-gradient-to-b from-violet-50/50 to-white">
        <h2 className="text-lg font-extrabold text-primary leading-tight">Media</h2>
        <p className="text-sm font-medium text-slate-800 truncate mt-1">{projectTitle}</p>
        <p className="text-xs text-slate-500 mt-2">Your media, stock, and favorites — add clips to the timeline.</p>
      </div>
      <ul className="shrink-0 p-2 space-y-1 border-b border-slate-100 bg-white">
        <li>
          <button
            type="button"
            onClick={() => setMediaLibraryTab('your')}
            className={`w-full text-left py-2.5 px-3 rounded-xl text-sm font-medium transition-colors flex justify-between items-center ${
              mediaLibraryTab === 'your' ? 'bg-violet-50 text-primary' : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            Your media
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
              {hasTimelineContent ? clips.length : 0}
            </span>
          </button>
        </li>
        <li>
          <div
            className="w-full py-2.5 px-3 rounded-xl text-sm text-slate-400 cursor-not-allowed flex justify-between items-center bg-slate-50"
            title="Coming soon"
          >
            Stock
            <span className="text-xs text-amber-700 font-semibold">Soon</span>
          </div>
        </li>
        <li>
          <button
            type="button"
            onClick={() => setMediaLibraryTab('favorites')}
            className={`w-full text-left py-2.5 px-3 rounded-xl text-sm font-medium transition-colors flex justify-between items-center ${
              mediaLibraryTab === 'favorites' ? 'bg-violet-50 text-primary' : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            Favorites
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{favCount}</span>
          </button>
        </li>
      </ul>
      <div className="min-h-0 min-w-0 flex-1 flex flex-col overflow-hidden">
        <MediaGalleryNested omitTabRow />
      </div>
    </div>
  );
}
