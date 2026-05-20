import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { MainLayout, UsageMeter, TopupModal } from '../components';
import { useSubscription, useOpenBillingPortal } from '../hooks/useSubscription';
import { usePaddleCheckout } from '../hooks/usePaddle';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

const PRICE_ID_PRO = import.meta.env.VITE_PADDLE_PRICE_ID_PRO_MONTHLY as string | undefined;

const SettingsBilling: React.FC = () => {
    const navigate = useNavigate();
    const { signOut } = useAuth();
    const { showNotification } = useNotification();
    const { data: sub, isLoading } = useSubscription();
    const openPortal = useOpenBillingPortal();
    const [showTopup, setShowTopup] = useState(false);
    const { openCheckout } = usePaddleCheckout();

    const isProActive = sub?.plan === 'pro' && (sub?.status === 'active' || sub?.status === 'trialing');
    const isTrialing = sub?.status === 'trialing';
    const trialEndDate = sub?.trialEnd ? new Date(sub.trialEnd) : null;
    const trialDaysLeft = trialEndDate
        ? Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / 86400000))
        : null;

    const handleCheckout = () => {
        if (!PRICE_ID_PRO) {
            showNotification('Pricing not configured (VITE_PADDLE_PRICE_ID_PRO_MONTHLY missing).', 'error');
            return;
        }
        openCheckout(PRICE_ID_PRO);
    };

    const handlePortal = async () => {
        try {
            await openPortal.mutateAsync();
        } catch (err: any) {
            showNotification(err?.message || 'Failed to open billing portal. Please try again.', 'error');
        }
    };

    const Sidebar = (
        <aside className="w-72 bg-white dark:bg-background-dark border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between p-6 overflow-y-auto">
            <div className="flex flex-col gap-8">
                <nav className="flex flex-col gap-1">
                    <NavLink to="/dashboard" className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <span className="material-symbols-outlined">dashboard</span>
                        <span className="font-semibold text-sm">Dashboard</span>
                    </NavLink>
                    <NavLink to="/library" className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
                        <span className="font-semibold text-sm">My Library</span>
                    </NavLink>
                    <NavLink to="/settings/billing" className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <span className="material-symbols-outlined">credit_card</span>
                        <span className="font-semibold text-sm">Plan & Billing</span>
                    </NavLink>
                </nav>
            </div>
            <div className="flex flex-col gap-6">
                <button onClick={() => showNotification('Use the SnapRec extension to start a new recording!', 'info')} className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg shadow-primary/20">
                    <span className="material-symbols-outlined text-xl">add_circle</span>
                    <span>New Recording</span>
                </button>
                <nav className="flex flex-col gap-1">
                    <NavLink to="/analytics" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 transition-colors ${isActive ? 'text-primary' : 'text-slate-600 dark:text-slate-400 hover:text-primary'}`}>
                        <span className="material-symbols-outlined">analytics</span>
                        <span className="font-semibold text-sm">Analytics</span>
                    </NavLink>
                    <NavLink to="/settings" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 transition-colors ${isActive ? 'text-primary' : 'text-slate-600 dark:text-slate-400 hover:text-primary'}`}>
                        <span className="material-symbols-outlined">settings</span>
                        <span className="font-semibold text-sm">Settings</span>
                    </NavLink>
                    <button onClick={signOut} className="flex items-center gap-3 px-3 py-2 text-red-500 hover:text-red-600 transition-colors w-full text-left">
                        <span className="material-symbols-outlined">logout</span>
                        <span className="font-semibold text-sm">Sign Out</span>
                    </button>
                </nav>
            </div>
        </aside>
    );

    return (
        <MainLayout sidebar={Sidebar}>
            <div className="bg-slate-50/50 dark:bg-background-dark/50 min-h-full p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Billing</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Manage your SnapRec subscription and AI usage.
                    </p>
                </div>

                <div className="max-w-2xl space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Current plan</h3>
                            <span
                                className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                                    isProActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}
                            >
                                {sub?.plan || 'free'}
                            </span>
                        </div>
                        {isLoading ? (
                            <p className="text-slate-400 text-sm mt-2">Loading…</p>
                        ) : isTrialing ? (
                            <div className="mt-2 space-y-1">
                                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                    <span className="material-symbols-outlined text-[16px]">star</span>
                                    <span className="text-sm font-semibold">
                                        Free trial active — {trialDaysLeft !== null ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left` : ''}
                                    </span>
                                </div>
                                <p className="text-slate-500 text-sm">
                                    {trialEndDate
                                        ? `Trial ends ${trialEndDate.toLocaleDateString()} — you won't be charged until then.`
                                        : 'Your trial is active.'}
                                </p>
                            </div>
                        ) : isProActive ? (
                            <p className="text-slate-500 text-sm mt-2">
                                {sub?.currentPeriodEnd
                                    ? `Renews ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
                                    : 'Subscription active.'}
                            </p>
                        ) : (
                            <p className="text-slate-500 text-sm mt-2">
                                You're on the free plan. Upgrade to add AI transcripts and summaries.
                            </p>
                        )}
                        <div className="mt-4 flex gap-3">
                            {isProActive ? (
                                <button
                                    onClick={handlePortal}
                                    disabled={openPortal.isPending}
                                    className="px-4 py-2 bg-primary/10 text-primary font-bold text-sm rounded-lg hover:bg-primary/20 disabled:opacity-50"
                                >
                                    {openPortal.isPending ? 'Opening…' : 'Manage subscription'}
                                </button>
                            ) : (
                                <button
                                    onClick={handleCheckout}
                                    className="px-4 py-2 bg-primary text-white font-bold text-sm rounded-lg hover:opacity-90 shadow-md shadow-primary/20"
                                >
                                    Start free trial
                                </button>
                            )}
                            <button
                                onClick={() => navigate('/pricing')}
                                className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm"
                            >
                                Compare plans
                            </button>
                        </div>
                    </div>

                    {sub && (
                        <UsageMeter
                            usedMinutes={sub.aiMinutesUsedThisCycle}
                            includedMinutes={sub.aiMinutesIncluded + (sub.aiMinutesPurchased || 0)}
                            label={`AI minutes this cycle${sub.aiMinutesPurchased ? ` (+${sub.aiMinutesPurchased} purchased)` : ''}`}
                        />
                    )}

                    {/* Top-up minutes (only for Pro users) */}
                    {isProActive && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                                        Need more minutes?
                                    </h3>
                                    <p className="text-sm text-slate-500">
                                        Top up your account with additional AI minutes. They don't expire and stack on top of your monthly quota.
                                    </p>
                                    {sub?.aiMinutesPurchased ? (
                                        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-2">
                                            {sub.aiMinutesPurchased} minutes available from previous top-ups
                                        </p>
                                    ) : null}
                                </div>
                                <button
                                    onClick={() => setShowTopup(true)}
                                    className="shrink-0 px-4 py-2 bg-primary/10 text-primary font-bold text-sm rounded-lg hover:bg-primary/20"
                                >
                                    Buy minutes
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <TopupModal isOpen={showTopup} onClose={() => setShowTopup(false)} />
        </MainLayout>
    );
};

export default SettingsBilling;
