import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useRecording, useGetUploadUrl, useCreateRecording, recordingsKeys, uploadFile } from './useRecordings';
import { fabric } from 'fabric';

export const useEditorLifecycle = (fabricCanvas: React.MutableRefObject<fabric.Canvas | null>) => {
    const { id } = useParams();
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const queryClient = useQueryClient();
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [hasAutoUploaded, setHasAutoUploaded] = useState(false);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Use centralized React Query hook to fetch existing recording
    const { data: recording, isError } = useRecording(id);
    const getUploadUrlMutation = useGetUploadUrl();
    const createRecordingMutation = useCreateRecording();

    // Show error if recording fetch fails
    useEffect(() => {
        if (isError) {
            showNotification('Failed to fetch recording', 'error');
        }
    }, [isError, showNotification]);

    useEffect(() => {
        if (recording && recording.fileUrl) {
            setCapturedImage(recording.fileUrl);
            setHasAutoUploaded(true);
        }
    }, [recording]);

    const handleUploadToCloud = async () => {
        if (!fabricCanvas.current || isUploading) return;

        setIsUploading(true);
        try {
            const dataUrl = fabricCanvas.current.toDataURL({ format: 'png', quality: 0.8 });
            const blob = await (await fetch(dataUrl)).blob();
            const fileName = `screenshot-${Date.now()}.png`;

            const { uploadUrl, fileUrl } = await getUploadUrlMutation.mutateAsync({
                fileName,
                contentType: 'image/png'
            });

            await uploadFile(uploadUrl, blob, 'image/png');

            const guestId = localStorage.getItem('snaprec_guest_id') || `guest_${Math.random().toString(36).substring(7)}`;
            if (!localStorage.getItem('snaprec_guest_id')) localStorage.setItem('snaprec_guest_id', guestId);

            const data = await createRecordingMutation.mutateAsync({
                title: 'Edited Screenshot',
                fileUrl,
                type: 'screenshot',
                guestId: !user ? guestId : undefined,
            });

            // Cache invalidation is handled by the mutation's onSuccess
            if (data && data.id && !id) {
                window.history.pushState({}, '', `/editor/${data.id}`);
            }
            showNotification('Saved to Cloud successfully', 'success');
        } catch {
            showNotification('Upload failed. Please try again.', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    return {
        id,
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
