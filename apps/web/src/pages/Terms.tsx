import { SEO } from '../components';

const Terms = () => {
    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <SEO
                url="/terms"
                title="Terms of Service"
                description="SnapRec Terms of Service. Read the terms and conditions for using the SnapRec screen recorder and screenshot Chrome extension."
                keywords="snaprec terms of service, snaprec terms, screen recorder terms"
                jsonLd={{
                    '@context': 'https://schema.org',
                    '@graph': [
                        {
                            '@type': 'WebPage',
                            name: 'SnapRec Terms of Service',
                            url: 'https://www.snaprecorder.org/terms',
                            description: 'Terms of Service for SnapRec screen recorder and screenshot tool.',
                        },
                        {
                            '@type': 'BreadcrumbList',
                            itemListElement: [
                                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.snaprecorder.org/' },
                                { '@type': 'ListItem', position: 2, name: 'Terms of Service' },
                            ],
                        },
                    ],
                }}
            />
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-indigo-600 px-8 py-10 text-white">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="material-symbols-outlined text-4xl">gavel</span>
                        <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
                    </div>
                    <p className="text-indigo-100 text-lg">SnapRec - Screen Recorder & Screenshot Tool</p>
                    <p className="text-indigo-200 mt-2">Last updated: March 5, 2026</p>
                </div>

                <div className="px-8 py-10 space-y-8">
                    <section className="bg-indigo-50 border-l-4 border-indigo-500 p-6 rounded-r-lg">
                        <h2 className="text-indigo-900 font-bold text-xl mb-2">Summary</h2>
                        <p className="text-indigo-800">
                            SnapRec is a free Chrome extension for screen recording and screenshots.
                            By using SnapRec, you agree to these terms. We provide the tool "as is"
                            and ask that you use it responsibly and lawfully.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b-2 border-indigo-100">1. Acceptance of Terms</h2>
                        <p className="text-slate-600 mb-4">
                            By installing, accessing, or using the SnapRec Chrome extension, website
                            (snaprecorder.org), or any related services (collectively, "the Service"),
                            you agree to be bound by these Terms of Service ("Terms"). If you do not
                            agree to these Terms, please do not use the Service.
                        </p>
                        <p className="text-slate-600">
                            We may update these Terms from time to time. Continued use of the Service
                            after changes constitutes acceptance of the updated Terms. We encourage you
                            to review this page periodically.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b-2 border-indigo-100">2. Description of Service</h2>
                        <p className="text-slate-600 mb-4">
                            SnapRec is a browser extension that provides screen recording and
                            screenshot capabilities. The Service includes:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-slate-600">
                            <li>Screen recording with audio and webcam overlay</li>
                            <li>Full-page and region screenshot capture</li>
                            <li>Image annotation and editing tools</li>
                            <li>Instant sharing via generated links</li>
                            <li>Optional cloud storage integration</li>
                        </ul>
                        <p className="text-slate-600 mt-4">
                            The core features of SnapRec are provided free of charge. We reserve the
                            right to introduce premium features in the future, but existing free
                            functionality will remain available.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b-2 border-indigo-100">3. User Responsibilities</h2>
                        <p className="text-slate-600 mb-4">When using SnapRec, you agree to:</p>
                        <ul className="list-disc pl-6 space-y-2 text-slate-600">
                            <li>Comply with all applicable laws and regulations in your jurisdiction</li>
                            <li>Obtain consent from all parties before recording conversations or meetings where required by law</li>
                            <li>Not use the Service to capture, distribute, or share illegal, harmful, or infringing content</li>
                            <li>Not attempt to reverse-engineer, modify, or distribute the extension's source code for malicious purposes</li>
                            <li>Not use the Service to violate anyone's intellectual property rights, privacy, or other legal rights</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b-2 border-indigo-100">4. Content Ownership</h2>
                        <p className="text-slate-600 mb-4">
                            You retain full ownership of all content you create using SnapRec,
                            including screenshots, recordings, and annotations. SnapRec does not claim
                            any rights over your content.
                        </p>
                        <p className="text-slate-600">
                            When you use our sharing feature, your content is uploaded to our servers
                            to generate a shareable link. You can delete shared content at any time.
                            We do not use your shared content for any purpose other than serving it to
                            those who have the link.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b-2 border-indigo-100">5. Privacy</h2>
                        <p className="text-slate-600">
                            Your privacy is important to us. Our use of your information is governed by
                            our{' '}
                            <a href="/privacy" className="text-indigo-600 hover:underline font-semibold">Privacy Policy</a>,
                            which is incorporated into these Terms by reference. In summary, SnapRec
                            does not collect personal data, does not track browsing activity, and
                            processes all captures locally on your device.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b-2 border-indigo-100">6. Disclaimers</h2>
                        <p className="text-slate-600 mb-4">
                            The Service is provided "as is" and "as available" without warranties of
                            any kind, either express or implied, including but not limited to implied
                            warranties of merchantability, fitness for a particular purpose, and
                            non-infringement.
                        </p>
                        <p className="text-slate-600">
                            We do not warrant that the Service will be uninterrupted, error-free, or
                            free of viruses or other harmful components. You use the Service at your
                            own risk. We are not responsible for any data loss resulting from the use
                            of the Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b-2 border-indigo-100">7. Limitation of Liability</h2>
                        <p className="text-slate-600">
                            To the fullest extent permitted by applicable law, SnapRec and its
                            developers shall not be liable for any indirect, incidental, special,
                            consequential, or punitive damages, or any loss of profits, data, or
                            goodwill, arising out of or in connection with your use of the Service,
                            regardless of the cause of action or the theory of liability.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b-2 border-indigo-100">8. Third-Party Services</h2>
                        <p className="text-slate-600">
                            SnapRec may integrate with third-party services such as Google Drive and
                            Cloudflare R2 for optional cloud storage. These integrations are subject
                            to the respective third party's terms of service and privacy policies. We
                            are not responsible for the practices of any third-party services.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b-2 border-indigo-100">9. Termination</h2>
                        <p className="text-slate-600">
                            You may stop using the Service at any time by uninstalling the extension
                            and ceasing to use the website. We reserve the right to suspend or
                            terminate access to the Service at our discretion if we believe you are
                            violating these Terms or using the Service in a manner that could harm
                            other users or the Service itself.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4 pb-2 border-b-2 border-indigo-100">10. Governing Law</h2>
                        <p className="text-slate-600">
                            These Terms shall be governed by and construed in accordance with the laws
                            of the jurisdiction in which the Service provider operates, without regard
                            to conflict of law principles. Any disputes arising from these Terms or the
                            Service shall be resolved through good-faith negotiation or, if necessary,
                            binding arbitration.
                        </p>
                    </section>

                    <section className="bg-slate-50 rounded-xl p-8 border border-slate-200">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Contact Us</h2>
                        <p className="text-slate-600 mb-4">If you have any questions about these Terms of Service, please contact us:</p>
                        <div className="space-y-2">
                            <p className="text-slate-700">
                                Email:{' '}
                                <a href="mailto:ghulammuhammadddahri@gmail.com" className="text-indigo-600 hover:underline">
                                    ghulammuhammadddahri@gmail.com
                                </a>
                            </p>
                            <p className="text-slate-700">
                                GitHub:{' '}
                                <a
                                    href="https://github.com/gmdahri/SnapRec---Screen-Recorder-Screenshot-Tool"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-indigo-600 hover:underline"
                                >
                                    SnapRec Repository
                                </a>
                            </p>
                        </div>
                    </section>
                </div>

                <div className="bg-slate-50 px-8 py-6 text-center text-slate-500 text-sm border-t border-slate-200">
                    <p>&copy; 2026 SnapRec. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
};

export default Terms;
