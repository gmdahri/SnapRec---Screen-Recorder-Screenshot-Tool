import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';

type PaddleEnv = 'sandbox' | 'production';

declare global {
    interface Window {
        Paddle?: {
            Environment: { set: (env: PaddleEnv) => void };
            Initialize: (opts: { token: string; eventCallback?: (data: any) => void }) => void;
            Checkout: {
                open: (opts: {
                    transactionId?: string;
                    items?: Array<{ priceId: string; quantity: number }>;
                    customer?: { email?: string; id?: string };
                    customData?: Record<string, any>;
                    settings?: Record<string, any>;
                }) => void;
                close: () => void;
            };
        };
    }
}

let initialized = false;

function initPaddle(onSuccess: () => void) {
    if (initialized || !window.Paddle) return;
    const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
    const env = (import.meta.env.VITE_PADDLE_ENV as PaddleEnv | undefined) || 'sandbox';
    if (!token) {
        console.warn('VITE_PADDLE_CLIENT_TOKEN not set — Paddle.js will not initialize.');
        return;
    }
    window.Paddle.Environment.set(env);
    window.Paddle.Initialize({
        token,
        eventCallback: (data: any) => {
            if (data?.name === 'checkout.completed') {
                onSuccess();
            }
        },
    });
    initialized = true;
}

/**
 * Returns a function that opens the Paddle overlay directly with items + customer.
 * Paddle creates the transaction inside the overlay session — no server-side
 * transaction.create call needed. Subscription/customer get linked via webhooks.
 */
export function usePaddleCheckout() {
    const queryClient = useQueryClient();
    const { showNotification } = useNotification();
    const { user } = useAuth();
    const handledRef = useRef(false);

    useEffect(() => {
        if (handledRef.current) return;
        if (typeof window === 'undefined' || !window.Paddle) return;

        initPaddle(() => {
            showNotification('Checkout complete — refreshing your plan…', 'success');
            queryClient.invalidateQueries({ queryKey: ['subscription', 'me'] });
        });

        // Legacy support: if a `_ptxn` arrived from an old-style checkout URL, open it.
        const ptxn = new URLSearchParams(window.location.search).get('_ptxn');
        if (ptxn && window.Paddle?.Checkout) {
            handledRef.current = true;
            window.Paddle.Checkout.open({ transactionId: ptxn });
            const url = new URL(window.location.href);
            url.searchParams.delete('_ptxn');
            window.history.replaceState({}, '', url.toString());
        }
    }, [queryClient, showNotification]);

    const openCheckout = useCallback(
        (priceId: string) => {
            if (!window.Paddle?.Checkout) {
                showNotification('Checkout failed to initialize. Please refresh and try again.', 'error');
                return;
            }
            if (!priceId) {
                showNotification('Paddle price ID is not configured.', 'error');
                return;
            }
            window.Paddle.Checkout.open({
                items: [{ priceId, quantity: 1 }],
                customer: user?.email ? { email: user.email } : undefined,
                customData: user?.id ? { userId: user.id } : undefined,
            });
        },
        [showNotification, user?.email, user?.id],
    );

    return { openCheckout };
}
