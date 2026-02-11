import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MainLayout, VideoPlayer, LoginModal, SEO } from '../components';
import { parseUTCDate } from '../lib/dateUtils';
import { useRecording, useAddReaction, useAddComment, useClaimRecordings } from '../hooks/useRecordings';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

const ShareView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const { data: recording, isLoading: loading } = useRecording(id);
    const addReaction = useAddReaction();
    const addComment = useAddComment();
    const claimMutation = useClaimRecordings();

    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [pollingTimedOut, setPollingTimedOut] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [loginAction, setLoginAction] = useState('continue');
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    useEffect(() => {
        if (!recording) return;

        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const fileName = recording.fileUrl.split('?')[0].split('/').pop();
        const streamUrl = `${API_BASE_URL}/recordings/stream/${fileName}`;

        const checkStreamAvailability = async (fName: string, signal?: AbortSignal) => {
            try {
                const response = await fetch(`${API_BASE_URL}/recordings/status/${fName}`, { signal });
                if (response.ok) {
                    const data = await response.json();
                    return data.ready;
                }
                return false;
            } catch (e) {
                return false;
            }
        };

        let pollInterval: any;

        const startPolling = async (fName: string, signal: AbortSignal) => {
            setIsProcessing(true);
            setPollingTimedOut(false);
            const isAvailable = await checkStreamAvailability(fName, signal);

            if (!isAvailable && !signal.aborted) {
                pollInterval = setInterval(async () => {
                    if (signal.aborted) {
                        clearInterval(pollInterval);
                        return;
                    }

                    setRetryCount(prev => {
                        if (prev >= 30) {
                            clearInterval(pollInterval);
                            setIsProcessing(false);
                            setPollingTimedOut(true);
                            return prev;
                        }
                        return prev + 1;
                    });

                    const available = await checkStreamAvailability(fName, signal);
                    if (available) {
                        clearInterval(pollInterval);
                        setIsProcessing(false);
                        setDownloadUrl(streamUrl);
                    }
                }, 3000);
            } else if (isAvailable) {
                setIsProcessing(false);
                setDownloadUrl(streamUrl);
            }
        };

        const controller = new AbortController();

        if (recording.type === 'video') {
            startPolling(fileName!, controller.signal);
        } else {
            setDownloadUrl(streamUrl);
        }

        return () => {
            controller.abort();
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [recording]);

    // Auto-trigger pending action after login
    useEffect(() => {
        if (user && pendingAction) {
            pendingAction();
            setPendingAction(null);
        }
    }, [user, pendingAction]);

    const handleReaction = (type: string) => {
        if (!user) {
            setLoginAction(`react with "${type}"`);
            setPendingAction(() => () => handleReaction(type));
            setIsLoginModalOpen(true);
            return;
        }
        if (!id) return;
        addReaction.mutate({ id, type });
    };

    const handlePostComment = () => {
        if (!user) {
            setLoginAction('post a comment');
            setPendingAction(() => () => handlePostComment());
            setIsLoginModalOpen(true);
            return;
        }
        if (!id || !commentText.trim()) return;
        addComment.mutate({ id, content: commentText }, {
            onSuccess: () => setCommentText(''),
        });
    };

    const handleDownload = () => {
        if (!user) {
            setLoginAction('download this video');
            setPendingAction(() => () => handleDownload());
            setIsLoginModalOpen(true);
            return;
        }
        if (downloadUrl) {
            const a = document.createElement('a');
            a.href = downloadUrl + '?download=true';
            a.click();
        }
    };

    const handleSaveClick = () => {
        if (!user) {
            setLoginAction('save this recording to your account');
            setPendingAction(() => () => handleSaveClick());
            setIsLoginModalOpen(true);
            return;
        }

        if (!id) return;

        claimMutation.mutate([id], {
            onSuccess: () => {
                showNotification('Recording saved to your account!', 'success');
            },
            onError: (err: any) => {
                showNotification(err.message || 'Failed to save recording', 'error');
                console.error('Failed to save recording:', err);
            }
        });
    };



    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!recording) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark p-6">
                <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">error</span>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Recording not found</h2>
                <p className="text-slate-500 mt-2">The link might be expired or invalid.</p>
                <a href="/dashboard" className="mt-6 text-primary font-bold hover:underline">Go to Dashboard</a>
            </div>
        );
    }

    const HeaderActions = (
        <div className="flex items-center gap-4">
            <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-bold transition-all"
            >
                <span className="material-symbols-outlined text-[20px]">download</span>
                Download
            </button>

            <button
                onClick={handleSaveClick}
                disabled={claimMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg text-sm font-bold transition-all hover:opacity-90 shadow-md shadow-primary/20 disabled:opacity-50"
            >
                {claimMutation.isPending ? 'Saving...' : (user && recording.user?.supabaseId === user.id ? 'Saved in account' : 'Save to your account')}
            </button>
        </div>
    );

    return (
        <MainLayout
            showBackButton={true}
            headerActions={HeaderActions}
        >
            <SEO
                title={recording.title}
                description={recording.description || `Watch this ${recording.type} shared via SnapRec.`}
                url={`/v/${id}`}
                type="video.other"
                image={recording.thumbnailUrl}
            />
            <div className="bg-background-light dark:bg-background-dark transition-colors duration-300 min-h-screen pb-20">
                <main className="max-w-[1440px] mx-auto px-6 lg:px-20 py-8">
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Main Content Area (Left) */}
                        <div className="flex-1 flex flex-col gap-6">
                            {/* Headline */}
                            <div className="flex flex-col gap-2">
                                <h1 className="text-[#130d1c] dark:text-white tracking-tight text-3xl font-bold leading-tight">
                                    {recording.title}
                                </h1>
                                <div className="flex items-center gap-4 text-sm text-slate-500">
                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">visibility</span> {recording.views} views</span>
                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">calendar_today</span> {parseUTCDate(recording.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                            {/* Media Player */}
                            <div className="w-full">
                                <VideoPlayer
                                    src={downloadUrl || undefined}
                                    isProcessing={isProcessing}
                                    retryCount={retryCount}
                                    pollingTimedOut={pollingTimedOut}
                                    onRefresh={() => window.location.reload()}
                                />
                            </div>
                            {/* Reaction Bar */}
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                                <div className="flex flex-wrap gap-2">
                                    {['like', 'love', 'celebrate', 'insightful', 'curious'].map((type) => {
                                        const count = (recording.reactions || []).filter(r => r.type === type).length;
                                        const iconMap: Record<string, string> = {
                                            like: 'thumb_up',
                                            love: 'favorite',
                                            celebrate: 'celebration',
                                            insightful: 'lightbulb',
                                            curious: 'help'
                                        };
                                        const isActive = (recording.reactions || []).some(r =>
                                            user && r.user?.supabaseId === user.id
                                        );

                                        return (
                                            <button
                                                key={type}
                                                onClick={() => handleReaction(type)}
                                                className={`flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border ${isActive ? 'border-primary text-primary' : 'border-slate-200 dark:border-slate-800 text-slate-grey dark:text-slate-300'} rounded-lg hover:border-primary/50 hover:text-primary transition-colors`}
                                            >
                                                <span className="material-symbols-outlined text-[20px]">{iconMap[type]}</span>
                                                <span className="text-sm font-bold">{count}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-grey dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        onClick={() => {
                                            navigator.clipboard.writeText(window.location.href);
                                            setCopied(true);
                                            setTimeout(() => setCopied(false), 2000);
                                        }}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">{copied ? 'check' : 'content_copy'}</span>
                                        <span className="text-sm font-medium">{copied ? 'Copied!' : 'Copy Link'}</span>
                                    </button>
                                    <button
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-grey dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        onClick={handleDownload}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">download</span>
                                        <span className="text-sm font-medium">Download</span>
                                    </button>
                                </div>
                            </div>
                            {/* Profile Header */}
                            <div className="flex items-center justify-between p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                <div className="flex items-center gap-5">
                                    <div
                                        className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-16 w-16 border-2 border-primary/20 flex items-center justify-center bg-slate-100 dark:bg-slate-800"
                                        style={recording.user?.avatarUrl ? { backgroundImage: `url('${recording.user.avatarUrl}')` } : {}}
                                    >
                                        {!recording.user?.avatarUrl && (
                                            <span className="material-symbols-outlined text-slate-400 text-3xl">person</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col justify-center">
                                        <p className="text-[#130d1c] dark:text-white text-xl font-bold leading-tight">
                                            {recording.user?.fullName || 'Guest User'}
                                        </p>
                                        <p className="text-primary text-sm font-semibold">SnapRec User</p>
                                        {recording.location && (
                                            <p className="text-slate-400 text-xs mt-1">Recorded in {recording.location}</p>
                                        )}
                                    </div>
                                </div>
                                <button className="hidden sm:flex min-w-[100px] cursor-pointer items-center justify-center rounded-lg h-10 px-6 bg-primary/10 text-primary text-sm font-bold transition-all hover:bg-primary/20">
                                    Follow
                                </button>
                            </div>
                        </div>
                        {/* Sidebar (Right) */}
                        <aside className="w-full lg:w-[380px] flex flex-col gap-6">
                            {/* Comments Section */}
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col h-full max-h-[600px]">
                                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <h3 className="font-bold text-lg text-[#130d1c] dark:text-white">Comments</h3>
                                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs font-bold">{(recording.comments || []).length}</span>
                                </div>
                                {/* Comment List */}
                                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                                    {(!recording.comments || recording.comments.length === 0) ? (
                                        <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10">
                                            <span className="material-symbols-outlined text-4xl mb-2">chat_bubble_outline</span>
                                            <p className="text-sm">No comments yet</p>
                                        </div>
                                    ) : (
                                        recording.comments.map((comment) => (
                                            <div key={comment.id} className="flex gap-3">
                                                <div className="size-8 rounded-full bg-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                                                    {comment.user?.avatarUrl ? (
                                                        <img
                                                            alt="User"
                                                            className="w-full h-full object-cover"
                                                            src={comment.user.avatarUrl}
                                                        />
                                                    ) : (
                                                        <span className="material-symbols-outlined text-slate-400 text-sm">person</span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-[#130d1c] dark:text-white">
                                                            {comment.user?.fullName || 'Guest'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 uppercase">
                                                            {new Date(comment.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                                        {comment.content}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                {/* Comment Input */}
                                <div className="p-5 border-t border-slate-100 dark:border-slate-800">
                                    <div className="relative">
                                        <textarea
                                            className="w-full rounded-lg border-slate-200 dark:border-slate-800 dark:bg-slate-950 text-sm focus:ring-primary focus:border-primary resize-none p-3 pr-10"
                                            placeholder="Add a comment..."
                                            rows={2}
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handlePostComment();
                                                }
                                            }}
                                        ></textarea>
                                        <button
                                            className="absolute right-2 bottom-2 text-primary hover:bg-primary/10 p-1 rounded disabled:opacity-50"
                                            onClick={handlePostComment}
                                            disabled={!commentText.trim() || addComment.isPending}
                                        >
                                            <span className="material-symbols-outlined">{addComment.isPending ? 'pending' : 'send'}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            {/* Ad/Promo Card */}
                            <div className="bg-gradient-to-br from-primary to-indigo-600 rounded-xl p-6 text-white shadow-lg">
                                <h4 className="text-lg font-bold mb-2">Want to record like this?</h4>
                                <p className="text-sm text-white/80 mb-4 leading-relaxed">Join 50,000+ professionals using SnapRec to communicate faster with video.</p>
                                <button className="w-full bg-white text-primary font-bold py-2 rounded-lg text-sm hover:bg-opacity-90 transition-all">
                                    Install Extension — Free
                                </button>
                            </div>
                        </aside>
                    </div>
                    {/* Bottom CTA Banner */}
                    <section className="mt-16 w-full">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 lg:p-12 border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 overflow-hidden relative">
                            <div className="absolute -top-10 -right-10 size-40 bg-primary/5 rounded-full blur-3xl"></div>
                            <div className="absolute -bottom-10 -left-10 size-40 bg-primary/5 rounded-full blur-3xl"></div>
                            <div className="max-w-xl text-center md:text-left z-10">
                                <h2 className="text-2xl lg:text-3xl font-bold text-[#130d1c] dark:text-white mb-4">Instantly record your screen and share.</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-lg">
                                    The easiest way to send quick video messages, bug reports, or product walkthroughs. No upload wait times.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 z-10">
                                <button className="flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white rounded-xl font-bold text-lg hover:scale-[1.02] transition-transform shadow-lg shadow-primary/30">
                                    <span className="material-symbols-outlined">download</span>
                                    Get SnapRec Free
                                </button>
                                <button className="flex items-center justify-center gap-2 px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-grey dark:text-white rounded-xl font-bold text-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                                    View Pricing
                                </button>
                            </div>
                        </div>
                        <div className="mt-8 flex justify-center gap-8 text-slate-400 text-sm">
                            <a className="hover:text-primary transition-colors" href="#">Privacy Policy</a>
                            <a className="hover:text-primary transition-colors" href="#">Terms of Service</a>
                            <a className="hover:text-primary transition-colors" href="#">Help Center</a>
                            <p>© 2024 SnapRec Inc.</p>
                        </div>
                    </section>
                </main>
            </div>

            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
                actionDescription={loginAction}
            />
        </MainLayout>
    );
};

export default ShareView;
