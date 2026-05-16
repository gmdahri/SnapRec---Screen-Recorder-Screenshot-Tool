import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchWithAuth } from './useRecordings';

export interface SubscriptionInfo {
    plan: 'free' | 'pro';
    status: string;
    currentPeriodEnd: string | null;
    aiMinutesUsedThisCycle: number;
    aiMinutesIncluded: number;
}

export function useSubscription(enabled: boolean = true) {
    return useQuery({
        queryKey: ['subscription', 'me'],
        queryFn: () => fetchWithAuth<SubscriptionInfo>('/subscriptions/me'),
        enabled,
        staleTime: 60 * 1000,
        retry: 1,
    });
}

export function useStartCheckout() {
    return useMutation({
        mutationFn: async (params: { successUrl?: string; cancelUrl?: string } = {}) => {
            const res = await fetchWithAuth<{ url: string }>('/subscriptions/checkout', {
                method: 'POST',
                body: JSON.stringify(params),
            });
            if (res.url) window.location.href = res.url;
            return res;
        },
    });
}

export function useOpenBillingPortal() {
    return useMutation({
        mutationFn: async () => {
            const res = await fetchWithAuth<{ url: string }>('/subscriptions/portal', {
                method: 'POST',
                body: JSON.stringify({}),
            });
            if (res.url) window.location.href = res.url;
            return res;
        },
    });
}
