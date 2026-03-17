import { SEO } from '../../components';
import { VideoEditorProvider, useVideoEditor } from './VideoEditorContext';
import { VideoEditorChrome } from './VideoEditorChrome';
import { TrimSidebar } from './TrimSidebar';
import { SpeedSidebar } from './SpeedSidebar';
import { EditorWorkspace } from './EditorWorkspace';
import { ExportModal } from './ExportModal';
import { ShareModal } from './ShareModal';
import { ProjectsView } from './ProjectsView';
import { useParams } from 'react-router-dom';
import { useEditorUnsavedGuard } from './useEditorUnsavedGuard';
import { UnsavedChangesModal } from './UnsavedChangesModal';

function VideoEditorInner() {
  const {
    screen,
    projectLoadError,
    projectLoading,
    workspace,
    hasUnsavedChanges,
    currentProjectId,
    requestUnsavedLeave,
  } = useVideoEditor();
  useEditorUnsavedGuard(!!currentProjectId && hasUnsavedChanges, requestUnsavedLeave);
  const { projectId } = useParams();
  if (projectId && projectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (projectId && projectLoadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] p-6">
        <p className="text-red-600 font-medium mb-4">{projectLoadError}</p>
        <a href="/video-editor" className="text-primary font-bold">
          Back to projects
        </a>
      </div>
    );
  }
  if (screen === 'projects') return <ProjectsView />;
  return (
    <VideoEditorChrome>
      {workspace === 'trim' ? <TrimSidebar /> : workspace === 'speed' ? <SpeedSidebar /> : null}
      <EditorWorkspace />
    </VideoEditorChrome>
  );
}

export default function VideoEditorPage() {
  return (
    <VideoEditorProvider>
      <SEO title="Video Editor" description="Edit screen recordings in SnapRec." noIndex />
      <div className="relative">
        <VideoEditorInner />
        <ExportModal />
        <ShareModal />
        <UnsavedChangesModal />
      </div>
    </VideoEditorProvider>
  );
}
