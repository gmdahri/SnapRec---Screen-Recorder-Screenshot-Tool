import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useVideoEditor } from './VideoEditorContext';
import UserMenu from '../../components/UserMenu';
import LoginModal from '../../components/LoginModal';

export function ProjectsView() {
  const { newProject, openProject, projects, projectsLoading, refreshProjects } = useVideoEditor();
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  return (
    <div className="min-h-screen bg-[var(--sr-surface-carbon)] text-[var(--sr-text-primary-on-dark)]">
      <header className="sticky top-0 z-10 bg-[var(--sr-surface-panel-dark)] border-b border-[var(--sr-border-dark)] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <Link
              to="/dashboard"
              className="flex items-center rounded-[2px] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--sr-cyan)] py-0.5"
              title="Dashboard"
            >
              <img
                src="/logo.png"
                alt="SnapRec"
                className="h-9 w-auto object-contain object-left"
              />
            </Link>
            <span className="text-sm text-[var(--sr-text-faint-on-dark)] hidden sm:inline border-l border-[var(--sr-border-dark)] pl-4">
              Video projects
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={newProject}
              className="bg-[var(--sr-cyan)] hover:opacity-90 text-[var(--sr-cyan-fg)] px-5 py-2.5 rounded-[2px] font-semibold flex items-center gap-2"
            >
              + New project
            </button>
            <UserMenu onSignIn={() => setShowLoginModal(true)} />
          </div>
        </div>
      </header>
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-8">Projects</h1>
        {projectsLoading && (
          <p className="text-sm text-[var(--sr-text-faint-on-dark)] mb-4">Loading…</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <button
            type="button"
            onClick={newProject}
            className="min-h-[220px] border-2 border-dashed border-[var(--sr-border-dark-strong)] rounded-[2px] flex flex-col items-center justify-center gap-3 hover:border-[var(--sr-cyan)] hover:bg-[var(--sr-surface-panel-dark)] transition-colors"
          >
            <div className="w-12 h-12 rounded-[2px] bg-[var(--sr-surface-panel-dark)] flex items-center justify-center text-2xl text-[var(--sr-text-faint-on-dark)]">+</div>
            <span className="font-semibold text-[var(--sr-text-muted-on-dark)]">Create project</span>
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => openProject(p.id, p.title)}
              className="bg-[var(--sr-surface-panel-dark)] border border-[var(--sr-border-dark)] rounded-[2px] overflow-hidden shadow-sm hover:shadow-md text-left group"
            >
              <div className="aspect-video bg-[var(--sr-surface-panel-dark-alt)] flex items-center justify-center text-[var(--sr-text-faint-on-dark)] text-sm">
                Thumbnail
              </div>
              <div className="p-4">
                <h3 className="font-semibold truncate">{p.title}</h3>
                <p className="text-sm text-[var(--sr-text-faint-on-dark)] mt-1">Modified {p.modified}</p>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
