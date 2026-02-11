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
    const [hasAutoUploaded, setHasAutoUploaded] = useState(!!id);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

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
            setCapturedImage(recording.fileUrl);
            setTitle(recording.title);
            setHasAutoUploaded(true);
        }
    }, [recording]);

    const handleUploadToCloud = async () => {
        if (!fabricCanvas.current || isUploading) return;

        setIsUploading(true);
        try {
            const dataUrl = fabricCanvas.current.toDataURL({ format: 'png', quality: 0.8 });
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
                    window.history.pushState({}, '', `/editor/${data.id}`);
                }
                showNotification('Saved to Cloud successfully', 'success');
            }
        } catch (error: any) {
            showNotification(error.message || 'Upload failed. Please try again.', 'error');
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
        showLoginPrompt,
        setShowLoginPrompt,
        pendingAction,
        setPendingAction,
        handleUploadToCloud,
    };
};
