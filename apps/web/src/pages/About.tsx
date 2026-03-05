import { LandingNavbar, LandingFooter, SEO, AddToChromeButton } from '../components';

const About = () => {
    return (
        <div className="min-h-screen bg-white text-slate-900 font-display">
            <SEO
                url="/about"
                title="About SnapRec — Free Screen Recorder & Screenshot Tool"
                description="SnapRec is a free, open-source screen recorder and screenshot tool for Chrome, Edge, and Brave. Learn about our mission, what we do, and why we built SnapRec."
                keywords="about snaprec, snaprec screen recorder, free screen recorder, chrome screenshot tool, who made snaprec"
                jsonLd={{
                    '@context': 'https://schema.org',
                    '@graph': [
                        {
                            '@type': 'AboutPage',
                            name: 'About SnapRec',
                            url: 'https://www.snaprecorder.org/about',
                            description: 'Learn about SnapRec — a free, open-source screen recorder and screenshot tool for Chrome.',
                            publisher: { '@type': 'Organization', name: 'SnapRec', url: 'https://www.snaprecorder.org' },
                        },
                        {
                            '@type': 'BreadcrumbList',
                            itemListElement: [
                                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.snaprecorder.org/' },
                                { '@type': 'ListItem', position: 2, name: 'About' },
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
                            <span className="material-symbols-outlined text-primary text-5xl">info</span>
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-4">
                            About{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">
                                SnapRec
                            </span>
                        </h1>
                        <p className="text-slate-500 text-lg max-w-2xl mx-auto">
                            A free, open-source screen recording and screenshot tool built for everyone.
                        </p>
                    </div>

                    {/* Content */}
                    <div className="prose prose-lg prose-slate max-w-none">
                        <section className="mb-12">
                            <h2 className="text-3xl font-bold text-slate-900 mb-4">Our Mission</h2>
                            <p className="text-slate-600 leading-relaxed">
                                We believe screen recording and screenshot tools should be free, fast, and
                                respect your privacy. Too many tools on the market limit free recordings to a
                                few minutes, slap watermarks on your videos, or require you to create an
                                account before you can capture a single frame. SnapRec was built to change that.
                            </p>
                            <p className="text-slate-600 leading-relaxed mt-4">
                                Our mission is to give everyone — students, teachers, remote workers,
                                developers, designers, and content creators — a powerful capture tool that
                                works out of the box, right inside the browser they already use. No downloads,
                                no watermarks, no time limits, and no sign-up required.
                            </p>
                        </section>

                        <section className="mb-12">
                            <h2 className="text-3xl font-bold text-slate-900 mb-4">What Is SnapRec?</h2>
                            <p className="text-slate-600 leading-relaxed">
                                SnapRec is a lightweight Chrome extension (under 1 MB) that lets you record
                                your screen in up to 4K resolution, take full-page scrolling screenshots,
                                annotate images with text, shapes, arrows, and blur, and share everything via
                                an instant link — all completely free.
                            </p>
                            <p className="text-slate-600 leading-relaxed mt-4">
                                It works on Chrome, Microsoft Edge, Brave, and any Chromium-based browser.
                                Whether you're on a powerful desktop or a budget Chromebook, SnapRec runs
                                smoothly because everything is processed locally on your device.
                            </p>
                        </section>

                        <section className="mb-12">
                            <h2 className="text-3xl font-bold text-slate-900 mb-4">Why We Built It</h2>
                            <p className="text-slate-600 leading-relaxed">
                                SnapRec started as a side project born out of frustration. Every screen
                                recorder we tried had the same problems: paywalls after a few recordings,
                                watermarks on exports, mandatory account creation, or bloated desktop
                                installers that ate up system resources.
                            </p>
                            <p className="text-slate-600 leading-relaxed mt-4">
                                We wanted something simple — click, record, share. No friction. So we built
                                it ourselves and decided to make it free for everyone. Today SnapRec is used
                                by thousands of people across education, remote work, content creation, and
                                software development.
                            </p>
                        </section>

                        <section className="mb-12">
                            <h2 className="text-3xl font-bold text-slate-900 mb-4">Key Features</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                {[
                                    { icon: 'videocam', title: 'Screen Recording', desc: 'Record your tab, window, or entire screen in up to 4K. Include microphone audio and webcam overlay.' },
                                    { icon: 'screenshot_monitor', title: 'Screenshots', desc: 'Capture visible area, full-page scrolling screenshots, or select a specific region.' },
                                    { icon: 'edit', title: 'Annotation Tools', desc: 'Draw, add text, arrows, shapes, and blur sensitive information — all built in.' },
                                    { icon: 'share', title: 'Instant Sharing', desc: 'Get a shareable link in one click. No account needed, no upload limits.' },
                                    { icon: 'shield', title: 'Privacy First', desc: 'All captures are processed locally. We never collect, store, or transmit your data.' },
                                    { icon: 'code', title: 'Open Source', desc: 'SnapRec is open source on GitHub. Inspect the code, contribute, or fork it.' },
                                ].map((f) => (
                                    <div key={f.title} className="flex gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                                        <div className="flex-shrink-0 size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-primary text-2xl">{f.icon}</span>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 mb-1">{f.title}</h3>
                                            <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="mb-12">
                            <h2 className="text-3xl font-bold text-slate-900 mb-4">Privacy & Security</h2>
                            <p className="text-slate-600 leading-relaxed">
                                Your privacy matters. SnapRec does not collect personal data, does not track
                                your browsing activity, and does not store your screenshots or recordings on
                                any external server. Everything stays on your device unless you choose to
                                upload it to your own cloud storage. We use only the minimum browser
                                permissions needed to provide capture functionality, and every permission is
                                explained in our{' '}
                                <a href="/privacy" className="text-primary hover:underline font-semibold">Privacy Policy</a>.
                            </p>
                        </section>

                        <section className="mb-12">
                            <h2 className="text-3xl font-bold text-slate-900 mb-4">Open Source</h2>
                            <p className="text-slate-600 leading-relaxed">
                                Transparency is important to us. SnapRec's source code is publicly available
                                on{' '}
                                <a
                                    href="https://github.com/gmdahri/SnapRec---Screen-Recorder-Screenshot-Tool"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline font-semibold"
                                >
                                    GitHub
                                </a>
                                . You can inspect the code, report issues, suggest features, or contribute
                                directly. We welcome pull requests and community feedback.
                            </p>
                        </section>

                        <section className="mb-12">
                            <h2 className="text-3xl font-bold text-slate-900 mb-4">Contact Us</h2>
                            <p className="text-slate-600 leading-relaxed">
                                Have questions, suggestions, or need help? We'd love to hear from you.
                            </p>
                            <ul className="mt-4 space-y-3 text-slate-600">
                                <li className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-primary">mail</span>
                                    <a href="mailto:ghulammuhammadddahri@gmail.com" className="text-primary hover:underline font-semibold">
                                        ghulammuhammadddahri@gmail.com
                                    </a>
                                </li>
                                <li className="flex items-center gap-3">
                                    <svg className="size-5 text-primary" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
                                    <a
                                        href="https://github.com/gmdahri/SnapRec---Screen-Recorder-Screenshot-Tool"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline font-semibold"
                                    >
                                        GitHub Repository
                                    </a>
                                </li>
                            </ul>
                        </section>
                    </div>

                    {/* CTA */}
                    <section className="mt-16">
                        <div className="bg-slate-900 rounded-3xl p-10 md:p-16 text-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 relative">
                                Try SnapRec for Free
                            </h2>
                            <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
                                Install in seconds. No account required. No watermarks. No limits.
                            </p>
                            <div className="flex justify-center">
                                <AddToChromeButton variant="white" size="lg" />
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            <LandingFooter />
        </div>
    );
};

export default About;
