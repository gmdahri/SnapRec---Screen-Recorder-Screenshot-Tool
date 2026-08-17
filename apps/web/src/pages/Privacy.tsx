import React from 'react';
import { SEO } from '../components';
import { LegalDocument, type LegalSection } from '../components/content';

/* Section text is preserved verbatim from the previous page — only its
 * presentation changed. Legal wording is not ours to restyle. */
const SECTIONS: LegalSection[] = [
    {
        n: 1,
        title: 'Information We Collect',
        body: (
            <>
                <p>The SnapRec Chrome extension does not collect any personal information.</p>
                <p>The extension operates entirely on your local device and does not:</p>
                <ul>
                <li>Collect personal data</li>
                <li>Track your browsing activity</li>
                <li>Store any screenshots or recordings on external servers (unless you opt in to cloud sharing)</li>
                </ul>
                <p>
                <strong>Our website</strong> (snaprecorder.org) uses third-party advertising services
                (Google AdSense) which may collect information via cookies and similar technologies.
                See Section 5 ("Advertising & Third-Party Technologies") and Section 6 ("Cookies")
                below for details.
                </p>
            </>
        ),
    },
    {
        n: 2,
        title: 'How the Extension Works',
        body: (
            <>
                <p>SnapRec provides screen recording and screenshot capabilities that operate entirely within your browser:</p>
                <ul>
                <li><strong>Screenshots:</strong> Captured images are processed locally and saved directly to your device</li>
                <li><strong>Screen Recording:</strong> Videos are recorded and stored locally on your device</li>
                <li><strong>Annotation Tools:</strong> All editing happens within your browser, no data is transmitted</li>
                </ul>
            </>
        ),
    },
    {
        n: 3,
        title: 'Cloud Integration (Optional)',
        body: (
            <>
                <p>If you choose to use the optional cloud integrations (Cloudflare R2 or Google Drive):</p>
                <ul>
                <li>We use secure authentication for cloud providers</li>
                <li>We only upload files you explicitly choose to save</li>
                <li>We do not access or modify any other files in your storage</li>
                <li>Your credentials are never stored by our extension, we use session tokens</li>
                </ul>
            </>
        ),
    },
    {
        n: 4,
        title: 'Permissions Explained',
        body: (
            <>
                <p>The extension requires certain permissions to function:</p>
                <ul>
                <li><strong>activeTab:</strong> To capture the current page content</li>
                <li><strong>storage:</strong> To save your preferences locally</li>
                <li><strong>downloads:</strong> To save captures to your device</li>
                <li><strong>desktopCapture & tabCapture:</strong> To enable screen recording functionality</li>
                <li><strong>scripting:</strong> To inject capture scripts into pages</li>
                </ul>
            </>
        ),
    },
    {
        n: 5,
        title: 'Advertising & Third-Party Technologies',
        body: (
            <>
                <p>
                Our website (snaprecorder.org) uses Google AdSense to display advertisements.
                When you visit our website, third-party vendors, including Google, may place and
                read cookies on your browser or use web beacons to collect information as a
                result of ad serving. These cookies may be used to serve ads based on your prior
                visits to our website or other websites on the internet.
                </p>
                <p>
                Google's use of advertising cookies enables it and its partners to serve ads to
                you based on your visits to our site and/or other sites on the internet. You may
                opt out of personalized advertising by visiting{' '}
                <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>.
                </p>
                <p>
                For more information about how Google uses data when you use our website, please
                visit:{' '}
                <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">
                How Google uses data when you use our partners' sites or apps
                </a>.
                </p>
                <p><strong>Important:</strong> This advertising applies only to our website. The SnapRec Chrome extension itself does not display ads, does not use cookies, and does not collect any user data.</p>
            </>
        ),
    },
    {
        n: 6,
        title: 'Cookies',
        body: (
            <>
                <p>Our website uses the following types of cookies:</p>
                <ul>
                <li><strong>Essential cookies:</strong> Used by our authentication provider (Supabase) to manage your login session when you sign in to your dashboard.</li>
                <li><strong>Advertising cookies:</strong> Placed by Google AdSense and its partners to serve relevant advertisements and measure ad performance. These are third-party cookies.</li>
                </ul>
                <p>
                You can control or disable cookies through your browser settings. However,
                disabling cookies may affect the functionality of certain features on our website.
                </p>
            </>
        ),
    },
    {
        n: 7,
        title: 'Data Security',
        body: (
            <>
                <p>Since all data remains on your device or in your private cloud storage:</p>
                <ul>
                <li>You have complete control over your captures</li>
                <li>No data is transmitted over the internet (except optional cloud uploads)</li>
                <li>Your captures are as secure as your local device or storage provider</li>
                </ul>
            </>
        ),
    }
];

/* SEO I3: the page had no structured data at all. WebPage + BreadcrumbList is what
 * every other marketing route already carries, and it is what puts the breadcrumb
 * trail in the SERP result rather than a bare URL. */
const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'WebPage',
            name: 'SnapRec Privacy Policy',
            url: 'https://www.snaprecorder.org/privacy/',
            description: 'How SnapRec handles recordings, screenshots and account data.',
            inLanguage: 'en',
            isPartOf: { '@type': 'WebSite', name: 'SnapRec', url: 'https://www.snaprecorder.org/' },
            publisher: { '@type': 'Organization', name: 'SnapRec', url: 'https://www.snaprecorder.org/' },
        },
        {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.snaprecorder.org/' },
                { '@type': 'ListItem', position: 2, name: 'Privacy Policy', item: 'https://www.snaprecorder.org/privacy/' },
            ],
        },
    ],
};

const Privacy: React.FC = () => (
    <>
        {/* SEO I3: the description was 43 characters — Google had almost nothing to
            build a snippet from and rewrote it. This one states what the page
            actually answers, at a length that survives into the SERP. */}
        <SEO
            url='/privacy'
            title='Privacy Policy — SnapRec'
            description='How SnapRec handles your data: recordings stay on your device until you upload one, what we store when you do, what we never see, and the third parties involved. Free Chrome screen recorder.'
            jsonLd={jsonLd}
        />
        <LegalDocument
            title='Privacy Policy'
            intro='What SnapRec records, what it sends, and what it never sees. Recordings stay on your device until you choose to upload one.'
            updated='August 2026'
            sections={SECTIONS}
        />
    </>
);

export default Privacy;
