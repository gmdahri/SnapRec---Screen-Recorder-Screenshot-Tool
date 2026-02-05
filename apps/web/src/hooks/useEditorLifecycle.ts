import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
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

    // Fetch existing recording if ID is in URL
    const { data: recording } = useQuery({
        queryKey: ['recording', id],
        queryFn: () => id ? api.recordings.get(id) : Promise.resolve(null),
        enabled: !!id,
        meta: {
            onError: () => showNotification('Failed to fetch recording', 'error'),
        }
    });

    useEffect(() => {
        if (recording && recording.fileUrl) {
            setCapturedImage(recording.fileUrl);
            setHasAutoUploaded(true);
        }
    }, [recording]);

    const uploadMutation = useMutation({
        mutationFn: async () => {
            if (!fabricCanvas.current) return;
            const dataUrl = fabricCanvas.current.toDataURL({ format: 'png', quality: 0.8 });
            const blob = await (await fetch(dataUrl)).blob();
            const fileName = `screenshot-${Date.now()}.png`;
            const { uploadUrl, fileUrl } = await api.recordings.getUploadUrl(fileName, 'image/png');
            await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/png' } });

            const guestId = localStorage.getItem('snaprec_guest_id') || `guest_${Math.random().toString(36).substring(7)}`;
            if (!localStorage.getItem('snaprec_guest_id')) localStorage.setItem('snaprec_guest_id', guestId);

            return api.recordings.create({
                title: 'Edited Screenshot',
                fileUrl,
                type: 'screenshot',
                guestId: !user ? guestId : undefined
            });
        },
        onSuccess: (data) => {
            if (data && data.id && !id) {
                window.history.pushState({}, '', `/editor/${data.id}`);
                queryClient.invalidateQueries({ queryKey: ['recordings'] });
            }
            showNotification('Saved to Cloud successfully', 'success');
        },
        onError: () => {
            showNotification('Upload failed. Please try again.', 'error');
        }
    });

    return {
        id,
        capturedImage,
        setCapturedImage,
        hasAutoUploaded,
        setHasAutoUploaded,
        isUploading: uploadMutation.isPending,
        showLoginPrompt,
        setShowLoginPrompt,
        pendingAction,
        setPendingAction,
        handleUploadToCloud: uploadMutation.mutateAsync,
    };
};
