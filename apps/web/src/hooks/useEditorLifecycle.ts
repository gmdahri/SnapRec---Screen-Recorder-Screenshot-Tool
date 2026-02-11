import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useRecording, useGetUploadUrl, useCreateRecording, useUpdateRecording, uploadFile } from './useRecordings';
import { fabric } from 'fabric';

export const useEditorLifecycle = (fabricCanvas: React.MutableRefObject<fabric.Canvas | null>) => {
    const { id } = useParams();
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const [title, setTitle] = useState(`Screenshot ${new Date().toLocaleString()}`);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [hasAutoUploaded, setHasAutoUploaded] = useState(false);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Use centralized React Query hook to fetch existing recording
    const { data: recording, isError } = useRecording(id);
    const getUploadUrlMutation = useGetUploadUrl();
    const createRecordingMutation = useCreateRecording();
    const updateRecordingMutation = useUpdateRecording();

    // Show error if recording fetch fails
    useEffect(() => {
        if (isError) {
            showNotification('Failed to fetch recording', 'error');
        }
    }, [isError, showNotification]);

    useEffect(() => {
        if (!recording) return;

        const checkAvailability = async (url: string) => {
            try {
                // Extract filename from URL (e.g., /recordings/stream/filename.png)
                const fileName = url.split('/').pop()?.split('?')[0];
                if (!fileName) return true;

                const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                const response = await fetch(`${API_BASE_URL}/recordings/status/${fileName}`);
                if (response.ok) {
                    const status = await response.json();
                    return status.ready;
                }
                return false;
            } catch (e) {
                return false;
            }
        };

        let pollInterval: any;

        const startPolling = async (url: string) => {
            setIsProcessing(true);
            const isAvailable = await checkAvailability(url);

            if (!isAvailable) {
                pollInterval = setInterval(async () => {
                    const available = await checkAvailability(url);
                    if (available) {
                        clearInterval(pollInterval);
                        setIsProcessing(false);
                        setCapturedImage(url);
                        setTitle(recording.title);
                        setHasAutoUploaded(true);
                    }
                }, 3000);
            } else {
                setIsProcessing(false);
                setCapturedImage(url);
                setTitle(recording.title);
                setHasAutoUploaded(true);
            }
        };

        if (recording.fileUrl) {
            startPolling(recording.fileUrl);
        }

        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [recording]);

    const handleUploadToCloud = async () => {
        if (!fabricCanvas.current || isUploading) return;

        setIsUploading(true);
        try {
            let dataUrl;
            if (fabricCanvas.current.backgroundImage) {
                dataUrl = fabricCanvas.current.toDataURL({ format: 'png', quality: 0.8 });
            } else if (capturedImage) {
                console.log('[SnapRec] Canvas not yet initialized, using capturedImage fallback');
                dataUrl = capturedImage;
            } else {
                throw new Error('No image data found to upload');
            }

            const blob = await (await fetch(dataUrl)).blob();
            console.log(`[SnapRec] Uploading blob: ${blob.size} bytes, type: ${blob.type}`);
            const fileName = id ? `update-${id}-${Date.now()}.png` : `screenshot-${Date.now()}.png`;

            // 1. Get presigned URL
            const { uploadUrl, fileUrl } = await getUploadUrlMutation.mutateAsync({
                fileName,
                contentType: 'image/png'
            });

            // 2. Create or Update database entry IMMEDIATELY
            if (id) {
                await updateRecordingMutation.mutateAsync({
                    id,
                    data: { title, fileUrl }
                });
            } else {
                const guestId = localStorage.getItem('snaprec_guest_id') || `guest_${Math.random().toString(36).substring(7)}`;
                if (!localStorage.getItem('snaprec_guest_id')) localStorage.setItem('snaprec_guest_id', guestId);

                const data = await createRecordingMutation.mutateAsync({
                    title,
                    fileUrl,
                    type: 'screenshot',
                    userId: user?.id,
                    guestId: !user ? guestId : undefined,
                });

                if (data && data.id) {
                    window.history.pushState({}, '', `/editor/${data.id}`);
                }
            }

            // 3. Start R2 upload in the background
            uploadFile(uploadUrl, blob, 'image/png').catch(err => {
                console.error('Background upload failed:', err);
                showNotification('Upload tracking failed, but entry created.', 'error');
            });

            // 4. Show success immediately
            showNotification(id ? 'Updated successfully' : 'Saved to Cloud successfully', 'success');
        } catch (error: any) {
            showNotification(error.message || 'Action failed. Please try again.', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    return {
        id,
        title,
        setTitle,
        capturedImage,
        setCapturedImage,
        hasAutoUploaded,
        setHasAutoUploaded,
        isUploading,
        isProcessing,
        showLoginPrompt,
        setShowLoginPrompt,
        pendingAction,
        setPendingAction,
        handleUploadToCloud,
    };
};
