import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout, VideoPlayer, LoginModal, SEO, GoogleAd, AddToChromeButton } from '../components';
import { parseUTCDate } from '../lib/dateUtils';
import { useRecording, useAddReaction, useAddComment, useClaimRecordings, useGetUploadUrl, useCreateRecording, uploadFile, fetchWithAuth } from '../hooks/useRecordings';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useMemo } from 'react';

const convertBase64ToBlobUrl = async (dataUrl: string): Promise<string> => {
    try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    } catch (e) {
        console.warn('Fetch base64 conversion failed, using manual fallback', e);
        try {
            // Split the data URL
            const splitIndex = dataUrl.indexOf(',');
            const metadata = dataUrl.substring(0, splitIndex);
            const base64Data = dataUrl.substring(splitIndex + 1);

            // Extract the MIME type
            const mimeMatch = metadata.match(/:(.*?);/);
            const contentType = mimeMatch ? mimeMatch[1] : 'video/webm';

            // Decode the base64 string
            const byteString = atob(base64Data);

            // Create an ArrayBuffer and a view (Uint8Array)
            const arrayBuffer = new ArrayBuffer(byteString.length);
            const uint8Array = new Uint8Array(arrayBuffer);

            // Fill the view with the binary data
            for (let i = 0; i < byteString.length; i++) {
                uint8Array[i] = byteString.charCodeAt(i);
            }

            // Create the Blob
            const blob = new Blob([arrayBuffer], { type: contentType });
            return URL.createObjectURL(blob);
        } catch (manualError) {
            console.error('Manual base64 conversion failed', manualError);
            return dataUrl; // Last resort
        }
    }
};

const ShareView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const isFreshParam = new URLSearchParams(window.location.search).get('fresh') === 'true';
    const isValidId = id && id !== 'undefined';
    const isFresh = !isValidId || isFreshParam;
    const [fallbackDate] = useState(() => new Date().toISOString());

    const [localId, setLocalId] = useState<string | undefined>(() => sessionStorage.getItem('snaprec_local_video_id') || undefined);
    const [localVideoBlob, setLocalVideoBlob] = useState<string | null>(null);
    const [, setLocalMetadata] = useState<any[] | null>(null);
    // Guard against race condition: if the message handler has already set the blob,
    // don't let the initial useEffect's async callback overwrite it with stale data
    const videoBlobSetByMessage = React.useRef(false);

    // Helper: Initialize from fallback DB if memory is wiped (e.g., refresh)
    const loadFromIndexedDB = async () => {
        return new Promise<{ blob: string | null, rawBlob: Blob | null, id: string | null, metadata: any[] | null }>((resolve) => {
            try {
                // Ensure version 2 is used to match background injection version
                const request = indexedDB.open('SnapRecDB', 2);

                request.onupgradeneeded = (e: any) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('recordings')) {
                        db.createObjectStore('recordings');
                    }
                };

                request.onsuccess = (e: any) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('recordings')) {
                        resolve({ blob: null, rawBlob: null, id: null, metadata: null });
                        return;
                    }
                    const transaction = db.transaction(['recordings'], 'readwrite');
                    const store = transaction.objectStore('recordings');

                    // TTL check: expire data older than 1 hour
                    const VIDEO_TTL_MS = 60 * 60 * 1000; // 1 hour
                    store.get('latest_video_timestamp').onsuccess = (tsEv: any) => {
                        const timestamp = tsEv.target.result;
                        if (timestamp && (Date.now() - timestamp) > VIDEO_TTL_MS) {
                            console.log('IDB video data expired (older than 1 hour), clearing');
                            store.clear();
                            resolve({ blob: null, rawBlob: null, id: null, metadata: null });
                            return;
                        }

                        let dbBlob: string | null = null;
                        let dbRawBlob: Blob | null = null;
                        let dbId: string | null = null;
                        let dbMetadata: any[] | null = null;

                        // First try the new raw Blob key
                        store.get('latest_video_blob').onsuccess = (blobEv: any) => {
                            if (blobEv.target.result instanceof Blob) {
                                dbRawBlob = blobEv.target.result;
                            }

                            // Then try the legacy string key
                            store.get('latest_video').onsuccess = (ev: any) => {
                                dbBlob = ev.target.result;
                                store.get('latest_id').onsuccess = (idEv: any) => {
                                    dbId = idEv.target.result;
                                    
                                    store.get('latest_metadata').onsuccess = (metaEv: any) => {
                                        if (metaEv.target.result) {
                                            try {
                                                dbMetadata = JSON.parse(metaEv.target.result);
                                            } catch (e) {
                                                console.warn('Failed to parse legacy metadata', e);
                                            }
                                        }
                                        resolve({ blob: dbBlob, rawBlob: dbRawBlob, id: dbId, metadata: dbMetadata });
                                    };
                                };
                            };
                        };
                    };
                    transaction.onerror = () => resolve({ blob: null, rawBlob: null, id: null, metadata: null });
                };
                request.onerror = () => resolve({ blob: null, rawBlob: null, id: null, metadata: null });
            } catch (err) {
                console.warn('IDB fallback load failed', err);
                resolve({ blob: null, rawBlob: null, id: null, metadata: null });
            }
        });
    };

    // Initial load from sessionStorage or IndexedDB
    useEffect(() => {
        const storedBlobUrl = sessionStorage.getItem('snaprec_local_video_blob');

        const applyBlob = (dataUrl: string) => {
            if (dataUrl.startsWith('data:')) {
                convertBase64ToBlobUrl(dataUrl).then(blobUrl => {
                    // Don't overwrite if the message handler has already set a fresh blob
                    if (!videoBlobSetByMessage.current) {
                        setLocalVideoBlob(blobUrl);
                    }
                });
            } else {
                if (!videoBlobSetByMessage.current) {
                    setLocalVideoBlob(dataUrl);
                }
            }
        };

        if (storedBlobUrl) {
            applyBlob(storedBlobUrl);
        } else {
            // Attempt resilient fallback if session storage is wiped on refresh
            loadFromIndexedDB().then(({ blob, rawBlob, id, metadata }) => {
                // Don't overwrite if the message handler has already set a fresh blob
                if (videoBlobSetByMessage.current) return;

                if (metadata) {
                    setLocalMetadata(metadata);
                    try {
                        sessionStorage.setItem('snaprec_local_metadata', JSON.stringify(metadata));
                    } catch (e) {}
                }

                // Prefer raw Blob (new path) over base64 string (legacy path)
                if (rawBlob) {
                    const blobUrl = URL.createObjectURL(rawBlob);
                    console.log('Loaded raw blob from IDB on refresh, size:', rawBlob.size);
                    setLocalVideoBlob(blobUrl);
                } else if (blob) {
                    applyBlob(blob);

                    // Recover session state only for small blobs
                    if (blob.length < 2 * 1024 * 1024) {
                        try {
                            sessionStorage.setItem('snaprec_local_video_blob', blob);
                        } catch (e) { }
                    }
                }

                if (id) {
                    try {
                        sessionStorage.setItem('snaprec_local_video_id', id);
                    } catch (e) { }
                    if (!localId) setLocalId(id);
                }
            });
        }
    }, [localId]);

    const effectiveId = (isValidId ? id : undefined) || localId;

    const [isUploaded, setIsUploaded] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [videoEditorLoading, setVideoEditorLoading] = useState(false);
    const [pollInterval, setPollInterval] = useState<number | false>(3000);

    const { data: recording, isLoading: loading } = useRecording(effectiveId, pollInterval, {
        enabled: (!!isValidId && !isFreshParam) || isUploaded || isUploading
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
        const loadBlobAndMetadataFromIDB = (): Promise<{ blob: Blob | null, metadata: any[] | null }> => {
            return new Promise((resolve) => {
                try {
                    const request = indexedDB.open('SnapRecDB', 2);

                    request.onupgradeneeded = (e: any) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('recordings')) {
                            db.createObjectStore('recordings');
                        }
                    };

                    request.onsuccess = (e: any) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('recordings')) {
                            resolve({ blob: null, metadata: null });
                            return;
                        }
                        const transaction = db.transaction(['recordings'], 'readonly');
                        const store = transaction.objectStore('recordings');
                        const getReq = store.get('latest_video_blob');

                        getReq.onsuccess = () => {
                            const result = getReq.result;
                            let finalBlob: Blob | null = null;
                            if (result instanceof Blob) {
                                finalBlob = result;
                            }
                            
                            const getMeta = store.get('latest_metadata');
                            getMeta.onsuccess = () => {
                                let metadata = null;
                                if (getMeta.result) {
                                    try {
                                        metadata = JSON.parse(getMeta.result);
                                    } catch (e) {}
                                }
                                resolve({ blob: finalBlob, metadata });
                            };
                            getMeta.onerror = () => resolve({ blob: finalBlob, metadata: null });
                        };
                        getReq.onerror = () => resolve({ blob: null, metadata: null });
                    };
                    request.onerror = () => resolve({ blob: null, metadata: null });
                } catch (err) {
                    console.warn('Failed to load blob from IDB', err);
                    resolve({ blob: null, metadata: null });
                }
            });
        };

        const handleMessage = async (event: MessageEvent) => {
            if (event.data?.type === 'SNAPREC_VIDEO_DATA') {
                console.log('Received video data from extension with id:', event.data.id);

                // New IDB path: blob was stored directly in IndexedDB by the injected script
                if (event.data.fromIDB) {
                    console.log('Loading video blob from IndexedDB (no base64 conversion)...');
                    const { blob, metadata } = await loadBlobAndMetadataFromIDB();
                    
                    if (metadata) {
                        setLocalMetadata(metadata);
                        try {
                            sessionStorage.setItem('snaprec_local_metadata', JSON.stringify(metadata));
                        } catch (e) {}
                    }
                    
                    if (blob) {
                        const blobUrl = URL.createObjectURL(blob);
                        console.log('Video blob loaded from IDB, size:', blob.size, 'type:', blob.type);
                        videoBlobSetByMessage.current = true;
                        setLocalVideoBlob(blobUrl);
                    } else {
                        console.warn('No blob found in IndexedDB, falling back to loadFromIndexedDB (legacy)');
                        // Try the legacy 'latest_video' key (base64 data URL stored as string)
                        const { blob: legacyBlob } = await loadFromIndexedDB();
                        if (legacyBlob) {
                            if (legacyBlob.startsWith('data:')) {
                                const blobUrl = await convertBase64ToBlobUrl(legacyBlob);
                                setLocalVideoBlob(blobUrl);
                            } else {
                                setLocalVideoBlob(legacyBlob);
                            }
                        }
                    }
                } else {
                    // Legacy path: dataUrl was passed directly via postMessage
                    const dataUrl = event.data.dataUrl;
                    if (!dataUrl) return;

                    if (dataUrl.startsWith('data:')) {
                        const blobUrl = await convertBase64ToBlobUrl(dataUrl);
                        setLocalVideoBlob(blobUrl);
                    } else {
                        setLocalVideoBlob(dataUrl);
                    }

                    // Only try sessionStorage for small data (< 2MB)
                    if (dataUrl.length < 2 * 1024 * 1024) {
                        try {
                            sessionStorage.setItem('snaprec_local_video_blob', dataUrl);
                        } catch (e) {
                            console.warn('QuotaExceededError: Cannot save video to sessionStorage');
                        }
                    }
                }

                if (event.data.id) {
                    setLocalId(event.data.id);
                    try {
                        sessionStorage.setItem('snaprec_local_video_id', event.data.id);
                    } catch (e) {
                        console.warn('QuotaExceededError: Cannot save video ID to sessionStorage');
                    }
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

    let downloadUrl: string | null = null;
    if (recordingData && 'fileUrl' in recordingData) {
        const raw = (recordingData as any).fileUrl;
        // Avoid using malformed URLs (e.g. video-undefined-*.webm) as video src to prevent poor LCP
        if (typeof raw === 'string' && !raw.includes('undefined')) {
            downloadUrl = raw;
        }
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
            } else if (pendingAction === 'videoEditor') {
                handleOpenVideoEditor();
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

    /** Upload local blob and create recording; returns server recording id or null */
    const uploadLocalRecording = async (): Promise<string | null> => {
        if (!user || !localVideoBlob) return null;
        const blob = await (await fetch(localVideoBlob)).blob();
        const safeId = effectiveId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}`);
        const fileName = `video-${safeId}-${Date.now()}.webm`;
        const { uploadUrl, fileUrl } = await getUploadUrlMutation.mutateAsync({
            fileName,
            contentType: 'video/webm',
        });
        await uploadFile(uploadUrl, blob, 'video/webm');
        const guestId = localStorage.getItem('snaprec_guest_id') || `guest_${Math.random().toString(36).substring(7)}`;
        if (!localStorage.getItem('snaprec_guest_id')) localStorage.setItem('snaprec_guest_id', guestId);
        const createdRecording = await createRecordingMutation.mutateAsync({
            id: effectiveId,
            title: `Video Recording ${new Date().toLocaleString()}`,
            fileUrl,
            type: 'video',
            userId: user?.id,
            guestId: undefined,
        });
        const recordingId = createdRecording?.id || effectiveId;
        if (!recordingId) return null;
        try {
            const request = indexedDB.open('SnapRecDB', 2);
            request.onsuccess = (e: any) => {
                const db = e.target.result;
                if (db.objectStoreNames.contains('recordings')) {
                    const txn = db.transaction(['recordings'], 'readwrite');
                    txn.objectStore('recordings').clear();
                }
            };
        } catch { /* empty */ }
        setIsUploaded(true);
        navigate(`/v/${recordingId}`, { replace: true });
        return recordingId;
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
            const recordingId = await uploadLocalRecording();
            if (!recordingId) {
                showNotification('Failed to get recording ID. Please try again.', 'error');
                return;
            }
            const shareUrl = `${window.location.origin}/v/${recordingId}`;
            try {
                await navigator.clipboard.writeText(shareUrl);
                showNotification('Shareable link generated and copied to clipboard!', 'success');
            } catch {
                showNotification('Shareable link generated successfully!', 'success');
            }
        } catch (error: any) {
            showNotification(error.message || 'Upload failed. Please try again.', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleOpenVideoEditor = async () => {
        if (!user) {
            setLoginAction('open the Video Editor');
            setPendingAction('videoEditor');
            setIsLoginModalOpen(true);
            return;
        }
        if (videoEditorLoading) return;
        setVideoEditorLoading(true);
        try {
            let recordingId: string | null = null;
            if (isValidId && recording?.user?.supabaseId === user.id) {
                recordingId = id!;
            } else if (isValidId && isUploaded) {
                recordingId = id!;
            }
            if (!recordingId && localVideoBlob) {
                recordingId = await uploadLocalRecording();
            }
            if (!recordingId) {
                showNotification('Upload the recording first or sign in as the owner.', 'error');
                return;
            }
            // POST is idempotent per recording: server returns existing project if you already opened the editor for this video.
            const project = await fetchWithAuth<{ id: string }>('/video-projects', {
                method: 'POST',
                body: JSON.stringify({ recordingId }),
            });
            navigate(`/video-editor/project/${project.id}`);
        } catch (e: unknown) {
            showNotification(e instanceof Error ? e.message : 'Could not open editor', 'error');
        } finally {
            setVideoEditorLoading(false);
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
            onSuccess: (data: { claimed?: string[] }) => {
                const claimed = data?.claimed ?? [];
                if (claimed.includes(id)) {
                    showNotification('Recording saved to your account!', 'success');
                } else {
                    showNotification('This recording is owned by another user and cannot be saved to your account.', 'error');
                }
            },
            onError: (err: any) => {
                showNotification(err.message || 'Failed to save recording', 'error');
                console.error('Failed to save recording:', err);
            }
        });
    };

    // Show "Save to your account" only for guest recordings (no owner) or recordings already owned by current user
    const canSaveToAccount =
        recordingData &&
        (!recordingData.user || (user && recordingData.user.supabaseId === user.id));



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
        <div className="flex items-center gap-4 min-h-[40px]">
            <button
                onClick={handleDownload}
                className={`flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-bold transition-all ${!isUploaded ? 'invisible' : ''}`}
            >
                <span className="material-symbols-outlined text-[20px]">download</span>
                Download
            </button>

            {!isUploaded ? (
                <button
                    onClick={handleUploadToCloud}
                    disabled={isUploading || (recordingData?.type === 'video' && !localVideoBlob)}
                    className={`flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg text-sm font-bold transition-all hover:opacity-90 shadow-md shadow-primary/20 disabled:opacity-50 ${isUploading ? 'animate-pulse' : ''}`}
                >
                    <span className="material-symbols-outlined text-[20px]">{isUploading ? 'sync' : 'cloud_upload'}</span>
                    {isUploading ? 'Generating...' : (recordingData?.type === 'video' && !localVideoBlob ? 'Waiting for video...' : 'Generate Shareable Link')}
                </button>
            ) : canSaveToAccount ? (
                <button
                    onClick={handleSaveClick}
                    disabled={claimMutation.isPending}
                    className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg text-sm font-bold transition-all hover:opacity-90 shadow-md shadow-primary/20 disabled:opacity-50"
                >
                    {claimMutation.isPending ? 'Saving...' : (user && recordingData?.user?.supabaseId === user.id ? 'Saved in account' : 'Save to your account')}
                </button>
            ) : null}
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
                noIndex={true}
            />
            <div className="bg-background-light dark:bg-background-dark transition-colors duration-300 pb-20">
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
                            {recordingData.type === 'video' && (localVideoBlob || downloadUrl) && (
                                <button
                                    type="button"
                                    onClick={handleOpenVideoEditor}
                                    disabled={videoEditorLoading || (recordingData?.type === 'video' && !localVideoBlob && !isValidId)}
                                    className="group relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 w-full rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-primary via-violet-600 to-purple-700 text-white shadow-xl shadow-primary/25 border border-white/10 overflow-hidden text-left disabled:opacity-60"
                                >
                                    <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.06\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-90 pointer-events-none" aria-hidden />
                                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                                        <span className="material-symbols-outlined text-3xl">auto_fix_high</span>
                                    </div>
                                    <div className="relative flex-1 min-w-0 text-left">
                                        <p className="text-xs font-bold uppercase tracking-widest text-white/80 mb-1">Main feature</p>
                                        <h2 className="text-xl sm:text-2xl font-black leading-tight">
                                            {videoEditorLoading ? 'Preparing editor…' : 'Open in Video Editor'}
                                        </h2>
                                        <p className="text-sm text-white/90 mt-1 max-w-xl">
                                            Trim clips, work on a multi-track timeline, then export — sign in once to unlock the editor.
                                        </p>
                                    </div>
                                    <span className="relative shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-primary px-6 py-3.5 text-sm font-bold shadow-lg group-hover:bg-violet-50 transition-colors">
                                        {videoEditorLoading ? '…' : 'Video Editor'}
                                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                    </span>
                                </button>
                            )}
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
                                            showBranding={true}
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
                            {/* Sidebar CTA */}
                            <a
                                href="https://chromewebstore.google.com/detail/snaprec-screen-recorder-s/lgafjgnifbjeafallnkkfpljgbilfajg"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:border-primary/30 hover:shadow-md transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <img src="/logo.png" alt="SnapRec" className="size-8 rounded-lg shrink-0" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Try SnapRec for free</span>
                                        <span className="text-xs text-slate-400">Record & share your screen instantly</span>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform shrink-0">Add to Chrome →</span>
                            </a>

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
                                    The easiest way to send quick video messages, bug reports, or product walkthroughs. 100% free, no watermarks.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 z-10">
                                <AddToChromeButton size="lg" />
                            </div>
                        </div>
                        <div className="mt-8 flex flex-wrap justify-center gap-6 text-slate-400 text-sm">
                            <a className="hover:text-primary transition-colors" href="/privacy">Privacy Policy</a>
                            <a className="hover:text-primary transition-colors" href="/how-it-works">How it Works</a>
                            <p>© {new Date().getFullYear()} SnapRec</p>
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
