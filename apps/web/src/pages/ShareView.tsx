import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VideoPlayer, LoginModal, SEO, GoogleAd, AddToChromeButton } from '../components';
import { FreshCaptureChrome } from './Share/FreshCaptureChrome';
import type { VideoPlayerHandle } from '../components/VideoPlayer';
import { ShareShell } from './Share/ShareShell';
import { VideoViewer } from './Share/VideoViewer';
import { chooseViewerSurface } from './Share/surface';
import { toShareComments, toShareKind, toShareState } from './Share/toShareProps';
import { parseUTCDate } from '../lib/dateUtils';
import { useWatchProgress } from '../hooks/useWatchProgress';
import { useVideoFrames } from '../hooks/useVideoFrames';
import { useStableMediaUrl } from '../hooks/useStableMediaUrl';
import { useUpdateRecording, useResolveComment, useRecording, useAddReaction, useAddComment, useClaimRecordings, useGetUploadUrl, useCreateRecording, uploadFile, fetchWithAuth } from '../hooks/useRecordings';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useMemo } from 'react';
import { measureMedia } from '../lib/mediaDuration';
import { CAPTURE_STATES, type StatusWord } from '@snaprec/design-system';
import { toCaptureStatus } from '../lib/captureAdapter';

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
    const resolveComment = useResolveComment();
    const updateRecording = useUpdateRecording();
    // Drawn from the video already on the page — see useVideoFrames.
    /* One source of truth for what the player and the filmstrip load.
     *
     * The local blob when the capture is still in hand — same file, no trip to
     * R2. Otherwise the recording's fileUrl, held still: the server re-signs it
     * on every read, and feeding the element a freshly signed URL restarts
     * playback from 0:00. See useStableMediaUrl. */
    const mediaSrc = useStableMediaUrl(recording?.fileUrl) ?? undefined;
    const playerSrc = localVideoBlob || mediaSrc;

    // Held back until the player reports a duration — i.e. it has its own
    // metadata and is playable. Otherwise the two compete for the same file.
    const [playerReady, setPlayerReady] = useState(false);
    const { frames, generating: framesGenerating, blocked: framesBlocked } =
        useVideoFrames(playerSrc, recording?.duration ?? 0, playerReady);
    const [sharePlaying, setSharePlaying] = useState(false);
    // V4 — accumulates watched seconds and flushes them on a timer and on
    // pagehide. Anonymous viewers are discarded server-side (plan O2).
    const { observe: observeWatched } = useWatchProgress(id, sharePlaying);
    const claimMutation = useClaimRecordings();

    // Drives the C1 timeline: the composer attaches the current position, and
    // clicking a comment seeks back to it.
    const [sharePlayheadSec, setSharePlayheadSec] = useState(0);
    const sharePlayerRef = React.useRef<VideoPlayerHandle | null>(null);

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
        // Measured here because this is the only moment the file is in hand.
        // A failure to measure must never cost the capture, so an unknown
        // length is simply omitted and the column stays null.
        let meta: { durationSec?: number; widthPx?: number; heightPx?: number } = {};
        try {
            meta = await measureMedia(blob);
        } catch {
            meta = {};
        }
        const guestId = localStorage.getItem('snaprec_guest_id') || `guest_${Math.random().toString(36).substring(7)}`;
        if (!localStorage.getItem('snaprec_guest_id')) localStorage.setItem('snaprec_guest_id', guestId);
        const createdRecording = await createRecordingMutation.mutateAsync({
            id: effectiveId,
            title: `Video Recording ${new Date().toLocaleString()}`,
            fileUrl,
            type: 'video',
            durationSec: meta.durationSec,
            widthPx: meta.widthPx,
            heightPx: meta.heightPx,
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
            <div className="min-h-screen flex flex-col items-center justify-center bg-background-light">
                <div className="size-12 border-4 border-[var(--sr-cyan-on-light)]/20 border-t-primary rounded-full animate-spin mb-4"></div>
                <div className="text-center animate-pulse">
                    <p className="text-lg font-bold text-[var(--sr-text-primary-on-light)]">Preparing your recording...</p>
                    <p className="text-[var(--sr-text-muted-on-light)] text-sm mt-1">This will only take a moment.</p>
                </div>
            </div>
        );
    }

    if (!recordingData) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background-light p-6">
                <span className="material-symbols-outlined text-6xl text-[var(--sr-text-faint-on-light)] mb-4">error</span>
                <h2 className="text-2xl font-bold text-[var(--sr-text-primary-on-light)]">Recording not found</h2>
                <p className="text-[var(--sr-text-muted-on-light)] mt-2">The link might be expired or invalid.</p>
                <a href="/dashboard" className="mt-6 text-[var(--sr-cyan-on-light)] font-bold hover:underline">Go to Dashboard</a>
            </div>
        );
    }

    /* ── Fresh capture, on the redesigned chrome ──────────────────────────
     *
     * The same surface a shared recording gets, with different promises: the
     * primary action generates the link instead of copying one, and the status
     * says the file is still on this device.
     *
     * This swaps the CHROME ONLY. handleUploadToCloud, the claim flow and the
     * local blob are used exactly as they were — that logic is the one place a
     * mistake loses somebody's recording, so none of it moved.
     * ------------------------------------------------------------------- */
    const surface = chooseViewerSurface({
        isFresh,
        hasRecording: !!recording,
        kind: recordingData?.type === 'video' ? 'video'
            : recordingData?.type === 'screenshot' ? 'screenshot' : null,
        hasLocalBlob: !!localVideoBlob,
    });

    if (surface === 'fresh' && recordingData) {
        const waitingForVideo = !localVideoBlob && !isUploaded;
        return (
            <>
                <SEO title={recordingData.title} description="Your new recording." noIndex />
                <VideoViewer
                    capture={{
                        id: effectiveId ?? 'fresh',
                        title: recordingData.title,
                        owner: user?.user_metadata?.full_name ?? 'You',
                        createdAt: recordingData.createdAt ?? new Date().toISOString(),
                        durationMs: (recording?.duration ?? 0) * 1000,
                        description: recordingData.description || undefined,
                        status: isUploaded ? 'link ready' : 'on this device',
                        views: recordingData.views ?? 0,
                        watchedPercent: null,
                        allowDownload: isUploaded,
                        canEdit: true,
                    }}
                    comments={[]}
                    hideComposer
                    commentsNote={isUploaded
                        ? 'Comments appear once someone opens the link.'
                        : 'Generate a shareable link before anyone can comment.'}
                    currentMs={Math.round(sharePlayheadSec * 1000)}
                    onBack={() => navigate('/library')}
                    onSeek={(ms) => sharePlayerRef.current?.seek(ms / 1000)}
                    onPost={() => {}}
                    onCopyLink={isUploaded
                        ? () => {
                            navigator.clipboard.writeText(window.location.href)
                                .then(() => showNotification('Link copied', 'success'))
                                .catch(() => showNotification('Could not copy the link', 'error'));
                        }
                        : handleUploadToCloud}
                    copyLinkLabel={isUploading
                        ? 'Generating\u2026'
                        : isUploaded ? 'Copy link'
                            : waitingForVideo ? 'Waiting for video\u2026' : 'Generate shareable link'}
                    copyLinkDisabled={isUploading || waitingForVideo}
                    onDownload={isUploaded ? handleDownload : undefined}
                    onEdit={handleOpenVideoEditor}
                    player={
                        <VideoPlayer
                            ref={sharePlayerRef}
                            src={playerSrc}
                            knownDurationSec={recording?.duration}
                            isReady
                            onPlaybackUpdate={(p) => setSharePlayheadSec(p.currentTime)}
                        />
                    }
                />
            </>
        );
    }

    /* ── The redesigned viewing surface (C1–C6) ───────────────────────────
     *
     * Only for a persisted recording opened from a share link. The fresh-
     * capture path below still owns upload, claiming and the local blob — it
     * is the one flow where getting this wrong loses someone's recording, so
     * it is deliberately left alone rather than folded in.
     * ------------------------------------------------------------------- */
    if (surface === 'shared' && recording) {
        const kind = toShareKind(recording);
        const durationSec = recording.duration ?? 0;

        return (
            <>
                <SEO
                    title={recording.title}
                    description={`Watch "${recording.title}" on SnapRec.`}
                    url={`/v/${recording.id}`}
                />
                <ShareShell
                    state={toShareState(recording)}
                    kind={kind}
                    capture={{
                        id: recording.id,
                        title: recording.title,
                        owner: recording.user?.fullName ?? 'A SnapRec user',
                        durationMs: durationSec * 1000,
                        allowDownload: true,
                        width: 16,
                        height: 9,
                        duration: durationSec
                            ? `${Math.floor(durationSec / 60)}:${String(Math.floor(durationSec % 60)).padStart(2, '0')}`
                            : undefined,
                        // P7 V1 viewer fields.
                        createdAt: recording.createdAt,
                        description: recording.description,
                        dimensions: recording.widthPx && recording.heightPx
                            ? `${recording.widthPx}\u00d7${recording.heightPx}`
                            : undefined,
                        statusWord: CAPTURE_STATES[toCaptureStatus(recording)].label as StatusWord,
                        views: recording.views,
                        watchedPercent: (recording as { watchedPercent?: number | null })
                            .watchedPercent ?? null,
                        canEdit: !!user && recording.user?.supabaseId === user.id,
                    }}
                    comments={toShareComments(recording, recording.user?.supabaseId)}
                    currentMs={Math.round(sharePlayheadSec * 1000)}
                    onSeek={(ms) => sharePlayerRef.current?.seek(ms / 1000)}
                    onPost={({ content, timecodeMs, anchorX, anchorY }) => {
                        if (!recording.id) return;
                        addComment.mutate({
                            id: recording.id,
                            content,
                            timecodeMs,
                            anchorX,
                            anchorY,
                        });
                    }}
                    onRequestAccess={() => setIsLoginModalOpen(true)}
                    onBack={() => navigate(-1)}
                    onCopyLink={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/v/${recording.id}`)
                            .then(() => showNotification('Link copied', 'success'))
                            .catch(() => showNotification('Could not copy the link', 'error'));
                    }}
                    /* Goes through handleOpenVideoEditor, not straight to a
                       URL: the editor route takes a PROJECT id, and a project
                       has to be created (or reused) for this recording first.
                       Navigating with the recording id 404s the editor. */
                    onEdit={handleOpenVideoEditor}
                    onDescriptionChange={
                        user && recording.user?.supabaseId === user.id
                            ? (description: string) =>
                                updateRecording.mutate({ id: recording.id, data: { description } })
                            : undefined
                    }
                    descriptionSaving={updateRecording.isPending}
                    frames={frames}
                    framesGenerating={framesGenerating}
                    framesBlocked={framesBlocked}
                    onResolve={(commentId, resolved) => {
                        resolveComment.mutate({ id: recording.id, commentId, resolved });
                    }}
                    /* Mirrors the server's rule exactly: owner or the comment's
                       own author, and never a guest. Showing the control to
                       anyone else would only earn them a 403. */
                    canResolve={(c) => {
                        if (!user) return false;
                        if (recording.user?.supabaseId === user.id) return true;
                        const source = recording.comments?.find((rc) => rc.id === c.id);
                        return source?.user?.supabaseId === user.id;
                    }}
                    onDownload={handleDownload}
                    player={
                        <VideoPlayer
                            ref={sharePlayerRef}
                            src={playerSrc}
                            /* Measured at upload. Without it the browser downloads
                               the whole webm just to learn its length. */
                            knownDurationSec={recording.duration}
                            isReady={recording.isReady !== false}
                            onPlaybackUpdate={(p) => {
                                if (p.duration > 0) setPlayerReady(true);
                                setSharePlayheadSec(p.currentTime);
                                setSharePlaying(p.playing);
                                // V4 — only while playing; a paused tab must not
                                // accumulate coverage it did not watch.
                                if (p.playing) observeWatched(p.currentTime);
                            }}
                            markers={toShareComments(recording, recording.user?.supabaseId)
                                .filter(c => c.anchor.kind === 'timecode')
                                .map(c => ({
                                    id: c.id,
                                    ms: (c.anchor as { ms: number }).ms,
                                    needsReply: c.needsReply,
                                }))}
                            onMarkerClick={(ms) => sharePlayerRef.current?.seek(ms / 1000)}
                        />
                    }
                    media={
                        kind === 'screenshot'
                            ? <img src={recording.fileUrl} alt={recording.title}
                                   style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            : undefined
                    }
                />
                <LoginModal
                    isOpen={isLoginModalOpen}
                    onClose={() => setIsLoginModalOpen(false)}
                    actionDescription={loginAction}
                />
            </>
        );
    }

    const HeaderActions = (
        <div className="flex items-center gap-2">
            <button
                onClick={handleDownload}
                className={`inline-flex items-center gap-2 h-[30px] px-3 border border-[var(--sr-border-light)] rounded-[2px] text-[var(--sr-text-secondary-on-light)] text-[12.5px] font-medium hover:border-[var(--sr-text-primary-on-light)] transition-colors ${!isUploaded ? 'invisible' : ''}`}
            >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Download
            </button>

            {!isUploaded ? (
                <button
                    onClick={handleUploadToCloud}
                    disabled={isUploading || (recordingData?.type === 'video' && !localVideoBlob)}
                    className={`inline-flex items-center gap-2 h-[30px] px-3.5 bg-[var(--sr-cyan)] text-[var(--sr-cyan-fg)] rounded-[2px] text-[12.5px] font-semibold hover:bg-[var(--sr-cyan-hover)] transition-colors disabled:opacity-40 ${isUploading ? 'animate-pulse' : ''}`}
                >
                    <span className="material-symbols-outlined text-[20px]">{isUploading ? 'sync' : 'cloud_upload'}</span>
                    {isUploading ? 'Generating...' : (recordingData?.type === 'video' && !localVideoBlob ? 'Waiting for video...' : 'Generate Shareable Link')}
                </button>
            ) : canSaveToAccount ? (
                <button
                    onClick={handleSaveClick}
                    disabled={claimMutation.isPending}
                    className="inline-flex items-center gap-2 h-[30px] px-3.5 border border-[var(--sr-border-light)] rounded-[2px] text-[12.5px] font-medium text-[var(--sr-text-secondary-on-light)] hover:border-[var(--sr-text-primary-on-light)] transition-colors disabled:opacity-40"
                >
                    {claimMutation.isPending ? 'Saving...' : (user && recordingData?.user?.supabaseId === user.id ? 'Saved in account' : 'Save to your account')}
                </button>
            ) : null}
        </div>
    );

    return (
        <FreshCaptureChrome actions={HeaderActions}>
            <SEO
                title={recordingData.title}
                description={recordingData.description || `Watch "${recordingData.title}" — a ${recordingData.type} captured and shared with SnapRec, the free Chrome screen recorder. No watermarks, no limits.`}
                keywords="screen recording, shared screen recording, snaprec, free screen recorder, screenshot share, screen capture"
                url={`/v/${id}`}
                type="video.other"
                image={recordingData.thumbnailUrl || undefined}
                noIndex={isFresh}
            />
            <div className="bg-background-light transition-colors duration-300 pb-20">
                {isFresh && !isUploaded && (
                    <div className="bg-[var(--sr-surface-paper)] border-b border-[var(--sr-border-light-soft)] py-2.5">
                        <div className="max-w-[1440px] mx-auto px-6 lg:px-20 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2.5 text-[12.5px] text-[var(--sr-text-secondary-on-light)]">
                                {/* Private is a state, not a warning — amber said something had gone
                                    wrong when nothing had. A rule and a mono label is how every
                                    other surface names a state. */}
                                <span className="w-0.5 self-stretch bg-[var(--sr-cyan-on-light)]" aria-hidden />
                                <span className="font-[family-name:var(--sr-font-mono)] text-[10px] tracking-[.12em] text-[var(--sr-text-faint-on-light)]">PRIVATE</span>
                                <span>Only you can see this. It stays on this device until you create a link.</span>
                            </div>
                        </div>
                    </div>
                )}
                <main className="max-w-[1440px] mx-auto px-6 lg:px-20 py-8">
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Main Content Area (Left) */}
                        <div className="flex-1 flex flex-col gap-6">
                            {/* Headline */}
                            <div className="flex flex-col gap-2">
                                <h1 className="text-[var(--sr-text-primary-on-light)] tracking-tight text-3xl font-bold leading-tight">
                                    {recordingData.title}
                                </h1>
                                <div className="flex items-center gap-4 text-sm text-[var(--sr-text-muted-on-light)]">
                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">visibility</span> {recordingData.views} views</span>
                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">calendar_today</span> {parseUTCDate(recordingData.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                            {recordingData.type === 'video' && (localVideoBlob || downloadUrl) && (
                                <button
                                    type="button"
                                    onClick={handleOpenVideoEditor}
                                    disabled={videoEditorLoading || (recordingData?.type === 'video' && !localVideoBlob && !isValidId)}
                                    className="group w-full flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-[var(--sr-surface-paper)] border border-[var(--sr-border-light-soft)] rounded-[2px] text-left transition-colors hover:border-[var(--sr-cyan-on-light)] disabled:opacity-50"
                                >
                                    {/* No gradient, no "MAIN FEATURE" eyebrow: this is one action
                                        among several, and dressing it as an advertisement made the
                                        capture — the thing people came for — read as secondary. */}
                                    <div className="flex-1 min-w-0">
                                        <span className="font-[family-name:var(--sr-font-mono)] text-[10px] tracking-[.12em] text-[var(--sr-text-faint-on-light)]">
                                            EDIT
                                        </span>
                                        <p className="mt-1 text-[15px] font-semibold text-[var(--sr-text-primary-on-light)]">
                                            {videoEditorLoading ? 'Preparing the editor\u2026' : 'Open in the video editor'}
                                        </p>
                                        <p className="mt-0.5 text-[12.5px] text-[var(--sr-text-muted-on-light)]">
                                            Trim, build a multi-clip timeline, then export. Sign in once to unlock it.
                                        </p>
                                    </div>
                                    <span className="shrink-0 inline-flex items-center gap-1.5 h-[34px] px-3.5 border border-[var(--sr-border-light)] rounded-[2px] text-[12.5px] font-semibold text-[var(--sr-text-primary-on-light)] group-hover:border-[var(--sr-cyan-on-light)] group-hover:text-[var(--sr-cyan-on-light)] transition-colors">
                                        {videoEditorLoading ? 'Preparing\u2026' : 'Open editor'}
                                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                    </span>
                                </button>
                            )}
                            <div className="w-full relative">
                                {recordingData.type === 'screenshot' ? (
                                    <div className="relative w-full min-h-[400px] bg-[var(--sr-surface-panel-light)] rounded-[2px] overflow-hidden shadow-2xl flex items-center justify-center border border-[var(--sr-border-light)]">
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
                                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background-light/50 backdrop-blur-sm z-40 rounded-[2px]">
                                                <div className="w-12 h-12 border-4 border-[var(--sr-cyan-on-light)] border-t-transparent rounded-full animate-spin"></div>
                                                <p className="font-bold text-[var(--sr-cyan-on-light)]">Receiving video data...</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Reaction Bar */}
                            <div className="flex items-center justify-between border-b border-[var(--sr-border-light)] pb-4">
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
                                                className={`flex items-center justify-center gap-2 px-4 py-2 bg-[var(--sr-surface-paper)] border ${isActive ? 'border-[var(--sr-cyan-on-light)] text-[var(--sr-cyan-on-light)]' : 'border-[var(--sr-border-light)] text-[var(--sr-text-muted-on-light)]'} rounded-[2px] hover:border-[var(--sr-cyan-on-light)]/50 hover:text-[var(--sr-cyan-on-light)] transition-colors`}
                                            >
                                                <span className="material-symbols-outlined text-[20px]">{iconMap[type]}</span>
                                                <span className="text-sm font-bold">{count}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        className="flex items-center gap-2 px-4 py-2 rounded-[2px] text-[var(--sr-text-muted-on-light)] hover:bg-[var(--sr-surface-panel-light)] transition-colors"
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
                                        className="flex items-center gap-2 px-4 py-2 rounded-[2px] text-[var(--sr-text-muted-on-light)] hover:bg-[var(--sr-surface-panel-light)] transition-colors"
                                        onClick={handleDownload}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">download</span>
                                        <span className="text-sm font-medium">Download</span>
                                    </button>
                                </div>
                            </div>
                            {/* Profile Header */}
                            <div className="flex items-center justify-between p-6 bg-[var(--sr-surface-paper)] rounded-[2px] border border-[var(--sr-border-light-soft)] shadow-sm">
                                <div className="flex items-center gap-5">
                                    <div
                                        className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-16 w-16 border-2 border-[var(--sr-cyan-on-light)]/20 flex items-center justify-center bg-[var(--sr-surface-panel-light)]"
                                        style={recordingData.user?.avatarUrl ? { backgroundImage: `url('${recordingData.user.avatarUrl}')` } : {}}
                                    >
                                        {!recordingData.user?.avatarUrl && (
                                            <span className="material-symbols-outlined text-[var(--sr-text-faint-on-light)] text-3xl">person</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col justify-center">
                                        <p className="text-[var(--sr-text-primary-on-light)] text-xl font-bold leading-tight">
                                            {recordingData.user?.fullName || 'Guest User'}
                                        </p>
                                        <p className="text-[var(--sr-cyan-on-light)] text-sm font-semibold">SnapRec User</p>
                                        {recordingData.location && (
                                            <p className="text-[var(--sr-text-faint-on-light)] text-xs mt-1">Recorded in {recordingData.location}</p>
                                        )}
                                    </div>
                                </div>
                                <button className="hidden sm:flex min-w-[100px] cursor-pointer items-center justify-center rounded-[2px] h-10 px-6 bg-[var(--sr-cyan-on-light)]/10 text-[var(--sr-cyan-on-light)] text-sm font-bold transition-all hover:bg-[var(--sr-cyan-on-light)]/20">
                                    Follow
                                </button>
                            </div>
                        </div>
                        {/* Sidebar (Right) */}
                        <aside className="w-full lg:w-[380px] flex flex-col gap-6">
                            {/* Sidebar CTA */}
                            {/* Only for a visitor who followed a share link. On a capture
                                you just made, "Add to Chrome" is being sold to the one person
                                who provably already has it. */}
                            {!isFresh && (
                            <a
                                href="https://chromewebstore.google.com/detail/snaprec-screen-recorder-s/lgafjgnifbjeafallnkkfpljgbilfajg"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between gap-3 p-4 rounded-[2px] bg-[var(--sr-surface-paper)] border border-[var(--sr-border-light-soft)] shadow-sm hover:border-[var(--sr-cyan-on-light)]/30 hover:shadow-md transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <img src="/logo.png" alt="SnapRec" className="size-8 rounded-[2px] shrink-0" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-[var(--sr-text-primary-on-light)] leading-tight">Try SnapRec for free</span>
                                        <span className="text-xs text-[var(--sr-text-faint-on-light)]">Record & share your screen instantly</span>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-[var(--sr-cyan-on-light)] group-hover:translate-x-0.5 transition-transform shrink-0">Add to Chrome →</span>
                            </a>
                            )}

                            {/* Comments Section */}
                            <div className="bg-[var(--sr-surface-paper)] rounded-[2px] border border-[var(--sr-border-light-soft)] shadow-sm flex flex-col h-full max-h-[600px]">
                                <div className="p-5 border-b border-[var(--sr-border-light-soft)] flex items-center justify-between">
                                    <h3 className="font-bold text-lg text-[var(--sr-text-primary-on-light)]">Comments</h3>
                                    <span className="bg-[var(--sr-surface-panel-light)] px-2 py-0.5 rounded text-xs font-bold">{(recordingData?.comments || []).length}</span>
                                </div>
                                {/* Comment List */}
                                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                                    {(!recordingData?.comments || (recordingData.comments as any[]).length === 0) ? (
                                        <div className="flex flex-col items-center justify-center h-full text-[var(--sr-text-faint-on-light)] py-10">
                                            <span className="material-symbols-outlined text-4xl mb-2">chat_bubble_outline</span>
                                            <p className="text-sm">No comments yet</p>
                                        </div>
                                    ) : (
                                        (recordingData.comments as any[]).map((comment: any) => (
                                            <div key={comment.id} className="flex gap-3">
                                                <div className="size-8 rounded-full bg-[var(--sr-border-light-soft)] shrink-0 overflow-hidden flex items-center justify-center">
                                                    {comment.user?.avatarUrl ? (
                                                        <img
                                                            alt="User"
                                                            className="w-full h-full object-cover"
                                                            src={comment.user.avatarUrl}
                                                        />
                                                    ) : (
                                                        <span className="material-symbols-outlined text-[var(--sr-text-faint-on-light)] text-sm">person</span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-[var(--sr-text-primary-on-light)]">
                                                            {comment.user?.fullName || 'Guest'}
                                                        </span>
                                                        <span className="text-[10px] text-[var(--sr-text-faint-on-light)] uppercase">
                                                            {new Date(comment.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-[var(--sr-text-secondary-on-light)] leading-relaxed">
                                                        {comment.content}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                {/* Comment Input */}
                                <div className="p-5 border-t border-[var(--sr-border-light-soft)]">
                                    <div className="relative">
                                        <textarea
                                            className="w-full rounded-[2px] border-[var(--sr-border-light)] text-sm focus:ring-[var(--sr-cyan-on-light)] focus:border-[var(--sr-cyan-on-light)] resize-none p-3 pr-10"
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
                                            className="absolute right-2 bottom-2 text-[var(--sr-cyan-on-light)] hover:bg-[var(--sr-cyan-on-light)]/10 p-1 rounded disabled:opacity-50"
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
                    {/* Bottom CTA Banner — see the sidebar card above. */}
                    <section className="mt-16 w-full">
                        {!isFresh && (
                        <div className="bg-[var(--sr-surface-paper)] rounded-[2px] p-8 lg:p-12 border border-[var(--sr-border-light-soft)] shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 overflow-hidden relative">
                            <div className="absolute -top-10 -right-10 size-40 bg-[var(--sr-cyan-on-light)]/5 rounded-full blur-3xl"></div>
                            <div className="absolute -bottom-10 -left-10 size-40 bg-[var(--sr-cyan-on-light)]/5 rounded-full blur-3xl"></div>
                            <div className="max-w-xl text-center md:text-left z-10">
                                <h2 className="text-2xl lg:text-3xl font-bold text-[var(--sr-text-primary-on-light)] mb-4">Instantly record your screen and share.</h2>
                                <p className="text-[var(--sr-text-muted-on-light)] text-lg">
                                    The easiest way to send quick video messages, bug reports, or product walkthroughs. 100% free, no watermarks.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 z-10">
                                <AddToChromeButton size="lg" />
                            </div>
                        </div>
                        )}
                        <div className="mt-8 flex flex-wrap justify-center gap-6 text-[var(--sr-text-faint-on-light)] text-sm">
                            <a className="hover:text-[var(--sr-cyan-on-light)] transition-colors" href="/privacy">Privacy Policy</a>
                            <a className="hover:text-[var(--sr-cyan-on-light)] transition-colors" href="/how-it-works">How it Works</a>
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
        </FreshCaptureChrome>
    );
};

export default ShareView;
