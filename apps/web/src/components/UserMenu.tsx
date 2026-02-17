import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { NavLink } from 'react-router-dom';

interface UserMenuProps {
    onSignIn?: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ onSignIn }) => {
    const { user, signOut } = useAuth();
    const [showMenu, setShowMenu] = useState(false);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setShowMenu(false);
        if (showMenu) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [showMenu]);

    if (!user) {
        return (
            <button
                onClick={onSignIn}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
                <span className="material-symbols-outlined text-[18px]">login</span>
                <span>Sign In</span>
            </button>
        );
    }

    return (
        <div className="relative">
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                }}
                className="size-9 rounded-full border-2 border-primary/20 overflow-hidden bg-primary/10 flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors"
            >
                {user?.user_metadata?.avatar_url ? (
                    <img
                        className="w-full h-full object-cover"
                        alt="User"
                        src={user.user_metadata.avatar_url}
                    />
                ) : (
                    <span className="material-symbols-outlined text-primary text-xl">person</span>
                )}
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
                <div className="absolute right-0 top-12 w-64 bg-white dark:bg-[#1c142b] rounded-xl shadow-xl border border-[#ece7f4] dark:border-[#2d2245] overflow-hidden z-50">
                    <div className="p-4 border-b border-[#ece7f4] dark:border-[#2d2245]">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-full overflow-hidden bg-primary/10 flex-shrink-0">
                                {user?.user_metadata?.avatar_url ? (
                                    <img
                                        className="w-full h-full object-cover"
                                        alt="User"
                                        src={user.user_metadata.avatar_url}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <span className="material-symbols-outlined text-primary">person</span>
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                    {user?.user_metadata?.full_name || 'User'}
                                </p>
                                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-2 flex flex-col gap-1">
                        <NavLink
                            to="/settings"
                            onClick={() => setShowMenu(false)}
                            className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <span className="material-symbols-outlined text-[20px]">settings</span>
                            <span>Settings</span>
                        </NavLink>
                        <div className="h-[1px] bg-[#ece7f4] dark:bg-[#2d2245] my-1 mx-2"></div>
                        <button
                            onClick={() => {
                                signOut();
                                setShowMenu(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-[20px]">logout</span>
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserMenu;
