import type { ReactNode } from 'react';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import type { ShareComment } from './anchors';
import { VideoShare, type ShareCapture } from './VideoShare';
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
  capture: ShareCapture & Partial<ImageCapture> & { duration?: string; dimensions?: string };
  comments: ShareComment[];
  currentMs?: number;
  onSeek: (ms: number) => void;
  onPost: (comment: NewComment) => void;
  onRequestAccess: () => void;
  onDownload?: () => void;
  player?: ReactNode;
  media?: ReactNode;
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
    return mobile
      ? <MobileVideoShare {...props} capture={props.capture} />
      : <VideoShare {...props} capture={props.capture} />;
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
      media={props.media}
      onDownload={props.onDownload}
    />
  );
}
