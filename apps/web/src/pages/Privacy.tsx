const Privacy = () => {
    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-indigo-600 px-8 py-10 text-white">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="material-symbols-outlined text-4xl">shield</span>
                        <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
                    </div>
                    <p className="text-indigo-100 text-lg">SnapRec - Screen Recorder & Screenshot Tool</p>
                    <p className="text-indigo-200 mt-2">Last updated: January 27, 2026</p>
                </div>

                <div className="px-8 py-10 space-y-8">
                    <section className="bg-indigo-50 border-l-4 border-indigo-500 p-6 rounded-r-lg">
                        <h2 className="text-indigo-900 font-bold text-xl mb-2">Summary</h2>
                        <p className="text-indigo-800">
                            SnapRec is committed to protecting your privacy. We do not collect, store, or
                            share any personal data. All captures remain locally on your device unless you explicitly choose to upload them to your cloud storage.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b-2 border-indigo-100">1. Information We Collect</h2>
                        <p className="text-slate-600 mb-4 font-semibold">We do not collect any personal information.</p>
                        <p className="text-slate-600 mb-4">SnapRec operates entirely on your local device. The extension does not:</p>
                        <ul className="list-disc pl-6 space-y-2 text-slate-600">
                            <li>Collect personal data</li>
                            <li>Track your browsing activity</li>
                            <li>Store any screenshots or recordings on external servers</li>
                            <li>Use cookies or tracking technologies</li>
                            <li>Send any data to third parties</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b-2 border-indigo-100">2. How the Extension Works</h2>
                        <p className="text-slate-600 mb-4">SnapRec provides screen recording and screenshot capabilities that operate entirely within your browser:</p>
                        <ul className="list-disc pl-6 space-y-2 text-slate-600">
                            <li><strong>Screenshots:</strong> Captured images are processed locally and saved directly to your device</li>
                            <li><strong>Screen Recording:</strong> Videos are recorded and stored locally on your device</li>
                            <li><strong>Annotation Tools:</strong> All editing happens within your browser, no data is transmitted</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b-2 border-indigo-100">3. Cloud Integration (Optional)</h2>
                        <p className="text-slate-600 mb-4">If you choose to use the optional cloud integrations (Cloudflare R2 or Google Drive):</p>
                        <ul className="list-disc pl-6 space-y-2 text-slate-600">
                            <li>We use secure authentication for cloud providers</li>
                            <li>We only upload files you explicitly choose to save</li>
                            <li>We do not access or modify any other files in your storage</li>
                            <li>Your credentials are never stored by our extension, we use session tokens</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b-2 border-indigo-100">4. Permissions Explained</h2>
                        <p className="text-slate-600 mb-4">The extension requires certain permissions to function:</p>
                        <ul className="list-disc pl-6 space-y-2 text-slate-600">
                            <li><strong>activeTab:</strong> To capture the current page content</li>
                            <li><strong>storage:</strong> To save your preferences locally</li>
                            <li><strong>downloads:</strong> To save captures to your device</li>
                            <li><strong>desktopCapture & tabCapture:</strong> To enable screen recording functionality</li>
                            <li><strong>scripting:</strong> To inject capture scripts into pages</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b-2 border-indigo-100">5. Data Security</h2>
                        <p className="text-slate-600 mb-4">Since all data remains on your device or in your private cloud storage:</p>
                        <ul className="list-disc pl-6 space-y-2 text-slate-600">
                            <li>You have complete control over your captures</li>
                            <li>No data is transmitted over the internet (except optional cloud uploads)</li>
                            <li>Your captures are as secure as your local device or storage provider</li>
                        </ul>
                    </section>

                    <section className="bg-slate-50 rounded-xl p-8 border border-slate-200">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Contact Us</h2>
                        <p className="text-slate-600 mb-4">If you have any questions about this Privacy Policy, please contact us:</p>
                        <div className="space-y-2">
                            <p className="text-slate-700">📧 Email: <a href="mailto:ghulammuhammadddahri@gmail.com" className="text-indigo-600 hover:underline">ghulammuhammadddahri@gmail.com</a></p>
                            <p className="text-slate-700">🔗 GitHub: <a href="https://github.com/gmdahri/SnapRec---Screen-Recorder-Screenshot-Tool" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">SnapRec Repository</a></p>
                        </div>
                    </section>
                </div>

                <div className="bg-slate-50 px-8 py-6 text-center text-slate-500 text-sm border-t border-slate-200">
                    <p>© 2026 SnapRec. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
};

export default Privacy;
