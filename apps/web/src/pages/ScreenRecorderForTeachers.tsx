import React from 'react';
import { NavLink } from 'react-router-dom';
import { LandingNavbar, LandingFooter, AddToChromeButton, SEO } from '../components';

const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'WebPage',
            name: 'Free Screen Recorder for Teachers & Schools — SnapRec',
            description: 'The free screen recorder built for teachers. Record lessons, lectures, and student feedback videos with webcam overlay. No watermarks, no time limits, works on Chromebook.',
            url: 'https://www.snaprecorder.org/screen-recorder-for-teachers',
        },
        {
            '@type': 'FAQPage',
            mainEntity: [
                {
                    '@type': 'Question',
                    name: 'Is SnapRec free for teachers?',
                    acceptedAnswer: { '@type': 'Answer', text: 'Yes. SnapRec is 100% free for teachers with no watermarks, no recording time limits, and no school license required. Just install the Chrome extension and start recording.' },
                },
                {
                    '@type': 'Question',
                    name: 'Does SnapRec work on school Chromebooks?',
                    acceptedAnswer: { '@type': 'Answer', text: 'SnapRec works on all Chromium-based browsers including Chrome on Chromebook. If your school allows Chrome extensions, SnapRec will work.' },
                },
                {
                    '@type': 'Question',
                    name: 'Can I record myself and my screen at the same time?',
                    acceptedAnswer: { '@type': 'Answer', text: 'Yes. SnapRec records your screen with a webcam overlay so students can see both your slides and your face in the same video — no extra software needed.' },
                },
                {
                    '@type': 'Question',
                    name: 'How do I share lesson recordings with students?',
                    acceptedAnswer: { '@type': 'Answer', text: 'SnapRec generates an instant shareable link when you stop recording. Paste it into Google Classroom, email, or any LMS. Students click and watch — no account needed on their end.' },
                },
                {
                    '@type': 'Question',
                    name: 'Is SnapRec a good Screencastify alternative for teachers?',
                    acceptedAnswer: { '@type': 'Answer', text: "Yes. SnapRec gives teachers everything Screencastify does — screen recording, webcam overlay, audio — without watermarks on the free plan, without the 30-minute cap, and without the $49/year fee." },
                },
            ],
        },
        {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.snaprecorder.org/' },
                { '@type': 'ListItem', position: 2, name: 'Screen Recorder for Teachers' },
            ],
        },
    ],
};

const useCases = [
    {
        icon: '📖',
        title: 'Record lessons & lectures',
        desc: 'Record your screen with webcam overlay to create reusable lesson recordings. Students watch at their own pace, pause, and rewatch key moments.',
    },
    {
        icon: '💬',
        title: 'Student feedback videos',
        desc: 'Record your screen while reviewing student work and narrate feedback over it. Far more personal and clear than written comments.',
    },
    {
        icon: '📋',
        title: 'Tutorial walkthroughs',
        desc: 'Record step-by-step instructions for assignments, tools, or processes. Students always have a reference they can rewatch.',
    },
    {
        icon: '🖥️',
        title: 'Flipped classroom content',
        desc: 'Pre-record direct instruction for flipped classroom models. Students watch at home; you use class time for practice and discussion.',
    },
    {
        icon: '📸',
        title: 'Annotated screenshots',
        desc: 'Capture full-page screenshots and annotate them with arrows, text, and highlights to create visual study guides and instructions.',
    },
    {
        icon: '🔗',
        title: 'Share directly to Google Classroom',
        desc: 'SnapRec generates a shareable link in seconds. Paste it into Google Classroom, your LMS, or email — no uploading, no file management.',
    },
];

const comparison = [
    { feature: 'Price',               snaprec: 'Free forever',         screencastify: '$0 (watermarked) / $49/yr' },
    { feature: 'Watermarks',          snaprec: 'None — ever',           screencastify: 'On free plan' },
    { feature: 'Recording length',    snaprec: '∞ Unlimited',           screencastify: '30 min (free)' },
    { feature: 'Resolution',          snaprec: 'Up to 4K',              screencastify: '720p free / 1080p paid' },
    { feature: 'Webcam overlay',      snaprec: '✅ Free',               screencastify: '✅' },
    { feature: 'Shareable link',      snaprec: '✅ Instant',            screencastify: '❌ free / Google Drive paid' },
    { feature: 'Screenshot + annotate', snaprec: '✅ Free',             screencastify: '❌' },
    { feature: 'Chromebook support',  snaprec: '✅',                    screencastify: '✅' },
    { feature: 'Account required',    snaprec: 'No',                    screencastify: 'Yes' },
];

const steps = [
    { n: '1', title: 'Install SnapRec', desc: 'Add SnapRec from the Chrome Web Store. No sign-up, no credit card, no IT request. Works on any Chrome or Chromebook.' },
    { n: '2', title: 'Record your lesson', desc: 'Click the SnapRec icon, enable webcam, choose your screen or tab, and hit Record. Your face appears as an overlay on the recording.' },
    { n: '3', title: 'Share with students', desc: 'Stop recording and copy the instant shareable link. Post it to Google Classroom, email it, or embed it in your LMS.' },
];

const faqs = [
    { q: 'Is SnapRec free for teachers?', a: 'Yes. SnapRec is 100% free for teachers with no watermarks, no recording time limits, and no school license required. Just install the Chrome extension and start recording.' },
    { q: 'Does SnapRec work on school Chromebooks?', a: 'SnapRec works on all Chromium-based browsers including Chrome on Chromebook. If your school allows Chrome extensions, SnapRec will work.' },
    { q: 'Can I record myself and my screen at the same time?', a: 'Yes. SnapRec records your screen with a webcam overlay so students can see both your slides and your face in the same video — no extra software needed.' },
    { q: 'How do I share lesson recordings with students?', a: 'SnapRec generates an instant shareable link when you stop recording. Paste it into Google Classroom, email, or any LMS. Students click and watch — no account needed on their end.' },
    { q: 'Is SnapRec a good Screencastify alternative for teachers?', a: "Yes. SnapRec gives teachers everything Screencastify does — screen recording, webcam overlay, audio — without watermarks on the free plan, without the 30-minute cap, and without the $49/year fee." },
];

const ScreenRecorderForTeachers: React.FC = () => (
    <div className="min-h-screen bg-white text-slate-900 font-display antialiased">
        <SEO
            url="/screen-recorder-for-teachers"
            title="Free Screen Recorder for Teachers & Schools — No Watermarks"
            description="The free screen recorder built for teachers. Record lessons, walkthroughs, and student feedback with webcam overlay. No watermarks, no time limits, works on Chromebook. No account needed."
            keywords="screen recording for schools, screen recorder for teachers, free screen recorder for teachers, screen recorder education, screen recorder chromebook, record lessons chrome, screencastify alternative for teachers, free screen recorder no watermark education, screen recorder google classroom, record presentation for students, lesson recording tool, free teacher screen recorder, flipped classroom recording tool"
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
                        Free for teachers — No account needed
                    </div>
                    <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
                        Free Screen Recorder
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">
                            Built for Teachers.
                        </span>
                    </h1>
                    <p className="text-lg sm:text-xl text-slate-500 mb-10 leading-relaxed max-w-2xl mx-auto">
                        Record lessons, walkthroughs, and student feedback with webcam overlay.{' '}
                        <span className="font-semibold text-slate-700">No watermarks, no time limits, no $49/year. Works on Chromebook.</span>
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
                        <AddToChromeButton size="xl" />
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
                        {['No watermarks ever', '∞ Unlimited recording', 'Works on Chromebook', 'No account needed'].map((t) => (
                            <span key={t} className="flex items-center gap-1.5">
                                <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                {t}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* Use Cases */}
            <section className="py-20 bg-slate-50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl md:text-4xl font-black text-center mb-4">How Teachers Use SnapRec</h2>
                    <p className="text-slate-500 text-center mb-12 max-w-xl mx-auto">From lesson recordings to student feedback — one free tool for every classroom need.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {useCases.map((u) => (
                            <div key={u.title} className="bg-white rounded-2xl p-7 border border-slate-100 hover:shadow-md transition-shadow">
                                <div className="text-3xl mb-4">{u.icon}</div>
                                <h3 className="font-black text-slate-900 text-lg mb-2">{u.title}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">{u.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Comparison Table */}
            <section className="py-20">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl md:text-4xl font-black text-center mb-4">SnapRec vs Screencastify for Teachers</h2>
                    <p className="text-slate-500 text-center mb-12 max-w-xl mx-auto">Everything Screencastify charges $49/year for, SnapRec gives teachers free.</p>
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

            {/* How It Works */}
            <section className="py-20 bg-slate-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl md:text-4xl font-black mb-4">Start Recording Lessons in 60 Seconds</h2>
                    <p className="text-slate-500 mb-14 max-w-xl mx-auto">No IT request, no installation on school machines, no setup time.</p>
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
                    <p className="text-sm text-slate-500 mb-4">Also comparing tools for your classroom?</p>
                    <div className="flex flex-wrap justify-center gap-4 text-sm">
                        <NavLink to="/screencastify-alternative" className="text-primary font-semibold hover:underline">Free Screencastify Alternative →</NavLink>
                        <NavLink to="/loom-alternative" className="text-primary font-semibold hover:underline">Free Loom Alternative →</NavLink>
                        <NavLink to="/webcam-overlay-presentation" className="text-primary font-semibold hover:underline">Record Presentation with Webcam →</NavLink>
                    </div>
                </div>
            </section>

            {/* Bottom CTA */}
            <section className="py-20 bg-slate-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-slate-900 rounded-3xl p-12 md:p-16 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-4 relative">
                            The free screen recorder every teacher needs.
                        </h2>
                        <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
                            No watermarks, no time limits, no credit card. Just install and start recording your lessons today.
                        </p>
                        <AddToChromeButton variant="white" size="xl" />
                    </div>
                </div>
            </section>
        </main>

        <LandingFooter />
    </div>
);

export default ScreenRecorderForTeachers;
