import React from 'react';
import { LandingNavbar, LandingFooter, SEO } from '../components';

interface Release {
    version: string;
    date: string;
    highlights: string[];
    tag: 'new' | 'improved' | 'fixed';
}

const releases: Release[] = [
    {
        version: '1.2.8',
        date: 'April 6, 2026',
        tag: 'improved',
        highlights: [
            'Author bio boxes added to all blog posts with real author photo',
            'Person schema (JSON-LD) deployed across all blog posts for E-E-A-T signals',
            'Canonical URL trailing-slash fix — all pages now consistently output trailing-slash canonicals',
            'Sitemap updated to reflect current page structure',
        ],
    },
    {
        version: '1.2.7',
        date: 'March 15, 2026',
        tag: 'improved',
        highlights: [
            'Blog post content expanded — posts now average 1,500+ words with troubleshooting sections',
            'New posts added covering Windows, Mac, Chromebook, and remote team workflows',
            'Internal linking improved across blog cluster for better crawlability',
        ],
    },
    {
        version: '1.2.6',
        date: 'February 20, 2026',
        tag: 'new',
        highlights: [
            'Auto-zoom playback — recordings automatically zoom on mouse clicks during playback',
            'Keyboard shortcut customization support introduced via Chrome extension settings',
        ],
    },
    {
        version: '1.2.5',
        date: 'February 1, 2026',
        tag: 'new',
        highlights: [
            'Webcam overlay (picture-in-picture) mode added',
            'System audio and microphone simultaneous capture enabled',
            'Improved recording quality at 4K resolution',
        ],
    },
    {
        version: '1.2.0',
        date: 'December 1, 2025',
        tag: 'new',
        highlights: [
            'Annotation editor launched — arrows, text, shapes, blur, crop',
            'Full-page screenshot engine rewritten for faster and more reliable capture',
        ],
    },
    {
        version: '1.1.8',
        date: 'February 19, 2026',
        tag: 'improved',
        highlights: [
            'SEO improvements across all pages with better meta tags',
            'Added sitemap.xml for improved search engine indexing',
            'Optimized Chrome extension description for store discoverability',
            'Refined floating preview window — kept Edit Clip & Discard, removed clutter',
        ],
    },
    {
        version: '1.1.7',
        date: 'February 17, 2026',
        tag: 'improved',
        highlights: [
            'Centralized URL management in extension config',
            'Fixed post-SSO redirect flow — returning to editor after login now works correctly',
            'Auto-update mechanism for the Chrome extension',
        ],
    },
    {
        version: '1.1.6',
        date: 'February 14, 2026',
        tag: 'fixed',
        highlights: [
            'Fixed camera and microphone not stopping when clicking the stop button',
            'Security vulnerability patches across dependencies',
            'Improved recording stop flow for cleaner resource cleanup',
        ],
    },
    {
        version: '1.1.0',
        date: 'January 2026',
        tag: 'new',
        highlights: [
            'Cloud sharing — upload and share recordings via link instantly',
            'Dashboard with library management and search',
            'Analytics page for tracking shared content views',
            'Annotation editor with drawing, text, and highlight tools',
        ],
    },
    {
        version: '1.0.0',
        date: 'December 2025',
        tag: 'new',
        highlights: [
            'Initial release of SnapRec Chrome extension',
            'Screen recording with webcam overlay and system audio',
            'Full-page, visible area, and region screenshot capture',
            'Local download support for all captures',
        ],
    },
];

const tagStyles: Record<Release['tag'], { bg: string; text: string; label: string }> = {
    new: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'New' },
    improved: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Improved' },
    fixed: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Bug Fix' },
};

const Changelog: React.FC = () => {
    return (
        <div className="min-h-screen bg-white text-slate-900 font-display">
            <SEO
                url="/changelog"
                title="Changelog — What's New in SnapRec"
                description="See the latest updates, new features, and bug fixes in SnapRec — the free screen recorder & screenshot Chrome extension. 4K recording, annotation tools, and more."
                keywords="snaprec changelog, snaprec updates, screen recorder updates, new features, free screen recorder updates, screenshot tool changelog, snaprec version history, chrome extension updates, screen recorder release notes"
                jsonLd={{
                    '@context': 'https://schema.org',
                    '@graph': [
                        {
                            '@type': 'WebPage',
                            name: 'SnapRec Changelog',
                            url: 'https://www.snaprecorder.org/changelog/',
                            description: 'Latest updates, features, and bug fixes for SnapRec screen recorder.',
                        },
                        {
                            '@type': 'SoftwareApplication',
                            name: 'SnapRec',
                            url: 'https://www.snaprecorder.org/',
                            softwareVersion: '1.2.8',
                            releaseNotes: 'https://www.snaprecorder.org/changelog/',
                            applicationCategory: 'BrowserApplication',
                            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
                        },
                        {
                            '@type': 'BreadcrumbList',
                            itemListElement: [
                                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.snaprecorder.org/' },
                                { '@type': 'ListItem', position: 2, name: 'Changelog', item: 'https://www.snaprecorder.org/changelog/' },
                            ],
                        },
                    ],
                }}
            />
            <LandingNavbar />

            <main className="pt-32 pb-20">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h1 className="text-5xl font-black tracking-tight mb-4">
                            What's New
                        </h1>
                        <p className="text-slate-500 text-lg">
                            Every improvement, feature, and fix — all in one place.
                        </p>
                    </div>

                    <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-slate-200 hidden md:block" />

                        <div className="space-y-12">
                            {releases.map((release, idx) => {
                                const tag = tagStyles[release.tag];
                                return (
                                    <div key={idx} className="relative flex gap-6 md:gap-8 group">
                                        {/* Timeline dot */}
                                        <div className="hidden md:flex flex-col items-center">
                                            <div className="size-10 rounded-full bg-white border-2 border-slate-300 group-hover:border-primary flex items-center justify-center transition-colors z-10">
                                                <div className="size-3 rounded-full bg-primary/70 group-hover:bg-primary transition-colors" />
                                            </div>
                                        </div>

                                        {/* Card */}
                                        <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-lg transition-shadow duration-300">
                                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                                <h2 className="text-2xl font-black">v{release.version}</h2>
                                                <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${tag.bg} ${tag.text}`}>
                                                    {tag.label}
                                                </span>
                                                <span className="text-slate-400 text-sm ml-auto">{release.date}</span>
                                            </div>
                                            <ul className="space-y-2">
                                                {release.highlights.map((item, i) => (
                                                    <li key={i} className="flex items-start gap-3 text-slate-600 text-sm leading-relaxed">
                                                        <span className="material-symbols-outlined text-primary text-base mt-0.5 flex-shrink-0">check_circle</span>
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </main>

            <LandingFooter />
        </div>
    );
};

export default Changelog;
