import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { MainLayout } from '../components';

const Settings: React.FC = () => {
    const { user, signOut } = useAuth();
    const { showNotification } = useNotification();

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
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Settings</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Manage your account and preferences</p>
                </div>

                <div className="max-w-2xl space-y-6">
                    {/* Profile Section */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Profile</h3>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                                {user?.email?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 dark:text-white">{user?.email?.split('@')[0] || 'User'}</p>
                                <p className="text-slate-500 text-sm">{user?.email || 'No email'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Preferences Section */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Preferences</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">Auto-upload captures</p>
                                    <p className="text-slate-500 text-sm">Automatically upload new captures to cloud</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" defaultChecked className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">Copy link after upload</p>
                                    <p className="text-slate-500 text-sm">Automatically copy share link to clipboard</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" defaultChecked className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Account Actions */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Account</h3>
                        <div className="space-y-3">
                            <button
                                onClick={signOut}
                                className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 px-4 rounded-lg transition-colors"
                            >
                                <span className="material-symbols-outlined">logout</span>
                                Sign Out
                            </button>
                            <button
                                onClick={() => showNotification('Contact support to delete your account', 'info')}
                                className="w-full flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 font-bold py-3 px-4 rounded-lg transition-colors"
                            >
                                <span className="material-symbols-outlined">delete_forever</span>
                                Delete Account
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export default Settings;
