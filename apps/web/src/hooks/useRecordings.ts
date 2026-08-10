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
    /** Seconds, mapped from the server's `durationSec` at the fetch boundary so
     * every surface can keep reading `duration`. */
    duration?: number;
    durationSec?: number;
    widthPx?: number;
    heightPx?: number;
    views: number;
    isReady?: boolean;
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
        /** What the comment is about. Null on a remark about the capture as a
         * whole, and on every row written before the anchor columns existed.
         * `timecodeMs` for video, normalised `anchorX`/`anchorY` for images. */
        timecodeMs?: number | null;
        anchorX?: number | null;
        anchorY?: number | null;
        /** ISO when settled; absent while the question is still open. */
        resolvedAt?: string | null;
        user?: {
            supabaseId: string;
            fullName?: string;
            avatarUrl?: string;
        };
    }>;
}

interface CreateRecordingInput {
    id?: string;
    title: string;
    type: string;
    fileUrl: string;
    /** Whole seconds. Omitted when unknown — the column is nullable and the
     * card falls back to reading the length off the media element. */
    durationSec?: number;
    /** Frame size, when the uploader could measure it. */
    widthPx?: number;
    heightPx?: number;
    thumbnailUrl?: string;
    userId?: string;
    guestId?: string;
}

interface UploadUrlResponse {
    uploadUrl: string;
    fileUrl: string;
}

// API Base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://snaprec-489525905608.us-central1.run.app';

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
        aborted: options.signal?.aborted
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
        // Don't log 404 as a full error to reduce console noise during polling/fresh registration
        if (response.status !== 404) {
            console.error(`API Error: ${response.status}`, errorText);
        }
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

/** Download binary (e.g. video stream) with the same auth as API calls. */
export async function fetchBlobWithAuth(videoUrl: string): Promise<Blob> {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error('Authentication error. Please log in again.');
    const token = session?.access_token;
    const response = await fetch(videoUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
        throw new Error(`Could not download video (${response.status}).`);
    }
    return response.blob();
}

// Query Keys - centralized for cache management
export const recordingsKeys = {
    all: ['recordings'] as const,
    detail: (id: string) => ['recordings', id] as const,
};

// ============= PUBLIC STATS =============

interface PublicStats {
    users: number;
    recordings: number;
    screenshots: number;
    videos: number;
}

export function useStats() {
    return useQuery({
        queryKey: ['public-stats'],
        queryFn: async (): Promise<PublicStats> => {
            const res = await fetch(`${API_BASE_URL}/stats`);
            if (!res.ok) throw new Error('Failed to fetch stats');
            return res.json();
        },
        staleTime: 1000 * 60 * 10, // 10 minutes
        retry: 1,
    });
}

const GUEST_RECORDING_IDS_KEY = 'guestRecordingIds';

/** Append a recording ID so it can be claimed after the user signs in. */
export function addGuestRecordingId(recordingId: string): void {
    try {
        const raw = localStorage.getItem(GUEST_RECORDING_IDS_KEY);
        const ids: string[] = raw ? JSON.parse(raw) : [];
        if (!ids.includes(recordingId)) {
            ids.push(recordingId);
            localStorage.setItem(GUEST_RECORDING_IDS_KEY, JSON.stringify(ids));
        }
    } catch (e) {
        console.warn('Failed to store guest recording id for claim', e);
    }
}

// ============= QUERIES =============

const ensureAbsoluteUrl = (url: string) => {
    if (url && url.startsWith('/')) {
        return `${API_BASE_URL}${url}`;
    }
    return url;
};

/**
 * Hook to fetch all recordings for the current user
 * Pass isAuthenticated and isLoading from useAuth to control when query runs
 */
export function useRecordings(isAuthenticated: boolean = true, isLoading: boolean = false) {
    return useQuery({
        queryKey: recordingsKeys.all,
        queryFn: async ({ signal }) => {
            const recordings = await fetchWithAuth<Recording[]>('/recordings', { signal });
            return recordings.map(r => ({
                ...r,
                fileUrl: ensureAbsoluteUrl(r.fileUrl),
                thumbnailUrl: r.thumbnailUrl ? ensureAbsoluteUrl(r.thumbnailUrl) : undefined,
                duration: r.duration ?? r.durationSec
            }));
        },
        // Only fetch when user is logged in and auth has finished loading
        enabled: isAuthenticated && !isLoading,
        retry: 1,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

/**
 * Hook to fetch a single recording by ID
 */
export function useRecording(id: string | undefined, refetchInterval?: number | false, options: { enabled?: boolean } = {}) {
    const isValidId = !!id && id !== 'undefined';
    return useQuery({
        queryKey: recordingsKeys.detail(id!),
        queryFn: async ({ signal }) => {
            const recording = await fetchWithAuth<Recording>(`/recordings/${id}`, { signal });
            return {
                ...recording,
                fileUrl: ensureAbsoluteUrl(recording.fileUrl),
                thumbnailUrl: recording.thumbnailUrl ? ensureAbsoluteUrl(recording.thumbnailUrl) : undefined,
                duration: recording.duration ?? recording.durationSec
            };
        },
        enabled: (options.enabled !== undefined ? options.enabled : true) && isValidId,
        retry: 1,
        refetchInterval: refetchInterval,
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
        mutationFn: ({ id, data }: {
            id: string;
            data: { title?: string; fileUrl?: string; description?: string };
        }) =>
            fetchWithAuth<Recording>(`/recordings/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            }),
        // Returned, so `isPending` covers the refetch too — the description
        // editor stays in its saving state until the new text is the text the
        // page holds, rather than closing onto the previous copy of it.
        //
        // One invalidation, not two: `all` is the prefix of `detail`, so it
        // already matches the detail query. Naming both made every edit refetch
        // that query twice.
        onSuccess: () => queryClient.invalidateQueries({ queryKey: recordingsKeys.all }),
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
 * Hook to claim guest recordings after login.
 * API returns { claimed: string[] } — only those IDs were actually claimed (not owned by another user).
 */
export function useClaimRecordings() {
    const queryClient = useQueryClient();

    return useMutation({
        // The guestId scopes the claim to captures this browser actually made.
        // Without it the server can only fall back to ownerless rows, which is
        // exactly the case anyone holding a share link could exploit.
        mutationFn: (recordingIds: string[]) =>
            fetchWithAuth<{ success: boolean; claimed: string[] }>('/recordings/claim', {
                method: 'POST',
                body: JSON.stringify({
                    recordingIds,
                    guestId: localStorage.getItem('guestId') ?? undefined,
                }),
            }),
        onSuccess: (data, recordingIds) => {
            queryClient.invalidateQueries({ queryKey: recordingsKeys.all });
            (data?.claimed ?? recordingIds).forEach((recId) => {
                queryClient.invalidateQueries({ queryKey: recordingsKeys.detail(recId) });
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
        // Anchors are optional: a comment can be about the capture as a whole,
        // which is what every row written before the anchor columns is.
        mutationFn: ({ id, content, guestId, timecodeMs, anchorX, anchorY }: {
            id: string;
            content: string;
            guestId?: string;
            timecodeMs?: number;
            anchorX?: number;
            anchorY?: number;
        }) =>
            fetchWithAuth<any>(`/recordings/${id}/comments`, {
                method: 'POST',
                body: JSON.stringify({ content, guestId, timecodeMs, anchorX, anchorY }),
            }),
        // Returned, not fired and forgotten: a returned promise keeps the
        // mutation pending until it settles, so `isPending` covers the refetch
        // as well as the POST. The share surfaces hold a skeleton row for that
        // whole window — without this it would clear on the POST and leave a
        // frame with neither the skeleton nor the real comment on screen.
        onSuccess: (_, { id }) =>
            queryClient.invalidateQueries({ queryKey: recordingsKeys.detail(id) }),
    });
}

/** Settles or reopens a comment (P7 V3).
 *
 * No guestId branch, unlike the other comment mutations: the endpoint requires
 * a real session, because a guestId travels with the share link and would let
 * any recipient close other people's questions. */
export function useResolveComment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, commentId, resolved }: {
            id: string;
            commentId: string;
            resolved: boolean;
        }) =>
            fetchWithAuth<any>(`/recordings/${id}/comments/${commentId}/resolve`, {
                method: 'PATCH',
                body: JSON.stringify({ resolved }),
            }),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: recordingsKeys.detail(id) });
        },
    });
}

/** Replaces the media behind an existing recording (P7 E6).
 *
 * Destructive: everyone holding the share link sees the new footage, and the
 * previous file is no longer reachable at this id. Callers confirm first.
 *
 * Returns how many comments now point past the end, so the editor can say what
 * the publish broke rather than leaving people to find out. */
export function usePublishRecording() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, fileUrl, durationSec }: {
            id: string;
            fileUrl: string;
            durationSec?: number;
        }) =>
            fetchWithAuth<{ staleComments: number }>(`/recordings/${id}/publish`, {
                method: 'POST',
                body: JSON.stringify({ fileUrl, durationSec }),
            }),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: recordingsKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: recordingsKeys.all });
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
