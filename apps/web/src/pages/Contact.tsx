import { LandingNavbar, LandingFooter, SEO } from '../components';

const Contact = () => {
    return (
        <div className="min-h-screen bg-white text-slate-900 font-display">
            <SEO
                url="/contact"
                title="Contact Us — SnapRec Support & Feedback"
                description="Get in touch with the SnapRec team. Report bugs, suggest features, ask questions, or just say hello. We'd love to hear from you."
                keywords="contact snaprec, snaprec support, snaprec help, snaprec feedback, screen recorder support"
                jsonLd={{
                    '@context': 'https://schema.org',
                    '@graph': [
                        {
                            '@type': 'ContactPage',
                            name: 'Contact SnapRec',
                            url: 'https://www.snaprecorder.org/contact',
                            description: 'Get in touch with the SnapRec team for support, feedback, or feature requests.',
                            publisher: { '@type': 'Organization', name: 'SnapRec', url: 'https://www.snaprecorder.org' },
                        },
                        {
                            '@type': 'BreadcrumbList',
                            itemListElement: [
                                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.snaprecorder.org/' },
                                { '@type': 'ListItem', position: 2, name: 'Contact' },
                            ],
                        },
                    ],
                }}
            />
            <LandingNavbar />

            <main className="pt-32 pb-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Hero */}
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center justify-center size-20 rounded-2xl bg-primary/10 mb-6">
                            <span className="material-symbols-outlined text-primary text-5xl">mail</span>
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-4">
                            Get in{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">
                                Touch
                            </span>
                        </h1>
                        <p className="text-slate-500 text-lg max-w-2xl mx-auto">
                            Have a question, found a bug, or want to suggest a feature? We'd love to hear from you.
                            The SnapRec team reads every message and typically responds within 24-48 hours.
                        </p>
                    </div>

                    {/* Contact Methods */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
                        {/* Email */}
                        <a
                            href="mailto:ghulammuhammadddahri@gmail.com"
                            className="group block bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                        >
                            <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 size-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <span className="material-symbols-outlined text-primary text-3xl">email</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-primary transition-colors">Email Us</h2>
                                    <p className="text-slate-500 text-sm mb-3">
                                        Best for general questions, feature requests, partnership inquiries,
                                        or anything else.
                                    </p>
                                    <span className="text-primary font-semibold text-sm">
                                        ghulammuhammadddahri@gmail.com
                                    </span>
                                </div>
                            </div>
                        </a>

                        {/* GitHub Issues */}
                        <a
                            href="https://github.com/gmdahri/SnapRec---Screen-Recorder-Screenshot-Tool/issues"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                        >
                            <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 size-14 rounded-xl bg-slate-900/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <svg className="size-7 text-slate-900" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-primary transition-colors">Report a Bug</h2>
                                    <p className="text-slate-500 text-sm mb-3">
                                        Found something broken? Open a GitHub issue and we'll fix it as
                                        fast as we can.
                                    </p>
                                    <span className="text-primary font-semibold text-sm inline-flex items-center gap-1">
                                        Open an Issue
                                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                    </span>
                                </div>
                            </div>
                        </a>

                        {/* Feature Requests */}
                        <a
                            href="https://github.com/gmdahri/SnapRec---Screen-Recorder-Screenshot-Tool/discussions"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                        >
                            <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 size-14 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <span className="material-symbols-outlined text-amber-600 text-3xl">lightbulb</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-primary transition-colors">Suggest a Feature</h2>
                                    <p className="text-slate-500 text-sm mb-3">
                                        Have an idea that would make SnapRec better? Start a discussion
                                        on GitHub — we actively listen.
                                    </p>
                                    <span className="text-primary font-semibold text-sm inline-flex items-center gap-1">
                                        Start a Discussion
                                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                    </span>
                                </div>
                            </div>
                        </a>

                        {/* Chrome Web Store */}
                        <a
                            href="https://chromewebstore.google.com/detail/snaprec-screen-recorder-s/lgafjgnifbjeafallnkkfpljgbilfajg/reviews"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                        >
                            <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 size-14 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <span className="material-symbols-outlined text-green-600 text-3xl">star</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-primary transition-colors">Leave a Review</h2>
                                    <p className="text-slate-500 text-sm mb-3">
                                        Enjoying SnapRec? A quick review on the Chrome Web Store helps
                                        others discover us.
                                    </p>
                                    <span className="text-primary font-semibold text-sm inline-flex items-center gap-1">
                                        Rate on Chrome Web Store
                                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                    </span>
                                </div>
                            </div>
                        </a>
                    </div>

                    {/* FAQ-style section */}
                    <div className="bg-slate-50 rounded-3xl border border-slate-200 p-8 md:p-12">
                        <h2 className="text-2xl font-bold text-slate-900 mb-8">Frequently Asked</h2>

                        <div className="space-y-6">
                            <div>
                                <h3 className="font-bold text-slate-900 mb-2">How fast do you respond?</h3>
                                <p className="text-slate-600">
                                    We aim to respond to all emails and GitHub issues within 24-48 hours.
                                    Critical bug reports are prioritized and usually addressed within a
                                    few hours.
                                </p>
                            </div>

                            <div>
                                <h3 className="font-bold text-slate-900 mb-2">I found a security vulnerability. How should I report it?</h3>
                                <p className="text-slate-600">
                                    Please report security issues directly via email at{' '}
                                    <a href="mailto:ghulammuhammadddahri@gmail.com" className="text-primary hover:underline font-semibold">
                                        ghulammuhammadddahri@gmail.com
                                    </a>
                                    {' '}rather than opening a public GitHub issue. We take security seriously
                                    and will respond promptly.
                                </p>
                            </div>

                            <div>
                                <h3 className="font-bold text-slate-900 mb-2">Can I contribute to SnapRec?</h3>
                                <p className="text-slate-600">
                                    Absolutely! SnapRec is open source. Check out our{' '}
                                    <a
                                        href="https://github.com/gmdahri/SnapRec---Screen-Recorder-Screenshot-Tool"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline font-semibold"
                                    >
                                        GitHub repository
                                    </a>
                                    {' '}to get started. We welcome pull requests, documentation improvements,
                                    and translations.
                                </p>
                            </div>

                            <div>
                                <h3 className="font-bold text-slate-900 mb-2">Do you offer enterprise or team plans?</h3>
                                <p className="text-slate-600">
                                    SnapRec is currently free for everyone. If you're interested in
                                    enterprise features or team deployments, reach out via email and we'll
                                    be happy to discuss your needs.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <LandingFooter />
        </div>
    );
};

export default Contact;
