import { supabase } from './supabase';

// Centralized API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = {
    baseUrl: API_BASE_URL,

    // Generic fetch wrapper with auth
    async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

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
            throw new Error(`API Error: ${response.status}`);
        }

        return response.json();
    },

    // Recordings endpoints
    recordings: {
        async list() {
            return api.fetch<any[]>('/recordings');
        },

        async get(id: string) {
            return api.fetch<any>(`/recordings/${id}`);
        },

        async create(data: { title: string; type: string; fileUrl: string; guestId?: string }) {
            return api.fetch<any>('/recordings', {
                method: 'POST',
                body: JSON.stringify(data),
            });
        },

        async getUploadUrl(fileName: string, contentType: string) {
            return api.fetch<{ uploadUrl: string; fileUrl: string }>('/recordings/upload-url', {
                method: 'POST',
                body: JSON.stringify({ fileName, contentType }),
            });
        },
        async claim(recordingIds: string[]) {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            return api.fetch<any>('/recordings/claim', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ recordingIds }),
            });
        },
    },
};
