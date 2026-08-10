import type { ReactNode } from 'react';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import type { ShareComment } from './anchors';
import type { VideoFrame } from '../../hooks/useVideoFrames';
/** VideoShare (C1) is superseded by VideoViewer for desktop video as of P7 V1.
 * The file is kept for now because its comment-column maths and tests are the
 * only record of the old layout; delete it once the redesign has settled. */
import { type ShareCapture } from './VideoShare';
import { VideoViewer, type ViewerCapture } from './VideoViewer';
import { ImageShare, type ImageCapture } from './ImageShare';
import { MobileVideoShare } from './MobileVideoShare';
import { MobileImageShare } from './MobileImageShare';
import { PrivateCapture } from './PrivateCapture';
import { ProcessingCapture } from './ProcessingCapture';
import type { NewComment } from './CommentComposer';

export type ShareState = 'ready' | 'processing' | 'private';

export interface ShareShellProps {
  state: ShareState;
  kind: 'recording' | 'screenshot';
  capture: ShareCapture & Partial<ImageCapture> & {
    duration?: string;
    dimensions?: string;
    /** P7 viewer fields. Optional so the image and mobile bodies, which do not
     * use them, are unaffected. */
    createdAt?: string;
    description?: string;
    statusWord?: ViewerCapture['status'];
    views?: number;
    watchedPercent?: number | null;
    canEdit?: boolean;
  };
  comments: ShareComment[];
  currentMs?: number;
  onSeek: (ms: number) => void;
  /** Returns `false` when the comment is refused — the sign-in gate does
   * that, and the composer then keeps the draft. */
  onPost: (comment: NewComment) => void | boolean;
  onRequestAccess: () => void;
  onDownload?: () => void;
  player?: ReactNode;
  media?: ReactNode;
  onBack?: () => void;
  onCopyLink?: () => void;
  onEdit?: () => void;
  onResolve?: (commentId: string, resolved: boolean) => void;
  canResolve?: (comment: ShareComment) => boolean;
  /** A comment is in flight, so every body holds a skeleton row for it. */
  postingComment?: boolean;
  onDescriptionChange?: (description: string) => void;
  descriptionSaving?: boolean;
  frames?: VideoFrame[];
  framesGenerating?: boolean;
  framesBlocked?: boolean;
}

/** Chooses the body. Six scenes, three questions: is there media, is it a
 * video, and is the viewport narrow.
 *
 * The margin width fed to ImageShare is what decides whether leaders are
 * drawn — the rule is 300px of margin, not a breakpoint, because the margin is
 * what they have to cross. */
export function ShareShell(props: ShareShellProps) {
  const breakpoint = useBreakpoint();
  const mobile = breakpoint === 'mobile';

  if (props.state === 'private') {
    return <PrivateCapture owner={props.capture.owner} onRequestAccess={props.onRequestAccess} />;
  }

  if (props.state === 'processing') {
    return (
      <ProcessingCapture capture={{
        title: props.capture.title,
        owner: props.capture.owner,
        duration: props.capture.duration,
        dimensions: props.capture.dimensions,
      }} />
    );
  }

  if (props.kind === 'recording') {
    if (mobile) {
      return (
        <MobileVideoShare
          {...props}
          capture={props.capture}
          onBack={props.onBack ?? (() => window.history.back())}
          onCopyLink={props.onCopyLink ?? (() => {})}
        />
      );
    }

    // P7 V1: the desktop video body is the rail viewer.
    return (
      <VideoViewer
        capture={{
          id: props.capture.id,
          title: props.capture.title,
          owner: props.capture.owner,
          createdAt: props.capture.createdAt ?? new Date().toISOString(),
          durationMs: props.capture.durationMs,
          dimensions: props.capture.dimensions,
          description: props.capture.description,
          status: props.capture.statusWord ?? 'link ready',
          views: props.capture.views ?? 0,
          watchedPercent: props.capture.watchedPercent ?? null,
          allowDownload: props.capture.allowDownload,
          canEdit: props.capture.canEdit ?? false,
        }}
        comments={props.comments}
        currentMs={props.currentMs}
        player={props.player}
        onBack={props.onBack ?? (() => window.history.back())}
        onSeek={props.onSeek}
        onPost={props.onPost}
        postingComment={props.postingComment}
        onCopyLink={props.onCopyLink ?? (() => {})}
        onDownload={props.onDownload}
        onEdit={props.onEdit}
        onResolve={props.onResolve}
        canResolve={props.canResolve}
        onDescriptionChange={props.onDescriptionChange}
        descriptionSaving={props.descriptionSaving}
        frames={props.frames}
        framesGenerating={props.framesGenerating}
        framesBlocked={props.framesBlocked}
      />
    );
  }

  const imageCapture: ImageCapture = {
    id: props.capture.id,
    title: props.capture.title,
    owner: props.capture.owner,
    width: props.capture.width ?? 16,
    height: props.capture.height ?? 9,
    allowDownload: props.capture.allowDownload,
  };

  if (mobile) {
    return (
      <MobileImageShare
        capture={imageCapture}
        comments={props.comments}
        onPost={props.onPost}
        postingComment={props.postingComment}
        media={props.media}
      />
    );
  }

  // Desktop gets 360px of margin; tablet portrait and landscape get less than
  // 300, which is exactly when leaders stop being drawn.
  const marginPx = breakpoint === 'desktop' ? 360 : 260;

  return (
    <ImageShare
      capture={imageCapture}
      comments={props.comments}
      marginPx={marginPx}
      onPost={props.onPost}
      postingComment={props.postingComment}
      media={props.media}
      onDownload={props.onDownload}
    />
  );
}
