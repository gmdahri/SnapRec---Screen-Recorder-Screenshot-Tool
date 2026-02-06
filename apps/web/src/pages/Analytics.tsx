import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useRecordings, type Recording } from '../hooks/useRecordings';
import { MainLayout } from '../components';
import { parseUTCDate } from '../lib/dateUtils';

const Analytics: React.FC = () => {
    const { user, loading: authLoading, signOut } = useAuth();
    const { showNotification } = useNotification();

    const { data: recordings = [], isLoading, isError, error } = useRecordings(!!user, authLoading);

    // Show error notification when query fails
    useEffect(() => {
        if (isError && error) {
            showNotification(error.message || 'Failed to load recordings', 'error');
        }
    }, [isError, error, showNotification]);

    const videoCount = recordings.filter((r: Recording) => r.type === 'video').length;
    const screenshotCount = recordings.filter((r: Recording) => r.type === 'screenshot').length;

    // Group by date for activity chart
    const activityByDay = recordings.reduce((acc: Record<string, number>, r: Recording) => {
        const date = parseUTCDate(r.createdAt).toLocaleDateString();
        acc[date] = (acc[date] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

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
                <div className="mb-8">
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Analytics</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Insights into your capture activity</p>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Total Captures</p>
                                <p className="text-4xl font-black text-slate-900 dark:text-white">{recordings.length}</p>
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Videos</p>
                                <p className="text-4xl font-black text-amber-600">{videoCount}</p>
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Screenshots</p>
                                <p className="text-4xl font-black text-emerald-600">{screenshotCount}</p>
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Active Days</p>
                                <p className="text-4xl font-black text-primary">{Object.keys(activityByDay).length}</p>
                            </div>
                        </div>

                        {/* Type Breakdown */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Capture Breakdown</h3>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <div className="h-4 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                                                style={{ width: `${recordings.length ? (videoCount / recordings.length) * 100 : 0}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between mt-2 text-sm">
                                            <span className="text-amber-600 font-semibold">Videos: {videoCount}</span>
                                            <span className="text-emerald-600 font-semibold">Screenshots: {screenshotCount}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Recent Activity</h3>
                                <div className="flex gap-1 items-end h-20">
                                    {Object.entries(activityByDay).slice(-7).map(([date, count]) => (
                                        <div key={date} className="flex-1 flex flex-col items-center gap-1">
                                            <div
                                                className="w-full bg-primary rounded-sm min-h-[4px]"
                                                style={{ height: `${Math.min(count * 20, 80)}px` }}
                                            />
                                            <span className="text-[10px] text-slate-400">{parseUTCDate(date).getDate()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </MainLayout>
    );
};

export default Analytics;
