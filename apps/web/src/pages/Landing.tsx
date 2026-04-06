import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LandingNavbar, LandingFooter, AddToChromeButton, SEO } from '../components';

// ─── Data ────────────────────────────────────────────────────────────────────

const faqs = [
    { q: 'Is SnapRec really free?', a: 'Yes — SnapRec is 100% free with no hidden limits. No watermarks on recordings or screenshots, no time caps, and no mandatory sign-up to start capturing.' },
    { q: 'Does SnapRec work on Edge and Brave?', a: 'Absolutely. SnapRec works on all Chromium-based browsers including Google Chrome, Microsoft Edge, and Brave. Install it from the Chrome Web Store.' },
    { q: 'Can I record with audio and webcam?', a: 'Yes. SnapRec supports system audio, microphone input, and webcam overlay — all at once. Perfect for tutorials, demos, and walkthroughs.' },
    { q: 'Where are my recordings stored?', a: 'Download locally or upload to the cloud for instant link sharing. Your data is stored securely and you can delete it anytime from your dashboard.' },
    { q: 'Do I need to create an account?', a: 'No account needed for basic capturing and downloading. Sign in with Google only when you want cloud sharing, your personal library, or analytics.' },
];

const features = [
    {
        icon: '🎬',
        title: '4K Screen Recording',
        desc: 'Record your entire screen, a single tab, or a window. Add webcam overlay, mic, and system audio. Export as MP4 or save to Google Drive.',
        tags: ['4K', 'Webcam PiP', 'System Audio'],
        color: 'bg-violet-50',
        iconBg: 'bg-primary/10 text-primary',
    },
    {
        icon: '📸',
        title: 'Screenshot Capture',
        desc: 'Capture the full page beyond what\'s visible, select a region, or grab the visible area — all with a single keyboard shortcut.',
        tags: ['Full Page', 'Region', 'Visible Area'],
        color: 'bg-blue-50',
        iconBg: 'bg-blue-100 text-blue-600',
    },
    {
        icon: '✏️',
        title: 'Annotation Editor',
        desc: 'Draw, highlight, blur sensitive info, add arrows and text labels. Everything you need to make your point clearly.',
        tags: ['Blur', 'Arrows', 'Text'],
        color: 'bg-amber-50',
        iconBg: 'bg-amber-100 text-amber-600',
    },
    {
        icon: '🔗',
        title: 'Instant Sharing',
        desc: 'One click generates a shareable link. No account needed for downloads. Sign in to get a permanent cloud library.',
        tags: ['Share Link', 'Cloud', 'Dashboard'],
        color: 'bg-emerald-50',
        iconBg: 'bg-emerald-100 text-emerald-600',
    },
    {
        icon: '🔍',
        title: 'Auto-Zoom',
        desc: 'Automatically zooms in on your clicks during playback. Your recordings look professionally edited without touching a timeline.',
        tags: ['Click Tracking', 'Cinematic', 'Zero Editing'],
        color: 'bg-rose-50',
        iconBg: 'bg-rose-100 text-rose-600',
    },
    {
        icon: '⌨️',
        title: 'Keyboard Shortcuts',
        desc: 'Trigger any capture instantly with Ctrl/Cmd + Shift + 1–4. Never break your flow to open a menu.',
        tags: ['Ctrl+Shift+1', 'Ctrl+Shift+4', 'Customizable'],
        color: 'bg-slate-50',
        iconBg: 'bg-slate-200 text-slate-600',
    },
];

const steps = [
    { n: '1', title: 'Install in 10 seconds', desc: 'Click "Add to Chrome" — no sign-up, no credit card, nothing to configure.' },
    { n: '2', title: 'Capture or record', desc: 'Press a shortcut or click the extension icon. Screenshot or start recording instantly.' },
    { n: '3', title: 'Share with a link', desc: 'Download locally or get a shareable link in one click. Done.' },
];

const comparison = [
    { feature: 'Free forever', snaprec: true,  loom: false, screencastify: false },
    { feature: 'No watermarks', snaprec: true, loom: false, screencastify: false },
    { feature: 'No time limit',  snaprec: true, loom: false, screencastify: false },
    { feature: 'No account needed', snaprec: true, loom: false, screencastify: false },
    { feature: '4K recording',   snaprec: true, loom: false, screencastify: false },
    { feature: 'Full-page screenshot', snaprec: true, loom: false, screencastify: true },
    { feature: 'Annotation editor',    snaprec: true, loom: false, screencastify: true },
    { feature: 'Auto-zoom on clicks',  snaprec: true, loom: false, screencastify: false },
    { feature: 'Webcam overlay',       snaprec: true, loom: true,  screencastify: true },
    { feature: 'Cloud sharing',        snaprec: true, loom: true,  screencastify: true },
];

const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'SoftwareApplication',
            name: 'SnapRec',
            alternateName: ['SnapRec Screen Recorder', 'SnapRec Screenshot Tool', 'Snap Recorder'],
            applicationCategory: 'BrowserApplication',
            applicationSubCategory: 'Screen Recorder',
            operatingSystem: 'Chrome, Edge, Brave',
            browserRequirements: 'Requires a Chromium-based browser (Chrome, Edge, Brave)',
            softwareVersion: '1.3.0',
            url: 'https://www.snaprecorder.org',
            downloadUrl: 'https://chromewebstore.google.com/detail/screen-recorder-screensho/lgafjgnifbjeafallnkkfpljgbilfajg',
            description: 'Free screen recorder & screenshot tool for Chrome. Record your screen in 4K with audio & webcam, capture full-page screenshots, annotate, and share via link instantly. No watermarks, no time limits.',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
            featureList: ['Free screen recorder with 4K support', 'Screen recording with webcam overlay and audio', 'Full-page screenshot capture', 'Visible area and region screenshot capture', 'Built-in screenshot annotation editor', 'Cloud sharing via instant link', 'No watermarks or time limits', 'Auto-zoom on mouse clicks', 'Works on Chrome, Edge, and Brave browsers'],
        },
        { '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        { '@type': 'WebSite', name: 'SnapRec', url: 'https://www.snaprecorder.org', description: 'Free screen recorder & screenshot tool for Chrome, Edge & Brave.' },
        {
            '@type': 'Organization',
            name: 'SnapRec',
            url: 'https://www.snaprecorder.org',
            logo: 'https://www.snaprecorder.org/logo.png',
            sameAs: ['https://github.com/gmdahri/SnapRec---Screen-Recorder-Screenshot-Tool', 'https://www.producthunt.com/products/snap-recorder', 'https://chromewebstore.google.com/detail/screen-recorder-screensho/lgafjgnifbjeafallnkkfpljgbilfajg'],
            contactPoint: { '@type': 'ContactPoint', email: 'support@snaprec.com', contactType: 'customer support' },
        },
        {
            '@type': 'VideoObject',
            name: 'How to use SnapRec - Screen recorder & screenshot tool',
            description: 'Learn how to record your screen in 4K, capture full-page screenshots, annotate, and share — all free with SnapRec.',
            thumbnailUrl: 'https://img.youtube.com/vi/tEY5kA97Zq8/maxresdefault.jpg',
            uploadDate: '2026-02-01T08:00:00+08:00',
            contentUrl: 'https://www.youtube.com/watch?v=tEY5kA97Zq8',
            embedUrl: 'https://www.youtube.com/embed/tEY5kA97Zq8',
            duration: 'PT1M30S',
            publisher: { '@type': 'Organization', name: 'SnapRec' },
        },
    ],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Check = () => (
    <svg className="w-5 h-5 text-emerald-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
);

const Cross = () => (
    <svg className="w-5 h-5 text-slate-300 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);

const FAQItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-slate-100 last:border-b-0">
            <button onClick={() => setOpen(!open)} className="w-full flex justify-between items-center py-5 text-left group cursor-pointer gap-4">
                <span className="text-base font-bold text-slate-900 group-hover:text-primary transition-colors">{q}</span>
                <span className={`text-slate-400 group-hover:text-primary transition-all duration-300 shrink-0 text-xl ${open ? 'rotate-45' : ''}`}>+</span>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-48 pb-5' : 'max-h-0'}`}>
                <p className="text-slate-500 leading-relaxed text-sm">{a}</p>
            </div>
        </div>
    );
};

/** CSS browser frame mockup — no real screenshots needed */
function BrowserMockup() {
    return (
        <div className="relative w-full max-w-5xl mx-auto mt-16 px-4">
            {/* Ambient glow */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-primary/10 to-transparent blur-3xl pointer-events-none" />

            <div className="relative rounded-2xl overflow-hidden ring-1 ring-slate-200 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.18)] bg-white">
                {/* Browser chrome */}
                <div className="bg-[#f1f3f4] border-b border-slate-200 px-4 py-3 flex items-center gap-3">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                        <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                        <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                    </div>
                    <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-slate-400 border border-slate-200 flex items-center gap-1.5 max-w-sm mx-auto">
                        <svg className="w-3 h-3 text-slate-300" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                        snaprecorder.org/dashboard
                    </div>
                    {/* Extension icon in toolbar */}
                    <div className="ml-auto flex items-center gap-1.5">
                        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-sm">
                            <img src="/logo.png" alt="SnapRec" className="w-5 h-5 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                        </div>
                    </div>
                </div>

                {/* Browser body */}
                <div className="relative bg-slate-50 flex" style={{ minHeight: 380 }}>
                    {/* Fake page content */}
                    <div className="flex-1 p-8 space-y-4 opacity-40">
                        <div className="h-4 bg-slate-300 rounded w-1/3" />
                        <div className="h-3 bg-slate-200 rounded w-2/3" />
                        <div className="h-3 bg-slate-200 rounded w-1/2" />
                        <div className="mt-6 grid grid-cols-3 gap-3">
                            {[1,2,3].map(i => (
                                <div key={i} className="h-28 bg-slate-200 rounded-xl" />
                            ))}
                        </div>
                        <div className="h-3 bg-slate-200 rounded w-3/4" />
                        <div className="h-3 bg-slate-200 rounded w-1/2" />
                    </div>

                    {/* Recording indicator badge */}
                    <div className="absolute top-5 left-8 flex items-center gap-2 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        REC 0:12
                    </div>

                    {/* Extension popup */}
                    <div className="absolute top-4 right-4 w-64 bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 overflow-hidden text-left">
                        {/* Popup header */}
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                                    <span className="text-white text-xs font-black">S</span>
                                </div>
                                <span className="font-bold text-sm text-slate-900">SnapRec</span>
                            </div>
                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-sm">⚙</div>
                        </div>
                        {/* Mode toggle */}
                        <div className="px-3 py-2.5 flex gap-1.5">
                            <div className="flex-1 py-1.5 rounded-xl bg-primary text-white text-xs font-bold text-center">Screenshot</div>
                            <div className="flex-1 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-xs font-bold text-center">Record</div>
                        </div>
                        {/* Actions */}
                        <div className="px-3 pb-3 space-y-1">
                            {[
                                { label: 'Visible Area', sub: 'Capture what you see', emoji: '🖥' },
                                { label: 'Full Page', sub: 'Scroll & capture entire page', emoji: '📄' },
                                { label: 'Select Region', sub: 'Draw to select area', emoji: '✂️' },
                            ].map((action) => (
                                <div key={action.label} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100 transition-colors">
                                    <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center text-base shrink-0">{action.emoji}</div>
                                    <div className="min-w-0">
                                        <div className="text-xs font-semibold text-slate-800 truncate">{action.label}</div>
                                        <div className="text-[10px] text-slate-400 truncate">{action.sub}</div>
                                    </div>
                                    <span className="ml-auto text-slate-300 text-sm">›</span>
                                </div>
                            ))}
                        </div>
                        {/* Keyboard hint */}
                        <div className="px-3 pb-3">
                            <div className="bg-slate-50 rounded-xl px-3 py-2 text-[10px] text-slate-400 flex justify-between">
                                <span>Full page</span><span className="font-mono font-bold text-slate-500">⌘⇧1</span>
                            </div>
                        </div>
                    </div>

                    {/* Webcam PiP bubble */}
                    <div className="absolute bottom-5 left-8 w-20 h-20 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 ring-4 ring-white shadow-lg flex items-center justify-center text-2xl">
                        😊
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const Landing: React.FC = () => {
    return (
        <div className="min-h-screen bg-white text-slate-900 font-display antialiased">
            <SEO
                url="/"
                title="Free Screen Recorder for Chrome — No Watermarks, 4K"
                description="Record your screen in 4K with one click. Free Chrome extension — no watermarks, no time limits. Full-page screenshots, webcam overlay, instant share. Try SnapRec free."
                keywords="free screen recorder, screen recorder chrome, chrome screen recorder, free screen recorder chrome extension, screen recorder no watermark, 4k screen recorder, screen recorder extension, screenshot tool chrome, full page screenshot, screen capture chrome, auto zoom screen recorder, loom alternative free"
                jsonLd={jsonLd}
            />
            <LandingNavbar />

            <main>
                {/* ── Hero ─────────────────────────────────────────────── */}
                <section className="relative pt-36 pb-8 overflow-hidden">
                    <div className="absolute inset-0 -z-10 pointer-events-none">
                        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/6 rounded-full blur-[120px]" />
                        <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-blue-400/6 rounded-full blur-[100px]" />
                    </div>

                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200 text-primary text-sm font-bold px-4 py-2 rounded-full mb-8">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            Free Chrome Extension — No account needed
                        </div>

                        {/* Headline */}
                        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
                            Record your screen.
                            <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">
                                Share a link.
                            </span>
                        </h1>

                        {/* Subheadline */}
                        <p className="hero-description text-lg sm:text-xl text-slate-500 mb-10 leading-relaxed max-w-2xl mx-auto">
                            Free Chrome extension — 4K recording, webcam overlay, full-page screenshots, annotations, and instant sharing.
                            <span className="font-semibold text-slate-700"> No watermarks. No account.</span>
                        </p>

                        {/* CTAs */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
                            <AddToChromeButton size="xl" />
                            <NavLink
                                to="/how-it-works"
                                className="flex items-center gap-2.5 text-slate-600 hover:text-primary font-semibold text-lg px-6 py-4 transition-colors group"
                            >
                                <span className="w-9 h-9 rounded-full border-2 border-slate-300 group-hover:border-primary flex items-center justify-center transition-colors">
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 translate-x-0.5">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                </span>
                                Watch demo
                            </NavLink>
                        </div>

                        {/* Browser logos */}
                        <div className="flex items-center justify-center gap-6 text-xs text-slate-400 font-medium">
                            <span className="flex items-center gap-1.5">
                                <img src="https://www.google.com/chrome/static/images/chrome-logo.svg" alt="Chrome" className="w-4 h-4" />
                                Chrome
                            </span>
                            <span className="text-slate-200">·</span>
                            <span className="flex items-center gap-1.5">
                                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#0078d4]"><path d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z"/></svg>
                                Edge
                            </span>
                            <span className="text-slate-200">·</span>
                            <span className="flex items-center gap-1.5">
                                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#fb542b]"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2a10 10 0 110 20A10 10 0 0112 2z"/></svg>
                                Brave
                            </span>
                        </div>
                    </div>

                    {/* Product mockup */}
                    <BrowserMockup />
                </section>

                {/* ── Trust strip ──────────────────────────────────────── */}
                <section className="py-12 border-y border-slate-100 bg-slate-50/50 mt-16">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
                            {[
                                { icon: '🆓', text: '100% free forever' },
                                { icon: '🚫', text: 'No watermarks' },
                                { icon: '♾️', text: 'Unlimited recordings' },
                                { icon: '🔒', text: 'No account required' },
                                { icon: '🔗', text: 'Share with one link' },
                            ].map(({ icon, text }) => (
                                <div key={text} className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                                    <span>{icon}</span>
                                    <span>{text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── How it works ─────────────────────────────────────── */}
                <section className="py-24">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-14">
                            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">How it works</p>
                            <h2 className="text-3xl md:text-4xl font-black text-slate-900">Up and running in 30 seconds</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {steps.map((s) => (
                                <div key={s.n} className="relative text-center">
                                    <div className="w-12 h-12 rounded-2xl bg-primary text-white font-black text-xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/25">
                                        {s.n}
                                    </div>
                                    <h3 className="font-black text-slate-900 mb-2">{s.title}</h3>
                                    <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Features ─────────────────────────────────────────── */}
                <section id="features" className="py-24 bg-slate-50/60">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-14">
                            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Features</p>
                            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
                                Everything in one extension
                            </h2>
                            <p className="text-slate-500 max-w-xl mx-auto">
                                No separate tools. No paid upgrades. SnapRec does it all.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {features.map((f) => (
                                <div key={f.title} className={`${f.color} rounded-3xl p-7 border border-white hover:shadow-lg transition-shadow duration-300`}>
                                    <div className={`w-12 h-12 rounded-2xl ${f.iconBg} flex items-center justify-center text-2xl mb-5`}>
                                        {f.icon}
                                    </div>
                                    <h3 className="font-black text-slate-900 text-lg mb-2">{f.title}</h3>
                                    <p className="text-slate-500 text-sm leading-relaxed mb-4">{f.desc}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {f.tags.map((t) => (
                                            <span key={t} className="text-[11px] font-bold text-slate-500 bg-white/80 px-2.5 py-1 rounded-full border border-slate-200">
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Video demo ───────────────────────────────────────── */}
                <section className="py-24">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-10">
                            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">See it in action</p>
                            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3">
                                Record, annotate, share — in under a minute
                            </h2>
                        </div>
                        <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-slate-200 aspect-video bg-slate-900">
                            <iframe
                                src="https://www.youtube.com/embed/tEY5kA97Zq8?start=2"
                                title="How to use SnapRec - Screen recorder & screenshot tool"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                className="absolute inset-0 w-full h-full"
                            />
                        </div>
                        <p className="text-center text-slate-400 text-sm mt-5">
                            <NavLink to="/how-it-works" className="text-primary font-semibold hover:underline">
                                Full step-by-step guide →
                            </NavLink>
                        </p>
                    </div>
                </section>

                {/* ── Comparison table ─────────────────────────────────── */}
                <section className="py-24 bg-slate-50/60">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-12">
                            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Comparison</p>
                            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
                                Why SnapRec?
                            </h2>
                            <p className="text-slate-500">See how SnapRec stacks up against the most popular alternatives.</p>
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="text-left px-6 py-4 text-slate-500 font-semibold w-1/2">Feature</th>
                                        <th className="px-4 py-4 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="font-black text-primary">SnapRec</span>
                                                <span className="text-[10px] text-emerald-500 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">Free</span>
                                            </div>
                                        </th>
                                        <th className="px-4 py-4 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="font-semibold text-slate-600">Loom</span>
                                                <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-full">Freemium</span>
                                            </div>
                                        </th>
                                        <th className="px-4 py-4 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="font-semibold text-slate-600">Screencastify</span>
                                                <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-full">Freemium</span>
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comparison.map((row, i) => (
                                        <tr key={row.feature} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                                            <td className="px-6 py-3.5 text-slate-700 font-medium">{row.feature}</td>
                                            <td className="px-4 py-3.5 text-center"><div className="flex justify-center">{row.snaprec ? <Check /> : <Cross />}</div></td>
                                            <td className="px-4 py-3.5 text-center"><div className="flex justify-center">{row.loom ? <Check /> : <Cross />}</div></td>
                                            <td className="px-4 py-3.5 text-center"><div className="flex justify-center">{row.screencastify ? <Check /> : <Cross />}</div></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-center text-xs text-slate-400 mt-4">
                            Based on free plan features as of 2026.{' '}
                            <NavLink to="/blog" className="text-primary hover:underline">Read our comparisons →</NavLink>
                        </p>
                    </div>
                </section>

                {/* ── Product Hunt badge + Install CTA ─────────────────── */}
                <section className="py-24">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="bg-slate-900 rounded-[2.5rem] p-12 md:p-20 text-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                            <div className="relative">
                                <a
                                    href="https://www.producthunt.com/products/snap-recorder?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-snap-recorder"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block mb-8 hover:opacity-90 transition-opacity"
                                >
                                    <img
                                        src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1083910&theme=dark&t=1771930696147"
                                        alt="Snap Recorder on Product Hunt"
                                        width="220"
                                        height="48"
                                        className="mx-auto"
                                    />
                                </a>

                                <h2 className="text-4xl md:text-5xl font-black text-white mb-5 leading-tight">
                                    Start recording in<br />30 seconds.
                                </h2>
                                <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
                                    Install the extension, click the icon, and you're recording. It really is that simple.
                                </p>

                                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                    <AddToChromeButton variant="white" size="lg" />
                                    <div className="flex items-center gap-4 text-sm text-slate-400">
                                        <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> Free forever</span>
                                        <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> No watermarks</span>
                                        <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> No sign-up</span>
                                    </div>
                                </div>

                                <p className="text-slate-600 text-xs mt-8">Chrome · Edge · Brave</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── FAQ ──────────────────────────────────────────────── */}
                <section id="faq" className="py-24 bg-slate-50/60">
                    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-12">
                            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">FAQ</p>
                            <h2 className="text-3xl md:text-4xl font-black text-slate-900">Common questions</h2>
                        </div>
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm px-6 md:px-10 py-2">
                            {faqs.map((faq, idx) => (
                                <FAQItem key={idx} q={faq.q} a={faq.a} />
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Final CTA ────────────────────────────────────────── */}
                <section className="py-24 text-center">
                    <div className="max-w-2xl mx-auto px-4">
                        <h2 className="text-4xl md:text-5xl font-black mb-5 leading-tight">
                            The screen recorder<br />you've been looking for.
                        </h2>
                        <p className="text-slate-500 text-lg mb-10">
                            Free. No watermarks. Works on Chrome, Edge, and Brave.
                        </p>
                        <AddToChromeButton size="xl" className="mx-auto" />
                    </div>
                </section>
            </main>

            <LandingFooter />
        </div>
    );
};

export default Landing;
