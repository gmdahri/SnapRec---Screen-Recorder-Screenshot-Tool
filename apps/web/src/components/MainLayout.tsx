import React from 'react';
import Header from './Header';

interface MainLayoutProps {
    children: React.ReactNode;
    title?: string;
    showBackButton?: boolean;
    headerActions?: React.ReactNode;
    headerCenter?: React.ReactNode;
    sidebar?: React.ReactNode;
    className?: string;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    title,
    showBackButton,
    headerActions,
    headerCenter,
    sidebar,
    className = '',
}) => {
    return (
        <div className={`min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display flex flex-col ${className}`}>
            <Header
                title={title}
                showBackButton={showBackButton}
                actions={headerActions}
                center={headerCenter}
            />

            <div className="flex-1 flex overflow-hidden">
                {sidebar}
                <main className="flex-1 overflow-y-auto overflow-x-hidden">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
