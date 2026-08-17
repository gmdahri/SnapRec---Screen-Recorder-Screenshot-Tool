import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

/** The 1200x630 JPEG social card. Exported so callers that build their own
 * JSON-LD (Landing, BlogPost) cite the same asset rather than a stale literal. */
export const DEFAULT_OG_IMAGE = '/og-image.jpg';
export const DEFAULT_OG_IMAGE_WIDTH = 1200;
export const DEFAULT_OG_IMAGE_HEIGHT = 630;
export const SITE_URL = 'https://www.snaprecorder.org';

interface SEOProps {
    title?: string;
    description?: string;
    keywords?: string;
    /** Absolute or root-relative OG/Twitter image. Falls back to DEFAULT_OG_IMAGE. */
    image?: string;
    /** Alt text for the social card. Only meaningful alongside a custom `image`. */
    imageAlt?: string;
    url?: string;
    type?: string;
    /** Set to true for auth-gated pages that should not be indexed */
    noIndex?: boolean;
    /** Optional JSON-LD structured data object to embed on the page */
    jsonLd?: Record<string, unknown>;
}

export const SEO: React.FC<SEOProps> = ({
    title,
    description,
    keywords,
    image,
    imageAlt,
    url,
    type = 'website',
    noIndex = false,
    jsonLd,
}) => {
    const siteTitle = 'SnapRec';
    const fullTitle = title ? `${title} | ${siteTitle}` : `Free Chrome Screen Recorder — No Watermarks, 4K | SnapRec`;
    const defaultDescription = 'Record your screen in 4K with one click. Free Chrome extension — no watermarks, no time limits. Full-page screenshots, webcam overlay, instant share. Try SnapRec free.';
    const metaDescription = description || defaultDescription;
    const siteUrl = SITE_URL;

    /* SEO W1: canonical used to fall back to the site root whenever `url` was
     * omitted, so ten gated surfaces each declared `canonical -> /` next to their
     * own noindex. The pathname is the honest self-reference, so use it. */
    const location = useLocation();
    const cleanPath = (url || location.pathname).replace(/\/+$/, '');
    const currentUrl = cleanPath ? `${siteUrl}${cleanPath}/` : `${siteUrl}/`;

    /* SEO C1/W4: default to the 129 KB JPEG card; `image` lets a post or a share
     * page supply its own. Root-relative values are made absolute — social
     * crawlers do not resolve relative og:image URLs. */
    const rawImage = image || DEFAULT_OG_IMAGE;
    const metaImage = rawImage.startsWith('http') ? rawImage : `${siteUrl}${rawImage}`;
    const isDefaultImage = metaImage === `${siteUrl}${DEFAULT_OG_IMAGE}`;
    const metaImageAlt = imageAlt
        || (isDefaultImage ? 'SnapRec — free Chrome screen recorder and screenshot tool' : fullTitle);

    return (
        <Helmet>
            {/* Standard metadata */}
            <title>{fullTitle}</title>
            <meta name="description" content={metaDescription} />
            {keywords && <meta name="keywords" content={keywords} />}

            {/* SEO I5: indexable pages opt into large image previews in SERPs and
                AI Overviews. noindex pages get the restrictive directive instead. */}
            {noIndex
                ? <meta name="robots" content="noindex, nofollow" />
                : <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />}

            {/* SEO W1: no canonical on a noindex page — Google's guidance is not to
                pair the two, because the noindex can transfer to the canonical target. */}
            {!noIndex && <link rel="canonical" href={currentUrl} />}

            {/* SEO I4: mirrors --sr-surface-paper. A <meta> content attribute cannot
                read a CSS custom property, so this is the one place the token value is
                repeated — keep it in step with tokens.css if paper ever changes. */}
            <meta name="theme-color" content="#FAFBFB" />

            {/* Open Graph */}
            <meta property="og:site_name" content="SnapRec" />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={metaDescription} />
            <meta property="og:type" content={type} />
            <meta property="og:url" content={currentUrl} />
            <meta property="og:locale" content="en_US" />
            <meta property="og:image" content={metaImage} />
            {/* SEO C1: explicit dimensions let crawlers lay out the card before
                fetching the bytes. Only asserted for the known default asset. */}
            {isDefaultImage && <meta property="og:image:width" content={String(DEFAULT_OG_IMAGE_WIDTH)} />}
            {isDefaultImage && <meta property="og:image:height" content={String(DEFAULT_OG_IMAGE_HEIGHT)} />}
            {isDefaultImage && <meta property="og:image:type" content="image/jpeg" />}
            <meta property="og:image:alt" content={metaImageAlt} />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:site" content="@snaprec" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={metaDescription} />
            <meta name="twitter:image" content={metaImage} />
            <meta name="twitter:image:alt" content={metaImageAlt} />

            {/* JSON-LD Structured Data */}
            {jsonLd && (
                <script type="application/ld+json">
                    {JSON.stringify(jsonLd)}
                </script>
            )}
        </Helmet>
    );
};

export default SEO;
