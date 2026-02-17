import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useRecording, useGetUploadUrl, useCreateRecording, useUpdateRecording, uploadFile } from './useRecordings';
import { fabric } from 'fabric';

export const useEditorLifecycle = (fabricCanvas: React.MutableRefObject<fabric.Canvas | null>) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const [title, setTitle] = useState(`Screenshot ${new Date().toLocaleString()}`);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isUploaded, setIsUploaded] = useState(!!id);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [pendingAction, setPendingActionState] = useState<string | null>(localStorage.getItem('editor_pending_action'));
    const [isUploading, setIsUploading] = useState(false);

    // Wrapper to sync with localStorage
    const setPendingAction = useCallback((action: string | null) => {
        if (action) {
            localStorage.setItem('editor_pending_action', action);
        } else {
            localStorage.removeItem('editor_pending_action');
        }
        setPendingActionState(action);
    }, []);

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
        if (recording && recording.fileUrl) {
            // Only update if we don't already have an image (e.g., initial load of existing recording)
            // This prevents the "white flicker" or redundant reload after a fresh upload
            if (!capturedImage) {
                console.log('useEditorLifecycle: Setting capturedImage from fetched recording');
                setCapturedImage(recording.fileUrl);
            }
            setTitle(recording.title);
            setIsUploaded(true);
        }
    }, [recording, capturedImage]);

    const handleUploadToCloud = useCallback(async () => {
        if (!fabricCanvas.current || isUploading) return;

        // Safety check: Don't upload if canvas is empty/not loaded
        if (!fabricCanvas.current.backgroundImage) {
            console.warn('useEditorLifecycle: Upload aborted, background image not set');
            return;
        }

        setIsUploading(true);
        try {
            const canvas = fabricCanvas.current;
            const zoom = canvas.getZoom() || 1;
            console.log('useEditorLifecycle: Exporting with zoom:', zoom);

            const dataUrl = canvas.toDataURL({
                format: 'png',
                multiplier: 1 / zoom, // Always export at original resolution
                enableRetinaScaling: false // Avoid double-scaling on Retina screens
            });
            const blob = await (await fetch(dataUrl)).blob();
            const fileName = id ? `update-${id}-${Date.now()}.png` : `screenshot-${Date.now()}.png`;

            const { uploadUrl, fileUrl } = await getUploadUrlMutation.mutateAsync({
                fileName,
                contentType: 'image/png'
            });

            await uploadFile(uploadUrl, blob, 'image/png');

            if (id) {
                // Update existing recording
                await updateRecordingMutation.mutateAsync({
                    id,
                    data: { title, fileUrl }
                });
                showNotification('Updated successfully', 'success');
            } else {
                // Create new recording
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
                    const shareUrl = `${window.location.origin}/editor/${data.id}`;
                    navigate(`/editor/${data.id}`, { replace: true });

                    // Copy to clipboard
                    try {
                        await navigator.clipboard.writeText(shareUrl);
                        showNotification('Shareable link generated and copied to clipboard!', 'success');
                    } catch (err) {
                        showNotification('Shareable link generated successfully!', 'success');
                    }
                }
            }
            setIsUploaded(true);
        } catch (error: any) {
            showNotification(error.message || 'Upload failed. Please try again.', 'error');
        } finally {
            setIsUploading(false);
        }
    }, [id, title, user, isUploading, fabricCanvas, navigate, showNotification, getUploadUrlMutation, createRecordingMutation, updateRecordingMutation]);

    return {
        id,
        title,
        setTitle,
        capturedImage,
        setCapturedImage,
        isUploaded,
        setIsUploaded,
        isUploading,
        showLoginPrompt,
        setShowLoginPrompt,
        pendingAction,
        setPendingAction,
        handleUploadToCloud,
    };
};
