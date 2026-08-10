import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  EditorTool,
  EditorWorkspace,
  ExportModalState,
  MediaClip,
  MediaLibraryTab,
  ProjectSummary,
  RightDockTab,
  ZoomKeyframe,
} from './types';
import { fetchWithAuth, uploadFile } from '../../hooks/useRecordings';
import { recordVideoSegmentToWebm } from './localVideoTrim';
import { normalizeCuts, outputDurationSec, type Cut } from './cuts';
import {
  canRedo, canUndo, createHistory, record, redo, resetHistory, undo,
} from './history';

interface EditSnapshot {
  trimStartSec: number;
  trimEndSec: number;
  cuts: Cut[];
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://snaprec-489525905608.us-central1.run.app';

export interface VideoProjectDto {
  id: string;
  title: string;
  /** The capture this project edits — the thing Publish overwrites. */
  recordingId: string;
  fileUrl: string;
  videoUrl: string;
  timelineJson: Record<string, unknown> | null;
  updatedAt: string | null;
  /** From R2 HeadObject; drives storage bar. */
  fileSizeBytes?: number | null;
}

interface VideoEditorContextValue {
  screen: 'projects' | 'editor';
  setScreen: (s: 'projects' | 'editor') => void;
  projectTitle: string;
  setProjectTitle: (t: string) => void;
  activeTool: EditorTool;
  setActiveTool: (t: EditorTool) => void;
  workspace: EditorWorkspace;
  setWorkspace: (w: EditorWorkspace) => void;
  mediaLibraryOpen: boolean;
  setMediaLibraryOpen: (o: boolean) => void;
  /** Right panel: Properties or Media gallery (nested) */
  rightDockTab: RightDockTab;
  setRightDockTab: (t: RightDockTab) => void;
  mediaLibraryTab: MediaLibraryTab;
  setMediaLibraryTab: (t: MediaLibraryTab) => void;
  favoriteClipIds: string[];
  toggleFavoriteClip: (clipId: string) => void;
  clips: MediaClip[];
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  exportModal: ExportModalState;
  setExportModal: (e: ExportModalState) => void;
  exportProgress: { pct: number; frame: number; frames: number } | null;
  exportEdit: () => Promise<void>;
  shareModal: boolean;
  setShareModal: (s: boolean) => void;
  hasTimelineContent: boolean;
  addMediaToTimeline: () => void;
  openProject: (id: string, title: string) => void;
  newProject: () => void;
  projects: ProjectSummary[];
  projectsLoading: boolean;
  refreshProjects: () => void;
  editorVideoSrc: string | null;
  setEditorVideoSrc: (u: string | null) => void;
  currentProjectId: string | null;
  projectLoadError: string | null;
  projectLoading: boolean;
  reloadProject: () => void;
  trimStartSec: number;
  trimEndSec: number;
  setTrimStartSec: (n: number) => void;
  setTrimEndSec: (n: number) => void;
  videoDurationSec: number;
  setVideoDurationSec: (n: number) => void;
  editorPlaybackTime: number;
  setEditorPlaybackTime: (n: number) => void;
  resetTrim: () => void;
  /** Preview playback speed (0.5–2); persisted in timelineJson on Save. */
  playbackRate: number;
  setPlaybackRate: (r: number) => void;
  hasUnsavedChanges: boolean;
  saveProject: () => Promise<void>;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  stagedExportFile: File | null;
  stagedExportLabel: string | null;
  setStagedExport: (file: File | null) => void;
  /** Bake current trim range into a new in-memory WebM; preview updates; Save uploads it. */
  applyLocalTrim: () => Promise<void>;
  localModifyStatus: 'idle' | 'working' | 'error';
  localModifyError: string | null;
  clearLocalModifyError: () => void;
  /** Effect names chosen in the Effects panel (local only until Save clears). */
  localEffectsApplied: string[];
  applyLocalEffect: (name: string) => void;
  /** Pending in-app navigation when user has unsaved changes (custom modal). */
  unsavedLeaveTarget: string | null;
  requestUnsavedLeave: (absoluteHref: string) => void;
  cancelUnsavedLeave: () => void;
  confirmUnsavedLeave: () => void;
  autoZoom: boolean;
  metadata: any[];
  /** Source ranges the output leaves out (P7 E3). Always normalised. */
  /** P7 E4.1 — seconds, against the kept range. Clamped on use, not on set, so
   * moving the trim does not silently rewrite a fade the user chose. */
  fadeInSec: number;
  fadeOutSec: number;
  setFadeInSec: (n: number) => void;
  setFadeOutSec: (n: number) => void;
  /** P7 E5.2 — apply a loudness correction when baking the export. */
  normalizeAudio: boolean;
  setNormalizeAudio: (on: boolean) => void;
  /** Gain the export should apply; 1 when normalising is off or unmeasurable. */
  audioGain: number;
  setAudioGain: (g: number) => void;
  cuts: Cut[];
  addCut: (startSec: number, endSec: number) => void;
  removeCut: (id: string) => void;
  /** P7 E3.1 — over trim and cuts, the two things an edit is made of. Zoom
   * keyframes are excluded for now: they are edited through their own panel
   * with its own affordances, and folding them in would make one Undo press
   * mean two different things depending on what you touched last. */
  /** P7 E6 — replace the source capture's media with the current edit. */
  sourceRecordingId: string | null;
  publishToRecording: () => Promise<void>;
  publishStatus: 'idle' | 'publishing' | 'done' | 'error';
  publishError: string | null;
  /** Comments left pointing past the new end by the last publish. */
  publishStaleComments: number;
  undoEdit: () => void;
  redoEdit: () => void;
  canUndoEdit: boolean;
  canRedoEdit: boolean;
  zoomKeyframes: ZoomKeyframe[];
  addZoomKeyframe: (kf: ZoomKeyframe) => void;
  updateZoomKeyframe: (id: string, patch: Partial<ZoomKeyframe>) => void;
  deleteZoomKeyframe: (id: string) => void;
}

const Ctx = createContext<VideoEditorContextValue | null>(null);

const PLAYBACK_RATE_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function normalizePlaybackRate(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 1;
  const r = Math.min(4, Math.max(0.25, raw));
  const nearest = PLAYBACK_RATE_PRESETS.reduce((best, p) =>
    Math.abs(p - r) < Math.abs(best - r) ? p : best,
  );
  return nearest;
}

function clearStagingRef(
  revoker: React.MutableRefObject<string | null>,
  setFile: (f: File | null) => void,
  setLabel: (s: string | null) => void,
) {
  if (revoker.current) {
    try {
      URL.revokeObjectURL(revoker.current);
    } catch {
      /* empty */
    }
    revoker.current = null;
  }
  setFile(null);
  setLabel(null);
}

export function VideoEditorProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { projectId: routeProjectId } = useParams();

  const [screen, setScreen] = useState<'projects' | 'editor'>('projects');
  const [projectTitle, setProjectTitle] = useState('Project Untitled');
  const [activeTool, setActiveTool] = useState<EditorTool>('media');
  const [workspace, setWorkspace] = useState<EditorWorkspace>('empty');
  const [rightDockTab, setRightDockTab] = useState<RightDockTab>('mediaGallery');
  const setMediaLibraryOpen = useCallback((open: boolean) => {
    setRightDockTab(open ? 'mediaGallery' : 'properties');
  }, []);
  const mediaLibraryOpen = rightDockTab === 'mediaGallery';
  const [mediaLibraryTab, setMediaLibraryTab] = useState<MediaLibraryTab>('your');
  const [favoriteClipIds, setFavoriteClipIds] = useState<string[]>([]);
  const toggleFavoriteClip = useCallback((clipId: string) => {
    setFavoriteClipIds((prev) =>
      prev.includes(clipId) ? prev.filter((id) => id !== clipId) : [...prev, clipId],
    );
  }, []);

  const [clips, setClips] = useState<MediaClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [exportModal, setExportModal] = useState<ExportModalState>('closed');
  /** Real numbers from the encoder, not a spinner. Null until an export runs. */
  const [exportProgress, setExportProgress] = useState<
    { pct: number; frame: number; frames: number } | null
  >(null);
  const [shareModal, setShareModal] = useState(false);
  const [unsavedLeaveTarget, setUnsavedLeaveTarget] = useState<string | null>(null);

  const requestUnsavedLeave = useCallback((absoluteHref: string) => {
    setUnsavedLeaveTarget(absoluteHref);
  }, []);
  const cancelUnsavedLeave = useCallback(() => setUnsavedLeaveTarget(null), []);
  const confirmUnsavedLeave = useCallback(() => {
    if (!unsavedLeaveTarget) return;
    try {
      const u = new URL(unsavedLeaveTarget, window.location.origin);
      navigate(`${u.pathname}${u.search}${u.hash}`);
    } catch {
      navigate(unsavedLeaveTarget);
    }
    setUnsavedLeaveTarget(null);
  }, [unsavedLeaveTarget, navigate]);
  const [hasTimelineContent, setHasTimelineContent] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [fadeInSec, setFadeInSec] = useState(0);
  const [fadeOutSec, setFadeOutSec] = useState(0);
  const [normalizeAudio, setNormalizeAudio] = useState(false);
  const [audioGain, setAudioGain] = useState(1);
  const [editHistory, setEditHistory] = useState(
    () => createHistory<EditSnapshot>({ trimStartSec: 0, trimEndSec: 0, cuts: [] }),
  );
  /** Set while an undo is being applied, so the effect that records changes
   * does not immediately record the undo as a new edit. */
  const applyingHistory = useRef(false);
  const [editorVideoSrc, setEditorVideoSrc] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [sourceRecordingId, setSourceRecordingId] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] =
    useState<'idle' | 'publishing' | 'done' | 'error'>('idle');
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishStaleComments, setPublishStaleComments] = useState(0);

  useEffect(() => {
    if (!currentProjectId) return;
    try {
      sessionStorage.setItem(
        `video-editor-favorites-${currentProjectId}`,
        JSON.stringify(favoriteClipIds),
      );
    } catch {
      /* empty */
    }
  }, [currentProjectId, favoriteClipIds]);

  const [projectLoadError, setProjectLoadError] = useState<string | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [trimStartSec, setTrimStartSec] = useState(0);
  const [trimEndSec, setTrimEndSec] = useState(0);
  const [videoDurationSec, setVideoDurationSec] = useState(0);
  const [editorPlaybackTime, setEditorPlaybackTime] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedTitle, setSavedTitle] = useState('');
  const [savedTrimStart, setSavedTrimStart] = useState(0);
  const [savedTrimEnd, setSavedTrimEnd] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [savedPlaybackRate, setSavedPlaybackRate] = useState(1);
  /** Baseline for dirty detection. Compared as JSON because the list is
   * rebuilt by normalizeCuts on every change, so identity never matches. */
  const [savedCutsJson, setSavedCutsJson] = useState('[]');
  const [savedFadeInSec, setSavedFadeInSec] = useState(0);
  const [savedFadeOutSec, setSavedFadeOutSec] = useState(0);
  const [stagedExportFile, setStagedExportFile] = useState<File | null>(null);
  const [stagedExportLabel, setStagedExportLabel] = useState<string | null>(null);
  const stagedBlobUrlRef = useRef<string | null>(null);
  const workingVideoBlobUrlRef = useRef<string | null>(null);
  const [localModifyStatus, setLocalModifyStatus] = useState<'idle' | 'working' | 'error'>('idle');
  const [localModifyError, setLocalModifyError] = useState<string | null>(null);
  const [localEffectsApplied, setLocalEffectsApplied] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<any[]>([]);
  const [zoomKeyframes, setZoomKeyframes] = useState<ZoomKeyframe[]>([]);

  const addCut = useCallback((startSec: number, endSec: number) => {
    setCuts((prev) => normalizeCuts(
      [...prev, { id: `cut-${Date.now()}-${Math.round(startSec * 1000)}`, startSec, endSec }],
      videoDurationSec,
    ));
  }, [videoDurationSec]);

  const removeCut = useCallback((id: string) => {
    setCuts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Records trim and cut changes as one snapshot each. Skipped while an undo is
  // being applied, otherwise stepping back would immediately be recorded as a
  // new edit and Redo could never be reached.
  useEffect(() => {
    if (applyingHistory.current) { applyingHistory.current = false; return; }
    setEditHistory((h) => {
      const p = h.present;
      if (p.trimStartSec === trimStartSec && p.trimEndSec === trimEndSec && p.cuts === cuts) {
        return h;
      }
      return record(h, { trimStartSec, trimEndSec, cuts });
    });
  }, [trimStartSec, trimEndSec, cuts]);

  /** A project with no saved trim keeps the whole clip, not none of it.
   *
   * timelineJson is null for every freshly created project, so `trimEnd` loads
   * as 0 — and the duration only arrives later, from the player's metadata.
   * Nothing bridged the two, so the editor opened believing you had kept
   * nothing: "0:00 of 0:42 kept", output length zero, and Save draft and
   * Publish changes both dead. The editor was unusable until you happened to
   * drag the End slider. */
  const defaultedTrim = useRef(false);
  useEffect(() => {
    if (videoDurationSec <= 0 || defaultedTrim.current) return;
    // A saved or user-made trim is a real range; only an empty one is defaulted.
    if (trimEndSec > trimStartSec) { defaultedTrim.current = true; return; }
    defaultedTrim.current = true;

    // Not an edit. Without this the record effect below would log it, so Undo
    // would step back to the zero-length selection the user never chose.
    applyingHistory.current = true;
    setTrimEndSec(videoDurationSec);
    // And the baseline moves with it, or the project reads as dirty on open and
    // Publish lights up before anything has been changed.
    setSavedTrimEnd(videoDurationSec);
    setEditHistory((h) => resetHistory(h, {
      trimStartSec, trimEndSec: videoDurationSec, cuts,
    }));
  }, [videoDurationSec, trimStartSec, trimEndSec, cuts]);

  const applySnapshot = useCallback((snap: EditSnapshot) => {
    applyingHistory.current = true;
    setTrimStartSec(snap.trimStartSec);
    setTrimEndSec(snap.trimEndSec);
    setCuts(snap.cuts);
  }, []);

  const undoEdit = useCallback(() => {
    setEditHistory((h) => {
      if (!canUndo(h)) return h;
      const next = undo(h);
      applySnapshot(next.present);
      return next;
    });
  }, [applySnapshot]);

  const redoEdit = useCallback(() => {
    setEditHistory((h) => {
      if (!canRedo(h)) return h;
      const next = redo(h);
      applySnapshot(next.present);
      return next;
    });
  }, [applySnapshot]);

  const addZoomKeyframe = useCallback((kf: ZoomKeyframe) => {
    setZoomKeyframes((prev) => [...prev, kf].sort((a, b) => a.timestamp - b.timestamp));
  }, []);

  const updateZoomKeyframe = useCallback((id: string, patch: Partial<ZoomKeyframe>) => {
    setZoomKeyframes((prev) =>
      prev.map((kf) => (kf.id === id ? { ...kf, ...patch } : kf))
          .sort((a, b) => a.timestamp - b.timestamp),
    );
  }, []);

  const deleteZoomKeyframe = useCallback((id: string) => {
    setZoomKeyframes((prev) => prev.filter((kf) => kf.id !== id));
  }, []);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('snaprec_local_metadata');
      if (stored) {
        setMetadata(JSON.parse(stored));
      }
    } catch(e) {}
  }, [currentProjectId]);

  /** Derived, not stored. This was `useState(true)` plus an effect that set it
   * to false whenever metadata was empty — and nothing ever set it back. On
   * mount metadata is always [], so the effect latched auto-zoom off before
   * the stored metadata finished loading, and it stayed off for the rest of
   * the session. There is no UI toggle, so this is the whole condition. */
  const autoZoom = metadata.length > 0;

  const applyLocalEffect = useCallback((name: string) => {
    setLocalEffectsApplied((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }, []);
  const clearLocalModifyError = useCallback(() => {
    setLocalModifyError(null);
    setLocalModifyStatus('idle');
  }, []);

  const revokeWorkingVideoBlob = useCallback(() => {
    if (workingVideoBlobUrlRef.current) {
      try {
        URL.revokeObjectURL(workingVideoBlobUrlRef.current);
      } catch {
        /* empty */
      }
      workingVideoBlobUrlRef.current = null;
    }
  }, []);

  const setStagedExport = useCallback((file: File | null) => {
    if (stagedBlobUrlRef.current) {
      try {
        URL.revokeObjectURL(stagedBlobUrlRef.current);
      } catch {
        /* empty */
      }
      stagedBlobUrlRef.current = null;
    }
    setStagedExportFile(file);
    setStagedExportLabel(file ? file.name : null);
    if (file) {
      setClips((prev) =>
        prev.length ? [{ ...prev[0], sizeBytes: file.size }, ...prev.slice(1)] : prev,
      );
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const list = await fetchWithAuth<VideoProjectDto[]>('/video-projects');
      setProjects(
        list.map((p) => ({
          id: p.id,
          title: p.title,
          modified: p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '—',
        })),
      );
    } catch {
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const loadProject = useCallback(
    async (id: string) => {
      setProjectLoadError(null);
      setProjectLoading(true);
      clearStagingRef(stagedBlobUrlRef, setStagedExportFile, setStagedExportLabel);
      revokeWorkingVideoBlob();
      try {
        const p = await fetchWithAuth<VideoProjectDto>(`/video-projects/${id}`);
        setCurrentProjectId(p.id);
        setSourceRecordingId(p.recordingId ?? null);
        setProjectTitle(p.title);
        const src = p.videoUrl.startsWith('http') ? p.videoUrl : `${API_BASE_URL}${p.videoUrl}`;
        setEditorVideoSrc(src);
        setScreen('editor');
        setHasTimelineContent(true);
        setWorkspace('timeline');
        setActiveTool('media');
        setRightDockTab('mediaGallery');
        const clipId = 'timeline-1';
        const sizeBytes =
          typeof p.fileSizeBytes === 'number' && p.fileSizeBytes >= 0
            ? p.fileSizeBytes
            : undefined;
        setClips([
          {
            id: clipId,
            name: p.title || 'Recording',
            durationLabel: '—',
            res: '—',
            fps: '—',
            ...(sizeBytes !== undefined ? { sizeBytes } : {}),
          },
        ]);
        setSelectedClipId(clipId);
        setVideoDurationSec(0);
        defaultedTrim.current = false;
        setMediaLibraryTab('your');
        try {
          const raw = sessionStorage.getItem(`video-editor-favorites-${id}`);
          setFavoriteClipIds(raw ? JSON.parse(raw) : []);
        } catch {
          setFavoriteClipIds([]);
        }
        const tj = p.timelineJson as {
          trimStart?: number;
          trimEnd?: number;
          playbackRate?: number;
          cuts?: Cut[];
          fadeInSec?: number;
          fadeOutSec?: number;
          normalizeAudio?: boolean;
        } | null;
        let ts = 0;
        let te = 0;
        if (
          tj &&
          typeof tj.trimStart === 'number' &&
          typeof tj.trimEnd === 'number' &&
          tj.trimEnd > tj.trimStart
        ) {
          ts = tj.trimStart;
          te = tj.trimEnd;
        }
        const pr = normalizePlaybackRate(tj?.playbackRate);
        setTrimStartSec(ts);
        setTrimEndSec(te);
        setPlaybackRate(pr);
        // Re-normalised on load: a project saved by an older build, or edited
        // by hand, must not put an invalid list into everything downstream.
        setCuts(normalizeCuts(Array.isArray(tj?.cuts) ? tj.cuts : [], te || 0));
        setFadeInSec(typeof tj?.fadeInSec === 'number' ? tj.fadeInSec : 0);
        setFadeOutSec(typeof tj?.fadeOutSec === 'number' ? tj.fadeOutSec : 0);
        setNormalizeAudio(tj?.normalizeAudio === true);
        setSavedPlaybackRate(pr);
        setSavedTitle(p.title);
        setSavedTrimStart(ts);
        setEditHistory((h) => resetHistory(h, { trimStartSec: ts, trimEndSec: te, cuts: normalizeCuts(Array.isArray(tj?.cuts) ? tj.cuts : [], te || 0) }));
        setSavedFadeInSec(typeof tj?.fadeInSec === 'number' ? tj.fadeInSec : 0);
        setSavedFadeOutSec(typeof tj?.fadeOutSec === 'number' ? tj.fadeOutSec : 0);
        setSavedCutsJson(JSON.stringify(normalizeCuts(Array.isArray(tj?.cuts) ? tj.cuts : [], te || 0)));
        setSavedTrimEnd(te);
        setSaveStatus('idle');
        setLocalEffectsApplied([]);
      } catch (e: unknown) {
        setProjectLoadError(e instanceof Error ? e.message : 'Failed to load project');
        setScreen('projects');
      } finally {
        setProjectLoading(false);
      }
    },
    [revokeWorkingVideoBlob],
  );

  useEffect(() => {
    if (routeProjectId) {
      loadProject(routeProjectId);
    } else {
      setCurrentProjectId(null);
      setEditorVideoSrc(null);
      setProjectLoadError(null);
      setScreen('projects');
      setPlaybackRate(1);
      setSavedPlaybackRate(1);
      clearStagingRef(stagedBlobUrlRef, setStagedExportFile, setStagedExportLabel);
      revokeWorkingVideoBlob();
      refreshProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeProjectId]);

  const reloadProject = useCallback(() => {
    if (currentProjectId) loadProject(currentProjectId);
  }, [currentProjectId, loadProject]);

  const addMediaToTimeline = useCallback(() => {
    setHasTimelineContent(true);
    setWorkspace('timeline');
    if (!selectedClipId && clips[0]) setSelectedClipId(clips[0].id);
    setRightDockTab('mediaGallery');
  }, [clips, selectedClipId]);

  const openProject = useCallback(
    (pid: string, _title: string) => {
      navigate(`/video-editor/project/${pid}`);
    },
    [navigate],
  );

  const newProject = useCallback(() => {
    navigate('/video-editor');
    setProjectTitle('Project Untitled');
    setScreen('editor');
    setHasTimelineContent(false);
    setWorkspace('empty');
    setSelectedClipId(null);
    setMediaLibraryOpen(true);
    setEditorVideoSrc(null);
    setCurrentProjectId(null);
    setTrimStartSec(0);
    setTrimEndSec(0);
    setVideoDurationSec(0);
    setPlaybackRate(1);
    setSavedPlaybackRate(1);
    clearStagingRef(stagedBlobUrlRef, setStagedExportFile, setStagedExportLabel);
    revokeWorkingVideoBlob();
  }, [navigate, revokeWorkingVideoBlob]);

  /** Export: encode the current edit and hand back a file.
   *
   * The Export button used to call setExportModal('settings'), and the only
   * state anything rendered was 'progress' — so pressing it did nothing at all.
   * This runs the same encoder the Apply path uses, so the file carries the
   * trim, the cuts, the zoom regions and the audio gain, then downloads it and
   * stages it. Staging is what unblocks Publish, which needs a real file rather
   * than an edit plan. */
  const exportEdit = useCallback(async () => {
    const src = editorVideoSrc;
    if (!src) return;
    const d = videoDurationSec > 0 ? videoDurationSec : 120;
    const end = trimEndSec > trimStartSec ? trimEndSec : d;
    const start = Math.min(trimStartSec, Math.max(0, end - 0.1));

    setExportProgress({ pct: 0, frame: 0, frames: 0 });
    setExportModal('progress');
    try {
      const blob = await recordVideoSegmentToWebm(src, start, end, {
        autoZoom,
        metadata,
        zoomKeyframes,
        cuts,
        audioGain: normalizeAudio ? audioGain : 1,
        onProgress: setExportProgress,
      });

      const name = `${(projectTitle || 'export').replace(/[^\w-]+/g, '-').slice(0, 60)}.webm`;
      const file = new File([blob], name, { type: blob.type || 'video/webm' });
      // Staged before the download, so Publish is available even if the browser
      // routes the download somewhere the user does not notice.
      setStagedExport(file);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      // Revoked on a later tick: revoking immediately cancels the download in
      // Chrome, which is a silent failure — the dialog closes and no file
      // arrives.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      setExportModal('closed');
      setExportProgress(null);
    } catch {
      // The modal's failed state names the frame it stopped at, so the progress
      // is deliberately left in place.
      setExportModal('failed');
    }
  }, [
    editorVideoSrc,
    videoDurationSec,
    trimStartSec,
    trimEndSec,
    autoZoom,
    metadata,
    zoomKeyframes,
    cuts,
    normalizeAudio,
    audioGain,
    projectTitle,
    setStagedExport,
  ]);

  const resetTrim = useCallback(() => {
    setTrimStartSec(0);
    setTrimEndSec(videoDurationSec || 99999);
  }, [videoDurationSec]);

  const applyLocalTrim = useCallback(async () => {
    const src = editorVideoSrc;
    if (!src || !currentProjectId) {
      setLocalModifyError('Open a project with video first.');
      setLocalModifyStatus('error');
      return;
    }
    const d = videoDurationSec > 0 ? videoDurationSec : 120;
    const end = trimEndSec > trimStartSec ? trimEndSec : Math.min(trimStartSec + 0.5, d);
    const start = Math.min(trimStartSec, end - 0.1);
    setLocalModifyError(null);
    setLocalModifyStatus('working');
    try {
      const blob = await recordVideoSegmentToWebm(src, start, end, {
        autoZoom,
        metadata,
        zoomKeyframes,
        cuts,
        // 1 unless normalising is on and the level could actually be measured.
        audioGain: normalizeAudio ? audioGain : 1,
      });
      revokeWorkingVideoBlob();
      const url = URL.createObjectURL(blob);
      workingVideoBlobUrlRef.current = url;
      setEditorVideoSrc(url);
      // The baked clip already has the cuts taken out, so it is shorter than
      // the trim range by exactly what they removed.
      const segmentSec = outputDurationSec(start, end, cuts);
      setTrimStartSec(0);
      setTrimEndSec(segmentSec);
      setVideoDurationSec(segmentSec);
      // And the cuts are now part of the footage, not pending edits. Left in
      // place they would be re-applied against the new clip at source
      // timestamps that no longer mean anything — removing a second, unrelated
      // stretch of video every time Apply was pressed.
      setCuts([]);
      const file = new File([blob], `trim-local-${Date.now()}.webm`, {
        type: blob.type || 'video/webm',
      });
      setStagedExport(file);
      setLocalModifyStatus('idle');
    } catch (e) {
      setLocalModifyError(e instanceof Error ? e.message : 'Modify failed');
      setLocalModifyStatus('error');
    }
  }, [
    editorVideoSrc,
    currentProjectId,
    videoDurationSec,
    trimStartSec,
    trimEndSec,
    revokeWorkingVideoBlob,
    setStagedExport,
    autoZoom,
    metadata,
    cuts,
    normalizeAudio,
    audioGain,
  ]);

  /** P7 E6.1 — replace the source capture's media with the current edit.
   *
   * Requires a baked file. Publishing the untouched original would be a no-op
   * that still counts as a publish, so the caller must Apply first; the editor
   * surfaces that rather than silently doing nothing.
   *
   * Deliberately does NOT confirm here. A context method that opens a dialog
   * cannot be called from anywhere else, and the decision belongs with the UI
   * that knows what it is about to overwrite. */
  const publishToRecording = useCallback(async () => {
    if (!sourceRecordingId) {
      setPublishError('This project has no source capture to publish over.');
      setPublishStatus('error');
      return;
    }
    if (!stagedExportFile) {
      setPublishError('Apply your edit first — there is nothing new to publish.');
      setPublishStatus('error');
      return;
    }

    setPublishStatus('publishing');
    setPublishError(null);
    try {
      const ext = stagedExportFile.name.split('.').pop() || 'webm';
      const fileName = `publish-${sourceRecordingId}-${Date.now()}.${ext}`;
      const contentType = stagedExportFile.type || 'video/webm';
      const { uploadUrl, fileUrl } = await fetchWithAuth<{ uploadUrl: string; fileUrl: string }>(
        '/recordings/upload-url',
        { method: 'POST', body: JSON.stringify({ fileName, contentType }) },
      );
      await uploadFile(uploadUrl, stagedExportFile, contentType);

      const result = await fetchWithAuth<{ staleComments: number }>(
        `/recordings/${sourceRecordingId}/publish`,
        {
          method: 'POST',
          body: JSON.stringify({
            fileUrl,
            durationSec: Math.round(Math.max(0, trimEndSec - trimStartSec)),
          }),
        },
      );
      setPublishStaleComments(result?.staleComments ?? 0);
      setPublishStatus('done');
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Publish failed');
      setPublishStatus('error');
    }
  }, [sourceRecordingId, stagedExportFile, trimStartSec, trimEndSec]);

  const hasUnsavedChanges = useMemo(() => {
    if (!currentProjectId) return false;
    const end = trimEndSec > trimStartSec ? trimEndSec : trimStartSec;
    const savedEnd = savedTrimEnd > savedTrimStart ? savedTrimEnd : savedTrimStart;
    const dirtyEdit =
      projectTitle.trim() !== savedTitle.trim() ||
      trimStartSec !== savedTrimStart ||
      end !== savedEnd ||
      playbackRate !== savedPlaybackRate ||
      JSON.stringify(cuts) !== savedCutsJson ||
      fadeInSec !== savedFadeInSec ||
      fadeOutSec !== savedFadeOutSec;
    return dirtyEdit || !!stagedExportFile || localEffectsApplied.length > 0;
  }, [
    currentProjectId,
    projectTitle,
    savedTitle,
    trimStartSec,
    trimEndSec,
    savedTrimStart,
    savedTrimEnd,
    playbackRate,
    savedPlaybackRate,
    cuts,
    savedCutsJson,
    fadeInSec,
    fadeOutSec,
    savedFadeInSec,
    savedFadeOutSec,
    stagedExportFile,
    localEffectsApplied.length,
  ]);

  const saveProject = useCallback(async () => {
    if (!currentProjectId) return;
    const end = trimEndSec > trimStartSec ? trimEndSec : trimStartSec + 0.01;
    const title = projectTitle.trim() || 'Untitled';
    const timelineJson = {
      trimStart: trimStartSec,
      trimEnd: end,
      version: 1,
      playbackRate,
      cuts,
      fadeInSec,
      fadeOutSec,
      normalizeAudio,
    };
    setSaveStatus('saving');
    try {
      let newFileUrl: string | undefined;
      if (stagedExportFile) {
        const ext = stagedExportFile.name.split('.').pop() || 'webm';
        const fileName = `export-${currentProjectId}-${Date.now()}.${ext}`;
        const contentType = stagedExportFile.type || 'video/webm';
        const { uploadUrl, fileUrl } = await fetchWithAuth<{ uploadUrl: string; fileUrl: string }>(
          '/recordings/upload-url',
          {
            method: 'POST',
            body: JSON.stringify({ fileName, contentType }),
          },
        );
        await uploadFile(uploadUrl, stagedExportFile, contentType);
        newFileUrl = fileUrl;
      }
      const body: Record<string, unknown> = {
        title,
        timelineJson,
      };
      if (newFileUrl) body.newFileUrl = newFileUrl;
      const updated = await fetchWithAuth<{ videoUrl: string }>(`/video-projects/${currentProjectId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      const src =
        updated.videoUrl.startsWith('http')
          ? updated.videoUrl
          : `${API_BASE_URL}${updated.videoUrl}`;
      setEditorVideoSrc(src);
      revokeWorkingVideoBlob();
      clearStagingRef(stagedBlobUrlRef, setStagedExportFile, setStagedExportLabel);
      setSavedTitle(title);
      setSavedTrimStart(trimStartSec);
      setSavedCutsJson(JSON.stringify(cuts));
      setSavedFadeInSec(fadeInSec);
      setSavedFadeOutSec(fadeOutSec);
      setSavedTrimEnd(end);
      setSavedPlaybackRate(playbackRate);
      setSaveStatus('saved');
      setLocalEffectsApplied([]);
      setTimeout(() => setSaveStatus('idle'), 2000);
      refreshProjects();
    } catch {
      setSaveStatus('error');
    }
    // Every value the payload above reads has to be here. cuts, the two fades
    // and normalizeAudio were missing, so this callback kept the identity it
    // had at mount and saved their initial values: remove six silences, press
    // Save draft, and the PATCH went out with `cuts: []`. The UI showed the
    // edit, the save reported success, and the work was gone on reload.
  }, [
    currentProjectId,
    projectTitle,
    trimStartSec,
    trimEndSec,
    playbackRate,
    cuts,
    fadeInSec,
    fadeOutSec,
    normalizeAudio,
    stagedExportFile,
    refreshProjects,
    revokeWorkingVideoBlob,
  ]);

  const value = useMemo(
    () => ({
      screen,
      setScreen,
      projectTitle,
      setProjectTitle,
      activeTool,
      setActiveTool,
      workspace,
      setWorkspace,
      mediaLibraryOpen,
      setMediaLibraryOpen,
      rightDockTab,
      setRightDockTab,
      mediaLibraryTab,
      setMediaLibraryTab,
      favoriteClipIds,
      toggleFavoriteClip,
      clips,
      selectedClipId,
      setSelectedClipId,
      exportModal,
      setExportModal,
      exportProgress,
      exportEdit,
      shareModal,
      setShareModal,
      hasTimelineContent,
      addMediaToTimeline,
      openProject,
      newProject,
      projects,
      projectsLoading,
      refreshProjects,
      editorVideoSrc,
      setEditorVideoSrc,
      currentProjectId,
      projectLoadError,
      projectLoading,
      reloadProject,
      trimStartSec,
      trimEndSec,
      setTrimStartSec,
      setTrimEndSec,
      videoDurationSec,
      setVideoDurationSec,
      editorPlaybackTime,
      setEditorPlaybackTime,
      resetTrim,
      playbackRate,
      setPlaybackRate,
      hasUnsavedChanges,
      saveProject,
      saveStatus,
      stagedExportFile,
      stagedExportLabel,
      setStagedExport,
      applyLocalTrim,
      localModifyStatus,
      localModifyError,
      clearLocalModifyError,
      localEffectsApplied,
      applyLocalEffect,
      unsavedLeaveTarget,
      requestUnsavedLeave,
      cancelUnsavedLeave,
      confirmUnsavedLeave,
      autoZoom,
      metadata,
      fadeInSec,
      fadeOutSec,
      setFadeInSec,
      setFadeOutSec,
      normalizeAudio,
      setNormalizeAudio,
      audioGain,
      setAudioGain,
      sourceRecordingId,
      publishToRecording,
      publishStatus,
      publishError,
      publishStaleComments,
      cuts,
      addCut,
      removeCut,
      undoEdit,
      redoEdit,
      canUndoEdit: canUndo(editHistory),
      canRedoEdit: canRedo(editHistory),
      zoomKeyframes,
      addZoomKeyframe,
      updateZoomKeyframe,
      deleteZoomKeyframe,
    }),
    [
      screen,
      projectTitle,
      activeTool,
      workspace,
      mediaLibraryOpen,
      rightDockTab,
      mediaLibraryTab,
      favoriteClipIds,
      toggleFavoriteClip,
      clips,
      selectedClipId,
      exportModal,
      exportProgress,
      exportEdit,
      shareModal,
      hasTimelineContent,
      addMediaToTimeline,
      openProject,
      newProject,
      projects,
      projectsLoading,
      refreshProjects,
      editorVideoSrc,
      currentProjectId,
      projectLoadError,
      projectLoading,
      reloadProject,
      trimStartSec,
      trimEndSec,
      videoDurationSec,
      editorPlaybackTime,
      resetTrim,
      playbackRate,
      hasUnsavedChanges,
      saveProject,
      saveStatus,
      stagedExportFile,
      stagedExportLabel,
      setStagedExport,
      applyLocalTrim,
      localModifyStatus,
      localModifyError,
      clearLocalModifyError,
      localEffectsApplied,
      applyLocalEffect,
      unsavedLeaveTarget,
      requestUnsavedLeave,
      cancelUnsavedLeave,
      confirmUnsavedLeave,
      autoZoom,
      metadata,
      fadeInSec,
      fadeOutSec,
      setFadeInSec,
      setFadeOutSec,
      normalizeAudio,
      setNormalizeAudio,
      audioGain,
      setAudioGain,
      sourceRecordingId,
      publishToRecording,
      publishStatus,
      publishError,
      publishStaleComments,
      cuts,
      addCut,
      removeCut,
      undoEdit,
      redoEdit,
      editHistory,
      zoomKeyframes,
      addZoomKeyframe,
      updateZoomKeyframe,
      deleteZoomKeyframe,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVideoEditor() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useVideoEditor inside VideoEditorProvider');
  return c;
}
