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

/** Canvas frame around clip; persisted in timelineJson.frameStyle */
export type FrameAspect = '16:9' | '9:16' | '1:1' | '4:3';

export interface FrameStyle {
  backgroundPresetId: string;
  customBackgroundUrl?: string | null;
  paddingPct: number;
  radiusPx: number;
  aspect: FrameAspect;
  /** 0 = none, 1 = strong */
  shadow: number;
  /** Background blur strength 0–24 (preview) */
  blurBg: number;
}

export const DEFAULT_FRAME_STYLE: FrameStyle = {
  backgroundPresetId: 'slate',
  paddingPct: 4,
  radiusPx: 12,
  aspect: '16:9',
  shadow: 0.35,
  blurBg: 0,
};

const ASPECT_IDS: FrameAspect[] = ['16:9', '9:16', '1:1', '4:3'];

export function normalizeFrameStyle(raw: unknown): FrameStyle {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FRAME_STYLE };
  const o = raw as Record<string, unknown>;
  const aspect = o.aspect;
  return {
    backgroundPresetId:
      typeof o.backgroundPresetId === 'string' ? o.backgroundPresetId : DEFAULT_FRAME_STYLE.backgroundPresetId,
    customBackgroundUrl:
      typeof o.customBackgroundUrl === 'string' ? o.customBackgroundUrl : null,
    paddingPct:
      typeof o.paddingPct === 'number' && o.paddingPct >= 0 && o.paddingPct <= 24
        ? o.paddingPct
        : DEFAULT_FRAME_STYLE.paddingPct,
    radiusPx:
      typeof o.radiusPx === 'number' && o.radiusPx >= 0 && o.radiusPx <= 64
        ? o.radiusPx
        : DEFAULT_FRAME_STYLE.radiusPx,
    aspect: ASPECT_IDS.includes(aspect as FrameAspect) ? (aspect as FrameAspect) : DEFAULT_FRAME_STYLE.aspect,
    shadow:
      typeof o.shadow === 'number' && o.shadow >= 0 && o.shadow <= 1
        ? o.shadow
        : DEFAULT_FRAME_STYLE.shadow,
    blurBg:
      typeof o.blurBg === 'number' && o.blurBg >= 0 && o.blurBg <= 24
        ? o.blurBg
        : DEFAULT_FRAME_STYLE.blurBg,
  };
}

/** Time-based zoom+pan (preview); persisted in timelineJson.zoomSegments */
export interface ZoomSegment {
  id: string;
  startSec: number;
  endSec: number;
  peakScale: number;
  focusX: number;
  focusY: number;
  easeInSec?: number;
  easeOutSec?: number;
  /** Brief scale pulses on clicks within this segment. */
  clickBoosts?: { tSec: number; scale: number }[];
}
