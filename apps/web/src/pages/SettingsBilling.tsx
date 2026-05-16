import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout, UsageMeter } from '../components';
import { useSubscription, useOpenBillingPortal, useStartCheckout } from '../hooks/useSubscription';

const SettingsBilling: React.FC = () => {
    const navigate = useNavigate();
    const { data: sub, isLoading } = useSubscription();
    const openPortal = useOpenBillingPortal();
    const startCheckout = useStartCheckout();

    const isProActive = sub?.plan === 'pro' && (sub?.status === 'active' || sub?.status === 'trialing');
    const isTrialing = sub?.status === 'trialing';
    const trialEndDate = sub?.trialEnd ? new Date(sub.trialEnd) : null;
    const trialDaysLeft = trialEndDate
        ? Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / 86400000))
        : null;

    return (
        <MainLayout>
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
                                    onClick={() => openPortal.mutate()}
                                    disabled={openPortal.isPending}
                                    className="px-4 py-2 bg-primary/10 text-primary font-bold text-sm rounded-lg hover:bg-primary/20 disabled:opacity-50"
                                >
                                    {openPortal.isPending ? 'Opening…' : 'Manage in Stripe'}
                                </button>
                            ) : (
                                <button
                                    onClick={() => startCheckout.mutate({})}
                                    disabled={startCheckout.isPending}
                                    className="px-4 py-2 bg-primary text-white font-bold text-sm rounded-lg hover:opacity-90 shadow-md shadow-primary/20 disabled:opacity-50"
                                >
                                    {startCheckout.isPending ? 'Opening checkout…' : 'Start free trial'}
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
                            includedMinutes={sub.aiMinutesIncluded}
                            label="AI minutes used this cycle"
                        />
                    )}
                </div>
            </div>
        </MainLayout>
    );
};

export default SettingsBilling;
