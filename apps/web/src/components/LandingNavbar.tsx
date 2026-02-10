import React from 'react';
import { NavLink } from 'react-router-dom';
import { Logo } from './Logo';

export const LandingNavbar: React.FC = () => {
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-20">
                    <div className="flex-shrink-0">
                        <Logo size="md" />
                    </div>

                    <div className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-slate-600 hover:text-primary font-medium transition-colors">Features</a>
                        <a href="#extension" className="text-slate-600 hover:text-primary font-medium transition-colors">Extension</a>
                        <a href="#pricing" className="text-slate-600 hover:text-primary font-medium transition-colors">Pricing</a>
                    </div>

                    <div className="flex items-center gap-4">
                        <NavLink to="/login" className="text-slate-600 hover:text-primary font-semibold px-4 py-2 transition-colors">
                            Login
                        </NavLink>
                        <NavLink
                            to="/login"
                            className="bg-primary hover:bg-primary/90 text-white font-bold px-6 py-2.5 rounded-full transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5"
                        >
                            Sign Up
                        </NavLink>
                    </div>
                </div>
            </div>
        </nav>
    );
};
