import React from 'react';
import Header from './Header';

interface MainLayoutProps {
    children: React.ReactNode;
    title?: React.ReactNode;
    showBackButton?: boolean;
    headerActions?: React.ReactNode;
    headerCenter?: React.ReactNode;
    sidebar?: React.ReactNode;
    className?: string;
    noScroll?: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    title,
    showBackButton,
    headerActions,
    headerCenter,
    sidebar,
    className = '',
    noScroll = false,
}) => {
    return (
        <div className={`h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display flex flex-col ${className}`}>
            <Header
                title={title}
                showBackButton={showBackButton}
                actions={headerActions}
                center={headerCenter}
            />

            <div className="flex-1 flex overflow-hidden">
                {sidebar}
                <main className={`flex-1 flex flex-col ${noScroll ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}>
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
