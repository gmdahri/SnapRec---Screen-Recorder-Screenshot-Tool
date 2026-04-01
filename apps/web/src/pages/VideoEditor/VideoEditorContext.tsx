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
} from './types';
import { fetchWithAuth, uploadFile } from '../../hooks/useRecordings';
import { recordVideoSegmentToWebm } from './localVideoTrim';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://snaprec-backend.onrender.com';

export interface VideoProjectDto {
  id: string;
  title: string;
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
  setAutoZoom: (v: boolean) => void;
  metadata: any[];
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
  const [editorVideoSrc, setEditorVideoSrc] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

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
  const [stagedExportFile, setStagedExportFile] = useState<File | null>(null);
  const [stagedExportLabel, setStagedExportLabel] = useState<string | null>(null);
  const stagedBlobUrlRef = useRef<string | null>(null);
  const workingVideoBlobUrlRef = useRef<string | null>(null);
  const [localModifyStatus, setLocalModifyStatus] = useState<'idle' | 'working' | 'error'>('idle');
  const [localModifyError, setLocalModifyError] = useState<string | null>(null);
  const [localEffectsApplied, setLocalEffectsApplied] = useState<string[]>([]);
  const [autoZoom, setAutoZoom] = useState(true);
  const [metadata, setMetadata] = useState<any[]>([]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('snaprec_local_metadata');
      if (stored) {
        setMetadata(JSON.parse(stored));
      }
    } catch(e) {}
  }, [currentProjectId]);

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
        setSavedPlaybackRate(pr);
        setSavedTitle(p.title);
        setSavedTrimStart(ts);
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
      });
      revokeWorkingVideoBlob();
      const url = URL.createObjectURL(blob);
      workingVideoBlobUrlRef.current = url;
      setEditorVideoSrc(url);
      const segmentSec = end - start;
      setTrimStartSec(0);
      setTrimEndSec(segmentSec);
      setVideoDurationSec(segmentSec);
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
  ]);

  const hasUnsavedChanges = useMemo(() => {
    if (!currentProjectId) return false;
    const end = trimEndSec > trimStartSec ? trimEndSec : trimStartSec;
    const savedEnd = savedTrimEnd > savedTrimStart ? savedTrimEnd : savedTrimStart;
    const dirtyEdit =
      projectTitle.trim() !== savedTitle.trim() ||
      trimStartSec !== savedTrimStart ||
      end !== savedEnd ||
      playbackRate !== savedPlaybackRate;
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
      setSavedTrimEnd(end);
      setSavedPlaybackRate(playbackRate);
      setSaveStatus('saved');
      setLocalEffectsApplied([]);
      setTimeout(() => setSaveStatus('idle'), 2000);
      refreshProjects();
    } catch {
      setSaveStatus('error');
    }
  }, [
    currentProjectId,
    projectTitle,
    trimStartSec,
    trimEndSec,
    playbackRate,
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
      setAutoZoom,
      metadata,
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
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVideoEditor() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useVideoEditor inside VideoEditorProvider');
  return c;
}
