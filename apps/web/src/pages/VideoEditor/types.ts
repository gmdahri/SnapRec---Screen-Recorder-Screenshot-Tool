export type EditorTool = 'media' | 'trim' | 'speed' | 'zoom' | 'text' | 'effects';

export type EditorWorkspace =
  | 'empty'
  | 'media'
  | 'timeline'
  | 'trim'
  | 'speed'
  | 'zoom'
  | 'clip'
  | 'effects';

export interface ZoomKeyframe {
  id: string;
  timestamp: number;  // ms from video start
  x: number;          // pivot X as % of video width (0–100)
  y: number;          // pivot Y as % of video height (0–100)
  scale: number;      // zoom level 1.1–3.0
  duration: number;   // total zoom window in ms
}

export type ExportModalState = 'closed' | 'settings' | 'progress';

export type MediaLibraryTab = 'your' | 'favorites';

/** Right dock: Properties vs nested media gallery */
export type RightDockTab = 'properties' | 'mediaGallery';

export interface MediaClip {
  id: string;
  name: string;
  durationLabel: string;
  res: string;
  fps: string;
  /** Optional; used for storage bar (bytes). */
  sizeBytes?: number;
}

export interface ProjectSummary {
  id: string;
  title: string;
  modified: string;
}
