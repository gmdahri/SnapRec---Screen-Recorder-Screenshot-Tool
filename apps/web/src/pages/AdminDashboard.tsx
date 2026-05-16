import React, { useState } from 'react';
import { MainLayout } from '../components';
import { useAdminStats, useAdminUsers } from '../hooks/useAdmin';

const StatCard: React.FC<{ label: string; value: string | number; sublabel?: string; accent?: 'primary' | 'emerald' | 'amber' }> = ({
    label,
    value,
    sublabel,
    accent,
}) => {
    const accentClass =
        accent === 'primary'
            ? 'text-primary'
            : accent === 'emerald'
            ? 'text-emerald-600'
            : accent === 'amber'
            ? 'text-amber-600'
            : 'text-slate-900 dark:text-white';
    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
            <p className={`text-3xl font-black ${accentClass}`}>{value}</p>
            {sublabel && <p className="text-xs text-slate-400 mt-1">{sublabel}</p>}
        </div>
    );
};

const AdminDashboard: React.FC = () => {
    const [offset, setOffset] = useState(0);
    const limit = 50;
    const { data: stats, isLoading: statsLoading, error: statsError } = useAdminStats();
    const { data: usersPage, isLoading: usersLoading } = useAdminUsers(limit, offset, !!stats);

    // 403 from /admin/stats means the viewer isn't an admin.
    if (statsError) {
        return (
            <MainLayout>
                <div className="min-h-full p-8 flex items-center justify-center">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center max-w-md">
                        <span className="material-symbols-outlined text-slate-300 text-6xl">lock</span>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-4">
                            Admin access only
                        </h2>
                        <p className="text-slate-500 text-sm mt-2">
                            You don't have permission to view this page.
                        </p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="bg-slate-50/50 dark:bg-background-dark/50 min-h-full p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Admin</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
                        SnapRec usage, cost, and revenue metrics.
                    </p>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 max-w-5xl">
                    <StatCard
                        label="Total users"
                        value={statsLoading ? '…' : stats?.users.total ?? 0}
                        sublabel={`+${stats?.users.newLast7Days ?? 0} last 7 days`}
                    />
                    <StatCard
                        label="Pro subscribers"
                        value={statsLoading ? '…' : stats?.pro.total ?? 0}
                        sublabel={`${stats?.pro.active ?? 0} active · ${stats?.pro.trialing ?? 0} on trial`}
                        accent="primary"
                    />
                    <StatCard
                        label="Estimated MRR"
                        value={statsLoading ? '…' : `$${stats?.usage.estimatedMrrUsd ?? 0}`}
                        sublabel="Active subscriptions × $19"
                        accent="emerald"
                    />
                    <StatCard
                        label="Variable cost (cycle)"
                        value={statsLoading ? '…' : `$${stats?.usage.estimatedVariableCostThisCycleUsd ?? 0}`}
                        sublabel="Whisper + Claude"
                        accent="amber"
                    />
                    <StatCard
                        label="Recordings"
                        value={statsLoading ? '…' : stats?.recordings.total ?? 0}
                        sublabel={`+${stats?.recordings.newLast7Days ?? 0} last 7 days`}
                    />
                    <StatCard
                        label="AI minutes used"
                        value={statsLoading ? '…' : stats?.usage.totalMinutesProcessedThisCycle ?? 0}
                        sublabel="This cycle"
                    />
                    <StatCard
                        label="Top-up minutes sold"
                        value={statsLoading ? '…' : stats?.usage.totalMinutesPurchasedLifetime ?? 0}
                        sublabel="Lifetime"
                    />
                </div>

                {/* Users table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-w-7xl">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Users</h3>
                        {usersPage && (
                            <span className="text-xs text-slate-400">
                                Showing {offset + 1}–{offset + (usersPage.users?.length ?? 0)} of {usersPage.total}
                            </span>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr className="text-left text-xs font-semibold text-slate-500 uppercase">
                                    <th className="px-4 py-3">User</th>
                                    <th className="px-4 py-3">Plan</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Used min</th>
                                    <th className="px-4 py-3 text-right">Quota</th>
                                    <th className="px-4 py-3 text-right">Cost</th>
                                    <th className="px-4 py-3">Joined</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usersLoading && (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading…</td>
                                    </tr>
                                )}
                                {usersPage?.users.map((u) => (
                                    <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-slate-900 dark:text-white">
                                                {u.fullName || u.email?.split('@')[0] || '—'}
                                                {u.isAdmin && (
                                                    <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                                        admin
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-400">{u.email || '—'}</div>
                                        </td>
                                        <td className="px-4 py-3 capitalize">{u.plan}</td>
                                        <td className="px-4 py-3 text-slate-500">{u.status}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{u.aiMinutesUsedThisCycle}</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                                            {u.aiMinutesIncluded + u.aiMinutesPurchased}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums text-amber-600">
                                            ${u.estimatedCostUsd.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">
                                            {new Date(u.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {usersPage && usersPage.total > limit && (
                        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                            <button
                                onClick={() => setOffset(Math.max(0, offset - limit))}
                                disabled={offset === 0}
                                className="px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setOffset(offset + limit)}
                                disabled={offset + limit >= usersPage.total}
                                className="px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
};

export default AdminDashboard;
