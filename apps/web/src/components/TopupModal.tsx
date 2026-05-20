import React, { useState } from 'react';
import { useStartTopup, type TopupPackId } from '../hooks/useSubscription';
import { useNotification } from '../contexts/NotificationContext';

interface TopupModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PACKS: Array<{ id: TopupPackId; hours: number; price: string; perHour: string }> = [
    { id: '5h', hours: 5, price: '$8', perHour: '$1.60/hr' },
    { id: '10h', hours: 10, price: '$15', perHour: '$1.50/hr' },
    { id: '20h', hours: 20, price: '$28', perHour: '$1.40/hr' },
];

const TopupModal: React.FC<TopupModalProps> = ({ isOpen, onClose }) => {
    const [selected, setSelected] = useState<TopupPackId>('10h');
    const startTopup = useStartTopup();
    const { showNotification } = useNotification();

    const handleTopup = async () => {
        try {
            await startTopup.mutateAsync(selected);
        } catch (err: any) {
            showNotification(err?.message || 'Failed to open checkout. Please try again.', 'error');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-8 shadow-2xl border border-slate-100 dark:border-slate-800"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-primary">
                        <span className="material-symbols-outlined">add_circle</span>
                        <span className="font-bold text-sm uppercase tracking-widest">Top up minutes</span>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Add more AI minutes</h2>
                <p className="text-slate-500 text-sm mb-5">
                    Purchased minutes don't expire — they stack on top of your monthly quota.
                </p>

                <div className="space-y-2 mb-5">
                    {PACKS.map((p) => {
                        const active = selected === p.id;
                        return (
                            <button
                                key={p.id}
                                onClick={() => setSelected(p.id)}
                                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-colors ${
                                    active
                                        ? 'border-primary bg-primary/5'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                }`}
                            >
                                <div className="text-left">
                                    <p className="font-bold text-slate-900 dark:text-white">{p.hours} hours</p>
                                    <p className="text-xs text-slate-500">{p.perHour}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-black text-slate-900 dark:text-white">{p.price}</p>
                                    <p className="text-xs text-slate-400">one-time</p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                <button
                    onClick={handleTopup}
                    disabled={startTopup.isPending}
                    className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity shadow-md shadow-primary/20 disabled:opacity-50"
                >
                    {startTopup.isPending ? 'Opening checkout…' : 'Continue to checkout'}
                </button>
                <p className="text-center text-xs text-slate-400 mt-2">
                    Powered by Paddle · secure card payment
                </p>
            </div>
        </div>
    );
};

export default TopupModal;
