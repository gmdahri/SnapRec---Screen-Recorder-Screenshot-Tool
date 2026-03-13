import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useVideoEditor } from './VideoEditorContext';

export function ProjectsView() {
  const { newProject, openProject, projects, projectsLoading, refreshProjects } = useVideoEditor();

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
              title="Dashboard"
            >
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">
                S
              </div>
              <span className="text-xl font-bold text-slate-900">SnapRec</span>
            </Link>
            <span className="text-sm text-slate-500 hidden sm:inline border-l border-slate-200 pl-4">
              Video projects
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={newProject}
              className="bg-primary hover:opacity-90 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2"
            >
              + New project
            </button>
            <div className="w-10 h-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-xs font-bold">
              U
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-8">Projects</h1>
        {projectsLoading && (
          <p className="text-sm text-slate-500 mb-4">Loading…</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <button
            type="button"
            onClick={newProject}
            className="min-h-[220px] border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-primary hover:bg-white transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-2xl text-slate-500">+</div>
            <span className="font-semibold text-slate-600">Create project</span>
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => openProject(p.id, p.title)}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md text-left group"
            >
              <div className="aspect-video bg-gradient-to-br from-violet-100 to-slate-200 flex items-center justify-center text-slate-400 text-sm">
                Thumbnail
              </div>
              <div className="p-4">
                <h3 className="font-semibold truncate">{p.title}</h3>
                <p className="text-sm text-slate-500 mt-1">Modified {p.modified}</p>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
