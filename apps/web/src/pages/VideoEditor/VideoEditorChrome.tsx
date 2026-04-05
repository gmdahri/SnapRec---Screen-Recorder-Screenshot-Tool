import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useVideoEditor } from './VideoEditorContext';
import type { EditorTool } from './types';
import UserMenu from '../../components/UserMenu';
import LoginModal from '../../components/LoginModal';

const tools: { id: EditorTool; name: string; disabled?: boolean }[] = [
  { id: 'media', name: 'Media' },
  { id: 'trim', name: 'Trim' },
  { id: 'speed', name: 'Speed' },
  { id: 'zoom', name: 'Zoom' },
  { id: 'text', name: 'Text', disabled: true },
  { id: 'effects', name: 'Effects', disabled: true },
];

/** Stroke icons aligned with Stitch / editor spec (heroicons-style). */
function ToolIcon({ id }: { id: EditorTool }) {
  const common = { className: 'w-6 h-6', fill: 'none', stroke: 'currentColor', strokeWidth: 2, viewBox: '0 0 24 24' as const };
  switch (id) {
    case 'media':
      return (
        <svg {...common} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'trim':
      return (
        <svg {...common} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758L5 19m0-14l4.121 4.121" />
        </svg>
      );
    case 'speed':
      return (
        <svg {...common} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'text':
      return (
        <svg {...common} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
        </svg>
      );
    case 'zoom':
      return (
        <svg {...common} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 8v6M8 11h6" />
        </svg>
      );
    case 'effects':
      return (
        <svg {...common} aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
          />
        </svg>
      );
    default:
      return null;
  }
}

export function VideoEditorChrome({ children }: { children: React.ReactNode }) {
  const {
    projectTitle,
    setProjectTitle,
    activeTool,
    setActiveTool,
    setWorkspace,
    setRightDockTab,
    setExportModal,
    setShareModal,
    currentProjectId,
    hasUnsavedChanges,
    saveProject,
    saveStatus,
    stagedExportFile,
  } = useVideoEditor();

  const [showLoginModal, setShowLoginModal] = useState(false);

  const onTool = (t: EditorTool) => {
    setActiveTool(t);
    if (t === 'media') {
      setRightDockTab('mediaGallery');
      setWorkspace('media');
    } else if (t === 'trim') {
      setRightDockTab('properties');
      setWorkspace('trim');
    } else if (t === 'speed') {
      setRightDockTab('properties');
      setWorkspace('speed');
    } else if (t === 'zoom') {
      setWorkspace('zoom');
    } else {
      setWorkspace('timeline');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#f8fafc] text-slate-800 overflow-hidden font-[family-name:var(--font-display)]">
      <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-4 gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <Link
            to="/dashboard"
            className="flex items-center shrink-0 rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary py-0.5"
            title="Dashboard"
          >
            <img
              src="/logo.png"
              alt="SnapRec"
              className="h-8 w-auto object-contain object-left max-w-[9rem] sm:max-w-none"
            />
          </Link>
          <Link
            to="/video-editor"
            className="text-sm font-semibold text-primary hover:underline shrink-0 hidden sm:inline border-l border-slate-200 pl-3"
          >
            All video projects
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <input
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              className="text-sm font-medium border-0 bg-slate-100 rounded-lg px-3 py-1.5 max-w-[200px] focus:ring-2 focus:ring-primary"
              aria-label="Project title"
            />
          </div>
        </div>
        <div className="flex-1 max-w-md hidden md:block">
          <input
            type="search"
            placeholder="Search assets, effects…"
            className="w-full rounded-full bg-slate-100 border-0 px-4 py-2 text-sm focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {currentProjectId && (
            <button
              type="button"
              disabled={!hasUnsavedChanges || saveStatus === 'saving'}
              onClick={() => void saveProject()}
              className={`px-3 py-2 text-sm font-semibold rounded-lg border ${
                hasUnsavedChanges
                  ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                  : 'border-slate-200 text-slate-400 cursor-not-allowed bg-slate-50'
              } disabled:opacity-60`}
              title={
                hasUnsavedChanges
                  ? stagedExportFile
                    ? 'Save uploads staged file, title, trim & playback speed'
                    : 'Save title, trim & playback speed to server'
                  : 'No changes to save'
              }
            >
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Retry save' : 'Save'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShareModal(true)}
            className="px-3 py-2 text-sm font-semibold border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Share
          </button>
          <button
            type="button"
            onClick={() => setExportModal('settings')}
            className="px-4 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:opacity-90"
          >
            Export
          </button>
          <UserMenu onSignIn={() => setShowLoginModal(true)} />
        </div>
      </header>
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      <div className="flex flex-1 min-h-0">
        <nav
          className="w-[4.5rem] sm:w-[5rem] shrink-0 bg-slate-50/80 border-r border-slate-200 flex flex-col items-center py-4 px-2 gap-3"
          aria-label="Editor tools"
        >
          {tools.map(({ id, name, disabled }) =>
            disabled ? (
              <div
                key={id}
                className="flex flex-col items-center gap-1.5 w-full py-2 rounded-2xl bg-white/60 border border-slate-100 text-slate-400 cursor-not-allowed select-none"
                title={`${name} — coming soon`}
                aria-disabled
              >
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-400">
                  <ToolIcon id={id} />
                </span>
                <span className="text-[11px] font-medium text-slate-500 text-center leading-none">{name}</span>
                <span className="text-[10px] font-medium text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded-full">
                  Soon
                </span>
              </div>
            ) : (
              <button
                key={id}
                type="button"
                aria-label={name}
                aria-pressed={activeTool === id}
                onClick={() => onTool(id)}
                className={`group flex flex-col items-center gap-2 w-full py-3 rounded-2xl transition-all duration-200 ${
                  activeTool === id
                    ? 'bg-white shadow-md shadow-violet-100/80 text-primary border border-violet-200/80'
                    : 'text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200/80'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-11 h-11 rounded-full transition-colors ${
                    activeTool === id
                      ? 'bg-violet-100 text-primary'
                      : 'bg-white text-slate-500 group-hover:text-slate-700 ring-1 ring-slate-200/80'
                  }`}
                >
                  <ToolIcon id={id} />
                </span>
                <span
                  className={`text-[13px] font-semibold tracking-tight text-center leading-tight px-0.5 ${
                    activeTool === id ? 'text-primary' : 'text-slate-700'
                  }`}
                >
                  {name}
                </span>
              </button>
            ),
          )}
        </nav>
        {children}
      </div>
    </div>
  );
}
