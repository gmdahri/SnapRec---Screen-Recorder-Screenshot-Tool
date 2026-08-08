import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CAPTURE_STATES, CaptureFrame, StateRule, StatusBadge,
  type CaptureStatus, type StatusWord,
} from '@snaprec/design-system';
import { useAuth } from '../contexts/AuthContext';
import { AppShell, SEO } from '../components';
import { useVideoEditor } from './VideoEditor/VideoEditorContext';

export interface ProjectItem {
  id: string;
  title: string;
  status: CaptureStatus;
  detail: string;
  /** A second line, used for reassurance during long work. */
  extra?: string;
  progress?: number;
}

export interface ProjectListProps {
  projects: ProjectItem[];
  onAction: (id: string, action: string) => void;
  onOpen: (id: string) => void;
}

/** Presentational, so the action for each state comes from CAPTURE_STATES
 * rather than a switch statement that drifts from the rest of the product. */
export function ProjectList({ projects, onAction, onOpen }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <p style={{
        margin: 0, padding: '48px 0', textAlign: 'center',
        fontSize: 13, color: 'var(--sr-text-muted-on-light)',
      }}>
        No projects yet. Open a recording from your library and start editing.
      </p>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      gap: 16,
    }}>
      {projects.map(project => {
        const def = CAPTURE_STATES[project.status];

        return (
          <div key={project.id} style={{ display: 'flex', flexDirection: 'column' }}>
            <CaptureFrame
              treatment={def.canPreview ? 'focused' : 'passive'}
              style={{ background: 'var(--sr-surface-carbon)', aspectRatio: '16 / 9' }}
            >
              <StateRule status={project.status} progress={project.progress} />
            </CaptureFrame>

            <button
              type="button"
              onClick={() => onOpen(project.id)}
              style={{
                padding: '9px 2px 0', border: 'none', background: 'transparent',
                textAlign: 'left', cursor: 'pointer',
                fontSize: 13.5, fontWeight: 500, color: 'var(--sr-text-primary-on-light)',
              }}
            >{project.title}</button>

            <span style={{
              marginTop: 4, fontFamily: 'var(--sr-font-mono)', fontSize: 10,
              color: 'var(--sr-text-faint-on-light)',
            }}>{project.detail}</span>

            {project.extra && (
              <span style={{
                marginTop: 3, fontSize: 11.5, color: 'var(--sr-text-muted-on-light)',
              }}>{project.extra}</span>
            )}

            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusBadge status={def.label as StatusWord} />
              <button
                type="button"
                onClick={() => onAction(project.id, def.primary)}
                style={{
                  marginLeft: 'auto', height: 'var(--sr-h-2xs)', padding: '0 12px',
                  border: '1px solid var(--sr-border-light)', background: 'transparent',
                  fontSize: 12.5, cursor: 'pointer', borderRadius: 'var(--sr-radius-control)',
                }}
              >{def.primary}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function initialsOf(name: string | undefined, email: string | undefined): string {
  const source = name?.trim() || email?.split('@')[0] || 'You';
  const parts = source.split(/[\s.]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2)).toUpperCase();
}

export default function Projects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projects, projectsLoading, refreshProjects, newProject } = useVideoEditor();

  useEffect(() => { refreshProjects(); }, [refreshProjects]);

  /** ProjectSummary carries id, title and modified only — the server has no
   * export-state column, so every project reads as a draft edit. When the
   * server grows one, this map is the only thing to change; the exporting and
   * export-failed treatments are already built and tested. */
  const items: ProjectItem[] = projects.map(p => ({
    id: p.id,
    title: p.title,
    status: 'draftEdit' as const,
    detail: `edited ${p.modified}`,
  }));

  return (
    <AppShell
      title="Projects"
      meta={projectsLoading ? 'loading' : `${items.length} project${items.length === 1 ? '' : 's'}`}
      user={{
        initials: initialsOf(user?.user_metadata?.full_name, user?.email),
        name: user?.user_metadata?.full_name || user?.email || 'Your account',
      }}
      onSearch={q => navigate(`/library?q=${encodeURIComponent(q)}`)}
    >
      <SEO title="Projects — SnapRec" description="Multi-clip edits in progress." noIndex />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontFamily: 'var(--sr-font-mono)', fontSize: 10,
            letterSpacing: '.12em', color: 'var(--sr-text-faint-on-light)',
          }}>Recently edited</span>
          <span style={{ flex: 1, height: 1, background: 'var(--sr-border-light-soft)' }} />
          <button type="button" onClick={() => newProject()} style={{
            height: 'var(--sr-h-2xs)', padding: '0 13px', border: 'none', cursor: 'pointer',
            background: 'var(--sr-text-primary-on-light)', color: '#fff',
            fontSize: 12.5, fontWeight: 600, borderRadius: 'var(--sr-radius-control)',
          }}>New project</button>
        </div>

        <ProjectList
          projects={items}
          onOpen={id => navigate(`/video-editor/project/${id}`)}
          onAction={id => navigate(`/video-editor/project/${id}`)}
        />
      </div>
    </AppShell>
  );
}
