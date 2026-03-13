export type EditorTool = 'media' | 'trim' | 'speed' | 'text' | 'effects';

export type EditorWorkspace =
  | 'empty'
  | 'media'
  | 'timeline'
  | 'trim'
  | 'clip'
  | 'effects';

export type ExportModalState = 'closed' | 'settings' | 'progress';

export type MediaLibraryTab = 'your' | 'favorites';

export interface MediaClip {
  id: string;
  name: string;
  durationLabel: string;
  res: string;
  fps: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  modified: string;
}
