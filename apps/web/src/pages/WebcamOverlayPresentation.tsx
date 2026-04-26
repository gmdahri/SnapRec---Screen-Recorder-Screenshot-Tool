import React from 'react';
import { NavLink } from 'react-router-dom';
import { LandingNavbar, LandingFooter, AddToChromeButton, SEO } from '../components';

const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'WebPage',
            name: 'Record Presentation with Webcam Overlay — SnapRec',
            description: 'Record your presentation with webcam overlay directly in Chrome. Free screen recorder with picture-in-picture webcam, mic, and system audio. No account needed.',
            url: 'https://www.snaprecorder.org/webcam-overlay-presentation',
        },
        {
            '@type': 'FAQPage',
            mainEntity: [
                {
                    '@type': 'Question',
                    name: 'Can I record my presentation with a webcam overlay in Chrome?',
                    acceptedAnswer: { '@type': 'Answer', text: 'Yes. SnapRec lets you record your screen with a webcam overlay (picture-in-picture) directly from Chrome. No desktop app needed — just install the extension and hit record.' },
                },
                {
                    '@type': 'Question',
                    name: 'Is the webcam overlay free?',
                    acceptedAnswer: { '@type': 'Answer', text: 'Yes. Webcam overlay is included in the free plan with no restrictions, no watermarks, and no time limits.' },
                },
                {
                    '@type': 'Question',
                    name: 'Can I record system audio and microphone at the same time?',
                    acceptedAnswer: { '@type': 'Answer', text: 'Yes. SnapRec mixes system audio and your microphone together, so your presentation audio and your voice are both captured in the recording.' },
                },
                {
                    '@type': 'Question',
                    name: 'What resolution does the webcam overlay recording support?',
                    acceptedAnswer: { '@type': 'Answer', text: 'SnapRec records in up to 4K resolution — screen and webcam — completely free. No upgrade required.' },
                },
            ],
        },
        {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.snaprecorder.org/' },
                { '@type': 'ListItem', position: 2, name: 'Record Presentation with Webcam Overlay' },
            ],
        },
    ],
};

const features = [
    {
        icon: '🎥',
        title: 'Picture-in-picture webcam',
        desc: 'Your webcam appears as a resizable overlay in the corner of the screen recording — just like a professional presenter setup, with zero configuration.',
    },
    {
        icon: '🎤',
        title: 'Mic + system audio together',
        desc: 'SnapRec mixes your microphone voice and system audio (slides, videos, sound effects) into a single clean recording automatically.',
    },
    {
        icon: '4️⃣',
        title: '4K presentation quality',
        desc: 'Record your slides and webcam at up to 4K resolution for free. Your text, charts, and diagrams stay sharp for any viewer.',
    },
    {
        icon: '🔍',
        title: 'Auto-zoom on clicks',
        desc: 'SnapRec automatically zooms into your mouse clicks during playback — your audience always knows what you\'re pointing at, without you having to edit anything.',
    },
    {
        icon: '🔗',
        title: 'Instant shareable link',
        desc: 'When you stop recording, SnapRec generates a shareable link in seconds. Send it via email, Slack, or embed it — no uploading, no waiting.',
    },
    {
        icon: '📸',
        title: 'Full-page screenshots with annotations',
        desc: 'Capture and annotate screenshots of your slides or any content. Add arrows, text, and highlights to make your point crystal clear.',
    },
];

const steps = [
    { n: '1', title: 'Install SnapRec', desc: 'Add SnapRec from the Chrome Web Store in one click. No sign-up, no credit card. Works on Chrome, Edge, and Brave.' },
    { n: '2', title: 'Enable webcam overlay', desc: 'Click the SnapRec icon, enable webcam, choose your screen or tab to share, and hit Record. Your webcam appears as a live overlay.' },
    { n: '3', title: 'Share your recording', desc: 'Stop recording and get an instant shareable link. Send it to your audience or download the MP4 — no account required.' },
];

const faqs = [
    { q: 'Can I record my presentation with a webcam overlay in Chrome?', a: 'Yes. SnapRec lets you record your screen with a webcam overlay (picture-in-picture) directly from Chrome. No desktop app needed — just install the extension and hit record.' },
    { q: 'Is the webcam overlay free?', a: 'Yes. Webcam overlay is included in the free plan with no restrictions, no watermarks, and no time limits.' },
    { q: 'Can I record system audio and microphone at the same time?', a: 'Yes. SnapRec mixes system audio and your microphone together, so your presentation audio and your voice are both captured in the recording.' },
    { q: 'What resolution does the webcam overlay recording support?', a: 'SnapRec records in up to 4K resolution — screen and webcam — completely free. No upgrade required.' },
    { q: 'Do I need an account to start recording?', a: 'No. Install the extension and start recording immediately. Sign in with Google only if you want recordings saved to a permanent cloud library.' },
];

const WebcamOverlayPresentation: React.FC = () => (
    <div className="min-h-screen bg-white text-slate-900 font-display antialiased">
        <SEO
            url="/webcam-overlay-presentation"
            title="Record Presentation with Webcam Overlay — Free Chrome Extension"
            description="Record your presentation with webcam overlay in Chrome for free. Picture-in-picture webcam, mic + system audio, up to 4K, instant shareable link. No watermarks, no account needed."
            keywords="present with webcam overlay, record presentation with webcam overlay, record presentation with webcam, webcam overlay screen recorder, screen recorder webcam overlay chrome, picture in picture screen recorder, record screen with webcam chrome, webcam overlay presentation recording, free webcam overlay screen recorder, record presentation chrome extension, screen recorder with camera overlay"
            jsonLd={jsonLd}
        />
        <LandingNavbar />

        <main>
            {/* Hero */}
            <section className="relative pt-36 pb-16 overflow-hidden">
                <div className="absolute inset-0 -z-10 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/6 rounded-full blur-[120px]" />
                    <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-blue-400/6 rounded-full blur-[100px]" />
                </div>
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200 text-primary text-sm font-bold px-4 py-2 rounded-full mb-8">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Free webcam overlay — No account needed
                    </div>
                    <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
                        Present with Webcam Overlay.
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">
                            Free in Chrome.
                        </span>
                    </h1>
                    <p className="text-lg sm:text-xl text-slate-500 mb-10 leading-relaxed max-w-2xl mx-auto">
                        Record your screen with a live webcam overlay — picture-in-picture, mic + system audio, up to 4K.{' '}
                        <span className="font-semibold text-slate-700">No watermarks, no time limits, no account required.</span>
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
                        <AddToChromeButton size="xl" />
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
                        {['Webcam overlay free', '4K quality', 'Mic + system audio', 'Instant share link'].map((t) => (
                            <span key={t} className="flex items-center gap-1.5">
                                <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                {t}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="py-20 bg-slate-50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl md:text-4xl font-black text-center mb-4">Everything You Need for Webcam Presentations</h2>
                    <p className="text-slate-500 text-center mb-12 max-w-xl mx-auto">One Chrome extension — screen, webcam, audio, and sharing all in one.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((f) => (
                            <div key={f.title} className="bg-white rounded-2xl p-7 border border-slate-100 hover:shadow-md transition-shadow">
                                <div className="text-3xl mb-4">{f.icon}</div>
                                <h3 className="font-black text-slate-900 text-lg mb-2">{f.title}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl md:text-4xl font-black mb-4">Record Your First Webcam Presentation in 60 Seconds</h2>
                    <p className="text-slate-500 mb-14 max-w-xl mx-auto">No setup, no desktop app, no account needed.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {steps.map((s) => (
                            <div key={s.n} className="flex flex-col items-center">
                                <div className="w-12 h-12 rounded-full bg-primary text-white font-black text-lg flex items-center justify-center mb-4 shadow-lg shadow-primary/30">{s.n}</div>
                                <h3 className="font-black text-slate-900 mb-2">{s.title}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-12">
                        <AddToChromeButton size="xl" />
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="py-20 bg-slate-50">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl md:text-4xl font-black text-center mb-12">Frequently Asked Questions</h2>
                    <div className="divide-y divide-slate-100">
                        {faqs.map((f) => (
                            <div key={f.q} className="py-6">
                                <h3 className="font-black text-slate-900 mb-2">{f.q}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">{f.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Related Pages */}
            <section className="py-16">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <p className="text-sm text-slate-500 mb-4">Also looking for a Loom or Screencastify alternative?</p>
                    <div className="flex flex-wrap justify-center gap-4 text-sm">
                        <NavLink to="/loom-alternative" className="text-primary font-semibold hover:underline">Free Loom Alternative →</NavLink>
                        <NavLink to="/screencastify-alternative" className="text-primary font-semibold hover:underline">Free Screencastify Alternative →</NavLink>
                        <NavLink to="/screen-recorder-for-teachers" className="text-primary font-semibold hover:underline">Screen Recorder for Teachers →</NavLink>
                    </div>
                </div>
            </section>

            {/* Bottom CTA */}
            <section className="py-20 bg-slate-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-slate-900 rounded-3xl p-12 md:p-16 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-4 relative">
                            Start recording with webcam overlay — free.
                        </h2>
                        <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
                            No watermarks, no time limits, no account needed. Just install and record.
                        </p>
                        <AddToChromeButton variant="white" size="xl" />
                    </div>
                </div>
            </section>
        </main>

        <LandingFooter />
    </div>
);

export default WebcamOverlayPresentation;
