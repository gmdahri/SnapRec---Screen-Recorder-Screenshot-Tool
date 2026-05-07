import React from 'react';
import { NavLink } from 'react-router-dom';
import { LandingNavbar, LandingFooter, SEO } from '../components';
import { blogPosts } from '../data/blogData';

const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'ProfilePage',
            name: 'Ghulam Muhammad — SnapRec Creator & Author',
            url: 'https://www.snaprecorder.org/about/ghulam-muhammad/',
            description: 'Ghulam Muhammad is a full-stack developer and the creator of SnapRec, a free Chrome screen recorder and screenshot tool. He writes about productivity, screen recording, and web development.',
            mainEntity: {
                '@type': 'Person',
                '@id': 'https://www.snaprecorder.org/about/ghulam-muhammad/',
                name: 'Ghulam Muhammad',
                url: 'https://www.snaprecorder.org/about/ghulam-muhammad/',
                image: 'https://www.snaprecorder.org/author-ghulam.jpg',
                jobTitle: 'Full-Stack Developer & Founder',
                description: 'Full-stack developer, founder of SnapRec, and writer on productivity tools, screen recording, and Chrome extension development.',
                knowsAbout: [
                    'Screen recording',
                    'Chrome extension development',
                    'React',
                    'TypeScript',
                    'Web performance',
                    'Productivity tools',
                ],
                sameAs: [
                    'https://github.com/gmdahri',
                    'https://www.youtube.com/@GhulamMuhammad-n2n',
                    'https://www.snaprecorder.org/',
                ],
                worksFor: {
                    '@type': 'Organization',
                    name: 'SnapRec',
                    url: 'https://www.snaprecorder.org/',
                },
            },
        },
        {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.snaprecorder.org/' },
                { '@type': 'ListItem', position: 2, name: 'About', item: 'https://www.snaprecorder.org/about/' },
                { '@type': 'ListItem', position: 3, name: 'Ghulam Muhammad', item: 'https://www.snaprecorder.org/about/ghulam-muhammad/' },
            ],
        },
    ],
};

const expertise = [
    { icon: 'code', label: 'Full-Stack Development', detail: 'React, TypeScript, NestJS, Node.js' },
    { icon: 'extension', label: 'Chrome Extensions', detail: 'Manifest V3, WebRTC, MediaRecorder API' },
    { icon: 'videocam', label: 'Screen Recording Tech', detail: 'Browser capture APIs, codec optimisation' },
    { icon: 'speed', label: 'Web Performance', detail: 'Core Web Vitals, SSR, Vite build optimisation' },
    { icon: 'storage', label: 'Cloud Infrastructure', detail: 'Cloudflare R2, Supabase, edge deployments' },
    { icon: 'article', label: 'Technical Writing', detail: 'Productivity tools, browser APIs, developer guides' },
];

const authorPosts = blogPosts.slice(0, 12);

const AuthorPage: React.FC = () => (
    <div className="min-h-screen bg-white text-slate-900 font-display antialiased">
        <SEO
            url="/about/ghulam-muhammad"
            title="Ghulam Muhammad — Creator of SnapRec | Author Bio"
            description="Ghulam Muhammad is a full-stack developer and the creator of SnapRec, a free Chrome screen recorder. He writes about screen recording, productivity, and Chrome extension development."
            keywords="ghulam muhammad, snaprec creator, snaprec author, screen recorder developer, chrome extension developer"
            jsonLd={jsonLd}
        />
        <LandingNavbar />

        <main>
            {/* Hero / Profile */}
            <section className="relative pt-36 pb-16 overflow-hidden">
                <div className="absolute inset-0 -z-10 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
                </div>
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="text-sm text-slate-400 mb-10 flex items-center gap-2">
                        <NavLink to="/" className="hover:text-primary transition-colors">Home</NavLink>
                        <span>/</span>
                        <NavLink to="/about" className="hover:text-primary transition-colors">About</NavLink>
                        <span>/</span>
                        <span className="text-slate-600">Ghulam Muhammad</span>
                    </nav>

                    <div className="flex flex-col sm:flex-row items-start gap-8">
                        <div className="flex-shrink-0">
                            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-xl shadow-primary/20">
                                <span className="text-white text-5xl sm:text-6xl font-black">G</span>
                            </div>
                        </div>
                        <div className="flex-1">
                            <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200 text-primary text-xs font-bold px-3 py-1.5 rounded-full mb-3">
                                <span className="material-symbols-outlined text-sm">verified</span>
                                Creator & Author
                            </div>
                            <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3">Ghulam Muhammad</h1>
                            <p className="text-xl text-slate-500 mb-4">Full-Stack Developer · Founder of SnapRec</p>
                            <p className="text-slate-600 leading-relaxed max-w-2xl mb-6">
                                I'm a full-stack developer who built SnapRec because I needed a screen recorder that didn't watermark my work, cap my recording length, or require a subscription. I write about screen recording, browser APIs, and building productivity tools that respect users.
                            </p>
                            <div className="flex flex-wrap gap-3">
                                <a
                                    href="https://github.com/gmdahri"
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                                    GitHub
                                </a>
                                <a
                                    href="mailto:ghulammuhammadddahri@gmail.com"
                                    className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:border-primary hover:text-primary transition-colors"
                                >
                                    <span className="material-symbols-outlined text-base">mail</span>
                                    Email
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* About / Background */}
            <section className="py-16 bg-slate-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-2xl font-black mb-8">Background</h2>
                    <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed space-y-4">
                        <p>
                            I started building SnapRec in late 2025 after years of frustration with screen recording tools that either cost too much, added watermarks, capped recording lengths, or required account sign-ups before you could record anything. I wanted a tool that worked like a professional-grade screen recorder but felt as simple as taking a screenshot.
                        </p>
                        <p>
                            SnapRec is the result — a Chrome extension that captures full-screen recordings in up to 4K, full-page screenshots with annotation, and instant shareable links. No watermarks, no time limits, no subscription. The core is free and will stay that way.
                        </p>
                        <p>
                            On this blog, I write practical guides on screen recording, screenshot tools, Chrome extensions, and productivity workflows. I cover the technical details other guides skip — codec settings, browser API quirks, when to use a recording vs. a screenshot — because I think users deserve accurate, detailed information, not just keyword-stuffed summaries.
                        </p>
                        <p>
                            Everything I publish is based on direct testing. When I compare SnapRec to Loom or Screencastify, I'm using the actual products, checking the actual pricing pages, and calling out where competitors are genuinely better. I'd rather be honest and trusted than optimistic and wrong.
                        </p>
                    </div>
                </div>
            </section>

            {/* Expertise */}
            <section className="py-16">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-2xl font-black mb-8">Areas of Expertise</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {expertise.map((item) => (
                            <div key={item.label} className="flex items-start gap-4 p-5 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined text-primary text-xl">{item.icon}</span>
                                </div>
                                <div>
                                    <p className="font-black text-slate-900 text-sm mb-0.5">{item.label}</p>
                                    <p className="text-slate-500 text-xs leading-snug">{item.detail}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Editorial Standards */}
            <section className="py-16 bg-slate-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-2xl font-black mb-6">Editorial Standards</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {[
                            { icon: 'science', title: 'Tested personally', desc: 'Every tool or technique I write about is something I have used directly. I don\'t publish claims from press releases or manufacturer specs without verification.' },
                            { icon: 'update', title: 'Kept up to date', desc: 'Pricing, features, and recommendations can change. I review and update articles when products change significantly — the "last updated" date on each post reflects real content revisions, not trivial edits.' },
                            { icon: 'balance', title: 'Honest about competitors', desc: 'When Loom or Screencastify does something better than SnapRec, I say so. My goal is to help you make the right choice, not to maximise installs.' },
                            { icon: 'info', title: 'Transparent about limitations', desc: 'SnapRec is a browser extension with real constraints — no audio from external apps on macOS without extra setup, no offline editing, no AI features. I document these clearly rather than burying them.' },
                        ].map((item) => (
                            <div key={item.title} className="flex items-start gap-4 p-6 bg-white rounded-xl border border-slate-200">
                                <span className="material-symbols-outlined text-primary text-2xl mt-0.5">{item.icon}</span>
                                <div>
                                    <h3 className="font-black text-slate-900 mb-1">{item.title}</h3>
                                    <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Recent Articles */}
            <section className="py-16">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-2xl font-black mb-8">Recent Articles</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {authorPosts.map((post) => (
                            <NavLink
                                key={post.slug}
                                to={`/blog/${post.slug}`}
                                className="group flex flex-col p-5 bg-slate-50 rounded-xl border border-slate-100 hover:border-primary/30 hover:shadow-md transition-all"
                            >
                                <span className="text-xs font-bold text-primary uppercase tracking-wide mb-2">{post.category}</span>
                                <h3 className="font-black text-slate-900 text-sm leading-snug mb-2 group-hover:text-primary transition-colors">{post.title}</h3>
                                <p className="text-slate-500 text-xs leading-relaxed flex-1 mb-3 line-clamp-2">{post.description}</p>
                                <span className="text-xs text-slate-400">{post.date}</span>
                            </NavLink>
                        ))}
                    </div>
                    <div className="mt-8 text-center">
                        <NavLink to="/blog" className="inline-flex items-center gap-2 text-primary font-bold hover:underline">
                            View all articles
                            <span className="material-symbols-outlined text-base">arrow_forward</span>
                        </NavLink>
                    </div>
                </div>
            </section>
        </main>

        <LandingFooter />
    </div>
);

export default AuthorPage;
