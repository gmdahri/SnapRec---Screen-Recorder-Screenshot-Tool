import { useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '@iconify/react';
import { CaptureFrame, StatusBadge, type StatusWord } from '@snaprec/design-system';
import { formatTimecode, type ShareComment } from './anchors';
import type { VideoFrame } from '../../hooks/useVideoFrames';
import { CommentComposer, type NewComment } from './CommentComposer';

/** P7 V1 — the viewer shell.
 *
 * Replaces C1's time-positioned comment columns with a persistent rail, which
 * is what the redesign asks for: the conversation is a list beside the media,
 * not a shape underneath it.
 *
 * The WATCHED tile appears only once a signed-in viewer has watched something.
 * It measures coverage across signed-in viewers only (plan O1/O2) — guests are
 * never individually tracked — so the tile says so rather than implying it
 * covers everyone who opened the link.
 *
 * Transcript stays visible as a disabled rail tab so the desktop layout
 * matches the product reference without implying that the cut feature works. */

export interface ViewerCapture {
  id: string;
  title: string;
  owner: string;
  /** ISO. */
  createdAt: string;
  /** 0 when unknown — not every recording has a stored duration. */
  durationMs: number;
  /** Absent until capture records it; no column exists yet. */
  dimensions?: string;
  description?: string;
  status: StatusWord;
  views: number;
  /** Mean coverage across signed-in viewers, 0–100. Null when nobody signed in
   * has watched — the tile is then absent rather than showing 0%. */
  watchedPercent?: number | null;
  allowDownload: boolean;
  /** Drives whether Edit is offered at all — a non-owner would only get a 403. */
  canEdit: boolean;
}

export interface VideoViewerProps {
  capture: ViewerCapture;
  comments: ShareComment[];
  currentMs?: number;
  player?: ReactNode;
  onBack: () => void;
  onSeek: (ms: number) => void;
  onPost: (comment: NewComment) => void;
  onCopyLink: () => void;
  onDownload?: () => void;
  onEdit?: () => void;
  /** Absent when nobody signed in can settle anything — the control is then
   * not rendered at all rather than shown and rejected by the server. */
  onResolve?: (commentId: string, resolved: boolean) => void;
  canResolve?: (comment: ShareComment) => boolean;
  /** A fresh capture has no link yet, so the primary action generates one
   * rather than copying it. Same button, different promise. */
  copyLinkLabel?: string;
  copyLinkDisabled?: boolean;
  /** Replaces "No comments yet" when commenting is not possible yet. */
  commentsNote?: string;
  /** Fresh captures have nowhere to post a comment to. */
  hideComposer?: boolean;
  /** Owner-only. Absent for viewers who may not edit. */
  onDescriptionChange?: (description: string) => void;
  descriptionSaving?: boolean;
  /** Auto-generated preview frames, in order. */
  frames?: VideoFrame[];
  framesGenerating?: boolean;
  framesBlocked?: boolean;
}

type RailTab = 'comments' | 'details';

const barAction: CSSProperties = {
  width: 30, height: 30, padding: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--sr-border-dark)', background: 'transparent',
  color: 'var(--sr-text-primary-on-dark)', fontSize: 12.5, fontWeight: 600,
  borderRadius: 0, cursor: 'pointer',
};

const mono: CSSProperties = {
  fontFamily: 'var(--sr-font-mono)', fontSize: 10,
  color: 'var(--sr-text-faint-on-light)',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

/** "2 h ago" in the mono voice the rest of the product uses. */
function relative(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function VideoViewer({
  capture, comments, currentMs = 0, player,
  onBack, onSeek, onPost, onCopyLink, onDownload, onEdit, onResolve, canResolve,
  copyLinkLabel, copyLinkDisabled, commentsNote, hideComposer,
  onDescriptionChange, descriptionSaving,
  frames = [], framesGenerating, framesBlocked,
}: VideoViewerProps) {
  const [editingDescription, setEditingDescription] = useState(false);
  const [draftDescription, setDraftDescription] = useState('');
  const currentSec = currentMs / 1000;
  // The frame whose section contains the playhead: the last one that starts
  // at or before it.
  const activeFrameStart = frames.length > 0
    ? frames.reduce((best, f) => (f.startSec <= currentSec ? f.startSec : best), frames[0].startSec)
    : null;
  const [tab, setTab] = useState<RailTab>('comments');
  const [showResolved, setShowResolved] = useState(true);

  const railTabs = [
    { key: 'comments' as const, label: `Comments ${comments.length}` },
    { key: 'transcript' as const, label: 'Transcript —', disabled: true },
    { key: 'details' as const, label: 'Details' },
  ];

  const resolvedCount = comments.filter(c => c.resolved).length;
  // Open questions first; within each group the original order is kept, so the
  // list does not reshuffle every time someone settles one.
  const shown = (showResolved ? comments : comments.filter(c => !c.resolved))
    .slice()
    .sort((a, b) => Number(a.resolved) - Number(b.resolved));

  // An unknown length is omitted rather than rendered as 0:00.
  const duration = capture.durationMs > 0 ? formatTimecode(capture.durationMs) : undefined;
  const date = new Date(capture.createdAt).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const metaParts = [capture.owner, date, duration, capture.dimensions].filter(Boolean);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      background: 'var(--sr-surface-panel-light)',
    }}>
      <header
        data-testid="viewer-topbar"
        style={{
          height: 50, flex: 'none', display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 14px', background: 'var(--sr-surface-carbon)',
        }}
      >
        <button type="button" onClick={onBack} aria-label="Back" style={{
          ...barAction, background: 'transparent', cursor: 'pointer',
        }}>
          <Icon icon="ant-design:arrow-left-outlined" width={17} aria-hidden="true" />
        </button>

        <span style={{
          fontSize: 14, fontWeight: 600, color: 'var(--sr-text-primary-on-dark)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{capture.title}</span>

        <StatusBadge status={capture.status} surface="dark" />

        <span style={{ flex: 1 }} />

        {capture.allowDownload && (
          <button type="button" onClick={onDownload} aria-label="Download" title="Download" style={barAction}>
            <Icon icon="ant-design:download-outlined" width={14} aria-hidden="true" />
          </button>
        )}
        {capture.canEdit && (
          <button type="button" onClick={onEdit} aria-label="Edit" title="Edit" style={barAction}>
            <Icon icon="ant-design:scissor-outlined" width={14} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={onCopyLink}
          disabled={copyLinkDisabled}
          aria-label={copyLinkLabel ?? 'Copy link'}
          style={{
            ...barAction,
            width: 'auto', padding: '0 12px', gap: 7, border: 'none',
            background: copyLinkDisabled ? 'var(--sr-border-dark)' : 'var(--sr-cyan)',
            color: copyLinkDisabled ? 'var(--sr-text-faint-on-dark)' : 'var(--sr-cyan-fg)',
            cursor: copyLinkDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          <Icon icon="ant-design:link-outlined" width={13} aria-hidden="true" />
          {copyLinkLabel ?? 'Copy link'}
        </button>
      </header>

      <main className="sr-viewer-page">
        {/* The stage: the video with the rail beside it, close enough to read as
            one object. The rail used to be a full-height page column pinned to
            the window's right edge, which on a wide screen left several hundred
            pixels of empty paper between the two.

            Row height comes from the frame's aspect ratio, and the rail is
            stretched to match it — hence `minHeight: 0` on the rail, without
            which its content would set the row height and the two would
            disagree. Below 1024px the rail stacks under the media rather than
            becoming an overlay, so nothing covers the video. */}
        <div className="sr-viewer-workspace">
          {/* The player is fluid inside the workspace's main column. The video
              remains object-contain so an off-ratio frame letterboxes instead
              of being cropped. */}
          <div className="sr-viewer-stage">
            <CaptureFrame
              treatment="focused"
              style={{
                background: 'var(--sr-surface-carbon)',
                aspectRatio: '16 / 9',
                width: '100%',
                border: '1px solid var(--sr-border-dark)',
                borderRadius: 0,
              }}
            >
              {player}
            </CaptureFrame>
          </div>

        <aside data-testid="viewer-rail" className="sr-viewer-rail">
          <div role="tablist" aria-label="Capture panels" style={{
            display: 'flex', flex: 'none',
            borderBottom: '1px solid var(--sr-border-light-soft)',
          }}>
            {railTabs.map(({ key, label, ...item }) => {
              const disabled = 'disabled' in item && item.disabled;
              const selected = !disabled && tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  disabled={disabled}
                  aria-disabled={disabled ? 'true' : undefined}
                  aria-selected={selected}
                  aria-label={disabled ? label : undefined}
                  className={disabled ? 'sr-viewer-tab-disabled' : undefined}
                  onClick={() => {
                    if (key !== 'transcript') setTab(key);
                  }}
                  style={{
                    flex: 1, height: 40, border: 'none', background: 'transparent',
                    cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12,
                    fontWeight: selected ? 600 : 500,
                    color: selected
                      ? 'var(--sr-text-primary-on-light)'
                      : 'var(--sr-text-muted-on-light)',
                    boxShadow: selected ? 'inset 0 -2px 0 var(--sr-cyan-on-light)' : 'none',
                  }}
                >{disabled ? label.replace(' —', '') : label}</button>
              );
            })}
          </div>

          {tab === 'comments' && resolvedCount > 0 && (
            <label style={{
              flex: 'none', display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 14px', borderBottom: '1px solid var(--sr-border-light-soft)',
              fontFamily: 'var(--sr-font-mono)', fontSize: 10,
              color: 'var(--sr-text-muted-on-light)', cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={showResolved}
                onChange={e => setShowResolved(e.target.checked)}
                style={{ accentColor: 'var(--sr-cyan-on-light)' }}
              />
              show resolved ({resolvedCount})
            </label>
          )}

          {/* The thread takes the available rail height and scrolls internally,
              keeping the composer pinned to the stage's lower edge. */}
          <div style={{ flex: '1 1 auto', overflowY: 'auto', minHeight: 0 }}>
            {tab === 'comments' && (
              comments.length === 0
                ? <Empty note={commentsNote ?? 'No comments yet.'} />
                : shown.map(comment => (
                  <div
                    key={comment.id}
                    style={{
                      display: 'flex', gap: 10, padding: '13px 14px',
                      borderBottom: '1px solid var(--sr-border-light-soft)',
                      opacity: comment.resolved ? 0.65 : 1,
                    }}
                  >
                  <button
                    type="button"
                    aria-label={`Comment from ${comment.author}`}
                    onClick={() => comment.anchor.kind === 'timecode' && onSeek(comment.anchor.ms)}
                    style={{
                      flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer',
                      display: 'flex', gap: 10, padding: 0,
                      border: 'none', background: 'transparent',
                    }}
                  >
                    <span style={{
                      flex: 'none', width: 26, height: 26,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: comment.needsReply
                        ? 'var(--sr-coral-text)' : 'var(--sr-surface-carbon)',
                      color: 'var(--sr-text-primary-on-dark)',
                      fontFamily: 'var(--sr-font-mono)', fontSize: 10,
                    }}>{initials(comment.author)}</span>

                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                        <span style={{
                          fontSize: 12.5, fontWeight: 600,
                          color: 'var(--sr-text-primary-on-light)',
                        }}>{comment.author}</span>
                        {comment.anchor.kind === 'timecode' && (
                          <span style={{
                            fontFamily: 'var(--sr-font-mono)', fontSize: 10,
                            color: 'var(--sr-cyan-on-light)',
                          }}>{formatTimecode(comment.anchor.ms)}</span>
                        )}
                        <span style={{ flex: 1 }} />
                        <span style={mono}>{relative(comment.createdAt)}</span>
                      </span>

                      <span style={{
                        display: 'block', marginTop: 4, fontSize: 12.5, lineHeight: 1.5,
                        color: 'var(--sr-text-secondary-on-light)',
                      }}>{comment.body}</span>

                      {/* P7 E6 — publishing a shorter cut can strand a comment
                          past the end. It is not deleted: what someone wrote is
                          still real, so it says what happened instead. */}
                      {comment.anchor.kind === 'timecode'
                        && capture.durationMs > 0
                        && comment.anchor.ms > capture.durationMs && (
                        <span data-testid="stale-anchor" style={{
                          display: 'block', marginTop: 6,
                          fontFamily: 'var(--sr-font-mono)', fontSize: 9.5,
                          color: 'var(--sr-text-faint-on-light)',
                        }}>points at footage that was removed</span>
                      )}

                      {comment.resolved && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6,
                          fontFamily: 'var(--sr-font-mono)', fontSize: 10,
                          color: 'var(--sr-cyan-on-light)',
                        }}>
                          <Icon icon="ant-design:check-outlined" width={10} aria-hidden="true" />
                          resolved
                        </span>
                      )}
                    </span>
                  </button>

                  {onResolve && canResolve?.(comment) && (
                    <button
                      type="button"
                      aria-label={comment.resolved
                        ? `Reopen comment from ${comment.author}`
                        : `Resolve comment from ${comment.author}`}
                      onClick={() => onResolve(comment.id, !comment.resolved)}
                      style={{
                        flex: 'none', alignSelf: 'flex-start',
                        border: '1px solid var(--sr-border-light)', background: 'transparent',
                        padding: '2px 7px', cursor: 'pointer',
                        fontFamily: 'var(--sr-font-mono)', fontSize: 9.5,
                        color: 'var(--sr-text-muted-on-light)',
                        borderRadius: 'var(--sr-radius-control)',
                      }}
                    >{comment.resolved ? 'reopen' : 'resolve'}</button>
                  )}
                  </div>
                ))
            )}

            {tab === 'details' && (
              <dl style={{ margin: 0, padding: '14px' }}>
                {([
                  ['Owner', capture.owner],
                  ['Recorded', date],
                  ['Length', duration ?? 'unknown'],
                  ['Dimensions', capture.dimensions ?? 'unknown'],
                  ['Views', String(capture.views)],
                ] as const).map(([label, value]) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    gap: 12, padding: '7px 0',
                    borderBottom: '1px solid var(--sr-border-light-soft)',
                  }}>
                    <dt style={{ fontSize: 12.5, color: 'var(--sr-text-muted-on-light)' }}>{label}</dt>
                    <dd style={{ ...mono, margin: 0, color: 'var(--sr-text-primary-on-light)' }}>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {tab === 'comments' && !hideComposer && (
            <div style={{
              flex: 'none', borderTop: '1px solid var(--sr-border-light-soft)',
              padding: '10px 12px 12px',
            }}>
              <p style={{ ...mono, margin: '0 0 6px' }}>
                Comment pinned at {formatTimecode(currentMs)}
              </p>
              {/* timecodeMs is what actually anchors the posted comment; the
                  line above is only the human statement of it. */}
              <CommentComposer onPost={onPost} timecodeMs={currentMs} />
            </div>
          )}
        </aside>
        </div>

        {/* Everything below the stage keeps the player's width, so the
            title, the stats and the filmstrip all line up with its edges. */}
        <div className="sr-viewer-content-column">
          <div className="sr-viewer-metadata-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{
                margin: 0, fontSize: 20, fontWeight: 700, lineHeight: 1.25,
                color: 'var(--sr-text-primary-on-light)',
              }}>{capture.title}</h1>

              <p data-testid="viewer-meta" style={{ ...mono, margin: '7px 0 0' }}>
                {metaParts.join(' · ')}
              </p>

              {/* Editable in place for the owner. A separate page for one text
                  field would be a poor trade, and the description is usually
                  written straight after watching it back. */}
              {editingDescription ? (
                <div style={{ marginTop: 14, maxWidth: '62ch' }}>
                  <textarea
                    aria-label="Description"
                    value={draftDescription}
                    autoFocus
                    onChange={e => setDraftDescription(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    style={{
                      width: '100%', padding: '8px 10px', fontFamily: 'inherit',
                      fontSize: 13.5, lineHeight: 1.6, resize: 'vertical',
                      border: '1px solid var(--sr-border-light)',
                      background: 'var(--sr-surface-paper)',
                      borderRadius: 'var(--sr-radius-control)',
                    }}
                  />
                  <span style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      disabled={descriptionSaving}
                      onClick={() => {
                        onDescriptionChange?.(draftDescription);
                        setEditingDescription(false);
                      }}
                      style={{
                        height: 'var(--sr-h-xs)', padding: '0 12px', border: 'none',
                        background: 'var(--sr-text-primary-on-light)',
                        color: 'var(--sr-surface-paper)', fontSize: 12.5, fontWeight: 600,
                        borderRadius: 'var(--sr-radius-control)', cursor: 'pointer',
                      }}
                    >{descriptionSaving ? 'Saving…' : 'Save'}</button>
                    <button
                      type="button"
                      onClick={() => setEditingDescription(false)}
                      style={{
                        height: 'var(--sr-h-xs)', padding: '0 12px',
                        border: '1px solid var(--sr-border-light)', background: 'transparent',
                        color: 'var(--sr-text-muted-on-light)', fontSize: 12.5,
                        borderRadius: 'var(--sr-radius-control)', cursor: 'pointer',
                      }}
                    >Cancel</button>
                  </span>
                </div>
              ) : capture.description ? (
                <p data-testid="viewer-description" style={{
                  margin: '14px 0 0', fontSize: 13.5, lineHeight: 1.6,
                  color: 'var(--sr-text-secondary-on-light)', maxWidth: '62ch',
                }}>
                  {capture.description}
                  {onDescriptionChange && (
                    <button type="button" aria-label="Edit description"
                      onClick={() => { setDraftDescription(capture.description ?? ''); setEditingDescription(true); }}
                      style={{
                        marginLeft: 8, border: 'none', background: 'transparent', padding: 0,
                        cursor: 'pointer', fontFamily: 'var(--sr-font-mono)', fontSize: 10,
                        color: 'var(--sr-cyan-on-light)',
                      }}>edit</button>
                  )}
                </p>
              ) : onDescriptionChange ? (
                <button type="button" aria-label="Add description"
                  onClick={() => { setDraftDescription(''); setEditingDescription(true); }}
                  style={{
                    marginTop: 14, border: 'none', background: 'transparent', padding: 0,
                    cursor: 'pointer', fontFamily: 'var(--sr-font-mono)', fontSize: 10,
                    color: 'var(--sr-cyan-on-light)',
                  }}>+ add a description</button>
              ) : null}
            </div>

            <div data-testid="viewer-stats" className="sr-viewer-stats">
              {([
                ['views', String(capture.views)] as const,
                ...(typeof capture.watchedPercent === 'number'
                  ? [['watched', `${capture.watchedPercent}%`] as const]
                  : []),
                ['comments', String(comments.length)] as const,
              ]).map(
                ([label, value], i) => (
                  <div key={label} style={{
                    padding: '10px 20px', textAlign: 'center',
                    border: '1px solid var(--sr-border-light-soft)',
                    borderLeftWidth: i === 0 ? 1 : 0,
                    background: 'var(--sr-surface-paper)',
                  }}>
                    <span
                      style={{ ...mono, display: 'block', letterSpacing: '.1em' }}
                      title={label === 'watched'
                        ? 'Average share of the video watched, by signed-in viewers only'
                        : undefined}
                    >{label.toUpperCase()}</span>
                    <span style={{
                      display: 'block', marginTop: 4, fontSize: 20, fontWeight: 700,
                      color: 'var(--sr-text-primary-on-light)',
                    }}>{value}</span>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Frames — an auto-generated filmstrip, not hand-written chapters.
              One picture per section of the recording, each a jump target. The
              count follows the length: a clip under ten seconds still gets one.

              Drawn in the browser from the video already on the page, so this
              works on recordings made long before the feature and costs no
              upload or storage. */}
          {frames.length > 0 && (
            <section data-testid="viewer-frames" className="sr-viewer-chapters">
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ ...mono, letterSpacing: '.12em' }}>CHAPTERS</span>
                <span style={{ flex: 1, height: 1, background: 'var(--sr-border-light-soft)' }} />
                {framesGenerating && <span style={mono}>generating…</span>}
                {framesBlocked && <span style={mono}>previews unavailable for this file</span>}
              </span>

              <ol className="sr-viewer-chapter-grid">
                {frames.map((frame) => {
                  const active = activeFrameStart === frame.startSec;
                  return (
                    <li key={frame.startSec}>
                      <button
                        type="button"
                        aria-label={`Jump to ${formatTimecode(frame.startSec * 1000)}`}
                        aria-current={active ? 'true' : undefined}
                        onClick={() => onSeek(frame.startSec * 1000)}
                        style={{
                          width: '100%', padding: 0, cursor: 'pointer', textAlign: 'left',
                          background: 'var(--sr-surface-carbon)',
                          border: active
                            ? '1px solid var(--sr-cyan-on-light)'
                            : '1px solid var(--sr-border-light-soft)',
                        }}
                      >
                        <span style={{
                          display: 'block', aspectRatio: '16 / 9', overflow: 'hidden',
                          background: 'var(--sr-surface-carbon)',
                        }}>
                          {frame.dataUrl && (
                            <img src={frame.dataUrl} alt="" style={{
                              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                            }} />
                          )}
                        </span>
                        <span style={{
                          display: 'block', padding: '6px 8px',
                          background: 'var(--sr-surface-paper)',
                          fontFamily: 'var(--sr-font-mono)', fontSize: 10,
                          color: active
                            ? 'var(--sr-cyan-on-light)' : 'var(--sr-text-muted-on-light)',
                        }}>{formatTimecode(frame.startSec * 1000)}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function Empty({ note, detail }: { note: string; detail?: string }) {
  return (
    <div style={{ padding: '18px 16px', textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--sr-text-muted-on-light)' }}>{note}</p>
      {detail && <p style={{ ...mono, margin: '6px 0 0' }}>{detail}</p>}
    </div>
  );
}
