import React, { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useRecordings, type Recording } from '../hooks/useRecordings';
import { MainLayout } from '../components';

const DashboardOverview: React.FC = () => {
    const { user, loading: authLoading, signOut } = useAuth();
    const { showNotification } = useNotification();
    const navigate = useNavigate();

    const { data: recordings = [], isLoading, isError, error } = useRecordings(!!user, authLoading);

    // Show error notification when query fails
    useEffect(() => {
        if (isError && error) {
            showNotification(error.message || 'Failed to load recordings', 'error');
        }
    }, [isError, error, showNotification]);

    const recentRecordings = recordings.slice(0, 5);
    const videoCount = recordings.filter((r: Recording) => r.type === 'video').length;
    const screenshotCount = recordings.filter((r: Recording) => r.type === 'screenshot').length;

    const Sidebar = (
        <aside className="w-72 bg-white dark:bg-background-dark border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between p-6 overflow-y-auto">
            <div className="flex flex-col gap-8">
                <nav className="flex flex-col gap-1">
                    <NavLink to="/dashboard" className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <span className="material-symbols-outlined">dashboard</span>
                        <span className="font-semibold text-sm">Dashboard</span>
                    </NavLink>
                    <NavLink to="/library" className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
                        <span className="font-semibold text-sm">My Library</span>
                    </NavLink>
                </nav>
            </div>
            <div className="flex flex-col gap-6">
                <button onClick={() => showNotification('Use the SnapRec extension to start a new recording!', 'info')} className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg shadow-primary/20">
                    <span className="material-symbols-outlined text-xl">add_circle</span>
                    <span>New Recording</span>
                </button>
                <nav className="flex flex-col gap-1">
                    <NavLink to="/analytics" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 transition-colors ${isActive ? 'text-primary' : 'text-slate-600 dark:text-slate-400 hover:text-primary'}`}>
                        <span className="material-symbols-outlined">analytics</span>
                        <span className="font-semibold text-sm">Analytics</span>
                    </NavLink>
                    <NavLink to="/settings" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 transition-colors ${isActive ? 'text-primary' : 'text-slate-600 dark:text-slate-400 hover:text-primary'}`}>
                        <span className="material-symbols-outlined">settings</span>
                        <span className="font-semibold text-sm">Settings</span>
                    </NavLink>
                    <button onClick={signOut} className="flex items-center gap-3 px-3 py-2 text-red-500 hover:text-red-600 transition-colors w-full text-left">
                        <span className="material-symbols-outlined">logout</span>
                        <span className="font-semibold text-sm">Sign Out</span>
                    </button>
                </nav>
            </div>
        </aside>
    );

    return (
        <MainLayout sidebar={Sidebar}>
            <div className="bg-slate-50/50 dark:bg-background-dark/50 min-h-full p-8">
                {/* Welcome Section */}
                <div className="mb-8">
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}! 👋
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Here's what's happening with your captures
                    </p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <div className="flex items-center gap-4">
                            <div className="size-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <span className="material-symbols-outlined text-2xl">video_library</span>
                            </div>
                            <div>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Total Captures</p>
                                <p className="text-3xl font-black text-slate-900 dark:text-white">{recordings.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <div className="flex items-center gap-4">
                            <div className="size-14 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                                <span className="material-symbols-outlined text-2xl">videocam</span>
                            </div>
                            <div>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Videos</p>
                                <p className="text-3xl font-black text-slate-900 dark:text-white">{videoCount}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <div className="flex items-center gap-4">
                            <div className="size-14 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                                <span className="material-symbols-outlined text-2xl">image</span>
                            </div>
                            <div>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Screenshots</p>
                                <p className="text-3xl font-black text-slate-900 dark:text-white">{screenshotCount}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <button onClick={() => navigate('/library')} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex items-center gap-4 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
                        <div className="size-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-2xl">folder_open</span>
                        </div>
                        <div className="text-left">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">View Library</h3>
                            <p className="text-slate-500 text-sm">Browse all your captures</p>
                        </div>
                    </button>
                    <button onClick={() => showNotification('Use the SnapRec extension to start recording!', 'info')} className="bg-gradient-to-r from-primary to-purple-600 rounded-2xl p-6 flex items-center gap-4 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                        <div className="size-14 rounded-xl bg-white/20 flex items-center justify-center text-white">
                            <span className="material-symbols-outlined text-2xl">play_circle</span>
                        </div>
                        <div className="text-left">
                            <h3 className="text-lg font-bold text-white">Start Recording</h3>
                            <p className="text-white/80 text-sm">Capture your screen now</p>
                        </div>
                    </button>
                </div>

                {/* Recent Captures */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Recent Captures</h3>
                        <button onClick={() => navigate('/library')} className="text-primary font-bold text-sm hover:underline">
                            View All →
                        </button>
                    </div>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="size-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        </div>
                    ) : recentRecordings.length === 0 ? (
                        <div className="text-center py-8">
                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">folder_open</span>
                            <p className="text-slate-500">No captures yet</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                            {recentRecordings.map(recording => (
                                <a key={recording.id} href={recording.type === 'screenshot' ? `/editor/${recording.id}` : `/video-preview/${recording.id}`} className="group bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden hover:shadow-md transition-all">
                                    <div className="aspect-video bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                                        {recording.type === 'video' ? (
                                            <span className="material-symbols-outlined text-3xl text-slate-400">videocam</span>
                                        ) : (
                                            <img src={recording.fileUrl} alt={recording.title} className="w-full h-full object-cover" />
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{recording.title}</p>
                                    </div>
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
};

export default DashboardOverview;
