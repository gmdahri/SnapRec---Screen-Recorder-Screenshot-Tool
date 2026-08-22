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
            url: 'https://www.snaprecorder.org/loom-alternative/',
        },
        /* SEO: page-specific SoftwareApplication. The homepage declares one too, but
         * this is the page competing for "free loom alternative" — the product entity
         * needs to exist here rather than only on `/`. Deliberately no
         * aggregateRating: self-serving review markup is against Google's guidelines
         * and the fabricated one was removed from the homepage for that reason. */
        {
            '@type': 'SoftwareApplication',
            name: 'SnapRec',
            applicationCategory: 'MultimediaApplication',
            applicationSubCategory: 'Screen Recorder',
            operatingSystem: 'Chrome',
            browserRequirements: 'Requires a Chromium-based browser (Chrome, Edge, Brave)',
            url: 'https://www.snaprecorder.org/loom-alternative/',
            downloadUrl: 'https://chromewebstore.google.com/detail/screen-recorder-screensho/lgafjgnifbjeafallnkkfpljgbilfajg',
            description: 'Free Loom alternative for Chrome. Unlimited recording length, no video cap, no watermarks, and up to 4K quality with no account required.',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
            featureList: [
                'Unlimited recording length',
                'Unlimited number of recordings',
                'Up to 4K screen recording',
                'No watermarks',
                'Webcam overlay picture-in-picture',
                'System audio and microphone capture',
                'Full-page screenshots with annotation',
                'Auto-zoom on mouse clicks',
                'Instant shareable links',
                'Records locally — upload is optional',
            ],
            publisher: { '@type': 'Organization', name: 'SnapRec', url: 'https://www.snaprecorder.org/' },
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
                { '@type': 'ListItem', position: 2, name: 'Loom Alternative', item: 'https://www.snaprecorder.org/loom-alternative/' },
            ],
        },
    ],
};

/* SEO: the comparison table. Two rows were added (Chrome extension, Local
 * recording) because they are true, verifiable and were missing — local recording
 * is the privacy differentiator, confirmed in Privacy.tsx and the offscreen
 * recorder, which keeps captures on-device until an explicit upload.
 *
 * Two values were deliberately NOT changed to what a draft of this table proposed:
 * Loom does not watermark free recordings, so "Watermarks: None" stays for both —
 * claiming otherwise would be inaccurate and would contradict the FAQ below. And
 * Loom's free tier is 720p, not 1080p, so the more precise existing figure stays. */
const comparison = [
    { feature: 'Price',                snaprec: 'Free forever',   loom: '$0 (limited) / from $12.50/mo' },
    { feature: 'Recording length',     snaprec: '∞ Unlimited',    loom: '5 min (free) / Unlimited (paid)' },
    { feature: 'Number of videos',     snaprec: '∞ Unlimited',    loom: '25 (free) / Unlimited (paid)' },
    { feature: 'Resolution',           snaprec: 'Up to 4K',       loom: '720p (free) / up to 4K (paid)' },
    { feature: 'Watermarks',           snaprec: 'None',           loom: 'None' },
    { feature: 'Account required',     snaprec: 'No',             loom: 'Yes' },
    { feature: 'Chrome extension',     snaprec: '✅',             loom: '✅' },
    { feature: 'Webcam overlay',       snaprec: '✅',             loom: '✅' },
    { feature: 'System audio',         snaprec: '✅',             loom: '✅' },
    { feature: 'Cloud sharing',        snaprec: '✅ Free',        loom: '✅' },
    { feature: 'Records locally',      snaprec: '✅ Upload optional', loom: '❌ Cloud-first' },
    { feature: 'Screenshot tool',      snaprec: '✅ Full-page + annotation', loom: '❌' },
    { feature: 'Auto-zoom on clicks',  snaprec: '✅',             loom: '❌' },
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
    <div className="min-h-screen bg-[var(--sr-surface-paper)] text-[var(--sr-text-primary-on-light)] font-display antialiased">
        {/* SEO: leads with the exact head term "Free Loom Alternative", which the two
            competing blog posts no longer target. SEO.tsx appends " | SnapRec", so the
            title prop is kept at 49 chars to land the full tag at 59 — inside the ~60
            Google renders. "4K Screen Recorder" was shortened to "4K Recording" for
            exactly that reason; the longer variant pushed the rendered tag to 66. */}
        <SEO
            url="/loom-alternative"
            title="Free Loom Alternative — 4K Recording, No Watermark"
            description="Record your screen in 4K with no watermarks, no sign-up and no time limits. SnapRec is the free Loom alternative for Chrome, Edge and Brave — free forever."
            keywords="free loom alternative, loom alternative free, loom alternative, best loom alternative, loom replacement, loom competitor, screen recorder no watermark, 4k screen recorder, free screen recorder chrome extension, screen recorder like loom, loom vs snaprec, free screen recorder no time limit, loom free plan alternative"
            jsonLd={jsonLd}
        />
        <LandingNavbar />

        <main>
            {/* Hero */}
            <section className="relative pt-36 pb-16 overflow-hidden">
                <div className="absolute inset-0 -z-10 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[var(--sr-cyan)]/6 rounded-full blur-[120px]" />
                    <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-blue-400/6 rounded-full blur-[100px]" />
                </div>
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="inline-flex items-center gap-2 bg-[var(--sr-cyan-tint)] border border-[var(--sr-cyan)] text-[var(--sr-cyan-on-light)] text-sm font-bold px-4 py-2 rounded-full mb-8">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Free Loom Alternative — No account needed
                    </div>
                    {/* SEO: the H1 already carried "The Free Loom Alternative"; the second
                        line now carries "4K Screen Recording" instead of a generic phrase,
                        so the H1 covers both the head term and the primary modifier. */}
                    <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
                        The Free Loom Alternative
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">
                            for 4K Screen Recording
                        </span>
                    </h1>
                    <p className="text-lg sm:text-xl text-[var(--sr-text-faint-on-light)] mb-10 leading-relaxed max-w-2xl mx-auto">
                        Loom's free plan stops you at 5 minutes and 25 videos. SnapRec is 100% free with{' '}
                        <span className="font-semibold text-[var(--sr-text-primary-on-light)]">no time limits, no video caps, no watermarks, and 4K quality.</span>
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
                        <AddToChromeButton size="xl" location="loom_alternative" />
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--sr-text-faint-on-light)]">
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
            <section className="py-20 bg-[var(--sr-surface-panel-light)]">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl md:text-4xl font-black text-center mb-4">SnapRec vs Loom — Feature Comparison</h2>
                    <p className="text-[var(--sr-text-faint-on-light)] text-center mb-12 max-w-xl mx-auto">Every feature Loom charges for, SnapRec gives you free.</p>
                    <div className="overflow-x-auto rounded-[2px] border border-[var(--sr-border-light-soft)] shadow-sm">
                        <table className="w-full text-sm bg-[var(--sr-surface-paper)]">
                            <thead>
                                <tr className="border-b border-[var(--sr-border-light-soft)]">
                                    <th className="text-left p-5 font-black text-[var(--sr-text-primary-on-light)] w-1/3">Feature</th>
                                    <th className="p-5 font-black text-[var(--sr-cyan-on-light)] text-center">SnapRec (Free)</th>
                                    <th className="p-5 font-black text-[var(--sr-text-faint-on-light)] text-center">Loom</th>
                                </tr>
                            </thead>
                            <tbody>
                                {comparison.map((row, i) => (
                                    <tr key={row.feature} className={i % 2 === 0 ? 'bg-[var(--sr-surface-paper)]' : 'bg-[var(--sr-surface-panel-light)]/50'}>
                                        <td className="p-5 font-semibold text-[var(--sr-text-primary-on-light)]">{row.feature}</td>
                                        <td className="p-5 text-center text-emerald-700 font-bold">{row.snaprec}</td>
                                        <td className="p-5 text-center text-[var(--sr-text-faint-on-light)]">{row.loom}</td>
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
                    {/* SEO: H2 now carries "Switch from Loom to SnapRec" rather than a bare
                        count, and the prose block below it covers the four switching
                        arguments in sentences — cards alone gave crawlers no connected text
                        on cost, quality, friction or privacy. */}
                    <h2 className="text-3xl md:text-4xl font-black text-center mb-4">Why Teams Switch from Loom to SnapRec</h2>
                    <p className="text-[var(--sr-text-faint-on-light)] text-center mb-12 max-w-xl mx-auto">SnapRec isn't just free — it does things Loom can't, at any price.</p>

                    <div className="max-w-3xl mx-auto mb-14 flex flex-col gap-5 text-[15px] leading-[1.75] text-[var(--sr-text-muted-on-light)]">
                        <p>
                            <strong className="text-[var(--sr-text-primary-on-light)]">It costs nothing, permanently.</strong>{' '}
                            Loom's free tier is a trial shaped like a product: 5 minutes per recording, 25 videos
                            total, 720p. Getting past any of those means $12.50 per user per month. SnapRec has no
                            paid tier to upgrade to, so there is no ceiling to hit and no renewal to budget for.
                        </p>
                        <p>
                            <strong className="text-[var(--sr-text-primary-on-light)]">The recording quality is better on the free plan.</strong>{' '}
                            SnapRec captures at your display's native resolution, so a 4K monitor produces a 4K
                            recording. On Loom you would need a Business seat to exceed 720p. For anything where
                            text has to stay legible — code, spreadsheets, dense UI — that difference decides
                            whether the recording is usable.
                        </p>
                        <p>
                            <strong className="text-[var(--sr-text-primary-on-light)]">There is no sign-up between you and a recording.</strong>{' '}
                            Loom requires an account before it will record anything. SnapRec records immediately
                            after install — no email, no Google login, no onboarding. An account is optional and
                            only adds a cloud library. That matters most when you are sending a recording to
                            someone who needs to reply with one of their own.
                        </p>
                        <p>
                            <strong className="text-[var(--sr-text-primary-on-light)]">Recordings stay on your device unless you upload them.</strong>{' '}
                            SnapRec captures locally and only sends a file when you choose to create a share link.
                            Loom is cloud-first: recordings go to its servers as part of the normal flow. If you
                            handle customer data, internal systems or anything under an NDA, keeping the default
                            local is a materially different privacy position.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {reasons.map((r) => (
                            <div key={r.title} className="bg-[var(--sr-surface-panel-light)] rounded-[2px] p-7 border border-[var(--sr-border-light-soft)] hover:shadow-md transition-shadow">
                                <div className="text-3xl mb-4">{r.icon}</div>
                                <h3 className="font-black text-[var(--sr-text-primary-on-light)] text-lg mb-2">{r.title}</h3>
                                <p className="text-[var(--sr-text-faint-on-light)] text-sm leading-relaxed">{r.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-20 bg-[var(--sr-surface-panel-light)]">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    {/* SEO: keeps the "Switch from Loom" phrasing while adding the
                        "How to Get Started" heading users and crawlers scan for. */}
                    <h2 className="text-3xl md:text-4xl font-black mb-4">How to Get Started — Switch from Loom in 30 Seconds</h2>
                    <p className="text-[var(--sr-text-faint-on-light)] mb-14 max-w-xl mx-auto">No migration, no setup, no account required.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { n: '1', title: 'Add to Chrome', desc: 'Click "Add to Chrome" from the Chrome Web Store. No sign-up, no credit card, nothing to configure.' },
                            { n: '2', title: 'Click & Record', desc: 'Click the SnapRec icon or press Ctrl+Shift+1. Choose full screen, a tab, or a window. Hit record.' },
                            { n: '3', title: 'Share the Link', desc: 'When done, get an instant shareable link — just like Loom, but without the restrictions.' },
                        ].map((s) => (
                            <div key={s.n} className="flex flex-col items-center">
                                <div className="w-12 h-12 rounded-full bg-[var(--sr-cyan)] text-white font-black text-lg flex items-center justify-center mb-4 shadow-lg shadow-primary/30">{s.n}</div>
                                <h3 className="font-black text-[var(--sr-text-primary-on-light)] mb-2">{s.title}</h3>
                                <p className="text-[var(--sr-text-faint-on-light)] text-sm leading-relaxed">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-12">
                        <AddToChromeButton size="xl" location="loom_alternative" />
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
                                <h3 className="font-black text-[var(--sr-text-primary-on-light)] mb-2">{f.q}</h3>
                                <p className="text-[var(--sr-text-faint-on-light)] text-sm leading-relaxed">{f.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* When Loom Is Still Worth It */}
            <section className="py-20 bg-[var(--sr-surface-panel-light)]">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl md:text-4xl font-black text-center mb-4">When Is Loom Still Worth It?</h2>
                    <p className="text-[var(--sr-text-faint-on-light)] text-center mb-10 max-w-xl mx-auto">
                        SnapRec replaces Loom for most users — but Loom has genuine strengths worth knowing before you switch.
                    </p>
                    <div className="space-y-6">
                        <div className="bg-[var(--sr-surface-paper)] rounded-[2px] p-7 border border-[var(--sr-border-light-soft)]">
                            <h3 className="font-black text-[var(--sr-text-primary-on-light)] mb-2">You need AI-powered editing tools</h3>
                            <p className="text-[var(--sr-text-muted-on-light)] text-sm leading-relaxed">
                                Loom's paid plans include AI features like automatic filler-word removal, AI-generated transcripts with chapters, and smart summaries. If async video messaging with AI post-production is your core workflow, Loom Business is built for that. SnapRec focuses on capturing and sharing — editing features are annotation-based, not AI-based.
                            </p>
                        </div>
                        <div className="bg-[var(--sr-surface-paper)] rounded-[2px] p-7 border border-[var(--sr-border-light-soft)]">
                            <h3 className="font-black text-[var(--sr-text-primary-on-light)] mb-2">Your team already has a paid Loom plan</h3>
                            <p className="text-[var(--sr-text-muted-on-light)] text-sm leading-relaxed">
                                If you're mid-contract on Loom Business or Enterprise, switching mid-cycle costs money. Finish your term, evaluate whether the AI features justify the price, then make the move. SnapRec will still be here — and still free.
                            </p>
                        </div>
                        <div className="bg-[var(--sr-surface-paper)] rounded-[2px] p-7 border border-[var(--sr-border-light-soft)]">
                            <h3 className="font-black text-[var(--sr-text-primary-on-light)] mb-2">You rely on CRM or Salesforce integrations</h3>
                            <p className="text-[var(--sr-text-muted-on-light)] text-sm leading-relaxed">
                                Loom integrates directly with HubSpot and Salesforce so sales teams can embed recordings in CRM records and track viewer engagement. If that pipeline data matters to your sales process, Loom's ecosystem plays a role SnapRec doesn't try to fill. For simple async sales videos, SnapRec's shareable link is all most teams need.
                            </p>
                        </div>
                        <div className="bg-[var(--sr-surface-paper)] rounded-[2px] p-7 border border-[var(--sr-border-light-soft)]">
                            <h3 className="font-black text-[var(--sr-text-primary-on-light)] mb-2">You need per-viewer analytics</h3>
                            <p className="text-[var(--sr-text-muted-on-light)] text-sm leading-relaxed">
                                Loom Business shows you who watched your video, how far they got, and whether they rewatched sections. If video engagement data drives decisions for your team, that analytics layer is a real differentiator. SnapRec gives you a shareable link — not a dashboard of viewer behavior.
                            </p>
                        </div>
                    </div>
                    <p className="text-[var(--sr-text-faint-on-light)] text-sm text-center mt-8 leading-relaxed">
                        For everyone else — individual creators, educators, developers, remote teams who want fast async video without a subscription — SnapRec is the better choice.
                    </p>
                </div>
            </section>

            {/* Related Pages */}
            <section className="py-16">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <p className="text-sm text-[var(--sr-text-faint-on-light)] mb-4">Also comparing other tools?</p>
                    <div className="flex flex-wrap justify-center gap-4 text-sm">
                        <NavLink to="/screencastify-alternative" className="text-[var(--sr-cyan-on-light)] font-semibold hover:underline">Free Screencastify Alternative →</NavLink>
                        <NavLink to="/screen-recorder-for-teachers" className="text-[var(--sr-cyan-on-light)] font-semibold hover:underline">Screen Recorder for Teachers →</NavLink>
                        <NavLink to="/webcam-overlay-presentation" className="text-[var(--sr-cyan-on-light)] font-semibold hover:underline">Record Presentation with Webcam →</NavLink>
                    </div>
                </div>
            </section>

            {/* Bottom CTA */}
            <section className="py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-[var(--sr-surface-carbon)] rounded-[2px] p-12 md:p-16 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--sr-cyan)]/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-4 relative">
                            Stop paying for Loom. Switch today.
                        </h2>
                        <p className="text-[var(--sr-text-faint-on-light)] text-lg mb-8 max-w-xl mx-auto">
                            SnapRec is the free Chrome screen recorder with no limits — no 5-minute cap, no 25-video limit, no credit card ever.
                        </p>
                        <AddToChromeButton variant="white" size="xl" location="loom_alternative" />
                    </div>
                </div>
            </section>
        </main>

        <LandingFooter />
    </div>
);

export default LoomAlternative;
