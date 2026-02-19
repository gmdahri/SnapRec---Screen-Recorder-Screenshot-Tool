import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout, VideoPlayer, LoginModal, SEO, GoogleAd } from '../components';
import { parseUTCDate } from '../lib/dateUtils';
import { useRecording, useAddReaction, useAddComment, useClaimRecordings, useGetUploadUrl, useCreateRecording, uploadFile } from '../hooks/useRecordings';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useMemo } from 'react';

const ShareView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const isFreshParam = new URLSearchParams(window.location.search).get('fresh') === 'true';
    const isFresh = !id || isFreshParam;
    const [fallbackDate] = useState(() => new Date().toISOString());

    const [localId, setLocalId] = useState<string | undefined>(() => sessionStorage.getItem('snaprec_local_video_id') || undefined);
    const [localVideoBlob, setLocalVideoBlob] = useState<string | null>(() => sessionStorage.getItem('snaprec_local_video_blob'));

    const effectiveId = id || localId;

    const [isUploaded, setIsUploaded] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [pollInterval, setPollInterval] = useState<number | false>(3000);

    const { data: recording, isLoading: loading } = useRecording(effectiveId, pollInterval, {
        enabled: (!!id && !isFreshParam) || isUploaded || isUploading
    });

    const addReaction = useAddReaction();
    const addComment = useAddComment();
    const claimMutation = useClaimRecordings();

    const [copied, setCopied] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [loginAction, setLoginAction] = useState('continue');
    const [pendingAction, setPendingActionState] = useState<string | null>(localStorage.getItem('share_pending_action'));

    const setPendingAction = (action: string | null) => {
        if (action) {
            localStorage.setItem('share_pending_action', action);
        } else {
            localStorage.removeItem('share_pending_action');
        }
        setPendingActionState(action);
    };

    const getUploadUrlMutation = useGetUploadUrl();
    const createRecordingMutation = useCreateRecording();

    // Stop polling once ready or if it's a new local-only recording
    useEffect(() => {
        if (recording?.isReady || (recording?.type === 'screenshot' && recording)) {
            setPollInterval(false);
            setIsUploaded(true);
        }
    }, [recording?.isReady, recording?.type]);

    // Extension Message Listener for local video data
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'SNAPREC_VIDEO_DATA') {
                console.log('Received video data from extension with id:', event.data.id);
                setLocalVideoBlob(event.data.dataUrl);
                sessionStorage.setItem('snaprec_local_video_blob', event.data.dataUrl);
                if (event.data.id) {
                    setLocalId(event.data.id);
                    sessionStorage.setItem('snaprec_local_video_id', event.data.id);
                }
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);



    // Use a unified recording object with fallbacks for "fresh" local-only state
    const recordingData = useMemo(() => {
        const base = recording || (isFresh ? {
            id: effectiveId || '',
            title: 'New Recording',
            type: 'video' as const,
            views: 0,
            createdAt: fallbackDate,
            reactions: [],
            comments: [],
            description: '',
            thumbnailUrl: '',
            location: '',
            user: null
        } : null);

        if (!base) return null;

        return {
            ...base,
            reactions: base.reactions || [],
            comments: base.comments || []
        };
    }, [recording, isFresh, effectiveId, fallbackDate]);

    // Derive processing state
    const isProcessing = recordingData?.type === 'video' && !(recordingData as any).isReady;

    let downloadUrl = null;
    if (recordingData && 'fileUrl' in recordingData) {
        downloadUrl = (recordingData as any).fileUrl;
    }

    // Auto-trigger pending action after login
    useEffect(() => {
        if (user && pendingAction) {
            console.log('Executing pending action after login:', pendingAction);
            if (pendingAction === 'share') {
                handleUploadToCloud();
            } else if (pendingAction === 'save') {
                handleSaveClick();
            } else if (pendingAction === 'download') {
                handleDownload();
            }
            setPendingAction(null);
        }
    }, [user, pendingAction]);

    const handleReaction = (type: string) => {
        // Reactions are less critical to persist across redirect for now, 
        // but let's keep the modal if not logged in.
        if (!user) {
            setLoginAction(`react with "${type}"`);
            setIsLoginModalOpen(true);
            return;
        }
        if (!id) return;
        addReaction.mutate({ id, type });
    };

    const handlePostComment = () => {
        if (!user) {
            setLoginAction('post a comment');
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
            setPendingAction('download');
            setIsLoginModalOpen(true);
            return;
        }
        if (downloadUrl) {
            const a = document.createElement('a');
            a.href = downloadUrl + '?download=true';
            a.click();
        }
    };

    const handleUploadToCloud = async () => {
        if (!user) {
            setLoginAction('generate a shareable link');
            setPendingAction('share');
            setIsLoginModalOpen(true);
            return;
        }

        if (!localVideoBlob || isUploading) return;

        setIsUploading(true);
        try {
            const blob = await (await fetch(localVideoBlob)).blob();
            const fileName = `video-${id}-${Date.now()}.webm`;

            const { uploadUrl, fileUrl } = await getUploadUrlMutation.mutateAsync({
                fileName,
                contentType: 'video/webm'
            });

            await uploadFile(uploadUrl, blob, 'video/webm');

            const guestId = localStorage.getItem('snaprec_guest_id') || `guest_${Math.random().toString(36).substring(7)}`;
            if (!localStorage.getItem('snaprec_guest_id')) localStorage.setItem('snaprec_guest_id', guestId);

            await createRecordingMutation.mutateAsync({
                id: effectiveId!,
                title: `Video Recording ${new Date().toLocaleString()}`,
                fileUrl,
                type: 'video',
                userId: user?.id,
                guestId: !user ? guestId : undefined,
            });

            setIsUploaded(true);

            // Redirect to the public URL immediately
            navigate(`/v/${effectiveId}`, { replace: true });

            // Copy to clipboard
            const shareUrl = `${window.location.origin}/v/${effectiveId}`;

            try {
                await navigator.clipboard.writeText(shareUrl);
                showNotification('Shareable link generated and copied to clipboard!', 'success');
            } catch (err) {
                showNotification('Shareable link generated successfully!', 'success');
            }
        } catch (error: any) {
            showNotification(error.message || 'Upload failed. Please try again.', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveClick = () => {
        if (!user) {
            setLoginAction('save this recording to your account');
            setPendingAction('save');
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



    // Show loader if we are fetching data, OR if this is a "fresh" redirect and we have nothing yet
    // Improved condition: Only show loader if we have NO data to show at all
    const hasNothingToShow = isFresh && !recording && !localVideoBlob;
    if (loading || (hasNothingToShow && !isUploaded)) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
                <div className="text-center animate-pulse">
                    <p className="text-lg font-bold text-slate-800 dark:text-white">Preparing your recording...</p>
                    <p className="text-slate-500 text-sm mt-1">This will only take a moment.</p>
                </div>
            </div>
        );
    }

    if (!recordingData) {
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
            {isUploaded && (
                <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-bold transition-all"
                >
                    <span className="material-symbols-outlined text-[20px]">download</span>
                    Download
                </button>
            )}

            {!isUploaded ? (
                <button
                    onClick={handleUploadToCloud}
                    disabled={isUploading || (recordingData?.type === 'video' && !localVideoBlob)}
                    className={`flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg text-sm font-bold transition-all hover:opacity-90 shadow-md shadow-primary/20 disabled:opacity-50 ${isUploading ? 'animate-pulse' : ''}`}
                >
                    <span className="material-symbols-outlined text-[20px]">{isUploading ? 'sync' : 'cloud_upload'}</span>
                    {isUploading ? 'Generating...' : (recordingData?.type === 'video' && !localVideoBlob ? 'Waiting for video...' : 'Generate Shareable Link')}
                </button>
            ) : (
                <button
                    onClick={handleSaveClick}
                    disabled={claimMutation.isPending}
                    className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg text-sm font-bold transition-all hover:opacity-90 shadow-md shadow-primary/20 disabled:opacity-50"
                >
                    {claimMutation.isPending ? 'Saving...' : (user && recordingData?.user?.supabaseId === user.id ? 'Saved in account' : 'Save to your account')}
                </button>
            )}
        </div>
    );

    return (
        <MainLayout
            showBackButton={true}
            headerActions={HeaderActions}
        >
            <SEO
                title={recordingData.title}
                description={recordingData.description || `Watch this ${recordingData.type} shared via SnapRec.`}
                url={`/v/${id}`}
                type="video.other"
                image={recordingData.thumbnailUrl}
            />
            <div className="bg-background-light dark:bg-background-dark transition-colors duration-300 min-h-screen pb-20">
                {isFresh && !isUploaded && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/30 p-3">
                        <div className="max-w-[1440px] mx-auto px-6 lg:px-20 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm font-medium">
                                <span className="material-symbols-outlined text-[20px]">visibility_off</span>
                                <span>This recording is not yet public. Only you can see it right now.</span>
                            </div>
                            <button
                                onClick={handleUploadToCloud}
                                disabled={isUploading || !localVideoBlob}
                                className="text-amber-900 dark:text-amber-100 text-xs font-bold underline hover:no-underline disabled:opacity-50"
                            >
                                {isUploading ? 'Generating Link...' : 'Generate Shareable Link'}
                            </button>
                        </div>
                    </div>
                )}
                <main className="max-w-[1440px] mx-auto px-6 lg:px-20 py-8">
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Main Content Area (Left) */}
                        <div className="flex-1 flex flex-col gap-6">
                            {/* Headline */}
                            <div className="flex flex-col gap-2">
                                <h1 className="text-[#130d1c] dark:text-white tracking-tight text-3xl font-bold leading-tight">
                                    {recordingData.title}
                                </h1>
                                <div className="flex items-center gap-4 text-sm text-slate-500">
                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">visibility</span> {recordingData.views} views</span>
                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">calendar_today</span> {parseUTCDate(recordingData.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="w-full relative">
                                {recordingData.type === 'screenshot' ? (
                                    <div className="relative w-full min-h-[400px] bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden shadow-2xl flex items-center justify-center border border-slate-200 dark:border-slate-800">
                                        <img
                                            src={downloadUrl || undefined}
                                            alt={recordingData.title}
                                            className="max-w-full max-h-[80vh] object-contain shadow-lg"
                                            onLoad={() => console.log('Screenshot loaded in viewer')}
                                            onError={(e) => console.error('Screenshot failed to load in viewer', e)}
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <VideoPlayer
                                            src={downloadUrl || localVideoBlob || undefined}
                                            isProcessing={isProcessing && !localVideoBlob}
                                        />
                                        {recordingData.type === 'video' && !downloadUrl && !localVideoBlob && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background-light/50 dark:bg-background-dark/50 backdrop-blur-sm z-40 rounded-xl">
                                                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                                <p className="font-bold text-primary">Receiving video data...</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            {/* Reaction Bar */}
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                                <div className="flex flex-wrap gap-2">
                                    {['like', 'love', 'celebrate', 'insightful', 'curious'].map((type) => {
                                        const count = (recordingData.reactions || []).filter(r => r.type === type).length;
                                        const iconMap: Record<string, string> = {
                                            like: 'thumb_up',
                                            love: 'favorite',
                                            celebrate: 'celebration',
                                            insightful: 'lightbulb',
                                            curious: 'help'
                                        };
                                        const isActive = (recordingData.reactions || []).some(r =>
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
                                        style={recordingData.user?.avatarUrl ? { backgroundImage: `url('${recordingData.user.avatarUrl}')` } : {}}
                                    >
                                        {!recordingData.user?.avatarUrl && (
                                            <span className="material-symbols-outlined text-slate-400 text-3xl">person</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col justify-center">
                                        <p className="text-[#130d1c] dark:text-white text-xl font-bold leading-tight">
                                            {recordingData.user?.fullName || 'Guest User'}
                                        </p>
                                        <p className="text-primary text-sm font-semibold">SnapRec User</p>
                                        {recordingData.location && (
                                            <p className="text-slate-400 text-xs mt-1">Recorded in {recordingData.location}</p>
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
                                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs font-bold">{(recordingData?.comments || []).length}</span>
                                </div>
                                {/* Comment List */}
                                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                                    {(!recordingData?.comments || (recordingData.comments as any[]).length === 0) ? (
                                        <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10">
                                            <span className="material-symbols-outlined text-4xl mb-2">chat_bubble_outline</span>
                                            <p className="text-sm">No comments yet</p>
                                        </div>
                                    ) : (
                                        (recordingData.comments as any[]).map((comment: any) => (
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

                            {/* Sidebar Ad Placement */}
                            <div className="mt-4">
                                <GoogleAd
                                    className="w-full !min-h-[250px]"
                                    style={{ maxHeight: '300px' }}
                                    slotId={import.meta.env.VITE_ADSENSE_SHARE_SLOT}
                                />
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
            </div >

            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
                actionDescription={loginAction}
            />
        </MainLayout >
    );
};

export default ShareView;
