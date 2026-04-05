import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LandingNavbar, LandingFooter, AddToChromeButton, SEO } from '../components';

const faqs = [
    {
        q: 'Is SnapRec really free?',
        a: 'Yes — SnapRec is 100% free with no hidden limits. There are no watermarks on your recordings or screenshots, no time caps on recordings, and no mandatory sign-up to start capturing.',
    },
    {
        q: 'Does SnapRec work on Edge and Brave?',
        a: 'Absolutely. SnapRec works on all Chromium-based browsers including Google Chrome, Microsoft Edge, and Brave. Just install it from the Chrome Web Store.',
    },
    {
        q: 'Can I record with audio and webcam?',
        a: 'Yes. SnapRec supports system audio, microphone input, and webcam overlay — all at the same time. Perfect for tutorials, demos, and walkthroughs.',
    },
    {
        q: 'Where are my recordings stored?',
        a: 'You can download captures locally or upload them to the cloud for instant link sharing. Your data is stored securely and you can delete it anytime from your dashboard.',
    },
    {
        q: 'Do I need to create an account?',
        a: 'No account is needed for basic capturing and downloading. Sign in with Google only when you want cloud sharing, your personal library, or analytics.',
    },
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
            softwareVersion: '1.2.3',
            url: 'https://www.snaprecorder.org',
            downloadUrl: 'https://chromewebstore.google.com/detail/snaprec-screen-recorder-s/lgafjgnifbjeafallnkkfpljgbilfajg',
            description:
                'Free screen recorder & screenshot tool for Chrome. Record your screen in 4K with audio & webcam, capture full-page screenshots, annotate, and share via link instantly. No watermarks, no time limits.',
            offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
                availability: 'https://schema.org/InStock',
            },
            featureList: [
                'Free screen recorder with 4K support',
                'Screen recording with webcam overlay and audio',
                'Full-page screenshot capture',
                'Visible area and region screenshot capture',
                'Built-in screenshot annotation editor',
                'Cloud sharing via instant link',
                'No watermarks or time limits',
                'Works on Chrome, Edge, and Brave browsers',
                'Screen recorder Chrome extension',
                'Screenshot Chrome extension',
            ],
            speakable: {
                '@type': 'SpeakableSpecification',
                cssSelector: ['h1', '.hero-description', '#faq'],
            },
        },
        {
            '@type': 'FAQPage',
            mainEntity: faqs.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: f.a,
                },
            })),
        },
        {
            '@type': 'WebSite',
            name: 'SnapRec',
            url: 'https://www.snaprecorder.org',
            description: 'Free screen recorder & screenshot tool for Chrome, Edge & Brave.',
        },
        {
            '@type': 'Organization',
            name: 'SnapRec',
            url: 'https://www.snaprecorder.org',
            logo: 'https://www.snaprecorder.org/logo.png',
            sameAs: [
                'https://github.com/gmdahri/SnapRec---Screen-Recorder-Screenshot-Tool',
                'https://www.producthunt.com/products/snap-recorder',
                'https://chromewebstore.google.com/detail/snaprec-screen-recorder-s/lgafjgnifbjeafallnkkfpljgbilfajg',
            ],
            description: 'Free screen recorder & screenshot tool for Chrome, Edge & Brave.',
            contactPoint: {
                '@type': 'ContactPoint',
                email: 'support@snaprec.com',
                contactType: 'customer support',
            },
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

const FAQItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-slate-200 last:border-b-0">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex justify-between items-center py-6 text-left group cursor-pointer"
            >
                <span className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors pr-4">
                    {q}
                </span>
                <span
                    className={`material-symbols-outlined text-slate-400 group-hover:text-primary transition-all duration-300 flex-shrink-0 ${open ? 'rotate-180' : ''
                        }`}
                >
                    expand_more
                </span>
            </button>
            <div
                className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-60 pb-6' : 'max-h-0'
                    }`}
            >
                <p className="text-slate-500 leading-relaxed">{a}</p>
            </div>
        </div>
    );
};

const Landing: React.FC = () => {
    return (
        <div className="min-h-screen bg-white text-slate-900 font-display">
            <SEO
                url="/"
                title="Free Screen Recorder for Chrome — No Watermarks, 4K"
                description="Record your screen in 4K with one click. Free Chrome extension — no watermarks, no time limits. Full-page screenshots, webcam overlay, instant share. Try SnapRec free."
                keywords="free screen recorder, screen recorder chrome, chrome screen recorder, free screen recorder chrome extension, screen recorder no watermark, 4k screen recorder, screen recorder extension, screenshot tool chrome, full page screenshot, screen capture chrome, auto zoom screen recorder, cinematic screen recording, screen recorder for youtube, how to record gameplay on pc, screen recorder for gaming, record zoom meeting free, tutorial video maker free, screen recorder for teachers, software demo recorder, loom alternative free, free alternative to loom, best screen recorder without watermark, top free screen recorders for pc, best screenshot annotation tool"
                jsonLd={jsonLd}
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

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
                        <a href="https://www.producthunt.com/products/snap-recorder?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-snap-recorder" target="_blank" rel="noopener noreferrer" className="mb-8 inline-block transform hover:scale-105 transition-transform duration-300">
                            <img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1083910&theme=light&t=1771930696147" alt="Snap Recorder - Free screen recorder & screenshot tool | Product Hunt" style={{ width: '250px', height: '54px' }} width="250" height="54" />
                        </a>
                        <h1 className="text-6xl md:text-8xl font-black tracking-tight leading-[1.1] mb-8">
                            Capture Your Ideas,<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">
                                Share Your Vision
                            </span>
                        </h1>
                        <p className="hero-description max-w-2xl mx-auto text-xl text-slate-500 mb-10 leading-relaxed">
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
                                <NavLink
                                    to="/how-it-works"
                                    className="flex items-center gap-2 text-slate-400 hover:text-primary font-bold transition-colors"
                                >
                                    <span className="material-symbols-outlined">play_circle</span>
                                    Watch how it works
                                </NavLink>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Trust Strip */}
                <section className="py-10 border-y border-slate-100">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-3xl">lock_open</span>
                                <p className="text-slate-700 font-semibold text-sm">No account required</p>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-3xl">money_off</span>
                                <p className="text-slate-700 font-semibold text-sm">100% free, no watermarks</p>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-3xl">all_inclusive</span>
                                <p className="text-slate-700 font-semibold text-sm">Unlimited recordings</p>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-3xl">link</span>
                                <p className="text-slate-700 font-semibold text-sm">Share with one link</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* How it works — Video */}
                <section className="py-20">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-10">
                            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3">
                                See SnapRec in action
                            </h2>
                            <p className="text-slate-500 font-medium">
                                Watch how to record your screen, capture screenshots, and share in under a minute.
                            </p>
                        </div>
                        <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-xl bg-slate-900 aspect-video">
                            <iframe
                                src="https://www.youtube.com/embed/tEY5kA97Zq8?start=2"
                                title="How to use SnapRec - Screen recorder & screenshot tool"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                className="absolute inset-0 w-full h-full"
                            />
                        </div>
                        <p className="text-center text-slate-500 text-sm mt-4">
                            <NavLink to="/how-it-works" className="text-primary font-semibold hover:underline">
                                Step-by-step guide →
                            </NavLink>
                        </p>
                    </div>
                </section>

                {/* Features Bento Grid */}
                <section id="features" className="py-24 bg-slate-50/50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl font-black mb-4">The Ultimate Free Screen Recorder & Screenshot Tool</h2>
                            <p className="text-slate-500 font-medium">Everything you need to record your screen in 4K, capture screenshots, and share content professionally.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-[300px]">
                            {/* Feature 1: Large */}
                            <div className="md:col-span-8 bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col justify-between group">
                                <div>
                                    <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform duration-500">
                                        <span className="material-symbols-outlined text-4xl">videocam</span>
                                    </div>
                                    <h3 className="text-2xl font-black mb-3 text-slate-900 leading-tight">Free Screen Recording in 4K</h3>
                                    <p className="text-slate-500 font-medium leading-relaxed max-w-md">
                                        Record your screen in 4K with webcam overlay and system audio. No watermarks, no time limits — just seamless, crystal-clear recording.
                                    </p>
                                </div>
                                <div className="mt-8 flex gap-2">
                                    <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-500">4K Screen Recorder</span>
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
                                <h3 className="text-2xl font-black mb-3">Screenshot Annotation Tools</h3>
                                <p className="text-slate-500 font-medium text-sm">
                                    Draw, highlight, blur, and add text to your screenshots with our powerful built-in editor.
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

                            {/* Feature 5: New Auto-Zoom */}
                            <div className="md:col-span-12 bg-slate-900 text-white p-10 rounded-[2.5rem] shadow-2xl hover:shadow-3xl transition-all duration-500 flex flex-col md:flex-row justify-between items-center gap-12 group overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/30 transition-colors duration-700"></div>
                                <div className="w-full md:w-1/2 relative z-10">
                                    <div className="inline-block px-4 py-1.5 bg-primary/20 text-primary-light font-bold text-xs rounded-full uppercase tracking-widest mb-6 border border-primary/30">Just Released</div>
                                    <h3 className="text-3xl md:text-4xl font-black mb-5 tracking-tight">AI-Powered Auto-Zoom</h3>
                                    <p className="text-slate-300 font-medium leading-relaxed text-lg mb-6">
                                        Stop wasting hours editing your tutorials. SnapRec intelligently tracks your mouse interactions while recording and automatically scales and pans the camera directly to your clicks. 
                                    </p>
                                    <p className="text-slate-400 font-medium text-sm">
                                        Get cinematic, highly-produced videos instantly in your browser — zero editing skills required.
                                    </p>
                                </div>
                                <div className="w-full md:w-1/2 flex justify-center relative z-10">
                                    <div className="size-48 rounded-full border border-primary/20 bg-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-700 shadow-[0_0_80px_rgba(124,58,237,0.3)] backdrop-blur-xl">
                                        <span className="material-symbols-outlined text-[80px] text-primary group-hover:animate-pulse">center_focus_strong</span>
                                    </div>
                                </div>
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
                                Install our free screen recorder & screenshot Chrome extension to capture full-page screenshots and record your screen from any tab with a single click.
                            </p>

                            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                                <AddToChromeButton variant="white" size="lg" />
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5 text-emerald-400">
                                        <span className="material-symbols-outlined text-xl">verified</span>
                                        <span className="text-sm font-bold text-slate-300">Free forever</span>
                                    </div>
                                    <span className="text-slate-700">|</span>
                                    <div className="flex items-center gap-1.5 text-amber-400">
                                        <span className="material-symbols-outlined text-xl">star</span>
                                        <span className="text-sm font-bold text-slate-300">No watermarks</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-slate-500 text-xs mt-8">Works on Chrome, Edge, and Brave.</p>
                        </div>
                    </div>
                </section>

                {/* FAQ Section */}
                <section id="faq" className="py-24 bg-slate-50/50">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-14">
                            <h2 className="text-4xl font-black mb-4">Frequently Asked Questions</h2>
                            <p className="text-slate-500 font-medium">
                                Everything you need to know about SnapRec.
                            </p>
                        </div>
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-10">
                            {faqs.map((faq, idx) => (
                                <FAQItem key={idx} q={faq.q} a={faq.a} />
                            ))}
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
