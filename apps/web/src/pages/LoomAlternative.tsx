import React from 'react';
import { NavLink } from 'react-router-dom';
import { LandingNavbar, LandingFooter, AddToChromeButton, SEO } from '../components';

const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'WebPage',
            name: 'Free Loom Alternative — SnapRec',
            description: 'SnapRec is the best free Loom alternative. No 5-minute limit, no 25-video cap, no watermarks. Record in 4K for free forever.',
            url: 'https://www.snaprecorder.org/loom-alternative',
        },
        {
            '@type': 'FAQPage',
            mainEntity: [
                {
                    '@type': 'Question',
                    name: 'Is SnapRec really a free Loom alternative?',
                    acceptedAnswer: { '@type': 'Answer', text: 'Yes. SnapRec is 100% free with no recording time limits, no video caps, and no watermarks — addressing every restriction on Loom\'s free plan.' },
                },
                {
                    '@type': 'Question',
                    name: 'Does SnapRec have a 5-minute recording limit like Loom?',
                    acceptedAnswer: { '@type': 'Answer', text: 'No. SnapRec has no time limit on recordings. Record for as long as you need, completely free.' },
                },
                {
                    '@type': 'Question',
                    name: 'Can SnapRec record in 4K like Loom Business?',
                    acceptedAnswer: { '@type': 'Answer', text: 'Yes. SnapRec supports up to 4K resolution recording for free — a feature Loom locks behind its $12.50/month Business plan.' },
                },
                {
                    '@type': 'Question',
                    name: 'Does SnapRec work on Edge and Brave like Loom?',
                    acceptedAnswer: { '@type': 'Answer', text: 'Yes. SnapRec works on all Chromium-based browsers including Google Chrome, Microsoft Edge, and Brave.' },
                },
            ],
        },
        {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.snaprecorder.org/' },
                { '@type': 'ListItem', position: 2, name: 'Loom Alternative' },
            ],
        },
    ],
};

const comparison = [
    { feature: 'Price',                snaprec: 'Free forever',   loom: '$0 (limited) / $12.50/mo' },
    { feature: 'Recording length',     snaprec: '∞ Unlimited',    loom: '5 min (free) / Unlimited (paid)' },
    { feature: 'Number of videos',     snaprec: '∞ Unlimited',    loom: '25 (free) / Unlimited (paid)' },
    { feature: 'Resolution',           snaprec: 'Up to 4K',       loom: '720p (free) / 4K (paid)' },
    { feature: 'Watermarks',           snaprec: 'None',           loom: 'None' },
    { feature: 'Webcam overlay',       snaprec: '✅',             loom: '✅' },
    { feature: 'System audio',         snaprec: '✅',             loom: '✅' },
    { feature: 'Cloud sharing',        snaprec: '✅ Free',        loom: '✅' },
    { feature: 'Screenshot tool',      snaprec: '✅ Full-page + annotation', loom: '❌' },
    { feature: 'Auto-zoom on clicks',  snaprec: '✅',             loom: '❌' },
    { feature: 'Account required',     snaprec: 'No',             loom: 'Yes' },
];

const reasons = [
    {
        icon: '⏱️',
        title: 'No 5-minute limit',
        desc: "Loom's free plan cuts you off at 5 minutes. SnapRec lets you record for as long as you need — a full demo, a lecture, a walkthrough — with zero restrictions.",
    },
    {
        icon: '📹',
        title: 'No 25-video cap',
        desc: 'Loom Free limits you to 25 stored videos. SnapRec has no cap. Record and keep as many videos as you want without managing a quota.',
    },
    {
        icon: '4️⃣',
        title: '4K for free',
        desc: 'Loom only unlocks 4K on its $12.50/month Business plan. SnapRec records in up to 4K on the free plan with no upgrade required.',
    },
    {
        icon: '📸',
        title: 'Screenshots Loom can\'t do',
        desc: 'SnapRec adds full-page screenshots with an annotation editor — blur, arrows, text. Loom has no screenshot feature at any price.',
    },
    {
        icon: '🔍',
        title: 'Auto-zoom on clicks',
        desc: 'SnapRec automatically zooms into your mouse clicks during playback, making recordings look professionally edited with zero effort. Loom doesn\'t have this.',
    },
    {
        icon: '🚀',
        title: 'No account to start',
        desc: 'Install SnapRec and start recording immediately — no sign-up, no Google login, no onboarding flow. Loom requires an account before you can record anything.',
    },
];

const faqs = [
    { q: 'Is SnapRec really a free Loom alternative?', a: "Yes. SnapRec is 100% free with no recording time limits, no video caps, and no watermarks — addressing every restriction on Loom's free plan." },
    { q: 'Does SnapRec have a 5-minute recording limit like Loom?', a: 'No. SnapRec has no time limit on recordings. Record for as long as you need, completely free.' },
    { q: 'Can SnapRec record in 4K like Loom Business?', a: 'Yes. SnapRec supports up to 4K resolution recording for free — a feature Loom locks behind its $12.50/month Business plan.' },
    { q: 'Does SnapRec work on Edge and Brave like Loom?', a: 'Yes. SnapRec works on all Chromium-based browsers including Google Chrome, Microsoft Edge, and Brave.' },
    { q: 'Can I share recordings with a link like Loom?', a: 'Yes. SnapRec generates an instant shareable link after recording. No account required for basic recording and downloading; sign in with Google to save to your permanent cloud library.' },
];

const LoomAlternative: React.FC = () => (
    <div className="min-h-screen bg-white text-slate-900 font-display antialiased">
        <SEO
            url="/loom-alternative"
            title="Best Free Loom Alternative — No Limits, No Watermarks, 4K"
            description="SnapRec is the best free Loom alternative for Chrome. No 5-minute recording limit, no 25-video cap, no watermarks, and 4K quality — all free forever. No account needed."
            keywords="loom alternative, free loom alternative, loom alternative free, best loom alternative, loom replacement, loom competitor, screen recorder like loom, loom vs snaprec, free screen recorder no time limit, screen recorder no watermark free, loom free plan alternative"
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
                        Free Loom Alternative — No account needed
                    </div>
                    <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
                        The Free Loom Alternative
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">
                            That Doesn't Limit You.
                        </span>
                    </h1>
                    <p className="text-lg sm:text-xl text-slate-500 mb-10 leading-relaxed max-w-2xl mx-auto">
                        Loom's free plan stops you at 5 minutes and 25 videos. SnapRec is 100% free with{' '}
                        <span className="font-semibold text-slate-700">no time limits, no video caps, no watermarks, and 4K quality.</span>
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
                        <AddToChromeButton size="xl" />
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
                        {['∞ Unlimited recordings', '4K quality free', 'No account needed', 'No watermarks'].map((t) => (
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
                    <h2 className="text-3xl md:text-4xl font-black text-center mb-4">SnapRec vs Loom — Feature Comparison</h2>
                    <p className="text-slate-500 text-center mb-12 max-w-xl mx-auto">Every feature Loom charges for, SnapRec gives you free.</p>
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                        <table className="w-full text-sm bg-white">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="text-left p-5 font-black text-slate-700 w-1/3">Feature</th>
                                    <th className="p-5 font-black text-primary text-center">SnapRec (Free)</th>
                                    <th className="p-5 font-black text-slate-500 text-center">Loom</th>
                                </tr>
                            </thead>
                            <tbody>
                                {comparison.map((row, i) => (
                                    <tr key={row.feature} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                        <td className="p-5 font-semibold text-slate-700">{row.feature}</td>
                                        <td className="p-5 text-center text-emerald-700 font-bold">{row.snaprec}</td>
                                        <td className="p-5 text-center text-slate-500">{row.loom}</td>
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
                    <h2 className="text-3xl md:text-4xl font-black text-center mb-4">6 Reasons to Switch from Loom</h2>
                    <p className="text-slate-500 text-center mb-12 max-w-xl mx-auto">SnapRec isn't just free — it does things Loom can't, at any price.</p>
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
                    <h2 className="text-3xl md:text-4xl font-black mb-4">Switch from Loom in 30 Seconds</h2>
                    <p className="text-slate-500 mb-14 max-w-xl mx-auto">No migration, no setup, no account required.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { n: '1', title: 'Add to Chrome', desc: 'Click "Add to Chrome" from the Chrome Web Store. No sign-up, no credit card, nothing to configure.' },
                            { n: '2', title: 'Click & Record', desc: 'Click the SnapRec icon or press Ctrl+Shift+1. Choose full screen, a tab, or a window. Hit record.' },
                            { n: '3', title: 'Share the Link', desc: 'When done, get an instant shareable link — just like Loom, but without the restrictions.' },
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
                        <NavLink to="/screencastify-alternative" className="text-primary font-semibold hover:underline">Free Screencastify Alternative →</NavLink>
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
                            Stop paying for Loom. Switch today.
                        </h2>
                        <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
                            SnapRec is the free Chrome screen recorder with no limits — no 5-minute cap, no 25-video limit, no credit card ever.
                        </p>
                        <AddToChromeButton variant="white" size="xl" />
                    </div>
                </div>
            </section>
        </main>

        <LandingFooter />
    </div>
);

export default LoomAlternative;
