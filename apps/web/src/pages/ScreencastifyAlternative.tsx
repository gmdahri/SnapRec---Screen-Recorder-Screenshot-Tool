import React from 'react';
import { NavLink } from 'react-router-dom';
import { LandingNavbar, LandingFooter, AddToChromeButton, SEO } from '../components';

const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'WebPage',
            name: 'Free Screencastify Alternative — SnapRec',
            description: 'SnapRec is the best free Screencastify alternative. No watermarks, no 30-minute limit, no $49/year plan needed. Record in 4K forever free.',
            url: 'https://www.snaprecorder.org/screencastify-alternative',
        },
        {
            '@type': 'FAQPage',
            mainEntity: [
                {
                    '@type': 'Question',
                    name: 'Does SnapRec remove the watermark that Screencastify adds?',
                    acceptedAnswer: { '@type': 'Answer', text: "Yes. SnapRec never adds watermarks to your recordings or screenshots — on any plan. Screencastify's free plan adds a watermark to every recording." },
                },
                {
                    '@type': 'Question',
                    name: 'Is SnapRec free like Screencastify?',
                    acceptedAnswer: { '@type': 'Answer', text: 'Both have free plans, but SnapRec\'s free plan is genuinely free — no watermarks, no 30-minute cap, no restricted features. Screencastify\'s free plan is heavily limited.' },
                },
                {
                    '@type': 'Question',
                    name: 'Can SnapRec replace Screencastify for teachers?',
                    acceptedAnswer: { '@type': 'Answer', text: 'Yes. SnapRec records screen, webcam, and audio — everything teachers need for lesson recordings, tutorials, and student feedback videos, for free.' },
                },
                {
                    '@type': 'Question',
                    name: 'Does SnapRec work on school Chromebooks?',
                    acceptedAnswer: { '@type': 'Answer', text: 'SnapRec works on all Chromium-based browsers including Chrome on Chromebook. If your school allows Chrome extensions, SnapRec will work.' },
                },
            ],
        },
        {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.snaprecorder.org/' },
                { '@type': 'ListItem', position: 2, name: 'Screencastify Alternative' },
            ],
        },
    ],
};

const comparison = [
    { feature: 'Price',               snaprec: 'Free forever',     screencastify: '$0 (watermarked) / $49/yr' },
    { feature: 'Watermarks',          snaprec: 'None — ever',       screencastify: 'On free plan' },
    { feature: 'Recording length',    snaprec: '∞ Unlimited',       screencastify: '30 min (free) / Unlimited (paid)' },
    { feature: 'Resolution',          snaprec: 'Up to 4K',          screencastify: 'Up to 720p (free) / 1080p (paid)' },
    { feature: 'Webcam overlay',      snaprec: '✅',                screencastify: '✅' },
    { feature: 'System audio',        snaprec: '✅',                screencastify: '✅' },
    { feature: 'Cloud sharing',       snaprec: '✅ Instant link',   screencastify: '❌ free / Google Drive paid' },
    { feature: 'Screenshot tool',     snaprec: '✅ Full-page + annotation', screencastify: '❌' },
    { feature: 'Auto-zoom on clicks', snaprec: '✅',                screencastify: '❌' },
    { feature: 'Account required',    snaprec: 'No',                screencastify: 'Yes' },
];

const reasons = [
    {
        icon: '🚫',
        title: 'Zero watermarks — ever',
        desc: "Screencastify stamps its logo on every free recording. SnapRec never adds watermarks at any level — your recordings look professional from day one.",
    },
    {
        icon: '⏱️',
        title: 'No 30-minute cap',
        desc: "Screencastify Free cuts off at 30 minutes. SnapRec lets you record as long as you need — full lectures, long demos, hours of content — completely free.",
    },
    {
        icon: '🔗',
        title: 'Instant shareable links',
        desc: 'Screencastify Free requires manual Google Drive upload. SnapRec generates a shareable link in seconds — copy and paste, done.',
    },
    {
        icon: '📸',
        title: 'Screenshots Screencastify can\'t take',
        desc: 'SnapRec includes full-page screenshots with an annotation editor (blur, arrows, text, highlights). Screencastify has no screenshot feature at any price.',
    },
    {
        icon: '4️⃣',
        title: '4K — free',
        desc: 'Screencastify caps free users at 720p and paid at 1080p. SnapRec records in up to 4K for free with no upgrade required.',
    },
    {
        icon: '🎓',
        title: 'Perfect for teachers',
        desc: 'Record lectures, feedback videos, and walkthroughs with webcam overlay and system audio. Everything Screencastify gives teachers, without the price tag.',
    },
];

const faqs = [
    { q: 'Does SnapRec remove the watermark that Screencastify adds?', a: "Yes. SnapRec never adds watermarks to your recordings or screenshots — on any plan. Screencastify's free plan adds a watermark to every recording." },
    { q: 'Is SnapRec free like Screencastify?', a: "Both have free plans, but SnapRec's free plan is genuinely free — no watermarks, no 30-minute cap, no restricted features. Screencastify's free plan is heavily limited." },
    { q: 'Can SnapRec replace Screencastify for teachers?', a: 'Yes. SnapRec records screen, webcam, and audio — everything teachers need for lesson recordings, tutorials, and student feedback videos, for free.' },
    { q: 'Does SnapRec work on school Chromebooks?', a: 'SnapRec works on all Chromium-based browsers including Chrome on Chromebook. If your school allows Chrome extensions, SnapRec will work.' },
    { q: 'Can I share recordings without Google Drive?', a: 'Yes. SnapRec generates an instant shareable link after every recording — no Google Drive required. Sign in with Google only if you want a permanent cloud library.' },
];

const ScreencastifyAlternative: React.FC = () => (
    <div className="min-h-screen bg-white text-slate-900 font-display antialiased">
        <SEO
            url="/screencastify-alternative"
            title="Best Free Screencastify Alternative — No Watermarks, No Limits"
            description="SnapRec is the best free Screencastify alternative. No watermarks on any plan, no 30-minute recording limit, no $49/year required. Record in 4K free forever. Perfect for teachers."
            keywords="screencastify alternative, free screencastify alternative, screencastify alternative free, screencastify replacement, screencastify vs snaprec, screencastify without watermark, free screen recorder no watermark, screen recorder for teachers free, screencastify competitor, best screencastify alternative 2026"
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
                        Free Screencastify Alternative — No account needed
                    </div>
                    <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
                        The Free Screencastify Alternative
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">
                            Without the Watermarks.
                        </span>
                    </h1>
                    <p className="text-lg sm:text-xl text-slate-500 mb-10 leading-relaxed max-w-2xl mx-auto">
                        Screencastify watermarks every free recording and caps you at 30 minutes. SnapRec gives you{' '}
                        <span className="font-semibold text-slate-700">unlimited recording, zero watermarks, 4K quality — 100% free.</span>
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
                        <AddToChromeButton size="xl" />
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
                        {['No watermarks ever', '∞ Unlimited recording', '4K quality free', 'No account needed'].map((t) => (
                            <span key={t} className="flex items-center gap-1.5">
                                <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                {t}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* Comparison Table */}
            <section className="py-20 bg-slate-50">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl md:text-4xl font-black text-center mb-4">SnapRec vs Screencastify</h2>
                    <p className="text-slate-500 text-center mb-12 max-w-xl mx-auto">What Screencastify charges $49/year for, SnapRec gives you free.</p>
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                        <table className="w-full text-sm bg-white">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="text-left p-5 font-black text-slate-700 w-1/3">Feature</th>
                                    <th className="p-5 font-black text-primary text-center">SnapRec (Free)</th>
                                    <th className="p-5 font-black text-slate-500 text-center">Screencastify</th>
                                </tr>
                            </thead>
                            <tbody>
                                {comparison.map((row, i) => (
                                    <tr key={row.feature} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                        <td className="p-5 font-semibold text-slate-700">{row.feature}</td>
                                        <td className="p-5 text-center text-emerald-700 font-bold">{row.snaprec}</td>
                                        <td className="p-5 text-center text-slate-500">{row.screencastify}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* Why Switch */}
            <section className="py-20">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl md:text-4xl font-black text-center mb-4">6 Reasons Teachers & Creators Switch</h2>
                    <p className="text-slate-500 text-center mb-12 max-w-xl mx-auto">SnapRec does more than Screencastify — and costs nothing.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {reasons.map((r) => (
                            <div key={r.title} className="bg-slate-50 rounded-2xl p-7 border border-slate-100 hover:shadow-md transition-shadow">
                                <div className="text-3xl mb-4">{r.icon}</div>
                                <h3 className="font-black text-slate-900 text-lg mb-2">{r.title}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">{r.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-20 bg-slate-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl md:text-4xl font-black mb-4">Get Started in 30 Seconds</h2>
                    <p className="text-slate-500 mb-14 max-w-xl mx-auto">Replace Screencastify instantly. No migration needed.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { n: '1', title: 'Install for Free', desc: 'Add SnapRec from the Chrome Web Store. No sign-up, no credit card, no watermark ever.' },
                            { n: '2', title: 'Record Anything', desc: 'Record your full screen, a tab, or a window. Add your webcam and microphone with one click.' },
                            { n: '3', title: 'Share Without Watermarks', desc: 'Download your recording or get a shareable link instantly — no branding, no logo, no restrictions.' },
                        ].map((s) => (
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
            <section className="py-20">
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
                    <p className="text-sm text-slate-500 mb-4">Also comparing other tools?</p>
                    <div className="flex flex-wrap justify-center gap-4 text-sm">
                        <NavLink to="/loom-alternative" className="text-primary font-semibold hover:underline">Free Loom Alternative →</NavLink>
                        <NavLink to="/screen-recorder-for-teachers" className="text-primary font-semibold hover:underline">Screen Recorder for Teachers →</NavLink>
                        <NavLink to="/webcam-overlay-presentation" className="text-primary font-semibold hover:underline">Record Presentation with Webcam →</NavLink>
                    </div>
                </div>
            </section>

            {/* Bottom CTA */}
            <section className="py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-slate-900 rounded-3xl p-12 md:p-16 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-4 relative">
                            Record without watermarks. Free, forever.
                        </h2>
                        <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
                            SnapRec is the free Screencastify alternative with no watermarks, no time limits, and 4K quality — no credit card ever.
                        </p>
                        <AddToChromeButton variant="white" size="xl" />
                    </div>
                </div>
            </section>
        </main>

        <LandingFooter />
    </div>
);

export default ScreencastifyAlternative;
