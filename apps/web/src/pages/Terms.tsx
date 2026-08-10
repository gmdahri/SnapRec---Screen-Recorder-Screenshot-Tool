import React from 'react';
import { SEO } from '../components';
import { LegalDocument, type LegalSection } from '../components/content';

/* Section text is preserved verbatim from the previous page — only its
 * presentation changed. Legal wording is not ours to restyle. */
const SECTIONS: LegalSection[] = [
    {
        n: 1,
        title: 'Acceptance of Terms',
        body: (
            <>
                <p>
                By installing, accessing, or using the SnapRec Chrome extension, website
                (snaprecorder.org), or any related services (collectively, "the Service"),
                you agree to be bound by these Terms of Service ("Terms"). If you do not
                agree to these Terms, please do not use the Service.
                </p>
                <p>
                We may update these Terms from time to time. Continued use of the Service
                after changes constitutes acceptance of the updated Terms. We encourage you
                to review this page periodically.
                </p>
            </>
        ),
    },
    {
        n: 2,
        title: 'Description of Service',
        body: (
            <>
                <p>
                SnapRec is a browser extension that provides screen recording and
                screenshot capabilities. The Service includes:
                </p>
                <ul>
                <li>Screen recording with audio and webcam overlay</li>
                <li>Full-page and region screenshot capture</li>
                <li>Image annotation and editing tools</li>
                <li>Instant sharing via generated links</li>
                <li>Optional cloud storage integration</li>
                </ul>
                <p>
                The core features of SnapRec are provided free of charge. We reserve the
                right to introduce premium features in the future, but existing free
                functionality will remain available.
                </p>
            </>
        ),
    },
    {
        n: 3,
        title: 'User Responsibilities',
        body: (
            <>
                <p>When using SnapRec, you agree to:</p>
                <ul>
                <li>Comply with all applicable laws and regulations in your jurisdiction</li>
                <li>Obtain consent from all parties before recording conversations or meetings where required by law</li>
                <li>Not use the Service to capture, distribute, or share illegal, harmful, or infringing content</li>
                <li>Not attempt to reverse-engineer, modify, or distribute the extension's source code for malicious purposes</li>
                <li>Not use the Service to violate anyone's intellectual property rights, privacy, or other legal rights</li>
                </ul>
            </>
        ),
    },
    {
        n: 4,
        title: 'Content Ownership',
        body: (
            <>
                <p>
                You retain full ownership of all content you create using SnapRec,
                including screenshots, recordings, and annotations. SnapRec does not claim
                any rights over your content.
                </p>
                <p>
                When you use our sharing feature, your content is uploaded to our servers
                to generate a shareable link. You can delete shared content at any time.
                We do not use your shared content for any purpose other than serving it to
                those who have the link.
                </p>
            </>
        ),
    },
    {
        n: 5,
        title: 'Privacy',
        body: (
            <>
                <p>
                Your privacy is important to us. Our use of your information is governed by
                our{' '}
                <a href="/privacy">Privacy Policy</a>,
                which is incorporated into these Terms by reference. In summary, SnapRec
                does not collect personal data, does not track browsing activity, and
                processes all captures locally on your device.
                </p>
            </>
        ),
    },
    {
        n: 6,
        title: 'Disclaimers',
        body: (
            <>
                <p>
                The Service is provided "as is" and "as available" without warranties of
                any kind, either express or implied, including but not limited to implied
                warranties of merchantability, fitness for a particular purpose, and
                non-infringement.
                </p>
                <p>
                We do not warrant that the Service will be uninterrupted, error-free, or
                free of viruses or other harmful components. You use the Service at your
                own risk. We are not responsible for any data loss resulting from the use
                of the Service.
                </p>
            </>
        ),
    },
    {
        n: 7,
        title: 'Limitation of Liability',
        body: (
            <>
                <p>
                To the fullest extent permitted by applicable law, SnapRec and its
                developers shall not be liable for any indirect, incidental, special,
                consequential, or punitive damages, or any loss of profits, data, or
                goodwill, arising out of or in connection with your use of the Service,
                regardless of the cause of action or the theory of liability.
                </p>
            </>
        ),
    },
    {
        n: 8,
        title: 'Third-Party Services',
        body: (
            <>
                <p>
                SnapRec may integrate with third-party services such as Google Drive and
                Cloudflare R2 for optional cloud storage. These integrations are subject
                to the respective third party's terms of service and privacy policies. We
                are not responsible for the practices of any third-party services.
                </p>
            </>
        ),
    },
    {
        n: 9,
        title: 'Termination',
        body: (
            <>
                <p>
                You may stop using the Service at any time by uninstalling the extension
                and ceasing to use the website. We reserve the right to suspend or
                terminate access to the Service at our discretion if we believe you are
                violating these Terms or using the Service in a manner that could harm
                other users or the Service itself.
                </p>
            </>
        ),
    },
    {
        n: 10,
        title: 'Governing Law',
        body: (
            <>
                <p>
                These Terms shall be governed by and construed in accordance with the laws
                of the jurisdiction in which the Service provider operates, without regard
                to conflict of law principles. Any disputes arising from these Terms or the
                Service shall be resolved through good-faith negotiation or, if necessary,
                binding arbitration.
                </p>
            </>
        ),
    }
];

const Terms: React.FC = () => (
    <>
        <SEO url='/terms' title='Terms of Service — SnapRec' description='The terms covering your use of SnapRec.' />
        <LegalDocument
            title='Terms of Service'
            intro='The agreement between you and SnapRec. Plain terms for a free tool: use it for lawful things, own what you capture, and expect no warranty.'
            updated='August 2026'
            sections={SECTIONS}
        />
    </>
);

export default Terms;
