import React, { createContext, useContext, useState, type ReactNode, useCallback } from 'react';

type NotificationType = 'success' | 'error' | 'info';

interface Notification {
    id: string;
    message: string;
    type: NotificationType;
}

interface NotificationContextType {
    showNotification: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const showNotification = useCallback((message: string, type: NotificationType = 'info') => {
        const id = Math.random().toString(36).substring(7);
        setNotifications((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, 5000);
    }, []);

    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
                {notifications.map((n) => (
                    <div
                        key={n.id}
                        className={`pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border min-w-[320px] animate-slide-up ${n.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-500/20 dark:text-emerald-400' :
                            n.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-800 dark:bg-rose-900/20 dark:border-rose-500/20 dark:text-rose-400' :
                                'bg-white border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200'
                            }`}
                    >
                        <span className="material-symbols-outlined">
                            {n.type === 'success' ? 'check_circle' : n.type === 'error' ? 'error' : 'info'}
                        </span>
                        <p className="text-sm font-bold">{n.message}</p>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotification must be used within NotificationProvider');
    return context;
};
