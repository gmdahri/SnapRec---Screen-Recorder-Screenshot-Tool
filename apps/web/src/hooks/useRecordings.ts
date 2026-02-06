import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Types
export interface Recording {
    id: string;
    title: string;
    fileUrl: string;
    thumbnailUrl?: string;
    type: 'video' | 'screenshot';
    createdAt: string;
    duration?: number;
    views: number;
    description?: string;
    location?: string;
    user?: {
        supabaseId: string;
        fullName?: string;
        avatarUrl?: string;
    };
    reactions: Array<{
        id: string;
        type: string;
        guestId?: string;
        user?: { supabaseId: string };
    }>;
    comments: Array<{
        id: string;
        content: string;
        createdAt: string;
        guestId?: string;
        user?: {
            supabaseId: string;
            fullName?: string;
            avatarUrl?: string;
        };
    }>;
}

interface CreateRecordingInput {
    title: string;
    type: string;
    fileUrl: string;
    thumbnailUrl?: string;
    userId?: string;
    guestId?: string;
}

interface UploadUrlResponse {
    uploadUrl: string;
    fileUrl: string;
}

// API Base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Base fetch function with auth - exported for use by AuthContext
export async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
        console.error('Supabase session error:', sessionError);
        throw new Error('Authentication error. Please log in again.');
    }

    const token = session?.access_token;

    // Debug logging
    console.log('API Request:', endpoint, {
        hasToken: !!token,
        tokenPrefix: token ? token.substring(0, 20) + '...' : 'none',
    });

    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    if (!response.ok) {
        if (response.status === 401) {
            console.error('401 Unauthorized - Token may be expired or invalid');
            throw new Error('Session expired. Please log in again.');
        }
        const errorText = await response.text().catch(() => '');
        console.error(`API Error: ${response.status}`, errorText);
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

// Query Keys - centralized for cache management
export const recordingsKeys = {
    all: ['recordings'] as const,
    detail: (id: string) => ['recordings', id] as const,
};

// ============= QUERIES =============

/**
 * Hook to fetch all recordings for the current user
 * Pass isAuthenticated and isLoading from useAuth to control when query runs
 */
export function useRecordings(isAuthenticated: boolean = true, isLoading: boolean = false) {
    return useQuery({
        queryKey: recordingsKeys.all,
        queryFn: () => fetchWithAuth<Recording[]>('/recordings'),
        // Only fetch when user is logged in and auth has finished loading
        enabled: isAuthenticated && !isLoading,
        retry: 1,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

/**
 * Hook to fetch a single recording by ID
 */
export function useRecording(id: string | undefined) {
    return useQuery({
        queryKey: recordingsKeys.detail(id!),
        queryFn: () => fetchWithAuth<Recording>(`/recordings/${id}`),
        enabled: !!id,
        retry: 1,
    });
}

// ============= MUTATIONS =============

/**
 * Hook to create a new recording
 */
export function useCreateRecording() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateRecordingInput) =>
            fetchWithAuth<Recording>('/recordings', {
                method: 'POST',
                body: JSON.stringify(data),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: recordingsKeys.all });
        },
    });
}

/**
 * Hook to update a recording (e.g., rename)
 */
export function useUpdateRecording() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: { title?: string; fileUrl?: string } }) =>
            fetchWithAuth<Recording>(`/recordings/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            }),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: recordingsKeys.all });
            queryClient.invalidateQueries({ queryKey: recordingsKeys.detail(id) });
        },
    });
}

/**
 * Hook to delete a recording
 */
export function useDeleteRecording() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) =>
            fetchWithAuth<{ success: boolean }>(`/recordings/${id}`, {
                method: 'DELETE',
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: recordingsKeys.all });
        },
    });
}

/**
 * Hook to get upload URL for a new file
 */
export function useGetUploadUrl() {
    return useMutation({
        mutationFn: ({ fileName, contentType }: { fileName: string; contentType: string }) =>
            fetchWithAuth<UploadUrlResponse>('/recordings/upload-url', {
                method: 'POST',
                body: JSON.stringify({ fileName, contentType }),
            }),
    });
}

/**
 * Hook to claim guest recordings after login
 */
export function useClaimRecordings() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (recordingIds: string[]) =>
            fetchWithAuth<{ success: boolean }>('/recordings/claim', {
                method: 'POST',
                body: JSON.stringify({ recordingIds }),
            }),
        onSuccess: (_, recordingIds) => {
            queryClient.invalidateQueries({ queryKey: recordingsKeys.all });
            recordingIds.forEach(id => {
                queryClient.invalidateQueries({ queryKey: recordingsKeys.detail(id) });
            });
        },
    });
}

/**
 * Hook to add a reaction to a recording
 */
export function useAddReaction() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, type, guestId }: { id: string; type: string; guestId?: string }) =>
            fetchWithAuth<any>(`/recordings/${id}/reactions`, {
                method: 'POST',
                body: JSON.stringify({ type, guestId }),
            }),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: recordingsKeys.detail(id) });
        },
    });
}

/**
 * Hook to add a comment to a recording
 */
export function useAddComment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, content, guestId }: { id: string; content: string; guestId?: string }) =>
            fetchWithAuth<any>(`/recordings/${id}/comments`, {
                method: 'POST',
                body: JSON.stringify({ content, guestId }),
            }),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: recordingsKeys.detail(id) });
        },
    });
}

// ============= UPLOAD HELPER =============

/**
 * Function to upload a file to the storage bucket
 */
export async function uploadFile(uploadUrl: string, blob: Blob, contentType: string): Promise<void> {
    const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': contentType },
    });

    if (!response.ok) {
        throw new Error('Failed to upload file');
    }
}
