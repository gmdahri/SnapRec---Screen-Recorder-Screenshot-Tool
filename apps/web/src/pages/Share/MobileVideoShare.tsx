import { type ReactNode, useState } from 'react';
import { Icon } from '@iconify/react';
import { StatusBadge, type StatusWord } from '@snaprec/design-system';
import { BottomSheet } from '../../components/BottomSheet';
import type { VideoFrame } from '../../hooks/useVideoFrames';
import { formatTimecode, type ShareComment } from './anchors';
import { CommentComposer, type NewComment } from './CommentComposer';
import type { ShareCapture } from './VideoShare';

export interface MobileVideoShareProps {
  capture: ShareCapture & {
    createdAt?: string;
    dimensions?: string;
    description?: string;
    statusWord?: StatusWord;
    views?: number;
    watchedPercent?: number | null;
    canEdit?: boolean;
  };
  comments: ShareComment[];
  currentMs?: number;
  onSeek: (ms: number) => void;
  onPost: (comment: NewComment) => void;
  player?: ReactNode;
  frames?: VideoFrame[];
  framesGenerating?: boolean;
  framesBlocked?: boolean;
  onBack?: () => void;
  onCopyLink?: () => void;
  onEdit?: () => void;
  onDownload?: () => void;
}

type MobileTab = 'comments' | 'details';

function displayDate(createdAt?: string): string | undefined {
  if (!createdAt || !Number.isFinite(Date.parse(createdAt))) return undefined;
  return new Date(createdAt).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

/** The phone viewer keeps playback in reach while turning the desktop rail
 * into a compact, tabbed sheet. Generated frames remain a timeline: the
 * horizontal filmstrip scrolls independently instead of widening the page. */
export function MobileVideoShare({
  capture, comments, currentMs = 0, onSeek, onPost, player,
  frames = [], framesGenerating, framesBlocked,
  onBack, onCopyLink, onEdit, onDownload,
}: MobileVideoShareProps) {
  const [overflow, setOverflow] = useState(false);
  const [tab, setTab] = useState<MobileTab>('comments');
  const awaiting = comments.filter(comment => comment.needsReply).length;
  const duration = capture.durationMs > 0 ? formatTimecode(capture.durationMs) : undefined;
  const date = displayDate(capture.createdAt);
  const metaParts = [capture.owner, date, duration, capture.dimensions].filter(Boolean);
  const stats = [
    ['views', String(capture.views ?? 0)] as const,
    ...(typeof capture.watchedPercent === 'number'
      ? [['watched', `${capture.watchedPercent}%`] as const]
      : []),
    ['comments', String(comments.length)] as const,
  ];

  return (
    <div className="sr-mobile-viewer">
      <header className="sr-mobile-viewer-topbar">
        <button
          type="button"
          data-min-target="44"
          aria-label="Back"
          onClick={() => (onBack ? onBack() : window.history.back())}
          className="sr-mobile-viewer-icon-button"
        >
          <Icon icon="ant-design:arrow-left-outlined" width={18} aria-hidden="true" />
        </button>

        <span className="sr-mobile-viewer-topbar-title">{capture.title}</span>
        <StatusBadge status={capture.statusWord ?? 'link ready'} surface="dark" />
        <span className="sr-mobile-viewer-topbar-spacer" />

        <button
          type="button"
          data-min-target="44"
          aria-label="More"
          onClick={() => setOverflow(true)}
          className="sr-mobile-viewer-icon-button"
        >
          <Icon icon="ant-design:ellipsis-outlined" width={20} aria-hidden="true" />
        </button>
      </header>

      <div
        data-testid="sticky-player"
        data-sticky="true"
        className="sr-mobile-viewer-player"
      >{player}</div>

      <main className="sr-mobile-viewer-content">
        <section className="sr-mobile-viewer-metadata" aria-labelledby="mobile-capture-title">
          <h1 id="mobile-capture-title">{capture.title}</h1>
          <p data-testid="mobile-viewer-meta" className="sr-mobile-viewer-meta-line">
            {metaParts.join(' · ')}
          </p>
          {capture.description && (
            <p className="sr-mobile-viewer-description">{capture.description}</p>
          )}

          <div className="sr-mobile-viewer-stats" aria-label="Capture activity">
            {stats.map(([label, value]) => (
              <div key={label}>
                <span
                  className="sr-mobile-viewer-stat-label"
                  title={label === 'watched'
                    ? 'Average share of the video watched, by signed-in viewers only'
                    : undefined}
                >{label.toUpperCase()}</span>
                <span className="sr-mobile-viewer-stat-value">{value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="sr-mobile-viewer-rail" aria-label="Capture panels">
          <div role="tablist" aria-label="Capture panels" className="sr-mobile-viewer-tabs">
            <button
              id="mobile-comments-tab"
              type="button"
              role="tab"
              data-min-target="44"
              aria-selected={tab === 'comments'}
              aria-controls="mobile-comments-panel"
              onClick={() => setTab('comments')}
            >Comments {comments.length}</button>
            <button
              id="mobile-transcript-tab"
              type="button"
              role="tab"
              data-min-target="44"
              disabled
              aria-disabled="true"
              aria-selected="false"
            >Transcript —</button>
            <button
              id="mobile-details-tab"
              type="button"
              role="tab"
              data-min-target="44"
              aria-selected={tab === 'details'}
              aria-controls="mobile-details-panel"
              onClick={() => setTab('details')}
            >Details</button>
          </div>

          {tab === 'comments' ? (
            <div
              id="mobile-comments-panel"
              role="tabpanel"
              aria-labelledby="mobile-comments-tab"
              tabIndex={0}
              className="sr-mobile-viewer-panel"
            >
              <div className="sr-mobile-viewer-comment-summary">
                <span>{comments.length} comments</span>
                {awaiting > 0 && <span>· {awaiting} needs a reply</span>}
              </div>

              <ul className="sr-mobile-viewer-comments">
                {comments.map(comment => (
                  <li key={comment.id}>
                    <button
                      type="button"
                      data-min-target="44"
                      onClick={() => comment.anchor.kind === 'timecode' && onSeek(comment.anchor.ms)}
                      className={comment.needsReply ? 'sr-mobile-viewer-comment needs-reply' : 'sr-mobile-viewer-comment'}
                    >
                      <span className="sr-mobile-viewer-timecode">
                        {comment.anchor.kind === 'timecode' ? formatTimecode(comment.anchor.ms) : ''}
                      </span>

                      <span className="sr-mobile-viewer-comment-copy">
                        <span className="sr-mobile-viewer-comment-author">{comment.author}</span>
                        <span className="sr-mobile-viewer-comment-body">{comment.body}</span>
                        {comment.needsReply && <StatusBadge status="needs a reply" />}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="sr-mobile-viewer-composer">
                <CommentComposer
                  touch
                  onPost={onPost}
                  timecodeMs={currentMs}
                  anchorLabel={`Commenting at ${formatTimecode(currentMs)}`}
                />
              </div>
            </div>
          ) : (
            <div
              id="mobile-details-panel"
              role="tabpanel"
              aria-labelledby="mobile-details-tab"
              tabIndex={0}
              className="sr-mobile-viewer-panel"
            >
              <dl className="sr-mobile-viewer-details">
                {([
                  ['Owner', capture.owner],
                  ['Recorded', date ?? 'unknown'],
                  ['Length', duration ?? 'unknown'],
                  ['Dimensions', capture.dimensions ?? 'unknown'],
                  ['Views', String(capture.views ?? 0)],
                ] as const).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </section>

        {frames.length > 0 && (
          <section data-testid="mobile-chapters" className="sr-mobile-viewer-chapters">
            <div className="sr-mobile-viewer-chapter-heading">
              <span>CHAPTERS</span>
              <span aria-hidden="true" />
              {framesGenerating && <span>generating…</span>}
              {framesBlocked && <span>previews unavailable for this file</span>}
            </div>

            <ol className="sr-mobile-viewer-chapter-track">
              {frames.map(frame => (
                <li key={frame.startSec}>
                  <button
                    type="button"
                    data-min-target="44"
                    aria-label={`Jump to ${formatTimecode(frame.startSec * 1000)}`}
                    onClick={() => onSeek(frame.startSec * 1000)}
                  >
                    <span className="sr-mobile-viewer-chapter-image">
                      {frame.dataUrl && <img src={frame.dataUrl} alt="" />}
                    </span>
                    <span className="sr-mobile-viewer-chapter-time">
                      {formatTimecode(frame.startSec * 1000)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>

      {overflow && (
        <BottomSheet label="Capture actions" onClose={() => setOverflow(false)}>
          {capture.allowDownload && (
            <button
              type="button"
              data-min-target="44"
              onClick={() => { onDownload?.(); setOverflow(false); }}
              className="sr-mobile-viewer-sheet-row"
            >Download</button>
          )}
          {capture.canEdit && (
            <button
              type="button"
              data-min-target="44"
              onClick={() => { onEdit?.(); setOverflow(false); }}
              className="sr-mobile-viewer-sheet-row"
            >Edit</button>
          )}
          <button
            type="button"
            data-min-target="44"
            onClick={() => { onCopyLink?.(); setOverflow(false); }}
            className="sr-mobile-viewer-sheet-row"
          >Copy link</button>
        </BottomSheet>
      )}
    </div>
  );
}
