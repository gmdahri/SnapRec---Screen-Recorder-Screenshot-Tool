import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MainLayout, LoginModal, GatedButton, Spinner } from '../components';
import { api } from '../lib/api';

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

    // Fetch existing recording if ID is in URL
    useEffect(() => {
        const fetchRecording = async () => {
            if (id) {
                try {
                    console.log('Fetching existing video recording:', id);
                    const recording = await api.recordings.get(id);
                    if (recording && recording.fileUrl) {
                        setVideoUrl(recording.fileUrl);
                        setHasAutoUploaded(true);
                        setLoading(false);
                    }
                } catch (error) {
                    console.error('Failed to fetch recording:', error);
                    setLoading(false);
                }
            }
        };
        fetchRecording();
    }, [id]);

    // Auto-upload when video is received
    useEffect(() => {
        if (videoUrl && !hasAutoUploaded && !isUploading) {
            handleUploadToCloud();
            setHasAutoUploaded(true);
        }
    }, [videoUrl, hasAutoUploaded]);

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

        // Fallback: check if video came before listener was ready
        const checkStoredVideo = async () => {
            try {
                setTimeout(() => {
                    if (!videoUrl) {
                        setLoading(false);
                    }
                }, 3000);
            } catch (e) {
                setLoading(false);
            }
        };

        checkStoredVideo();

        return () => window.removeEventListener('message', handleMessage);
    }, [videoUrl]);

    // Handle action button clicks - gate behind auth
    const handleActionClick = (action: string) => {
        // Allow 'save' (upload) for guests, store ID locally
        if (action === 'save') {
            executeAction(action);
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

    const handleUploadToCloud = async () => {
        if (!videoUrl || isUploading) return;

        console.log('Starting video cloud upload...');
        setIsUploading(true);
        try {
            // Get upload URL from backend using centralized API
            console.log('Getting presigned upload URL for video...');
            const { uploadUrl, fileUrl } = await api.recordings.getUploadUrl(
                `video_${Date.now()}.webm`,
                'video/webm'
            );
            console.log('Presigned URL received:', uploadUrl ? 'Success' : 'Failed');

            // Convert data URL to blob
            const res = await fetch(videoUrl);
            const blob = await res.blob();

            // Upload to R2
            console.log('Uploading to R2 via PUT...');
            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                body: blob,
                headers: { 'Content-Type': 'video/webm' }
            });

            if (!uploadRes.ok) {
                const errorText = await uploadRes.text();
                throw new Error(`R2 Upload failed: ${uploadRes.status} ${errorText}`);
            }
            console.log('R2 Video Upload successful');

            // Create recording entry
            console.log('Creating database entry...');
            const recording = await api.recordings.create({
                title: `Video Recording ${new Date().toLocaleString()}`,
                type: 'video',
                fileUrl
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

            // Update URL instead of just navigating away
            navigate(`/video-preview/${recording.id}`, { replace: true });
            console.log('Video Preview URL updated to:', `/video-preview/${recording.id}`);
        } catch (error) {
            console.error('VIDEO UPLOAD ERROR:', error);
            alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsUploading(false);
        }
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
                {loading ? (
                    <div className="flex flex-col items-center gap-4">
                        <Spinner size="lg" />
                        <p className="text-slate-500 font-medium">Waiting for video from extension...</p>
                    </div>
                ) : videoUrl ? (
                    <div className="w-full max-w-4xl">
                        {/* Video Player */}
                        <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl mb-8">
                            <video
                                src={videoUrl}
                                controls
                                autoPlay
                                className="w-full aspect-video"
                            />
                        </div>

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
