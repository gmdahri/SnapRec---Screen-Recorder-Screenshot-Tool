import { useEffect, useMemo } from 'react';
import { SEO } from '../../components';
import { VideoEditorProvider, useVideoEditor } from './VideoEditorContext';
import { VideoEditorChrome } from './VideoEditorChrome';
import { TrimSidebar } from './TrimSidebar';
import { SpeedSidebar } from './SpeedSidebar';
import { PropertiesPanel } from './PropertiesPanel';
import { useWaveform } from './useWaveform';
import { detectSilences, summarizeSilences } from './silences';
import { describeLoudness, gainFor } from './loudness';
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
    trimStartSec,
    trimEndSec,
    setTrimStartSec,
    setTrimEndSec,
    videoDurationSec,
    cuts,
    fadeInSec,
    fadeOutSec,
    setFadeInSec,
    setFadeOutSec,
    addCut,
    editorVideoSrc,
    normalizeAudio,
    setNormalizeAudio,
    setAudioGain,
    currentProjectId,
    requestUnsavedLeave,
  } = useVideoEditor();

  // E5.1 — the same decoded peaks the AUDIO lane uses; detection is free.
  const { peaks, loudnessDbfs } = useWaveform(editorVideoSrc);
  const loudnessSummary = describeLoudness(loudnessDbfs);

  // Kept in the context so the export can read it without re-measuring.
  useEffect(() => { setAudioGain(gainFor(loudnessDbfs)); }, [loudnessDbfs, setAudioGain]);
  const silences = useMemo(
    () => detectSilences(peaks, videoDurationSec),
    [peaks, videoDurationSec],
  );
  const silenceSummary = summarizeSilences(silences);
  useEditorUnsavedGuard(!!currentProjectId && hasUnsavedChanges, requestUnsavedLeave);
  const { projectId } = useParams();
  if (projectId && projectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--sr-surface-carbon)]">
        <div className="w-10 h-10 border-2 border-[var(--sr-cyan)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (projectId && projectLoadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--sr-surface-carbon)] p-6">
        <p className="text-[var(--sr-coral-on-dark)] font-medium mb-4">{projectLoadError}</p>
        <a href="/video-editor" className="text-[var(--sr-cyan)] font-bold">
          Back to projects
        </a>
      </div>
    );
  }
  if (screen === 'projects') return <ProjectsView />;
  return (
    <VideoEditorChrome>
      {/* P7 E1.3. The tool-specific sidebars still own their actions — Apply
          trim lives in TrimSidebar — so this is the panel for every other
          workspace rather than a replacement for them. Consolidating the two
          belongs with E2, when the timeline takes over trimming. */}
      {/* One sidebar per workspace. Trim and Speed own theirs; everywhere else
          the dock owns it, and the properties panel is a tab inside that dock
          rather than a second panel beside it. Media used to show both, which
          put Start and End in the dock's neighbour while the Trim tool — a
          click away in the same rail — owned the same two controls. */}
      {workspace === 'trim' ? <TrimSidebar />
        : workspace === 'speed' ? <SpeedSidebar />
          : null}
      <EditorWorkspace
        properties={
          <PropertiesPanel
            trimStartSec={trimStartSec}
            trimEndSec={trimEndSec}
            durationSec={videoDurationSec}
            onTrimStartChange={setTrimStartSec}
            onTrimEndChange={setTrimEndSec}
            cuts={cuts}
            fadeInSec={fadeInSec}
            fadeOutSec={fadeOutSec}
            onFadeInChange={setFadeInSec}
            onFadeOutChange={setFadeOutSec}
            silenceSummary={silenceSummary}
            loudnessSummary={loudnessSummary}
            normalizeAudio={normalizeAudio}
            onNormalizeChange={loudnessDbfs !== null ? setNormalizeAudio : undefined}
            onRemoveSilences={peaks.length > 0 ? () => {
              // Proposed as ordinary cuts, so they appear on the CUTS lane
              // and can be moved, removed or undone like any other. An
              // invisible filter would give nothing to review.
              silences.forEach(s => addCut(s.startSec, s.endSec));
            } : undefined}
            outputFormat="WebM · VP9"
          />
        }
      />
    </VideoEditorChrome>
  );
}

/** Connects the context to the two presentational modals.
 *
 * They take props now rather than reaching into context themselves, so their
 * copy and button ordering are testable without mounting an editor. This is
 * the one place that translation happens. */
function EditorModals() {
  const {
    exportModal, setExportModal, exportProgress, exportEdit, projectTitle,
    unsavedLeaveTarget, cancelUnsavedLeave, confirmUnsavedLeave,
  } = useVideoEditor();

  return (
    <>
      {(exportModal === 'progress' || exportModal === 'failed') && (
        <ExportModal
          // Real numbers from the encoder. This was hardcoded to 0% of 0
          // frames, which is what a dialog looks like when nothing is driving
          // it — and nothing was: the Export button set a state that had no
          // renderer at all.
          state={exportModal === 'failed'
            ? { kind: 'failed', frame: exportProgress?.frame ?? 0, frames: exportProgress?.frames ?? 0 }
            : {
                kind: 'exporting',
                pct: exportProgress?.pct ?? 0,
                frame: exportProgress?.frame ?? 0,
                frames: exportProgress?.frames ?? 0,
              }}
          onCancel={() => setExportModal('closed')}
          onRetry={() => void exportEdit()}
          onRetryLower={() => void exportEdit()}
          onBack={() => setExportModal('closed')}
        />
      )}

      {unsavedLeaveTarget && (
        <UnsavedChangesModal
          title={projectTitle}
          summary="draft edit · saved automatically"
          onLeave={confirmUnsavedLeave}
          onStay={cancelUnsavedLeave}
          onDiscard={confirmUnsavedLeave}
        />
      )}
    </>
  );
}

export default function VideoEditorPage() {
  return (
    <VideoEditorProvider>
      <SEO title="Video Editor" description="Edit screen recordings in SnapRec." noIndex />
      <div className="relative">
        <VideoEditorInner />
        <EditorModals />
        <ShareModal />
      </div>
    </VideoEditorProvider>
  );
}
