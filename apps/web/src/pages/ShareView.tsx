import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MainLayout } from '../components';

interface Recording {
    id: string;
    title: string;
    fileUrl: string;
    type: 'video' | 'screenshot';
    createdAt: string;
}

const ShareView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [recording, setRecording] = useState<Recording | null>(null);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        // Fetch metadata (now includes signed URL in fileUrl field)
        fetch(`http://localhost:3001/recordings/${id}`)
            .then(res => res.json())
            .then(data => {
                setRecording(data);
                setDownloadUrl(data.fileUrl);
                setLoading(false);

                // Handle guest claim parameter from extension
                const params = new URLSearchParams(window.location.search);
                if (params.get('claim') === 'true') {
                    const guestIds = JSON.parse(localStorage.getItem('guestRecordingIds') || '[]');
                    if (!guestIds.includes(id)) {
                        guestIds.push(id);
                        localStorage.setItem('guestRecordingIds', JSON.stringify(guestIds));
                        console.log('Saved guest recording ID for claiming:', id);
                    }
                }
            })
            .catch(err => {
                console.error('Failed to fetch recording:', err);
                setLoading(false);
            });
    }, [id]);

    const HeaderActions = (
        <div className="flex gap-3">
            <button className="hidden md:flex min-w-[100px] cursor-pointer items-center justify-center rounded-lg h-10 px-4 bg-slate-100 dark:bg-slate-800 text-slate-grey dark:text-slate-200 text-sm font-bold transition-all hover:bg-slate-200">
                Sign In
            </button>
            <button className="flex min-w-[110px] cursor-pointer items-center justify-center rounded-lg h-10 px-5 bg-primary text-white text-sm font-bold transition-all hover:opacity-90 shadow-md shadow-primary/20">
                Try it Free
            </button>
        </div>
    );

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!recording) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark p-6">
                <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">error</span>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Recording not found</h2>
                <p className="text-slate-500 mt-2">The link might be expired or invalid.</p>
                <a href="/dashboard" className="mt-6 text-primary font-bold hover:underline">Go to Dashboard</a>
            </div>
        );
    }

    return (
        <MainLayout headerActions={HeaderActions}>
            <div className="bg-background-light dark:bg-background-dark transition-colors duration-300 min-h-screen pb-20">
                <main className="max-w-[1440px] mx-auto px-6 lg:px-20 py-8">
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Main Content Area (Left) */}
                        <div className="flex-1 flex flex-col gap-6">
                            {/* Headline */}
                            <div className="flex flex-col gap-2">
                                <h1 className="text-[#130d1c] dark:text-white tracking-tight text-3xl font-bold leading-tight">
                                    {recording.title}
                                </h1>
                                <div className="flex items-center gap-4 text-sm text-slate-500">
                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">visibility</span> -- views</span>
                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">calendar_today</span> {new Date(recording.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                            {/* Media Player */}
                            <div className="w-full">
                                <div className="relative flex items-center justify-center bg-black aspect-video rounded-xl overflow-hidden shadow-2xl group">
                                    {recording.type === 'video' ? (
                                        <video
                                            src={downloadUrl || undefined}
                                            controls
                                            className="w-full h-full object-contain"
                                            autoPlay
                                        />
                                    ) : (
                                        <img
                                            alt={recording.title}
                                            className="w-full h-full object-contain"
                                            src={downloadUrl || undefined}
                                        />
                                    )}
                                </div>
                            </div>
                            {/* Reaction Bar */}
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                                <div className="flex flex-wrap gap-2">
                                    <button className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-grey dark:text-slate-300 hover:border-primary/50 hover:text-primary transition-colors">
                                        <span className="material-symbols-outlined text-[20px]">thumb_up</span>
                                        <span className="text-sm font-bold">12</span>
                                    </button>
                                    <button className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-grey dark:text-slate-300 hover:border-primary/50 hover:text-primary transition-colors">
                                        <span className="material-symbols-outlined text-[20px]">favorite</span>
                                        <span className="text-sm font-bold">5</span>
                                    </button>
                                    <button className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-grey dark:text-slate-300 hover:border-primary/50 hover:text-primary transition-colors">
                                        <span className="material-symbols-outlined text-[20px]">celebration</span>
                                        <span className="text-sm font-bold">3</span>
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-grey dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                        <span className="material-symbols-outlined text-[20px]">content_copy</span>
                                        <span className="text-sm font-medium">Copy Link</span>
                                    </button>
                                    <button
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-grey dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        onClick={() => {
                                            if (downloadUrl) {
                                                const a = document.createElement('a');
                                                a.href = downloadUrl;
                                                a.download = recording.title;
                                                a.click();
                                            }
                                        }}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">download</span>
                                        <span className="text-sm font-medium">Download</span>
                                    </button>
                                </div>
                            </div>
                            {/* Profile Header */}
                            <div className="flex items-center justify-between p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                <div className="flex items-center gap-5">
                                    <div
                                        className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-16 w-16 border-2 border-primary/20"
                                        style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCb5HH4CQfvHIZZaUEd4wVhxf8YMUQcSkgGTvdCOW1EoI58YKG2OMiTRuJSYv3bhQ30gEl_X8av3t_avAEn3w8y0cPd23Nnuw7pjX9bhkIRISBOz5NKdKpwEDQ9FYFSmGthpxC7y7MIITPcsg4A9rD5Ri4yKMsZa_tXk-a7d5f8qDyBOioKNNFZxJSBWSjrQo-ouMMTPr1igHl1DwkAaxQLIBHEsuw4JqQNHkmSwpJu9iEOo7vpvpNKtOFTN0a-hyj2hQnqXvATLpw')" }}
                                    ></div>
                                    <div className="flex flex-col justify-center">
                                        <p className="text-[#130d1c] dark:text-white text-xl font-bold leading-tight">Alex Rivera</p>
                                        <p className="text-primary text-sm font-semibold">Product Manager at SnapRec</p>
                                        <p className="text-slate-400 text-xs mt-1">Recorded in San Francisco, CA</p>
                                    </div>
                                </div>
                                <button className="hidden sm:flex min-w-[100px] cursor-pointer items-center justify-center rounded-lg h-10 px-6 bg-primary/10 text-primary text-sm font-bold transition-all hover:bg-primary/20">
                                    Follow
                                </button>
                            </div>
                        </div>
                        {/* Sidebar (Right) */}
                        <aside className="w-full lg:w-[380px] flex flex-col gap-6">
                            {/* Comments Section */}
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col h-full max-h-[600px]">
                                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <h3 className="font-bold text-lg text-[#130d1c] dark:text-white">Comments</h3>
                                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs font-bold">3</span>
                                </div>
                                {/* Comment List */}
                                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                                    {/* Comment 1 */}
                                    <div className="flex gap-3">
                                        <div className="size-8 rounded-full bg-slate-200 shrink-0 overflow-hidden">
                                            <img
                                                alt="User"
                                                className="w-full h-full object-cover"
                                                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDYZwbpQjt2r2tneDZW9b51IYmMsPuO-blYiLDNN0fwfxoHaLn2NnJ8Nrlsy5iIHUAiYIiB6oWkO7L0FC4oiPSOzDEeJ3ZV6dopDVck3LlZRLKnKMTqWf_QsaA-cim-9RJzM8sMUzxYqyMTpQ74VBqZtnL7d9b3nlsBCC_SEW6nBS-JooGlRValgxh1V0PJyUoBrKyry0TK6FNAmE6kjcmSSjD1RteRl6NpDiw_V7xeBZvoJRq_AbOE8QPNmIC_L_pVAHQGt5DU590"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-[#130d1c] dark:text-white">Sarah Chen</span>
                                                <span className="text-[10px] text-slate-400 uppercase">1h ago</span>
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                                This new dashboard interface looks amazing! Huge improvement over the previous version.
                                            </p>
                                        </div>
                                    </div>
                                    {/* Comment 2 */}
                                    <div className="flex gap-3">
                                        <div className="size-8 rounded-full bg-slate-200 shrink-0 overflow-hidden">
                                            <img
                                                alt="User"
                                                className="w-full h-full object-cover"
                                                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAp6DCxEwomMbUAzYq0BBYgaCnxjM2MCwC3J7JKOSdklo1Vh7bvUU18EwQNViDUAAx9umdJXTQPrXJFd_LT_-oklCQqWNGru3tMgKjvXrqUe4S_CQWYyzkhvt7R3YBK5cN_ZF4SVRfvV1Ulor1aY0f6-KbTtfLDP5X5O9uogZq9aFu4A66kBdQeZqlC4DKJSQyl-RcvczAou0eovV-q16XSLMXvSsXauwTYvBvz3ASVwNgvZiPRFJuvaI68QEJHIiNNF3T9glaJA3U"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-[#130d1c] dark:text-white">Marcus Wright</span>
                                                <span className="text-[10px] text-slate-400 uppercase">45m ago</span>
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                                Wait, did you say those charts are interactive now? That's a game changer for our reporting.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                {/* Comment Input */}
                                <div className="p-5 border-t border-slate-100 dark:border-slate-800">
                                    <div className="relative">
                                        <textarea
                                            className="w-full rounded-lg border-slate-200 dark:border-slate-800 dark:bg-slate-950 text-sm focus:ring-primary focus:border-primary resize-none p-3 pr-10"
                                            placeholder="Add a comment..."
                                            rows={2}
                                        ></textarea>
                                        <button className="absolute right-2 bottom-2 text-primary hover:bg-primary/10 p-1 rounded">
                                            <span className="material-symbols-outlined">send</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            {/* Ad/Promo Card */}
                            <div className="bg-gradient-to-br from-primary to-indigo-600 rounded-xl p-6 text-white shadow-lg">
                                <h4 className="text-lg font-bold mb-2">Want to record like this?</h4>
                                <p className="text-sm text-white/80 mb-4 leading-relaxed">Join 50,000+ professionals using SnapRec to communicate faster with video.</p>
                                <button className="w-full bg-white text-primary font-bold py-2 rounded-lg text-sm hover:bg-opacity-90 transition-all">
                                    Install Extension — Free
                                </button>
                            </div>
                        </aside>
                    </div>
                    {/* Bottom CTA Banner */}
                    <section className="mt-16 w-full">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 lg:p-12 border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 overflow-hidden relative">
                            <div className="absolute -top-10 -right-10 size-40 bg-primary/5 rounded-full blur-3xl"></div>
                            <div className="absolute -bottom-10 -left-10 size-40 bg-primary/5 rounded-full blur-3xl"></div>
                            <div className="max-w-xl text-center md:text-left z-10">
                                <h2 className="text-2xl lg:text-3xl font-bold text-[#130d1c] dark:text-white mb-4">Instantly record your screen and share.</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-lg">
                                    The easiest way to send quick video messages, bug reports, or product walkthroughs. No upload wait times.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 z-10">
                                <button className="flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white rounded-xl font-bold text-lg hover:scale-[1.02] transition-transform shadow-lg shadow-primary/30">
                                    <span className="material-symbols-outlined">download</span>
                                    Get SnapRec Free
                                </button>
                                <button className="flex items-center justify-center gap-2 px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-grey dark:text-white rounded-xl font-bold text-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                                    View Pricing
                                </button>
                            </div>
                        </div>
                        <div className="mt-8 flex justify-center gap-8 text-slate-400 text-sm">
                            <a className="hover:text-primary transition-colors" href="#">Privacy Policy</a>
                            <a className="hover:text-primary transition-colors" href="#">Terms of Service</a>
                            <a className="hover:text-primary transition-colors" href="#">Help Center</a>
                            <p>© 2024 SnapRec Inc.</p>
                        </div>
                    </section>
                </main>
            </div>
        </MainLayout>
    );
};

export default ShareView;
