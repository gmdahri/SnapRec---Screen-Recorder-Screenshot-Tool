import React from 'react';
import { NavLink } from 'react-router-dom';
import { LandingNavbar, LandingFooter, AddToChromeButton, SEO } from '../components';

const Landing: React.FC = () => {
    return (
        <div className="min-h-screen bg-white text-slate-900 font-display">
            <SEO
                url="/"
                title="Free Screen Recorder & Screenshot Tool for Chrome"
                description="SnapRec is a free Chrome extension to record your screen, capture full-page screenshots, annotate, and share via link instantly. No watermarks, no time limits."
                keywords="screen recorder, screenshot tool, chrome extension, screen capture, record screen, free screen recorder, full page screenshot, annotate screenshot, share screen recording"
            />
            <LandingNavbar />

            <main>
                {/* Hero Section */}
                <section className="relative pt-32 pb-20 overflow-hidden">
                    {/* Background Gradients */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
                        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[60%] bg-primary/10 rounded-full blur-[120px]"></div>
                        <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[60%] bg-blue-400/10 rounded-full blur-[120px]"></div>
                    </div>

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <h1 className="text-6xl md:text-8xl font-black tracking-tight leading-[1.1] mb-8">
                            Capture Your Ideas,<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">
                                Share Your Vision
                            </span>
                        </h1>
                        <p className="max-w-2xl mx-auto text-xl text-slate-500 mb-10 leading-relaxed">
                            SnapRec is the effortless screen recording and collaboration platform for teams that move fast. Record, share, and organize in seconds.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                            <AddToChromeButton size="xl" />
                            <div className="flex flex-col sm:flex-row items-center gap-4">
                                <NavLink
                                    to="/login"
                                    className="text-slate-600 hover:text-primary font-bold text-lg px-6 py-4 transition-all"
                                >
                                    Login to Dashboard
                                </NavLink>
                                <button className="flex items-center gap-2 text-slate-400 hover:text-primary font-bold transition-colors">
                                    <span className="material-symbols-outlined">play_circle</span>
                                    Watch how it works
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Bento Grid */}
                <section id="features" className="py-24 bg-slate-50/50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl font-black mb-4">The ultimate tool for creators</h2>
                            <p className="text-slate-500 font-medium">Everything you need to capture and share content professionally.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-[300px]">
                            {/* Feature 1: Large */}
                            <div className="md:col-span-8 bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col justify-between group">
                                <div>
                                    <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform duration-500">
                                        <span className="material-symbols-outlined text-4xl">videocam</span>
                                    </div>
                                    <h3 className="text-2xl font-black mb-3 text-slate-900 leading-tight">Screen Recording</h3>
                                    <p className="text-slate-500 font-medium leading-relaxed max-w-md">
                                        Instantly capture your screen, webcam, and audio with crystal-clear quality. No lag, just seamless recording.
                                    </p>
                                </div>
                                <div className="mt-8 flex gap-2">
                                    <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-500">4K Support</span>
                                    <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-500">Webcam Overlay</span>
                                    <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-500">System Audio</span>
                                </div>
                            </div>

                            {/* Feature 2: Small */}
                            <div className="md:col-span-4 bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col justify-between group">
                                <div className="size-16 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform duration-500">
                                    <span className="material-symbols-outlined text-4xl">cloud_upload</span>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black mb-3 text-slate-900 uppercase tracking-tighter">Cloud Sharing</h3>
                                    <p className="text-slate-400 font-medium text-sm">
                                        Securely upload and share your recordings instantly with a single link.
                                    </p>
                                </div>
                            </div>

                            {/* Feature 3: Small */}
                            <div className="md:col-span-4 bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col group">
                                <div className="size-16 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 mb-6 group-hover:rotate-12 transition-transform duration-500">
                                    <span className="material-symbols-outlined text-4xl">edit_note</span>
                                </div>
                                <h3 className="text-2xl font-black mb-3">Annotation Tools</h3>
                                <p className="text-slate-500 font-medium text-sm">
                                    Draw, highlight, and add text to your screenshots with our powerful editor.
                                </p>
                            </div>

                            {/* Feature 4: Medium */}
                            <div className="md:col-span-8 bg-gradient-to-br from-primary to-purple-600 p-10 rounded-[2.5rem] text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 flex flex-col justify-between">
                                <div className="flex justify-between items-start">
                                    <div className="size-16 rounded-2xl bg-white/20 flex items-center justify-center text-white">
                                        <span className="material-symbols-outlined text-4xl">inventory_2</span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Library Management</p>
                                        <h3 className="text-3xl font-black">Organize Everything</h3>
                                    </div>
                                </div>
                                <p className="font-medium leading-relaxed max-w-lg">
                                    Tag, categorize, and search through your entire video knowledge base. Never lose a valuable screen capture again.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Extension Section */}
                <section id="extension" className="py-24">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="bg-slate-900 rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>

                            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 relative">
                                Take SnapRec everywhere
                            </h2>
                            <p className="text-slate-400 text-lg mb-10 max-w-2xl mx-auto">
                                Install our Chrome extension to capture full-page screenshots and record your screen from any tab with a single click.
                            </p>

                            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                                <AddToChromeButton variant="white" size="lg" />
                                <div className="flex -space-x-3">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="size-10 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center overflow-hidden">
                                            <img src={`https://i.pravatar.cc/100?u=${i}`} alt="user" />
                                        </div>
                                    ))}
                                    <div className="size-10 rounded-full border-2 border-slate-900 bg-primary flex items-center justify-center text-white text-xs font-bold">
                                        +5k
                                    </div>
                                </div>
                            </div>
                            <p className="text-slate-500 text-xs mt-8">Works on Chrome, Edge, and Brave.</p>
                        </div>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="py-24 text-center">
                    <div className="max-w-3xl mx-auto px-4">
                        <h2 className="text-5xl font-black mb-8">Ready to start capturing?</h2>
                        <p className="text-slate-500 text-lg mb-12">
                            Join thousands of creators using SnapRec to document their work and share their ideas faster.
                        </p>
                        <NavLink
                            to="/login"
                            className="inline-block bg-primary hover:bg-primary/90 text-white text-xl font-bold px-12 py-5 rounded-2xl transition-all shadow-xl shadow-primary/30 hover:shadow-2xl hover:-translate-y-1"
                        >
                            Get Started Now — It's Free
                        </NavLink>
                    </div>
                </section>
            </main>

            <LandingFooter />
        </div>
    );
};

export default Landing;
