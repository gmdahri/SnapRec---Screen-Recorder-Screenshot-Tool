import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '@iconify/react';

/** P7 E1.1 — the editor's top bar.
 *
 * Presentational on purpose: everything it needs arrives as props, so it can be
 * tested without mounting VideoEditorProvider.
 *
 * Two deliberate departures from the mockup, both about not promising what the
 * product cannot do:
 *
 *  - The unsaved marker is **not coral**. Coral means live capture and
 *    needs-a-response, and it stays legible only because it is rare; an editor
 *    that is coral for most of a session spends that meaning on nothing.
 *  - Export and Publish are separate actions, not one button. Export writes a
 *    file to your machine; Publish overwrites what everyone holding the share
 *    link already has. Collapsing them would make a destructive action share a
 *    label with a harmless one.
 */

export interface EditorTopBarProps {
  title: string;
  onTitleChange: (title: string) => void;
  onBack: () => void;
  /** Seconds kept after trim, and the source length. Both 0 when unknown. */
  keptSec: number;
  totalSec: number;
  hasUnsavedChanges: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onSave: () => void;
  onExport: () => void;
  canSave: boolean;
  /** P7 E6. Absent on a project with no source capture — the control is then
   * not shown at all rather than shown and refused. */
  onPublish?: () => void;
  publishStatus?: 'idle' | 'publishing' | 'done' | 'error';
  canPublish?: boolean;
  publishBlockedReason?: string;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  /** Account controls. The mockup's bar has none, but removing sign-in from a
   * whole surface to match a picture is a functional loss, not a redesign. */
  trailing?: ReactNode;
}

const clock = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

const action: CSSProperties = {
  height: 'var(--sr-h-xs)', padding: '0 12px',
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontSize: 12.5, fontWeight: 600, borderRadius: 'var(--sr-radius-control)',
  cursor: 'pointer',
};

export function EditorTopBar({
  title, onTitleChange, onBack, keptSec, totalSec,
  hasUnsavedChanges, saveStatus, onSave, onExport, canSave, trailing,
  onUndo, onRedo, canUndo, canRedo,
  onPublish, publishStatus = 'idle', canPublish, publishBlockedReason,
}: EditorTopBarProps) {
  // "1:41 of 3:02 kept" is only meaningful once the source length is known;
  // without it the phrase would read "0:00 of 0:00 kept".
  const kept = totalSec > 0 ? `${clock(keptSec)} of ${clock(totalSec)} kept` : null;

  const saveLabel = saveStatus === 'saving' ? 'Saving…'
    : saveStatus === 'saved' ? 'Saved'
      : saveStatus === 'error' ? 'Retry save' : 'Save draft';

  return (
    <header
      data-testid="editor-topbar"
      style={{
        height: 52, flex: 'none', display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 14px', background: 'var(--sr-surface-carbon)',
        borderBottom: '1px solid var(--sr-border-dark-soft)',
      }}
    >
      <button type="button" onClick={onBack} aria-label="Back to projects" style={{
        border: 'none', background: 'transparent', padding: 4, cursor: 'pointer',
        color: 'var(--sr-text-primary-on-dark)', display: 'inline-flex',
      }}>
        <Icon icon="ant-design:arrow-left-outlined" width={17} aria-hidden="true" />
      </button>

      <input
        value={title}
        onChange={e => onTitleChange(e.target.value)}
        aria-label="Project title"
        style={{
          minWidth: 0, maxWidth: 280, height: 'var(--sr-h-xs)', padding: '0 8px',
          border: '1px solid transparent', background: 'transparent',
          color: 'var(--sr-text-primary-on-dark)', fontSize: 14, fontWeight: 600,
          borderRadius: 'var(--sr-radius-control)',
        }}
      />

      {kept && (
        <span data-testid="kept-summary" style={{
          fontFamily: 'var(--sr-font-mono)', fontSize: 10,
          color: 'var(--sr-text-faint-on-dark)', whiteSpace: 'nowrap',
        }}>{kept}</span>
      )}

      {hasUnsavedChanges && (
        <span data-testid="unsaved-chip" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--sr-font-mono)', fontSize: 10, letterSpacing: '.08em',
          color: 'var(--sr-text-secondary-on-dark)',
        }}>
          <span style={{
            width: 6, height: 6, background: 'var(--sr-text-secondary-on-dark)',
          }} aria-hidden="true" />
          unsaved
        </span>
      )}

      <span style={{ flex: 1 }} />

      {onUndo && (
        <button
          type="button"
          aria-label="Undo"
          onClick={onUndo}
          disabled={!canUndo}
          title={canUndo ? 'Undo the last trim or cut' : 'Nothing to undo'}
          style={{
            ...action, width: 30, padding: 0, justifyContent: 'center',
            border: '1px solid var(--sr-border-dark)', background: 'transparent',
            color: canUndo ? 'var(--sr-text-primary-on-dark)' : 'var(--sr-text-faint-on-dark)',
            cursor: canUndo ? 'pointer' : 'not-allowed',
          }}
        >
          <Icon icon="ant-design:undo-outlined" width={13} aria-hidden="true" />
        </button>
      )}
      {onRedo && (
        <button
          type="button"
          aria-label="Redo"
          onClick={onRedo}
          disabled={!canRedo}
          title={canRedo ? 'Redo the last undone change' : 'Nothing to redo'}
          style={{
            ...action, width: 30, padding: 0, justifyContent: 'center',
            border: '1px solid var(--sr-border-dark)', background: 'transparent',
            color: canRedo ? 'var(--sr-text-primary-on-dark)' : 'var(--sr-text-faint-on-dark)',
            cursor: canRedo ? 'pointer' : 'not-allowed',
          }}
        >
          <Icon icon="ant-design:redo-outlined" width={13} aria-hidden="true" />
        </button>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={!canSave}
        title={canSave ? 'Save the title, trim and speed to this project' : 'No changes to save'}
        style={{
          ...action,
          border: `1px solid ${canSave ? 'var(--sr-border-dark-strong)' : 'var(--sr-border-dark-soft)'}`,
          background: 'transparent',
          color: canSave ? 'var(--sr-text-primary-on-dark)' : 'var(--sr-text-faint-on-dark)',
          cursor: canSave ? 'pointer' : 'not-allowed',
        }}
      >{saveLabel}</button>

      <button type="button" onClick={onExport} style={{
        ...action,
        border: '1px solid var(--sr-border-dark-strong)', background: 'transparent',
        color: 'var(--sr-text-primary-on-dark)',
      }}>
        <Icon icon="ant-design:download-outlined" width={13} aria-hidden="true" />
        Export
      </button>

      {onPublish && (
        <button
          type="button"
          onClick={onPublish}
          disabled={!canPublish || publishStatus === 'publishing'}
          title={canPublish
            ? 'Replace the video at the existing link. Comments and view counts are kept.'
            : (publishBlockedReason ?? 'Nothing new to publish')}
          style={{
            ...action, border: 'none',
            background: canPublish ? 'var(--sr-cyan)' : 'var(--sr-border-dark)',
            color: canPublish ? 'var(--sr-cyan-fg)' : 'var(--sr-text-faint-on-dark)',
            cursor: canPublish && publishStatus !== 'publishing' ? 'pointer' : 'not-allowed',
          }}
        >
          <Icon icon="ant-design:cloud-upload-outlined" width={13} aria-hidden="true" />
          {publishStatus === 'publishing' ? 'Publishing…' : 'Publish changes'}
        </button>
      )}

      {trailing}
    </header>
  );
}
