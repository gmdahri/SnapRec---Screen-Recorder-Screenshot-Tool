import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title?: string;
    description?: string;
    keywords?: string;
    image?: string;
    url?: string;
    type?: string;
    /** Set to true for auth-gated pages that should not be indexed */
    noIndex?: boolean;
}

export const SEO: React.FC<SEOProps> = ({
    title,
    description,
    keywords,
    image,
    url,
    type = 'website',
    noIndex = false,
}) => {
    const siteTitle = 'SnapRec';
    const fullTitle = title ? `${title} | ${siteTitle}` : `SnapRec - Free Screen Recorder & Screenshot Tool for Chrome`;
    const defaultDescription = 'Free screen recorder and screenshot tool for Chrome. Capture full-page screenshots, record your screen with audio, annotate and share instantly via link. No watermarks.';
    const metaDescription = description || defaultDescription;
    const siteUrl = 'https://www.snaprecorder.org';
    const currentUrl = url ? `${siteUrl}${url}` : siteUrl;
    const defaultImage = `${siteUrl}/og-image.png`;
    const metaImage = image || defaultImage;

    return (
        <Helmet>
            {/* Standard metadata */}
            <title>{fullTitle}</title>
            <meta name="description" content={metaDescription} />
            {keywords && <meta name="keywords" content={keywords} />}
            {noIndex && <meta name="robots" content="noindex, nofollow" />}
            <link rel="canonical" href={currentUrl} />

            {/* Open Graph */}
            <meta property="og:site_name" content="SnapRec" />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={metaDescription} />
            <meta property="og:type" content={type} />
            <meta property="og:url" content={currentUrl} />
            <meta property="og:image" content={metaImage} />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:site" content="@snaprec" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={metaDescription} />
            <meta name="twitter:image" content={metaImage} />
        </Helmet>
    );
};

export default SEO;
