import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { api } from '../lib/api';
import { MainLayout } from '../components';

interface Recording {
    id: string;
    title: string;
    fileUrl: string;
    type: 'video' | 'screenshot';
    createdAt: string;
    duration?: number;
}

const Dashboard: React.FC = () => {
    const { user, signOut } = useAuth();
    const { showNotification } = useNotification();

    const { data: recordings = [], isLoading: loading } = useQuery<Recording[]>({
        queryKey: ['recordings'],
        queryFn: () => api.recordings.list(),
        meta: {
            onError: () => showNotification('Failed to load recordings', 'error'),
        }
    });

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours} hours ago`;
        return date.toLocaleDateString();
    };

    // Calculate dynamic stats
    const totalRecordings = recordings.length;
    const videoRecordings = recordings.filter(r => r.type === 'video');
    const screenshotCount = recordings.filter(r => r.type === 'screenshot').length;

    const Sidebar = (
        <aside className="w-72 bg-white dark:bg-background-dark border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between p-6 overflow-y-auto">
            <div className="flex flex-col gap-8">
                <nav className="flex flex-col gap-1">
                    <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" href="#">
                        <span className="material-symbols-outlined">dashboard</span>
                        <span className="font-semibold text-sm">Dashboard</span>
                    </a>
                    <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/10 text-primary" href="#">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
                        <span className="font-semibold text-sm">My Library</span>
                    </a>
                    <div className="mt-4 mb-2 px-3">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Folders</p>
                    </div>
                    <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" href="#">
                        <span className="material-symbols-outlined text-primary">business_center</span>
                        <span className="font-semibold text-sm">Work</span>
                    </a>
                    <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" href="#">
                        <span className="material-symbols-outlined text-amber-500">person</span>
                        <span className="font-semibold text-sm">Personal</span>
                    </a>
                    <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" href="#">
                        <span className="material-symbols-outlined text-blue-500">groups</span>
                        <span className="font-semibold text-sm">Shared</span>
                    </a>
                </nav>
            </div>
            <div className="flex flex-col gap-6">
                <button className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg shadow-primary/20">
                    <span className="material-symbols-outlined text-xl">add_circle</span>
                    <span>New Recording</span>
                </button>
                <nav className="flex flex-col gap-1">
                    <a className="flex items-center gap-3 px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors" href="#">
                        <span className="material-symbols-outlined">analytics</span>
                        <span className="font-semibold text-sm">Analytics</span>
                    </a>
                    <a className="flex items-center gap-3 px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors" href="#">
                        <span className="material-symbols-outlined">settings</span>
                        <span className="font-semibold text-sm">Settings</span>
                    </a>
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
                />
            </div>
        </div>
    );

    return (
        <MainLayout
            sidebar={Sidebar}
            headerCenter={HeaderActions}
        >
            <div className="bg-slate-50/50 dark:bg-background-dark/50 min-h-full">
                <div className="px-8 pt-8 pb-4">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="space-y-1">
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">My Library</h2>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">Manage your recent screen captures and meeting records</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors">
                                <span className="material-symbols-outlined text-lg">sort</span>
                                Newest First
                            </button>
                        </div>
                    </div>
                </div>

                <div className="px-8 sticky top-0 bg-slate-50/80 dark:bg-background-dark/80 backdrop-blur-md z-10 py-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-6">
                        <a className="pb-2 border-b-2 border-primary text-primary font-bold text-sm tracking-wide" href="#">All Items</a>
                        <a className="pb-2 border-b-2 border-transparent text-slate-500 dark:text-slate-400 font-bold text-sm tracking-wide hover:text-slate-700 transition-colors" href="#">Recordings</a>
                        <a className="pb-2 border-b-2 border-transparent text-slate-500 dark:text-slate-400 font-bold text-sm tracking-wide hover:text-slate-700 transition-colors" href="#">Screenshots</a>
                        <a className="pb-2 border-b-2 border-transparent text-slate-500 dark:text-slate-400 font-bold text-sm tracking-wide hover:text-slate-700 transition-colors" href="#">Archived</a>
                    </div>
                </div>

                <div className="px-8 py-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {loading ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20">
                                <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
                                <p className="text-slate-500 font-bold">Waking up the library...</p>
                            </div>
                        ) : recordings.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">folder_open</span>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Your library is empty</h3>
                                <p className="text-slate-500 mt-2 text-center max-w-xs">Start capturing with the SnapRec extension to see your recordings here!</p>
                            </div>
                        ) : (
                            recordings.map((recording) => (
                                <a href={`/v/${recording.id}`} key={recording.id} className="group bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
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
                                                <img
                                                    src={recording.fileUrl}
                                                    alt={recording.title}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x225?text=No+Preview';
                                                    }}
                                                />
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
                                    <div className="p-4">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="font-bold text-slate-900 dark:text-white truncate">{recording.title}</h3>
                                            <button className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">more_vert</span></button>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                                            <span className="material-symbols-outlined text-sm">schedule</span>
                                            <span>{formatTime(recording.createdAt)}</span>
                                        </div>
                                    </div>
                                </a>
                            ))
                        )}

                        <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center p-6 bg-slate-50/50 dark:bg-slate-900/30 hover:border-primary/50 transition-colors cursor-pointer group">
                            <div className="size-12 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-400 group-hover:text-primary mb-3 transition-colors">
                                <span className="material-symbols-outlined text-2xl">add</span>
                            </div>
                            <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Record New</p>
                            <p className="text-[10px] text-slate-400 text-center mt-1">Add a new capture to this folder</p>
                        </div>
                    </div>
                </div>

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
                                    <p className="text-2xl font-black text-slate-900 dark:text-white">{videoRecordings.length}</p>
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
