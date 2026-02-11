import React, { useState, useMemo, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useRecordings, useUpdateRecording, useDeleteRecording, type Recording } from '../hooks/useRecordings';
import { MainLayout } from '../components';
import { formatRelativeTime } from '../lib/dateUtils';

type TabFilter = 'all' | 'video' | 'screenshot';
type SortOrder = 'newest' | 'oldest' | 'name';

const Dashboard: React.FC = () => {
    const { user, loading: authLoading, signOut } = useAuth();
    const { showNotification } = useNotification();

    // State for search, filter, sort
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<TabFilter>('all');
    const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [activeCardMenu, setActiveCardMenu] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);

    // React Query hooks - pass auth state to control when query runs
    const { data: recordings = [], isLoading: loading, isError, error } = useRecordings(!!user, authLoading);
    const updateMutation = useUpdateRecording();
    const deleteMutation = useDeleteRecording();

    // Show error notification when query fails
    useEffect(() => {
        if (isError && error) {
            showNotification(error.message || 'Failed to load recordings', 'error');
        }
    }, [isError, error, showNotification]);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setActiveCardMenu(null);
                setShowSortMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Filtered and sorted recordings
    const filteredRecordings = useMemo(() => {
        let result = [...recordings];
        if (searchQuery) {
            result = result.filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        if (activeTab !== 'all') {
            result = result.filter(r => r.type === activeTab);
        }
        result.sort((a, b) => {
            if (sortOrder === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (sortOrder === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            return a.title.localeCompare(b.title);
        });
        return result;
    }, [recordings, searchQuery, activeTab, sortOrder]);


    // Stats
    const totalRecordings = recordings.length;
    const videoCount = recordings.filter(r => r.type === 'video').length;
    const screenshotCount = recordings.filter(r => r.type === 'screenshot').length;

    // Card Actions
    const handleCopyLink = (id: string) => {
        const url = `${window.location.origin}/v/${id}`;
        navigator.clipboard.writeText(url);
        showNotification('Link copied to clipboard!', 'success');
        setActiveCardMenu(null);
    };

    const handleDownload = async (recording: Recording) => {
        try {
            const response = await fetch(recording.fileUrl);
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${recording.title}.${recording.type === 'video' ? 'webm' : 'png'}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showNotification('Download started!', 'success');
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Download aborted');
            } else {
                showNotification('Download failed', 'error');
            }
        }
        setActiveCardMenu(null);
    };

    const handleStartRename = (recording: Recording) => {
        setEditingId(recording.id);
        setEditTitle(recording.title);
        setActiveCardMenu(null);
    };

    const handleSaveRename = async (id: string) => {
        updateMutation.mutate(
            { id, data: { title: editTitle } },
            {
                onSuccess: () => showNotification('Renamed successfully!', 'success'),
                onError: () => showNotification('Rename failed', 'error'),
            }
        );
        setEditingId(null);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this recording?')) return;
        deleteMutation.mutate(id, {
            onSuccess: () => showNotification('Deleted successfully!', 'success'),
            onError: () => showNotification('Delete failed', 'error'),
        });
        setActiveCardMenu(null);
    };

    const tabs: { key: TabFilter; label: string }[] = [
        { key: 'all', label: 'All Items' },
        { key: 'video', label: 'Recordings' },
        { key: 'screenshot', label: 'Screenshots' },
    ];

    const sortOptions: { key: SortOrder; label: string; icon: string }[] = [
        { key: 'newest', label: 'Newest First', icon: 'arrow_downward' },
        { key: 'oldest', label: 'Oldest First', icon: 'arrow_upward' },
        { key: 'name', label: 'Name (A-Z)', icon: 'sort_by_alpha' },
    ];

    const Sidebar = (
        <aside className="w-72 bg-white dark:bg-background-dark border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between p-6 overflow-y-auto">
            <div className="flex flex-col gap-8">
                <nav className="flex flex-col gap-1">
                    <NavLink
                        to="/dashboard"
                        className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        <span className="material-symbols-outlined">dashboard</span>
                        <span className="font-semibold text-sm">Dashboard</span>
                    </NavLink>
                    <NavLink
                        to="/library"
                        className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
                        <span className="font-semibold text-sm">My Library</span>
                    </NavLink>
                </nav>
            </div>
            <div className="flex flex-col gap-6">
                <button
                    onClick={() => showNotification('Use the SnapRec extension to start a new recording!', 'info')}
                    className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg shadow-primary/20"
                >
                    <span className="material-symbols-outlined text-xl">add_circle</span>
                    <span>New Recording</span>
                </button>
                <nav className="flex flex-col gap-1">
                    <NavLink
                        to="/analytics"
                        className={({ isActive }) => `flex items-center gap-3 px-3 py-2 transition-colors ${isActive ? 'text-primary' : 'text-slate-600 dark:text-slate-400 hover:text-primary'}`}
                    >
                        <span className="material-symbols-outlined">analytics</span>
                        <span className="font-semibold text-sm">Analytics</span>
                    </NavLink>
                    <NavLink
                        to="/settings"
                        className={({ isActive }) => `flex items-center gap-3 px-3 py-2 transition-colors ${isActive ? 'text-primary' : 'text-slate-600 dark:text-slate-400 hover:text-primary'}`}
                    >
                        <span className="material-symbols-outlined">settings</span>
                        <span className="font-semibold text-sm">Settings</span>
                    </NavLink>
                    <button
                        onClick={signOut}
                        className="flex items-center gap-3 px-3 py-2 text-red-500 hover:text-red-600 transition-colors w-full text-left"
                    >
                        <span className="material-symbols-outlined">logout</span>
                        <span className="font-semibold text-sm">Sign Out</span>
                    </button>
                </nav>
            </div>
        </aside>
    );

    const HeaderActions = (
        <div className="flex items-center flex-1 max-w-xl mx-8">
            <div className="relative group w-full">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
                <input
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-2 pl-11 pr-4 focus:ring-2 focus:ring-primary/20 text-sm transition-all"
                    placeholder="Search recordings..."
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
        </div>
    );

    return (
        <MainLayout sidebar={Sidebar} headerCenter={HeaderActions}>
            <div className="bg-slate-50/50 dark:bg-background-dark/50 min-h-full">
                {/* Header */}
                <div className="px-8 pt-8 pb-4">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="space-y-1">
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">My Library</h2>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">Manage your recent screen captures and meeting records</p>
                        </div>
                        {/* Sort Dropdown */}
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setShowSortMenu(!showSortMenu)}
                                className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors"
                            >
                                <span className="material-symbols-outlined text-lg">sort</span>
                                {sortOptions.find(o => o.key === sortOrder)?.label}
                            </button>
                            {showSortMenu && (
                                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-20">
                                    {sortOptions.map(opt => (
                                        <button
                                            key={opt.key}
                                            onClick={() => { setSortOrder(opt.key); setShowSortMenu(false); }}
                                            className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${sortOrder === opt.key ? 'bg-primary/10 text-primary' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                        >
                                            <span className="material-symbols-outlined text-lg">{opt.icon}</span>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-8 sticky top-0 bg-slate-50/80 dark:bg-background-dark/80 backdrop-blur-md z-10 py-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-6">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`pb-2 border-b-2 font-bold text-sm tracking-wide transition-colors ${activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Grid */}
                <div className="px-8 py-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {loading ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20">
                                <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
                                <p className="text-slate-500 font-bold">Waking up the library...</p>
                            </div>
                        ) : filteredRecordings.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">folder_open</span>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                    {searchQuery ? 'No results found' : 'Your library is empty'}
                                </h3>
                                <p className="text-slate-500 mt-2 text-center max-w-xs">
                                    {searchQuery ? `No recordings match "${searchQuery}"` : 'Start capturing with the SnapRec extension to see your recordings here!'}
                                </p>
                            </div>
                        ) : (
                            filteredRecordings.map((recording) => (
                                <div key={recording.id} className="group bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                    <a href={recording.type === 'screenshot' ? `/editor/${recording.id}` : `/v/${recording.id}`} className="block">
                                        <div className="relative aspect-video bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                            {recording.type === 'video' ? (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-4xl text-slate-300">videocam</span>
                                                    <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <div className="size-12 bg-white rounded-full flex items-center justify-center text-primary shadow-lg">
                                                            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <img src={recording.fileUrl} alt={recording.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x225?text=No+Preview'; }} />
                                                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-white text-4xl drop-shadow-md">fullscreen</span>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="absolute top-3 right-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] text-white font-bold uppercase tracking-tighter ${recording.type === 'video' ? 'bg-primary' : 'bg-blue-500'}`}>
                                                    {recording.type}
                                                </span>
                                            </div>
                                        </div>
                                    </a>
                                    <div className="p-4">
                                        <div className="flex justify-between items-start mb-1">
                                            {editingId === recording.id ? (
                                                <input
                                                    autoFocus
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    onBlur={() => handleSaveRename(recording.id)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(recording.id)}
                                                    className="font-bold text-slate-900 dark:text-white truncate bg-slate-100 dark:bg-slate-800 rounded px-2 py-1 w-full mr-2"
                                                />
                                            ) : (
                                                <h3 className="font-bold text-slate-900 dark:text-white truncate">{recording.title}</h3>
                                            )}
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => { e.preventDefault(); setActiveCardMenu(activeCardMenu === recording.id ? null : recording.id); }}
                                                    className="text-slate-400 hover:text-slate-600"
                                                >
                                                    <span className="material-symbols-outlined">more_vert</span>
                                                </button>
                                                {activeCardMenu === recording.id && (
                                                    <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-30">
                                                        <button onClick={() => handleCopyLink(recording.id)} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                                                            <span className="material-symbols-outlined text-lg">link</span>
                                                            Copy Link
                                                        </button>
                                                        <button onClick={() => handleStartRename(recording)} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                                                            <span className="material-symbols-outlined text-lg">edit</span>
                                                            Rename
                                                        </button>
                                                        <button onClick={() => handleDownload(recording)} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                                                            <span className="material-symbols-outlined text-lg">download</span>
                                                            Download
                                                        </button>
                                                        <hr className="my-1 border-slate-200 dark:border-slate-700" />
                                                        <button onClick={() => handleDelete(recording.id)} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                                                            <span className="material-symbols-outlined text-lg">delete</span>
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                                            <span className="material-symbols-outlined text-sm">schedule</span>
                                            <span>{formatRelativeTime(recording.createdAt)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Activity Overview */}
                <div className="px-8 pb-12">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Activity Overview</h3>
                                <p className="text-slate-500 text-sm">Your capture statistics</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="flex items-center gap-4">
                                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined">video_library</span>
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Total Items</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white">{totalRecordings}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="size-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                                    <span className="material-symbols-outlined">videocam</span>
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Videos</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white">{videoCount}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="size-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                                    <span className="material-symbols-outlined">image</span>
                                </div>
                                <div>
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Screenshots</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white">{screenshotCount}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export default Dashboard;
