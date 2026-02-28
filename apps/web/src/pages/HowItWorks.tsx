import React from 'react';
import { NavLink } from 'react-router-dom';
import { LandingNavbar, LandingFooter, AddToChromeButton, SEO } from '../components';

const steps = [
    {
        number: '01',
        icon: 'download',
        title: 'Install the Extension',
        description:
            'Add SnapRec to Chrome, Edge, or Brave in one click — free, no sign-up required. The extension icon appears in your toolbar instantly.',
        color: 'from-primary to-violet-600',
        bgColor: 'bg-primary/10',
        iconColor: 'text-primary',
    },
    {
        number: '02',
        icon: 'screenshot_monitor',
        title: 'Capture or Record',
        description:
            'Click the SnapRec icon and choose your action: full-page screenshot, visible area, selected region, or screen recording with webcam and audio.',
        color: 'from-blue-500 to-cyan-500',
        bgColor: 'bg-blue-100',
        iconColor: 'text-blue-600',
    },
    {
        number: '03',
        icon: 'edit_note',
        title: 'Annotate & Edit',
        description:
            'Open your capture in the built-in editor. Draw arrows, add text, highlight areas, blur sensitive info — everything you need to communicate visually.',
        color: 'from-amber-500 to-orange-500',
        bgColor: 'bg-amber-100',
        iconColor: 'text-amber-600',
    },
    {
        number: '04',
        icon: 'share',
        title: 'Share Instantly',
        description:
            'Generate a shareable link with one click, or download your capture locally. Share via Slack, email, or any platform — no file size limits.',
        color: 'from-emerald-500 to-teal-500',
        bgColor: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
    },
];

const useCases = [
    {
        icon: 'bug_report',
        title: 'Bug Reports',
        description: 'Capture exactly what went wrong with annotated screenshots and screen recordings.',
    },
    {
        icon: 'school',
        title: 'Tutorials & Demos',
        description: 'Record step-by-step walkthroughs with webcam overlay and audio narration.',
    },
    {
        icon: 'design_services',
        title: 'Design Feedback',
        description: 'Annotate designs with arrows, text, and highlights to give precise visual feedback.',
    },
    {
        icon: 'support_agent',
        title: 'Customer Support',
        description: 'Show customers how to solve issues with quick screen recordings instead of long text.',
    },
];

const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Record Your Screen & Take Screenshots in Chrome',
    description:
        'Learn how to use SnapRec to record your screen in 4K, capture full-page screenshots, annotate images, and share via link — all free, no watermarks.',
    totalTime: 'PT1M',
    tool: {
        '@type': 'HowToTool',
        name: 'SnapRec Chrome Extension',
    },
    step: steps.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: s.title,
        text: s.description,
    })),
};

const HowItWorks: React.FC = () => {
    return (
        <div className="min-h-screen bg-white text-slate-900 font-display">
            <SEO
                url="/how-it-works"
                title="How to Record Your Screen & Take Screenshots in Chrome"
                description="Learn how to use SnapRec to record your screen in 4K, capture full-page screenshots, annotate images, and share via link — all free, no watermarks, in Chrome, Edge, or Brave."
                keywords="how to record screen chrome, how to take full page screenshot, screen recording tutorial, chrome screenshot extension, how to capture screen, free screen recorder chrome, 4k screen recorder free, screen capture tool, chrome screen recorder extension, best screenshot extension, screen recorder extension free"
                jsonLd={howToJsonLd}
            />
            <LandingNavbar />

            <main>
                {/* Hero */}
                <section className="relative pt-32 pb-16 overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
                        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[60%] bg-blue-400/10 rounded-full blur-[120px]" />
                        <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[60%] bg-primary/10 rounded-full blur-[120px]" />
                    </div>

                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] mb-6">
                            How{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">
                                SnapRec
                            </span>{' '}
                            Works
                        </h1>
                        <p className="max-w-2xl mx-auto text-xl text-slate-500 leading-relaxed">
                            From install to share in under 60 seconds. No accounts, no watermarks, no limits.
                        </p>
                    </div>
                </section>

                {/* Steps */}
                <section className="py-20">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="space-y-8">
                            {steps.map((step, idx) => (
                                <div
                                    key={idx}
                                    className={`flex flex-col md:flex-row items-center gap-8 md:gap-12 ${idx % 2 !== 0 ? 'md:flex-row-reverse' : ''
                                        }`}
                                >
                                    {/* Number + Icon */}
                                    <div className="flex-shrink-0 relative">
                                        <div className={`size-32 md:size-40 rounded-3xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-xl`}>
                                            <span className="material-symbols-outlined text-white text-6xl md:text-7xl">
                                                {step.icon}
                                            </span>
                                        </div>
                                        <div className="absolute -top-3 -left-3 size-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-black shadow-lg">
                                            {step.number}
                                        </div>
                                    </div>

                                    {/* Text */}
                                    <div className="text-center md:text-left flex-1">
                                        <h2 className="text-3xl font-black mb-3">{step.title}</h2>
                                        <p className="text-slate-500 text-lg leading-relaxed max-w-lg">
                                            {step.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Use Cases */}
                <section className="py-20 bg-slate-50/50">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-14">
                            <h2 className="text-4xl font-black mb-4">Built for every workflow</h2>
                            <p className="text-slate-500 font-medium">See how teams use SnapRec every day.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {useCases.map((uc, idx) => (
                                <div
                                    key={idx}
                                    className="bg-white border border-slate-200 rounded-2xl p-8 hover:shadow-lg transition-shadow duration-300 group"
                                >
                                    <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-5 group-hover:scale-110 transition-transform duration-300">
                                        <span className="material-symbols-outlined text-3xl">{uc.icon}</span>
                                    </div>
                                    <h3 className="text-xl font-black mb-2">{uc.title}</h3>
                                    <p className="text-slate-500 text-sm leading-relaxed">{uc.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="py-24 text-center">
                    <div className="max-w-3xl mx-auto px-4">
                        <h2 className="text-4xl font-black mb-6">Ready to try it?</h2>
                        <p className="text-slate-500 text-lg mb-10">
                            Install SnapRec now — it takes less than 10 seconds.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                            <AddToChromeButton size="xl" />
                            <NavLink
                                to="/login"
                                className="text-slate-600 hover:text-primary font-bold text-lg px-6 py-4 transition-all"
                            >
                                Or sign in to your dashboard →
                            </NavLink>
                        </div>
                    </div>
                </section>
            </main>

            <LandingFooter />
        </div>
    );
};

export default HowItWorks;
