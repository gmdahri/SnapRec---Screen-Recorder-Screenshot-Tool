import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MainLayout, LoginModal, GatedButton, Spinner } from '../components';
import { useRecording, useGetUploadUrl, useCreateRecording, uploadFile } from '../hooks/useRecordings';

// Helper to generate thumbnail from video
const generateVideoThumbnail = (videoUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.src = videoUrl;
        video.muted = true;
        video.currentTime = 1; // Capture frame at 1 second

        video.onloadeddata = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 360;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(thumbnail);
                } else {
                    reject(new Error('Could not get canvas context'));
                }
            } catch (e) {
                reject(e);
            }
        };

        video.onerror = () => reject(new Error('Failed to load video for thumbnail'));
        video.load();
    });
};

const VideoPreview: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { id } = useParams();
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [hasAutoUploaded, setHasAutoUploaded] = useState(false);
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const [uploadStatus, setUploadStatus] = useState<string>('');
    const videoRef = useRef<HTMLVideoElement>(null);

    // React Query hooks
    const { data: existingRecording, isLoading: isLoadingRecording } = useRecording(id);
    const getUploadUrlMutation = useGetUploadUrl();
    const createRecordingMutation = useCreateRecording();

    // Load existing recording if ID is in URL
    useEffect(() => {
        if (id && existingRecording) {
            if (existingRecording.fileUrl) {
                setVideoUrl(existingRecording.fileUrl);
                setHasAutoUploaded(true);
                setLoading(false);
            }
        } else if (id && !isLoadingRecording) {
            // ID exists but no recording found
            setLoading(false);
        }
    }, [id, existingRecording, isLoadingRecording]);

    // Handle upload to cloud
    const handleUploadToCloud = useCallback(async () => {
        if (!videoUrl || isUploading) return;

        console.log('Starting video cloud upload...');
        setIsUploading(true);
        setUploadStatus('Getting upload URL...');

        try {
            const fileName = `video_${Date.now()}.webm`;

            // Get upload URL from backend
            console.log('Getting presigned upload URL for video...');
            setUploadStatus('Getting presigned URL...');
            const { uploadUrl, fileUrl } = await getUploadUrlMutation.mutateAsync({
                fileName,
                contentType: 'video/webm'
            });
            console.log('Presigned URL received:', uploadUrl ? 'Success' : 'Failed');

            // Convert data URL to blob
            setUploadStatus('Preparing video...');
            const res = await fetch(videoUrl);
            const blob = await res.blob();
            console.log('Video blob size:', blob.size);

            // Upload to R2
            setUploadStatus('Uploading video...');
            console.log('Uploading to R2 via PUT...');
            await uploadFile(uploadUrl, blob, 'video/webm');
            console.log('R2 Video Upload successful');

            // Generate thumbnail
            setUploadStatus('Generating thumbnail...');
            let thumbnailUrl: string | undefined;
            try {
                const thumbnail = await generateVideoThumbnail(videoUrl);
                console.log('Thumbnail generated, length:', thumbnail.length);

                // Upload thumbnail
                const thumbFileName = `thumb_${Date.now()}.jpg`;
                const { uploadUrl: thumbUploadUrl, fileUrl: thumbFileUrl } = await getUploadUrlMutation.mutateAsync({
                    fileName: thumbFileName,
                    contentType: 'image/jpeg'
                });

                const thumbRes = await fetch(thumbnail);
                const thumbBlob = await thumbRes.blob();
                await uploadFile(thumbUploadUrl, thumbBlob, 'image/jpeg');
                thumbnailUrl = thumbFileUrl;
                console.log('Thumbnail uploaded:', thumbFileUrl);
            } catch (thumbError) {
                console.warn('Thumbnail generation failed, continuing without:', thumbError);
            }

            // Create recording entry
            setUploadStatus('Saving to database...');
            console.log('Creating database entry...');
            const recording = await createRecordingMutation.mutateAsync({
                title: `Video Recording ${new Date().toLocaleString()}`,
                type: 'video',
                fileUrl,
                thumbnailUrl,
                userId: user?.id,
                guestId: !user ? localStorage.getItem('guestId') || undefined : undefined
            });
            console.log('Database entry created:', recording.id);

            // If guest, store ID to claim later
            if (!user) {
                const guestIds = JSON.parse(localStorage.getItem('guestRecordingIds') || '[]');
                if (!guestIds.includes(recording.id)) {
                    guestIds.push(recording.id);
                    localStorage.setItem('guestRecordingIds', JSON.stringify(guestIds));
                    console.log('Saved guest recording ID for claiming:', recording.id);
                }
            }

            // Redirect to the share view page
            setUploadStatus('Redirecting...');
            navigate(`/v/${recording.id}`, { replace: true });
            console.log('Redirected to:', `/v/${recording.id}`);
        } catch (error) {
            console.error('VIDEO UPLOAD ERROR:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setUploadStatus(`Error: ${errorMessage}`);
            alert(`Upload failed: ${errorMessage}\n\nPlease check if the server is running at localhost:3001`);
        } finally {
            setIsUploading(false);
        }
    }, [videoUrl, isUploading, user, navigate, getUploadUrlMutation, createRecordingMutation]);

    // Auto-upload when video is received (only for new videos, not existing ones)
    useEffect(() => {
        console.log('[VideoPreview] Auto-upload check:', {
            hasVideoUrl: !!videoUrl,
            hasAutoUploaded,
            isUploading,
            hasId: !!id
        });

        if (videoUrl && !hasAutoUploaded && !isUploading && !id) {
            console.log('[VideoPreview] Triggering auto-upload...');
            setHasAutoUploaded(true); // Set BEFORE calling to prevent double-trigger
            handleUploadToCloud();
        }
    }, [videoUrl, hasAutoUploaded, isUploading, id, handleUploadToCloud]);

    useEffect(() => {
        // Listen for message from extension
        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'SNAPREC_VIDEO_PREVIEW') {
                console.log('Received video from extension');
                setVideoUrl(event.data.dataUrl);
                setLoading(false);
            }
        };

        window.addEventListener('message', handleMessage);

        // Fallback: check if loading timeout
        const timeout = setTimeout(() => {
            if (!videoUrl && !id) {
                setLoading(false);
            }
        }, 3000);

        return () => {
            window.removeEventListener('message', handleMessage);
            clearTimeout(timeout);
        };
    }, [videoUrl, id]);

    // Handle action button clicks
    const handleActionClick = (action: string) => {
        if (action === 'save') {
            handleUploadToCloud();
            return;
        }

        if (!user && action !== 'save') {
            setPendingAction(action);
            setShowLoginPrompt(true);
            return;
        }
        executeAction(action);
    };

    const executeAction = (action: string) => {
        switch (action) {
            case 'download':
                handleDownload();
                break;
            case 'save':
                handleUploadToCloud();
                break;
        }
    };

    const handleDownload = () => {
        if (!videoUrl) return;
        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = `SnapRec_Video_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <MainLayout title="Video Preview" showBackButton={true}>
            {/* Login Prompt Modal */}
            <LoginModal
                isOpen={showLoginPrompt}
                onClose={() => setShowLoginPrompt(false)}
                actionDescription={pendingAction === 'download' ? 'download your video' : 'save your video to cloud'}
            />

            <main className="flex-1 flex flex-col items-center justify-center p-8">
                {loading || isLoadingRecording ? (
                    <div className="flex flex-col items-center gap-4">
                        <Spinner size="lg" />
                        <p className="text-slate-500 font-medium">Waiting for video from extension...</p>
                    </div>
                ) : videoUrl ? (
                    <div className="w-full max-w-4xl">
                        {/* Video Player */}
                        <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl mb-8">
                            <video
                                ref={videoRef}
                                src={videoUrl}
                                controls
                                autoPlay
                                className="w-full aspect-video"
                            />
                        </div>

                        {/* Upload Status */}
                        {isUploading && (
                            <div className="text-center mb-4">
                                <p className="text-sm text-slate-500 font-medium">{uploadStatus}</p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center justify-center gap-4">
                            <GatedButton
                                onClick={() => handleActionClick('download')}
                                icon="download"
                                variant="secondary"
                                className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                            >
                                Download
                            </GatedButton>
                            <GatedButton
                                onClick={() => handleActionClick('save')}
                                icon={isUploading ? 'sync' : 'cloud_upload'}
                                variant="primary"
                                className={`px-6 py-3 font-bold ${isUploading ? 'animate-pulse' : ''}`}
                                disabled={isUploading}
                            >
                                {isUploading ? 'Saving...' : 'Save to your account'}
                            </GatedButton>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 text-center">
                        <span className="material-symbols-outlined text-6xl text-slate-300">videocam_off</span>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">No Video Found</h3>
                        <p className="text-slate-500 max-w-md">
                            The video data could not be received. Try recording again from the extension.
                        </p>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="mt-4 flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm cursor-pointer hover:bg-primary/90 transition-colors"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                            Back to Dashboard
                        </button>
                    </div>
                )}
            </main>
        </MainLayout>
    );
};

export default VideoPreview;
