export type EditorTool = 'media' | 'trim' | 'speed' | 'text' | 'effects';

export type EditorWorkspace =
  | 'empty'
  | 'media'
  | 'timeline'
  | 'trim'
  | 'speed'
  | 'clip'
  | 'effects';

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
