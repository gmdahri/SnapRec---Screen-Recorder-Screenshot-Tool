import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title?: string;
    description?: string;
    keywords?: string;
    image?: string;
    url?: string;
    type?: string;
}

export const SEO: React.FC<SEOProps> = ({
    title,
    description,
    keywords,
    image,
    url,
    type = 'website'
}) => {
    const siteTitle = 'SnapRec';
    const fullTitle = title ? `${title} | ${siteTitle}` : `SnapRec - Instant Screen Recorder & Screenshot Tool`;
    const defaultDescription = 'Capture, record, and share your screen instantly. Powerful visual communication tool for professionals.';
    const metaDescription = description || defaultDescription;
    const siteUrl = 'https://snaprec.pages.dev';
    const currentUrl = url ? `${siteUrl}${url}` : siteUrl;

    return (
        <Helmet>
            {/* Standard metadata */}
            <title>{fullTitle}</title>
            <meta name="description" content={metaDescription} />
            {keywords && <meta name="keywords" content={keywords} />}

            {/* Open Graph / Facebook */}
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={metaDescription} />
            <meta property="og:type" content={type} />
            <meta property="og:url" content={currentUrl} />
            {image && <meta property="og:image" content={image} />}

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={metaDescription} />
            {image && <meta name="twitter:image" content={image} />}
        </Helmet>
    );
};

export default SEO;
