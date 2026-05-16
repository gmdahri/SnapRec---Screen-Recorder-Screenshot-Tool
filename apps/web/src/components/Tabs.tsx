import React from 'react';

export interface TabItem {
    key: string;
    label: React.ReactNode;
    badge?: React.ReactNode;
}

interface TabsProps {
    items: TabItem[];
    active: string;
    onChange: (key: string) => void;
    className?: string;
}

const Tabs: React.FC<TabsProps> = ({ items, active, onChange, className = '' }) => {
    return (
        <div className={`border-b border-slate-200 dark:border-slate-800 flex gap-1 ${className}`} role="tablist">
            {items.map((item) => {
                const isActive = item.key === active;
                return (
                    <button
                        key={item.key}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(item.key)}
                        className={`relative px-4 py-2.5 text-sm font-semibold transition-colors flex items-center gap-2 ${
                            isActive
                                ? 'text-primary'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        {item.label}
                        {item.badge}
                        {isActive && (
                            <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary" />
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default Tabs;
