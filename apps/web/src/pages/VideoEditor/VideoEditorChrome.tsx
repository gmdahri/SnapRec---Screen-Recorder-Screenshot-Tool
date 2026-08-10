import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVideoEditor } from './VideoEditorContext';
import { EditorTopBar } from './EditorTopBar';
import type { EditorTool } from './types';
import UserMenu from '../../components/UserMenu';
import LoginModal from '../../components/LoginModal';
import { outputDurationSec } from './cuts';

const tools: { id: EditorTool; name: string; disabled?: boolean }[] = [
  { id: 'media', name: 'Media' },
  { id: 'trim', name: 'Trim' },
  { id: 'speed', name: 'Speed' },
  { id: 'zoom', name: 'Zoom' },
  // Text and Effects were listed here permanently disabled. A control that can
  // never be reached is a dead end, so they are absent until they do something.
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
    exportEdit,
    currentProjectId,
    hasUnsavedChanges,
    saveProject,
    saveStatus,
    trimStartSec,
    trimEndSec,
    cuts,
    videoDurationSec,
    undoEdit,
    redoEdit,
    canUndoEdit,
    canRedoEdit,
    sourceRecordingId,
    publishToRecording,
    publishStatus,
    publishError,
    publishStaleComments,
    stagedExportFile,
  } = useVideoEditor();

  const navigate = useNavigate();

  const [showLoginModal, setShowLoginModal] = useState(false);

  // A publish that fails silently is the worst outcome here: the author walks
  // away believing recipients have the new cut.
  const reportedPublishError = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (publishStatus === 'error' && publishError && reportedPublishError.current !== publishError) {
      reportedPublishError.current = publishError;
      alert(`Publish failed: ${publishError}\n\nThe existing video is unchanged.`);
    }
    if (publishStatus !== 'error') reportedPublishError.current = null;
  }, [publishStatus, publishError]);

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
    <div className="h-screen flex flex-col bg-[var(--sr-surface-carbon)] text-[var(--sr-text-primary-on-dark)] overflow-hidden font-[family-name:var(--sr-font-ui)]">
      <EditorTopBar
        title={projectTitle}
        onTitleChange={setProjectTitle}
        onBack={() => navigate('/video-editor')}
        // The trim less what the cuts remove, not the trim alone. Removing
        // 11.7s of silence left the header reading "0:42 of 0:42 kept" while
        // the Output panel beside it correctly showed the shorter length.
        keptSec={outputDurationSec(trimStartSec, trimEndSec, cuts)}
        totalSec={videoDurationSec}
        hasUnsavedChanges={hasUnsavedChanges}
        saveStatus={saveStatus}
        onSave={() => void saveProject()}
        onExport={() => void exportEdit()}
        canSave={!!currentProjectId && hasUnsavedChanges && saveStatus !== 'saving'}
        onPublish={sourceRecordingId ? () => {
          // Follows the codebase's existing confirm() convention (see Library's
          // delete). Publishing is irreversible — there is no version history
          // (plan O4) — so the wording says exactly what it replaces.
          const ok = confirm(
            'Replace the video at the existing share link?\n\n'
            + 'Everyone with the link will see this edit instead. '
            + 'Comments and view counts are kept, but the previous video '
            + 'cannot be recovered.',
          );
          if (!ok) return;
          void publishToRecording().then(() => {
            if (publishStaleComments > 0) {
              alert(
                `Published. ${publishStaleComments} comment(s) now point past the `
                + 'end of the shortened video and are marked as referring to '
                + 'removed footage.',
              );
            }
          });
        } : undefined}
        publishStatus={publishStatus}
        canPublish={!!stagedExportFile}
        publishBlockedReason="Apply your edit first — there is nothing new to publish"
        onUndo={undoEdit}
        onRedo={redoEdit}
        canUndo={canUndoEdit}
        canRedo={canRedoEdit}
        trailing={<UserMenu onSignIn={() => setShowLoginModal(true)} />}
      />
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      <div className="flex flex-1 min-h-0">
        <nav
          className="w-[4.5rem] sm:w-[5rem] shrink-0 bg-[var(--sr-surface-panel-dark)]/80 border-r border-[var(--sr-border-dark)] flex flex-col items-center py-4 px-2 gap-3"
          aria-label="Editor tools"
        >
          {tools.map(({ id, name, disabled }) =>
            disabled ? (
              <div
                key={id}
                className="flex flex-col items-center gap-1.5 w-full py-2 rounded-[2px] bg-[var(--sr-surface-panel-dark)]/60 border border-[var(--sr-border-dark)] text-[var(--sr-text-faint-on-dark)] cursor-not-allowed select-none"
                title={`${name} — coming soon`}
                aria-disabled
              >
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--sr-surface-panel-dark)] text-[var(--sr-text-faint-on-dark)]">
                  <ToolIcon id={id} />
                </span>
                <span className="text-[11px] font-medium text-[var(--sr-text-faint-on-dark)] text-center leading-none">{name}</span>
                <span className="text-[10px] font-medium text-[var(--sr-text-faint-on-dark)] bg-[var(--sr-surface-panel-dark-alt)] px-2 py-0.5 rounded-[2px]">
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
                className={`group flex flex-col items-center gap-2 w-full py-3 rounded-[2px] transition-all duration-200 ${
                  activeTool === id
                    ? 'bg-[var(--sr-surface-panel-dark)] text-[var(--sr-cyan)] border border-[var(--sr-border-dark)]'
                    : 'text-[var(--sr-text-primary-on-dark)] hover:bg-[var(--sr-surface-panel-dark)] hover:shadow-sm border border-transparent hover:border-[var(--sr-border-dark)]/80'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-11 h-11 rounded-full transition-colors ${
                    activeTool === id
                      ? 'bg-[var(--sr-border-dark)] text-[var(--sr-cyan)]'
                      : 'bg-[var(--sr-surface-panel-dark)] text-[var(--sr-text-faint-on-dark)] group-hover:text-[var(--sr-text-primary-on-dark)] ring-1 ring-[var(--sr-border-dark)]'
                  }`}
                >
                  <ToolIcon id={id} />
                </span>
                <span
                  className={`text-[13px] font-semibold tracking-tight text-center leading-tight px-0.5 ${
                    activeTool === id ? 'text-[var(--sr-cyan)]' : 'text-[var(--sr-text-primary-on-dark)]'
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
