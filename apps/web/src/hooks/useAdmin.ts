import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from './useRecordings';

export interface AdminStats {
    users: { total: number; newLast7Days: number };
    recordings: { total: number; newLast7Days: number };
    pro: { active: number; trialing: number; total: number };
    usage: {
        totalMinutesProcessedThisCycle: number;
        totalMinutesPurchasedLifetime: number;
        estimatedVariableCostThisCycleUsd: number;
        estimatedMrrUsd: number;
    };
}

export interface AdminUserRow {
    id: string;
    supabaseId: string;
    email: string;
    fullName: string | null;
    isAdmin: boolean;
    createdAt: string;
    plan: 'free' | 'pro';
    status: string;
    aiMinutesUsedThisCycle: number;
    aiMinutesIncluded: number;
    aiMinutesPurchased: number;
    trialEnd: string | null;
    estimatedCostUsd: number;
}

export function useAdminStats(enabled: boolean = true) {
    return useQuery({
        queryKey: ['admin', 'stats'],
        queryFn: () => fetchWithAuth<AdminStats>('/admin/stats'),
        enabled,
        retry: false,
        staleTime: 30 * 1000,
    });
}

export function useAdminUsers(limit: number = 50, offset: number = 0, enabled: boolean = true) {
    return useQuery({
        queryKey: ['admin', 'users', limit, offset],
        queryFn: () =>
            fetchWithAuth<{ users: AdminUserRow[]; total: number }>(
                `/admin/users?limit=${limit}&offset=${offset}`,
            ),
        enabled,
        retry: false,
    });
}
