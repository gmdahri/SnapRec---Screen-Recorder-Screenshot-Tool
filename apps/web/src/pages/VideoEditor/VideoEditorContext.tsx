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
}

const Ctx = createContext<VideoEditorContextValue | null>(null);

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
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
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
  const [stagedExportFile, setStagedExportFile] = useState<File | null>(null);
  const [stagedExportLabel, setStagedExportLabel] = useState<string | null>(null);
  const stagedBlobUrlRef = useRef<string | null>(null);
  const workingVideoBlobUrlRef = useRef<string | null>(null);
  const [localModifyStatus, setLocalModifyStatus] = useState<'idle' | 'working' | 'error'>('idle');
  const [localModifyError, setLocalModifyError] = useState<string | null>(null);
  const [localEffectsApplied, setLocalEffectsApplied] = useState<string[]>([]);
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
        setMediaLibraryOpen(false);
        const clipId = 'timeline-1';
        setClips([
          {
            id: clipId,
            name: p.title || 'Recording',
            durationLabel: '—',
            res: '—',
            fps: '—',
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
        const tj = p.timelineJson as { trimStart?: number; trimEnd?: number } | null;
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
        setTrimStartSec(ts);
        setTrimEndSec(te);
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
    setMediaLibraryOpen(false);
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
      const blob = await recordVideoSegmentToWebm(src, start, end);
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
  ]);

  const hasUnsavedChanges = useMemo(() => {
    if (!currentProjectId) return false;
    const end = trimEndSec > trimStartSec ? trimEndSec : trimStartSec;
    const savedEnd = savedTrimEnd > savedTrimStart ? savedTrimEnd : savedTrimStart;
    const dirtyEdit =
      projectTitle.trim() !== savedTitle.trim() ||
      trimStartSec !== savedTrimStart ||
      end !== savedEnd;
    return dirtyEdit || !!stagedExportFile || localEffectsApplied.length > 0;
  }, [
    currentProjectId,
    projectTitle,
    savedTitle,
    trimStartSec,
    trimEndSec,
    savedTrimStart,
    savedTrimEnd,
    stagedExportFile,
    localEffectsApplied.length,
  ]);

  const saveProject = useCallback(async () => {
    if (!currentProjectId) return;
    const end = trimEndSec > trimStartSec ? trimEndSec : trimStartSec + 0.01;
    const title = projectTitle.trim() || 'Untitled';
    const timelineJson = { trimStart: trimStartSec, trimEnd: end, version: 1 };
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
    }),
    [
      screen,
      projectTitle,
      activeTool,
      workspace,
      mediaLibraryOpen,
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
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVideoEditor() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useVideoEditor inside VideoEditorProvider');
  return c;
}
