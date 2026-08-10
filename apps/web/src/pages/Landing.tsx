import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { LandingFooter, LandingNavbar, LANDING_LINKS, SEO } from '../components';
import { HeroMedia } from './Landing/HeroMedia';
import { ProductDemo } from './Landing/ProductDemo';
import { ComparisonTable } from './Landing/ComparisonTable';
import { Faq } from './Landing/Faq';
import { COMPARISON } from './Landing/copy';

const CHROME_STORE =
    'https://chromewebstore.google.com/detail/screen-recorder-screensho/lgafjgnifbjeafallnkkfpljgbilfajg';

/* The FAQ set below is the LIVE one and feeds FAQPage structured data. It is
 * deliberately NOT swapped for Landing/copy.ts's set: changing it changes what
 * Google has indexed and which rich result shows. See the note at the top of
 * copy.ts. */
const faqs = [
    { q: 'Is SnapRec really free?', a: 'Yes — SnapRec is 100% free with no hidden limits. No watermarks on recordings or screenshots, no time caps, and no mandatory sign-up to start capturing.' },
    { q: 'Does SnapRec work on Edge and Brave?', a: 'Absolutely. SnapRec works on all Chromium-based browsers including Google Chrome, Microsoft Edge, and Brave. Install it from the Chrome Web Store.' },
    { q: 'Can I record with audio and webcam?', a: 'Yes. SnapRec supports system audio, microphone input, and webcam overlay — all at once. Perfect for tutorials, demos, and walkthroughs.' },
    { q: 'Where are my recordings stored?', a: 'Download locally or upload to the cloud for instant link sharing. Your data is stored securely and you can delete it anytime from your dashboard.' },
    { q: 'Do I need to create an account?', a: 'No account needed for basic capturing and downloading. Sign in with Google only when you want cloud sharing, your personal library, or analytics.' },
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
            softwareVersion: '1.2.8',
            url: 'https://www.snaprecorder.org/',
            image: 'https://www.snaprecorder.org/og-image.png',
            downloadUrl: 'https://chromewebstore.google.com/detail/screen-recorder-screensho/lgafjgnifbjeafallnkkfpljgbilfajg',
            description: 'Free screen recorder & screenshot tool for Chrome. Record your screen in 4K with audio & webcam, capture full-page screenshots, annotate, and share via link instantly. No watermarks, no time limits.',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
            featureList: ['Free screen recorder with 4K support', 'Screen recording with webcam overlay and audio', 'Full-page screenshot capture', 'Visible area and region screenshot capture', 'Built-in screenshot annotation editor', 'Cloud sharing via instant link', 'No watermarks or time limits', 'Auto-zoom on mouse clicks', 'Works on Chrome, Edge, and Brave browsers'],
            aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '5.0',
                ratingCount: '2',
                bestRating: '5',
                worstRating: '1',
            },
        },
        { '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        {
            '@type': 'WebSite',
            name: 'SnapRec',
            url: 'https://www.snaprecorder.org/',
            description: 'Free screen recorder & screenshot tool for Chrome, Edge & Brave.',
            potentialAction: {
                '@type': 'SearchAction',
                target: { '@type': 'EntryPoint', urlTemplate: 'https://www.snaprecorder.org/blog?q={search_term_string}' },
                'query-input': 'required name=search_term_string',
            },
        },
        {
            '@type': 'Organization',
            name: 'SnapRec',
            url: 'https://www.snaprecorder.org/',
            foundingDate: '2025-12',
            logo: { '@type': 'ImageObject', url: 'https://www.snaprecorder.org/logo.png', width: 1024, height: 1024 },
            contactPoint: { '@type': 'ContactPoint', email: 'ghulammuhammadddahri@gmail.com', contactType: 'customer support' },
            sameAs: [
                'https://github.com/gmdahri/SnapRec---Screen-Recorder-Screenshot-Tool',
                'https://www.producthunt.com/products/snap-recorder',
                'https://chromewebstore.google.com/detail/screen-recorder-screensho/lgafjgnifbjeafallnkkfpljgbilfajg',
                'https://www.youtube.com/@GhulamMuhammad-n2n',
            ],
        },
        {
            '@type': 'Person',
            '@id': 'https://www.snaprecorder.org/about/#founder',
            name: 'Ghulam Muhammad',
            url: 'https://www.snaprecorder.org/about/',
            jobTitle: 'Software Engineer & Founder',
            worksFor: { '@type': 'Organization', name: 'SnapRec', url: 'https://www.snaprecorder.org/' },
            sameAs: ['https://github.com/gmdahri', 'https://www.youtube.com/@GhulamMuhammad-n2n'],
        },
        {
            '@type': 'WebPage',
            url: 'https://www.snaprecorder.org/',
            speakable: {
                '@type': 'SpeakableSpecification',
                cssSelector: ['.hero-description', 'h1'],
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
            publisher: { '@type': 'Organization', name: 'SnapRec', url: 'https://www.snaprecorder.org/', logo: { '@type': 'ImageObject', url: 'https://www.snaprecorder.org/logo.png' } },
        },
    ],
};

const SCREENSHOT_MODES = [
    ['Visible area', "Whatever's on screen, instantly."],
    ['Select a region', 'Drag a box with live dimensions and a magnifier.'],
    ['Full page', 'Scrolls and stitches the whole page, however long.'],
] as const;

const RECORDING_MODES = [
    ['Current tab', 'Cleanest result, and tab audio comes along.'],
    ['A window', 'One application, nothing else on your desktop.'],
    ['Entire screen', 'For anything that leaves the browser. System audio included.'],
] as const;

/** A mode column. Registration-mark corners on the label, mono body — the
 * plate's optical language rather than an icon card. */
function ModeGroup({ title, modes }: { title: string; modes: readonly (readonly [string, string])[] }) {
    return (
        <div className="flex flex-col gap-4">
            <span className="font-mono text-[10px] tracking-[0.12em] text-[var(--sr-text-faint-on-light)]">
                {title}
            </span>
            <div className="flex flex-col gap-5">
                {modes.map(([label, body]) => (
                    <div key={label} className="flex flex-col gap-1.5 border-l-2 border-[var(--sr-cyan)] pl-4">
                        <span className="text-[15px] font-semibold tracking-[-0.01em]">{label}</span>
                        <span className="text-[13.5px] leading-relaxed text-[var(--sr-text-muted-on-light)]">
                            {body}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

const Landing: React.FC = () => {
    return (
        <div className="min-h-screen bg-[var(--sr-surface-panel-light)] text-[var(--sr-text-primary-on-light)] font-display antialiased">
            <SEO
                url="/"
                title="Free Chrome Screen Recorder — No Watermarks, 4K"
                description="The free Loom alternative for Chrome. Record your screen in 4K, capture full-page screenshots, annotate, and share via link instantly. No watermarks, no time limits. No account needed."
                keywords="free screen recorder, chrome screen recorder, screen recorder chrome extension, free screen recorder chrome extension, screen recorder no watermark, 4k screen recorder, loom alternative free, loom alternative, screencastify alternative, screen recorder without watermark, record screen and audio chrome, tab recorder chrome, webcam screen recorder, screen recorder for teachers, tutorial screen recorder, how to record screen chrome, screen recorder microsoft edge, brave browser screen recorder, bug recording tool, full page screenshot, screenshot tool chrome, screen capture chrome, auto zoom screen recorder, free screen capture tool"
                jsonLd={jsonLd}
            />
            <LandingNavbar links={LANDING_LINKS} />

            <main>
                {/* ── Hero: promise left, real product right ───────────── */}
                <section className="pt-14 pb-16 px-10">
                    <div className="max-w-[1320px] mx-auto grid lg:grid-cols-[440px_minmax(0,1fr)] gap-11 items-start">
                        <div className="flex flex-col gap-[18px]">
                            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--sr-cyan-on-light)]">
                                screen recorder &amp; screenshot tool
                            </span>

                            <h1 className="text-[clamp(2.25rem,4.4vw,2.75rem)] font-bold leading-[1.06] tracking-[-0.035em]">
                                Capture it.<br />Make it clear.<br />Share it.
                            </h1>

                            <p className="text-[15.5px] leading-[1.65] text-[var(--sr-text-muted-on-light)] max-w-[42ch]">
                                Record your screen or grab a screenshot, mark up what matters, and
                                send a link. Free, no watermark, and it works before you make an
                                account.
                            </p>

                            {/* One CTA, twice — here and at the foot. Nothing between. */}
                            <div className="flex flex-wrap gap-2.5">
                                <a
                                    href={CHROME_STORE}
                                    target="_blank"
                                    rel="noopener"
                                    className="h-[46px] px-5 inline-flex items-center gap-2.5 bg-[var(--sr-text-primary-on-light)] text-white text-[15px] font-semibold rounded-[2px] hover:bg-[var(--sr-text-secondary-on-light)] transition-colors"
                                >
                                    <Icon icon="ant-design:chrome-outlined" width={17} aria-hidden="true" />
                                    Add to Chrome — free
                                </a>
                                <a
                                    href="#how"
                                    className="h-[46px] px-4 inline-flex items-center gap-2 border border-[var(--sr-border-light)] bg-[var(--sr-surface-paper)] text-[15px] rounded-[2px] hover:border-[var(--sr-cyan)] hover:text-[var(--sr-cyan-on-light)] transition-colors"
                                >
                                    <Icon icon="ant-design:play-circle-outlined" width={16} aria-hidden="true" />
                                    Watch how it works
                                </a>
                            </div>

                            {/* Green is otherwise reserved for completed path nodes; these
                                three ticks are the one marketing exception, and they state
                                the objections rather than answering unasked questions. */}
                            <div className="flex flex-wrap gap-x-[18px] gap-y-2 font-mono text-[10.5px] text-[var(--sr-text-faint-on-light)]">
                                {['no watermark', 'no recording limit', 'works without an account'].map((claim) => (
                                    <span key={claim} className="inline-flex items-center gap-1.5">
                                        <Icon
                                            icon="ant-design:check-outlined"
                                            width={11}
                                            className="text-[var(--sr-green)]"
                                            aria-hidden="true"
                                        />
                                        {claim}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <HeroMedia />
                    </div>
                </section>

                {/* ── How it works ─────────────────────────────────────── */}
                <section id="how" className="pb-20 px-10">
                    <div className="max-w-[1320px] mx-auto flex flex-col gap-3.5">
                        <div className="flex items-center gap-3.5">
                            <h2 className="font-mono text-[10px] tracking-[0.14em] text-[var(--sr-text-faint-on-light)] font-normal">
                                How it works
                            </h2>
                            <span className="flex-1 h-px bg-[var(--sr-border-light-soft)]" />
                            <span className="font-mono text-[10px] text-[var(--sr-text-faint-on-light)]">
                                click a step
                            </span>
                        </div>
                        <ProductDemo />
                    </div>
                </section>

                {/* ── Screenshot and recording modes ───────────────────── */}
                <section className="py-20 px-6 lg:px-10">
                    <div className="max-w-[1180px] mx-auto grid md:grid-cols-2 gap-14">
                        <ModeGroup title="Screenshot modes" modes={SCREENSHOT_MODES} />
                        <ModeGroup title="Recording modes" modes={RECORDING_MODES} />
                    </div>
                </section>

                {/* ── Comparison ───────────────────────────────────────── */}
                <section id="compare" className="py-20 px-6 lg:px-10 bg-[var(--sr-surface-panel-light)]">
                    <div className="max-w-[1180px] mx-auto flex flex-col gap-8">
                        <h2 className="text-[clamp(1.75rem,3vw,2.25rem)] font-bold tracking-[-0.03em]">
                            Choosing between SnapRec, Loom and Screencastify
                        </h2>
                        <ComparisonTable rows={COMPARISON} />
                    </div>
                </section>

                {/* ── FAQ ──────────────────────────────────────────────── */}
                <section id="faq" className="py-20 px-6 lg:px-10">
                    <div className="max-w-[820px] mx-auto flex flex-col gap-8">
                        <h2 className="text-[clamp(1.75rem,3vw,2.25rem)] font-bold tracking-[-0.03em]">
                            Questions people ask first
                        </h2>
                        <Faq faqs={faqs.map((f, i) => ({ n: i + 1, q: f.q, a: f.a }))} />
                    </div>
                </section>

                {/* ── Final CTA — the second and last time ─────────────── */}
                <section className="py-24 px-6 lg:px-10 bg-[var(--sr-surface-panel-light)]">
                    <div className="max-w-[680px] mx-auto flex flex-col items-center gap-5 text-center">
                        <h2 className="text-[clamp(1.75rem,3vw,2.25rem)] font-bold tracking-[-0.03em]">
                            Record something in the next minute
                        </h2>
                        <p className="text-[15px] leading-[1.65] text-[var(--sr-text-muted-on-light)]">
                            Install the extension and press ⌥⇧R. You don&apos;t need an account until
                            you want a link.
                        </p>
                        <a
                            href={CHROME_STORE}
                            target="_blank"
                            rel="noopener"
                            className="h-[46px] px-6 inline-flex items-center bg-[var(--sr-text-primary-on-light)] text-white text-[15px] font-semibold rounded-[2px] hover:bg-[var(--sr-text-secondary-on-light)] transition-colors"
                        >
                            Add to Chrome — free
                        </a>
                        <Link to="/how-it-works" className="text-[13px] text-[var(--sr-cyan-on-light)]">
                            Read the full walkthrough
                        </Link>
                    </div>
                </section>
            </main>

            <LandingFooter />
        </div>
    );
};

export default Landing;
