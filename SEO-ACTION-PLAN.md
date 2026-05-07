# SEO Action Plan — snaprecorder.org
**Audit Date:** 2026-05-07 | **Overall Score:** 63 / 100

Track progress by checking off items as you complete them.

---

## Score Breakdown

| Category | Weight | Score |
|---|---|---|
| Content Quality (E-E-A-T) | 23% | 62/100 |
| Technical SEO | 22% | 68/100 |
| On-Page SEO | 20% | 60/100 |
| Schema / Structured Data | 10% | 70/100 |
| Performance (CWV) | 10% | 55/100 |
| AI Search Readiness (GEO) | 10% | 71/100 (deep audit revised upward) |
| Images | 5% | 60/100 |

---

## Critical — Fix Immediately

- [ ] **C1 · Canonical trailing slash mismatch** — Canonical tags omit slash, sitemap has it, server enforces 308 redirect with slash. Every page has split PageRank signals. Fix: ensure React Helmet outputs trailing-slash URLs matching the sitemap (e.g. `https://www.snaprecorder.org/blog/` not `.../blog`).

- [ ] **C2 · HowTo schema deprecated** — `HowTo` rich results removed by Google Sept 2023. Remove the `HowTo` node from `apps/web/src/pages/HowItWorks.tsx` lines 75–90. Replace with `WebPage` + `ItemList` (steps as `ListItem` entries). Full replacement JSON-LD in Schema Reference section below.

- [ ] **C3 · VideoObject missing `duration`** — `VideoObject` on `/how-it-works` (`HowItWorks.tsx` line 98) is missing `duration` (required by Google) and uses date-only `uploadDate` instead of datetime. Fix: add `duration: 'PT1M30S'` and change `uploadDate` to `'2026-02-01T08:00:00+08:00'`.

- [ ] **C4 · Privacy claim contradiction on About page** — `About.tsx` states "We never collect, store, or transmit your data" but the product has Cloudflare R2 cloud storage. This is verifiably false. Rewrite to: "Local by default — recordings stay on your device unless you choose to upload to your private library."

- [ ] **C5 · Four critically thin blog posts** — Previously flagged by Google as crawled-not-indexed. Each needs expansion to 1,500+ words with troubleshooting sections and advanced use cases:
  - [ ] `snaprec-vs-loom-free-alternative` (~550 words → 1,500+)
  - [ ] `record-screen-with-audio-webcam-chrome` (~600 words → 1,500+)
  - [ ] `how-to-screenshot-on-chromebook` (~500 words → 1,500+)
  - [ ] `screen-record-google-meet-free` (~550 words → 1,500+)

- [ ] **C6 · Page-type mismatch for all head terms** — Google rewards comparison listicles for "free screen recorder no watermark", "loom alternative free" etc. Homepage is a single-vendor page. Fix: create the missing pillar blog posts (see H10/H11/M16) so the blog cluster fills those SERP slots.

---

## High — Fix Within 1 Week

- [ ] **H1 · Security headers not delivered** — `_headers` file declares `Strict-Transport-Security`, `X-Frame-Options`, `CSP` but they are absent from live HTTP responses. Verify `_headers` is in the Vite `dist/` output root. Run `curl -sI https://www.snaprecorder.org/ | grep -i strict` after next deploy to confirm.

- [ ] **H2 · Render-blocking AdSense script** — `index.html` has a synchronous (no `async`) AdSense script (`show_ads_impl.js`) in `<head>`. Blocks HTML parsing and directly harms LCP. Fix: add `async` attribute to that script tag.

- [ ] **H3 · OG image is 6.5 MB** — `/og-image.png` is 2848×1504px at 6.5 MB. Compress and resize to 1200×630 / under 200 KB (WebP). Also add missing `og:image:width` and `og:image:height` meta tags.

- [ ] **H4 · Duplicate meta tags** — `index.html` static shell contains OG/Twitter tags AND React Helmet injects page-specific versions. Every page has two sets of `og:url`, `og:title` etc. Remove all `og:*`, `twitter:*`, canonical, and description tags from the static shell — manage everything through React Helmet only.

- [ ] **H5 · BreadcrumbList terminal item missing `item` URL** — 10 pages affected: `/about`, `/blog`, `/loom-alternative`, `/screencastify-alternative`, `/screen-recorder-for-teachers`, `/webcam-overlay-presentation`, `/changelog`, `/contact`, `/terms`, `/how-it-works`. Add `"item": "https://www.snaprecorder.org/[page]/"` to each terminal `ListItem`.

- [ ] **H6 · WebSite schema missing `potentialAction`** — `Landing.tsx` line 142 `WebSite` node lacks `SearchAction`. Add only if `/blog?q=` search is functional:
  ```json
  "potentialAction": { "@type": "SearchAction", "target": { "@type": "EntryPoint", "urlTemplate": "https://www.snaprecorder.org/blog?q={search_term_string}" }, "query-input": "required name=search_term_string" }
  ```

- [ ] **H7 · Organization schema missing `contactPoint` and `foundingDate`** — `Landing.tsx` Organization node. Add:
  ```json
  "foundingDate": "2025-12",
  "contactPoint": { "@type": "ContactPoint", "email": "ghulammuhammadddahri@gmail.com", "contactType": "customer support" }
  ```

- [ ] **H8 · Comparison table factual error — Loom watermarks** — Homepage marks Loom ✗ for "No watermarks" (implies Loom adds watermarks). Loom's free plan does NOT add watermarks. Correct the row — real differentiator is Loom's 25-video / 5-minute-per-video limits.

- [ ] **H9 · IndexNow key exists but no submission workflow** — `/indexnow.txt` resolves but nothing POSTs to `https://api.indexnow.org/indexnow` when content is published. Add IndexNow POST to Cloudflare Pages deploy hook or GitHub Actions post-deploy step.

- [ ] **H10 · Missing C1 pillar post** — All 6 Chrome screen recorder spoke posts are orphaned. Create `/blog/best-free-chrome-screen-recorder-extension/` (3,200 words, comparison matrix including Screenity + Cap, bidirectional links to all 6 spokes).

- [ ] **H11 · Missing C2 pillar post** — 6 meeting recording spokes orphaned. Create `/blog/how-to-record-meetings-free-chrome/` (3,000 words, jump-linked sections for Zoom, Teams, Meet, Slides, Webcam, Presentation).

- [ ] **H12 · Mobile cookie banner hides primary CTA** — Cookie consent banner is 240px tall on 375px mobile, covering the "Add to Chrome" button on first load. Shorten consent copy to reduce banner to under 120px.

- [ ] **H13 · Changelog not updated past v1.1.8** — Extension is at v1.2.8 (released 2026-04-06) but public Changelog page stops at v1.1.8 (47 days out of date). Add v1.2.x entries to `Changelog.tsx`.

- [ ] **H14 · Schema trailing slash inconsistency — cross-cutting** — `WebPage.url`, `BreadcrumbList.item`, and `publisher.url` values use mixed trailing-slash/no-trailing-slash forms across all pages. Every schema URL must exactly match the canonical form (with trailing slash). Pages affected: `Blog.tsx`, `About.tsx`, `LoomAlternative.tsx`, `ScreencastifyAlternative.tsx`, `ScreenRecorderForTeachers.tsx`, `WebcamOverlayPresentation.tsx`, `Changelog.tsx`, `BlogPost.tsx` (publisher.url). Updated JSON-LD for each file is in the Schema Reference section below.

- [ ] **H15 · `VideoObject.publisher` is thin on Landing.tsx and HowItWorks.tsx** — Both `VideoObject` nodes set `publisher` as `{ name: 'SnapRec' }` only. Google's VideoObject spec requires `publisher` to be a full Organization with `url` and `logo`. Fix: expand to `{ '@type': 'Organization', name: 'SnapRec', url: 'https://www.snaprecorder.org/', logo: { '@type': 'ImageObject', url: 'https://www.snaprecorder.org/logo.png' } }` in both files.

- [ ] **H16 · `SoftwareApplication` missing `image` property** — `Landing.tsx` SoftwareApplication node has no `image`. Google's rich result spec recommends an image for display in search. Add `image: 'https://www.snaprecorder.org/og-image.png'` to the SoftwareApplication block.

- [ ] **H17 · Add YouTube channel URL to Organization `sameAs`** — The video `tEY5kA97Zq8` is already in VideoObject schema but the channel itself is missing from `sameAs` in `Landing.tsx`. YouTube channel presence has the strongest measured correlation with AI citations (~0.737). Extract the channel URL from the video (`https://www.youtube.com/@[handle]`) and add it as a `sameAs` entry in the Organization node.

- [ ] **H18 · Add HowTo schema to all tutorial blog posts** — `buildBlogPostJsonLd()` in `BlogPost.tsx` has no HowTo generation. ~15 step-by-step posts need it. This is the highest-leverage fix for Google AI Overviews "how to" queries. Implementation (see GEO Reference section for full code):
  1. Add `steps?: { name: string; text: string }[]` to `BlogPost` interface in `blogData.ts`
  2. Add HowTo builder logic to `BlogPost.tsx` (code in GEO Reference section below)
  3. Populate `steps` for: `how-to-make-tutorial-video-free`, `how-to-record-google-slides-presentation`, `how-to-record-screen-chrome-free`, `screen-record-chrome-without-installing`, and all other step-by-step posts

---

## Medium — Fix Within 1 Month

- [ ] **M1 · `dateModified` always equals `datePublished`** — Both derive from `post.date` in `BlogPost.tsx` lines 25–26. Add `updatedDate` field to `BlogPost` interface in `blogData.ts`. Set distinct `dateModified` on any post that has been substantively updated.

- [ ] **M2 · Homepage has no `SpeakableSpecification` at all** — *(Correction from initial audit)* Blog posts DO have `.prose` and the selector IS valid. The homepage problem is different: the `speakable` field is on a `SoftwareApplication` node — but `speakable` is not a valid Schema.org property of `SoftwareApplication`. It only applies to `Article` / `WebPage` / `NewsArticle`. Fix: add a `WebPage` node to the homepage `@graph` in `Landing.tsx` and attach `SpeakableSpecification` to it, pointing to `.hero-description` and `h1`.

- [ ] **M3 · No `Person` schema for founder** — No `Person` schema node anywhere on the site for Ghulam Muhammad. Add to `Landing.tsx` `@graph` and `About.tsx`:
  ```json
  { "@type": "Person", "name": "Ghulam Muhammad", "url": "https://www.snaprecorder.org/about/", "jobTitle": "Software Engineer & Founder", "worksFor": { "@type": "Organization", "name": "SnapRec" }, "sameAs": ["https://github.com/gmdahri"] }
  ```

- [ ] **M4 · Author lacks dedicated author page** — `author.url` in all `BlogPosting` schema points to `/about/` (company page). Create `/about/ghulam-muhammad/` with: full name, photo, bio, prior engineering work, links to GitHub and LinkedIn. Update `author.url` in `BlogPost.tsx`.

- [ ] **M5 · `BlogPosting` uses same OG image for all posts** — Every blog post JSON-LD `image` field points to the same `/og-image.png`. Rich result eligibility requires unique per-article images. Add an optional `image` field to the `BlogPost` interface.

- [ ] **M6 · `SoftwareApplication` missing `aggregateRating`** — `Landing.tsx` line 127. Enables star ratings in SERPs. Only add once you have verified review data (CWS rating, Product Hunt). If CWS star rating ≥ 4.0, add it.

- [ ] **M7 · Loom/Screencastify alternative pages too short** — Both pages ~550 words prose vs 800-word minimum for service/landing pages. Expand each by 300–400 words: add a genuine migration guide or "who Loom/Screencastify is still good for" section.

- [ ] **M8 · HowItWorks page too short** — ~400 words vs 500-word floor. Expand with a "Why it works this way" or "Common questions" section. Alternatively, consolidate into the homepage as a section.

- [ ] **M9 · Missing `Permissions-Policy` header** — Add to `_headers` file:
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`

- [ ] **M10 · No preload hints for LCP image or primary font** — Add `<link rel="preload" as="image">` for the primary above-fold image and `<link rel="preload" as="font" type="font/woff2" crossorigin>` for Inter variable font to `index.html`.

- [ ] **M11 · YouTube iframe missing `loading="lazy"`** — Homepage YouTube embed loads eagerly, creating unnecessary network requests for users who never scroll to the video. Add `loading="lazy"` to the iframe element in `Landing.tsx`.

- [ ] **M12 · 308 redirect should be 301** — Server uses HTTP 308 for trailing slash enforcement instead of the standard 301. Update Cloudflare redirect rules.

- [ ] **M13 · Touch targets too small on mobile** — 25 of 36 interactive elements are below 44×44px minimum. Priority fixes: Login nav link, logo icon, inline text links (add `display: inline-block; padding: 8px 4px`).

- [ ] **M14 · All blog posts use identical structure** — Every post follows intro → steps → comparison table → tips → FAQ. This mechanical uniformity is a QRG signal for AI-generated content. Vary structure across posts (narrative-driven comparison, troubleshooting-first, etc.).

- [ ] **M15 · `llms.txt` missing key sections** — Add to `apps/web/public/llms.txt`. **All content is pre-drafted in the GEO Deep Dive section below** — copy-paste ready. Sections to add:
  - `## Frequently Asked Questions` (10 Q&A pairs covering: is it free, account required, browser support, what it records, full-page screenshots, vs Loom, vs Screencastify, storage, Chromebook, keyboard shortcuts)
  - `## Use Cases` (8 use cases: bug reports, tutorials, async team comms, sales demos, teachers, customer support, design feedback, meeting recording)
  - `## Version History` (releases v1.0.0 through v1.2.8)
  - Replace existing `## Content License` with updated version that explicitly addresses AI training use

- [ ] **M16 · Missing C5 pillar post** — 6 professional-use spoke posts orphaned. Create `/blog/screen-recording-for-work-teams-guide/` (3,500 words targeting the async communication segment where Loom is most vulnerable post-Atlassian acquisition).

- [ ] **M17 · Homepage missing CWS install count / star rating** — No verified social proof at scale vs Loom ("14M people across 200,000 companies"). Add Chrome Web Store install count and star rating to the homepage hero section.

- [ ] **M18 · `CollectionPage` on `/blog` should be `Blog` type** — `Blog.tsx` line 33. Change `@type` from `CollectionPage` to `Blog` for better semantic accuracy.

- [ ] **M19 · No explicit `robots` meta tag** — Add `<meta name="robots" content="index, follow">` via the SEO component for clarity.

- [ ] **M20 · `Article` schema missing `publisher` field** — `BlogPost.tsx`. Add:
  ```json
  "publisher": { "@type": "Organization", "name": "SnapRec", "logo": { "@type": "ImageObject", "url": "https://www.snaprecorder.org/logo.png" } }
  ```

- [ ] **M21 · Add Bing Webmaster Tools verification** — No `msvalidate.01` meta tag in `index.html`. Without it there's no way to monitor Bing indexation or submit sitemaps directly to Bing. Register at Bing Webmaster Tools and add the verification meta tag to `index.html`.

- [ ] **M22 · Fix `HowItWorks.tsx` SpeakableSpecification — overly broad selector** — Current selector `['h1', 'h2', 'section p']` matches every paragraph in every section (footer, trust strip, CTAs). Narrow to the main content only, e.g. `main > section:first-of-type p` in `HowItWorks.tsx`.

- [ ] **M23 · Add external citations/statistics to top 5 blog posts** — Perplexity deprioritizes pages with no third-party citations. Add 1–2 externally sourced statistics with inline source attribution per post (e.g. "According to [Source], X% of remote workers use async video"). Target the 5 highest-traffic posts first.

- [ ] **M24 · Create LinkedIn Company Page and add to `sameAs`**

- [ ] **M25 · `Blog.tsx` — add `ItemList` of posts to `CollectionPage` graph** — The blog index schema only has `CollectionPage` + `BreadcrumbList`. Adding an `ItemList` with each post's title and URL directly in the schema helps Google understand the hub structure and aids sitelink generation. Full JSON-LD in Schema Reference section below.

- [ ] **M26 · `Changelog.tsx` — add `SoftwareApplication` version node** — The releases array has version numbers and dates. Adding a `SoftwareApplication` node with `softwareVersion: '1.2.8'` and `releaseNotes: 'https://www.snaprecorder.org/changelog/'` gives Google a machine-readable version signal and reinforces freshness. Full JSON-LD in Schema Reference section below.

- [ ] **M27 · Verify prerender delivers JSON-LD in static HTML** — All schema is injected by the `SEO` component at runtime. If `npm run build:prerender` is not correctly serialising `<script type="application/ld+json">` blocks into the prerendered HTML files, Googlebot sees no schema at all. After the next build, `curl -s https://www.snaprecorder.org/ | grep -c 'application/ld+json'` should return > 0. Check this after every deploy. — No LinkedIn presence exists. Bing Copilot weights professional authority signals heavily. Create a LinkedIn Company Page for SnapRec, then add the URL to Organization `sameAs` in `Landing.tsx`.

---

## Low — Backlog

- [ ] **L1 · Contact email is personal Gmail** — `ghulammuhammadddahri@gmail.com` visible on Contact and About pages. Register `support@snaprecorder.org` for professional trust signals.

- [ ] **L2 · `<meta name="author">` says "SnapRec Team"** — `index.html`. Contradicts individual-founder branding used across the rest of the site. Change to "Ghulam Muhammad" or remove.

- [ ] **L3 · Twitter `@snaprec` in meta but unlinked** — `twitter:site` declares the handle but no Twitter profile link exists in navigation or footer. Either add the profile link or remove the meta tag.

- [ ] **L4 · Blog images reused across posts** — 3 images (`snaprec-record-popup.png`, `snaprec-screenshot-popup.png`, `snaprec-dashboard.png`) reused across multiple posts. Create post-specific hero images for visual differentiation.

- [ ] **L5 · Changelog BreadcrumbList URL missing trailing slash** — `Changelog.tsx` line 94. Fix: `"https://www.snaprecorder.org/changelog/"` (add trailing slash).

- [ ] **L6 · `/v/` blanket blocked in robots.txt** — Confirm no shareable recording pages under `/v/` should be publicly indexable. Add exceptions if needed.

- [ ] **L7 · No explicit AI crawler rules in robots.txt** — Add to `apps/web/public/robots.txt`. Distinguish between indexing bots (allow) and training scrapers (disallow):
  ```
  User-agent: GPTBot
  Allow: /
  User-agent: OAI-SearchBot
  Allow: /
  User-agent: ClaudeBot
  Allow: /
  User-agent: PerplexityBot
  Allow: /
  User-agent: Googlebot-Extended
  Allow: /
  User-agent: CCBot
  Disallow: /
  User-agent: anthropic-ai
  Disallow: /
  User-agent: cohere-ai
  Disallow: /
  ```

- [ ] **L8 · No `Content-Type: text/plain` for `llms.txt`** — Add to `_headers` file.

- [ ] **L9 · No `Sitemap:` directive in robots.txt** — Add `Sitemap: https://www.snaprecorder.org/sitemap.xml`.

- [ ] **L10 · Add `inLanguage: 'en'` to all `BlogPosting` nodes** — Google's Article spec recommends `inLanguage`. Add to `BlogPost.tsx` `buildBlogPostJsonLd()` BlogPosting node. One-line addition.

- [ ] **L11 · 7 missing blog spoke posts** — See cluster plan. Priority order:
  - [ ] `/blog/screen-recorder-no-account-no-sign-up/` (C1 spoke)
  - [ ] `/blog/screen-recording-for-customer-support/` (C5 spoke)
  - [ ] `/blog/snaprec-vs-screenity-chrome-recorder/` (C4 spoke)
  - [ ] `/blog/async-video-messaging-vs-meetings/` (C5 spoke)
  - [ ] `/blog/how-to-create-video-bug-report/` (C5 spoke — expand existing)
  - [ ] `/blog/how-to-record-product-demo-sales/` (C5 spoke — expand existing)
  - [ ] `/blog/screen-recording-for-online-classes/` (C5 spoke — expand existing)

---

## Content Cluster Status

| Cluster | Pillar | Spokes |
|---|---|---|
| C1 — Chrome Screen Recorder | ❌ MISSING | 6 exist (orphaned) |
| C2 — Meeting & Presentation Recording | ❌ MISSING | 6 exist (orphaned) |
| C3 — Screenshot Tools | ⚠️ Thin (needs expansion) | 5 exist |
| C4 — Alternatives & Comparisons | ⚠️ Thin (needs expansion) | 4 exist |
| C5 — Professional Use Cases | ❌ MISSING | 6 exist (orphaned) |

---

## GEO / AI Search Platform Scores

*Revised after dedicated deep audit (2026-05-07). Overall GEO score: 71/100.*

| Platform | Score | Primary Gap |
|---|---|---|
| Perplexity | 74/100 | No external citations/statistics in blog posts |
| Google AI Overviews | 68/100 | No HowTo schema on tutorials; dateModified stagnation; no WebPage SpeakableSpecification on homepage |
| ChatGPT Web Search | 65/100 | No YouTube channel in sameAs, no Reddit presence, llms.txt too thin |
| Bing Copilot | 62/100 | No Bing Webmaster Tools verification, no LinkedIn, no Wikipedia |

---

## Schema Reference — Complete JSON-LD Implementations

*Ready-to-paste code for each file. Replace the existing `jsonLd` const / prop value with the block shown.*

### `Landing.tsx` — Full `jsonLd` replacement
Fixes: `SoftwareApplication` + `image`, `WebSite` + `SearchAction`, `VideoObject` publisher expanded. Add `foundingDate` + `contactPoint` to Organization when ready.

```js
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      name: 'SnapRec',
      alternateName: ['SnapRec Screen Recorder', 'SnapRec Screenshot Tool'],
      applicationCategory: 'BrowserApplication',
      applicationSubCategory: 'Screen Recorder',
      operatingSystem: 'Chrome, Edge, Brave',
      softwareVersion: '1.2.8',
      url: 'https://www.snaprecorder.org/',
      image: 'https://www.snaprecorder.org/og-image.png',
      downloadUrl: 'https://chromewebstore.google.com/detail/screen-recorder-screensho/lgafjgnifbjeafallnkkfpljgbilfajg',
      description: 'Free screen recorder & screenshot tool for Chrome. Record in 4K with audio & webcam, capture full-page screenshots, annotate, and share via link. No watermarks, no time limits.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
      featureList: ['Free 4K screen recording', 'Webcam overlay and audio capture', 'Full-page screenshot', 'Built-in annotation editor', 'Instant shareable link', 'No watermarks or time limits', 'Auto-zoom on mouse clicks'],
    },
    { '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    {
      '@type': 'WebSite',
      name: 'SnapRec',
      url: 'https://www.snaprecorder.org/',
      description: 'Free screen recorder & screenshot tool for Chrome, Edge & Brave.',
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: 'https://www.snaprecorder.org/blog?q={search_term_string}' },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Organization',
      name: 'SnapRec',
      url: 'https://www.snaprecorder.org/',
      foundingDate: '2025-12',
      logo: { '@type': 'ImageObject', url: 'https://www.snaprecorder.org/logo.png', width: 1024, height: 1024 },
      contactPoint: { '@type': 'ContactPoint', email: 'ghulammuhammadddahri@gmail.com', contactType: 'customer support' },
      sameAs: [
        'https://github.com/gmdahri/SnapRec---Screen-Recorder-Screenshot-Tool',
        'https://www.producthunt.com/products/snap-recorder',
        'https://chromewebstore.google.com/detail/screen-recorder-screensho/lgafjgnifbjeafallnkkfpljgbilfajg',
        // Add YouTube channel URL and LinkedIn URL here when available
      ],
    },
    {
      '@type': 'VideoObject',
      name: 'How to use SnapRec - Screen recorder & screenshot tool',
      description: 'Learn how to record your screen in 4K, capture full-page screenshots, annotate, and share — all free with SnapRec.',
      thumbnailUrl: 'https://img.youtube.com/vi/tEY5kA97Zq8/maxresdefault.jpg',
      uploadDate: '2026-02-01T08:00:00+08:00',
      contentUrl: 'https://www.youtube.com/watch?v=tEY5kA97Zq8',
      embedUrl: 'https://www.youtube.com/embed/tEY5kA97Zq8',
      duration: 'PT1M30S',
      publisher: { '@type': 'Organization', name: 'SnapRec', url: 'https://www.snaprecorder.org/', logo: { '@type': 'ImageObject', url: 'https://www.snaprecorder.org/logo.png' } },
    },
  ],
};
```

---

### `HowItWorks.tsx` — Full `howToJsonLd` replacement
Fixes: removes deprecated `HowTo`, fixes `VideoObject` publisher + `uploadDate`, adds `ItemList` for steps.

```js
const howToJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      name: 'How SnapRec Works — Screen Recorder & Screenshot Tool',
      description: 'Learn how to use SnapRec to record your screen in 4K, capture full-page screenshots, annotate images, and share via link — all free, no watermarks.',
      url: 'https://www.snaprecorder.org/how-it-works/',
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', 'h2', 'main > section:first-of-type p'] },
    },
    {
      '@type': 'ItemList',
      name: 'How to Record Your Screen & Take Screenshots in Chrome',
      itemListElement: steps.map((s, i) => ({
        '@type': 'ListItem', position: i + 1, name: s.title, description: s.description,
      })),
    },
    {
      '@type': 'VideoObject',
      name: 'How to use SnapRec - Screen recorder & screenshot tool',
      description: 'Watch the full walkthrough: record your screen in 4K, capture screenshots, annotate, and share — all free with SnapRec.',
      thumbnailUrl: 'https://img.youtube.com/vi/tEY5kA97Zq8/maxresdefault.jpg',
      uploadDate: '2026-02-01T08:00:00+00:00',
      contentUrl: 'https://www.youtube.com/watch?v=tEY5kA97Zq8',
      embedUrl: 'https://www.youtube.com/embed/tEY5kA97Zq8',
      duration: 'PT1M30S',
      publisher: { '@type': 'Organization', name: 'SnapRec', url: 'https://www.snaprecorder.org/', logo: { '@type': 'ImageObject', url: 'https://www.snaprecorder.org/logo.png' } },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.snaprecorder.org/' },
        { '@type': 'ListItem', position: 2, name: 'How It Works', item: 'https://www.snaprecorder.org/how-it-works/' },
      ],
    },
  ],
};
```

---

### `BlogPost.tsx` — `buildBlogPostJsonLd` BlogPosting node update
Fixes: adds `inLanguage`, `updatedDate` fallback for `dateModified`, consistent `publisher.url`, expands publisher logo.

```js
// Replace the BlogPosting node inside buildBlogPostJsonLd:
{
  '@type': 'BlogPosting',
  headline: post.title,
  description: post.description,
  url: postUrl,
  inLanguage: 'en',
  mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl },
  image: { '@type': 'ImageObject', url: `${siteUrl}/og-image.png`, width: 2848, height: 1504 },
  datePublished: new Date(post.date).toISOString(),
  dateModified: new Date(post.updatedDate ?? post.date).toISOString(),
  author: [{ '@type': 'Person', name: 'Ghulam Muhammad', url: `${siteUrl}/about/` }],
  publisher: { '@type': 'Organization', name: 'SnapRec', url: `${siteUrl}/`, logo: { '@type': 'ImageObject', url: `${siteUrl}/logo.png`, width: 1024, height: 1024 } },
  speakable: { '@type': 'SpeakableSpecification', cssSelector: ['article h1', '.prose h2', '.prose p:first-of-type'] },
}
```

Add to `BlogPost` interface in `blogData.ts`:
```ts
updatedDate?: string; // ISO date e.g. '2026-04-15'
```

---

### `About.tsx` — Add `Person` node to `jsonLd`
Fixes: adds Person schema for founder, adds `item` to BreadcrumbList terminal node, fixes trailing slashes.

```js
// Replace existing jsonLd prop:
{
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'AboutPage',
      name: 'About SnapRec',
      url: 'https://www.snaprecorder.org/about/',
      description: 'Learn about SnapRec — a free, open-source screen recorder and screenshot tool for Chrome.',
      publisher: { '@type': 'Organization', name: 'SnapRec', url: 'https://www.snaprecorder.org/' },
    },
    {
      '@type': 'Person',
      '@id': 'https://www.snaprecorder.org/about/#founder',
      name: 'Ghulam Muhammad',
      url: 'https://www.snaprecorder.org/about/',
      jobTitle: 'Software Engineer & Founder',
      worksFor: { '@type': 'Organization', name: 'SnapRec', url: 'https://www.snaprecorder.org/' },
      sameAs: ['https://github.com/gmdahri'],
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.snaprecorder.org/' },
        { '@type': 'ListItem', position: 2, name: 'About', item: 'https://www.snaprecorder.org/about/' },
      ],
    },
  ],
}
```

---

### `Blog.tsx` — Add `ItemList` + fix trailing slashes

```js
// Replace existing jsonLd prop:
{
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      name: 'SnapRec Blog — Screen Recording Tips, Tutorials & Comparisons',
      description: 'Free tutorials, tool comparisons, and expert tips from the SnapRec team.',
      url: 'https://www.snaprecorder.org/blog/',
      publisher: { '@type': 'Organization', name: 'SnapRec', url: 'https://www.snaprecorder.org/' },
    },
    {
      '@type': 'ItemList',
      itemListElement: blogPosts.map((post, idx) => ({
        '@type': 'ListItem', position: idx + 1, name: post.title,
        url: `https://www.snaprecorder.org/blog/${post.slug}/`,
      })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.snaprecorder.org/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://www.snaprecorder.org/blog/' },
      ],
    },
  ],
}
```

---

### `Changelog.tsx` — Add `SoftwareApplication` version node + fix trailing slashes

```js
// Replace existing jsonLd prop:
{
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      name: 'SnapRec Changelog',
      url: 'https://www.snaprecorder.org/changelog/',
      description: 'Latest updates, features, and bug fixes for SnapRec screen recorder.',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'SnapRec',
      url: 'https://www.snaprecorder.org/',
      softwareVersion: '1.2.8',
      releaseNotes: 'https://www.snaprecorder.org/changelog/',
      applicationCategory: 'BrowserApplication',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.snaprecorder.org/' },
        { '@type': 'ListItem', position: 2, name: 'Changelog', item: 'https://www.snaprecorder.org/changelog/' },
      ],
    },
  ],
}
```

---

### Comparison/Landing Pages — Trailing slash + BreadcrumbList `item` fix pattern
Apply to: `LoomAlternative.tsx`, `ScreencastifyAlternative.tsx`, `ScreenRecorderForTeachers.tsx`, `WebcamOverlayPresentation.tsx`

For each file:
1. Change `WebPage.url` from `https://www.snaprecorder.org/[slug]` → `https://www.snaprecorder.org/[slug]/`
2. Add `item` to BreadcrumbList terminal ListItem matching the trailing-slash URL
3. Full per-page implementations in the schema audit output above

---

## GEO Deep Dive — Platform Scores & Implementation Details

*From dedicated GEO audit, 2026-05-07. Score revised to 71/100.*

| Platform | Score | Primary Gap |
|---|---|---|
| Perplexity | 74/100 | No external citations/statistics in blog posts |
| Google AI Overviews | 68/100 | No HowTo schema on tutorials; dateModified stagnation; no WebPage SpeakableSpecification on homepage |
| ChatGPT Web Search | 65/100 | No YouTube channel in sameAs, no Reddit presence, llms.txt too thin |
| Bing Copilot | 62/100 | No Bing Webmaster Tools verification, no LinkedIn, no Wikipedia |

### GEO Reference — HowTo schema builder code (for H15)

Add to `BlogPost.tsx` inside the JSON-LD graph builder, after the existing nodes:

```js
if (post.steps?.length) {
  graph.push({
    '@type': 'HowTo',
    name: post.title,
    description: post.description,
    totalTime: 'PT10M',
    tool: { '@type': 'HowToTool', name: 'SnapRec Chrome Extension' },
    step: post.steps.map((s, i) => ({
      '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text,
    })),
  });
}
```

Add to `BlogPost` interface in `blogData.ts`:
```ts
steps?: { name: string; text: string }[];
```

---

### GEO Reference — Pre-drafted llms.txt content (copy-paste ready)

Add the following sections to `apps/web/public/llms.txt` after the existing `## Content License` section:

```markdown
## Frequently Asked Questions

**Is SnapRec really free?**
Yes. SnapRec is 100% free with no hidden tier, no paid plan, and no trial period. There are no watermarks on recordings or screenshots, no time limits, no video caps, and no mandatory account required to start capturing.

**Does SnapRec require an account?**
No account is required to capture screens, record, annotate, download, or generate a shareable link. An optional Google account sign-in unlocks a personal cloud library, cross-device access, and recording analytics.

**What browsers does SnapRec work on?**
SnapRec works on all Chromium-based browsers: Google Chrome, Microsoft Edge, and Brave. It does not work on Firefox or Safari, which use different extension APIs.

**What can SnapRec record?**
SnapRec can record a full screen, a specific application window, or a single browser tab. It captures system audio, microphone input, and webcam simultaneously. Maximum resolution is 4K.

**Can SnapRec capture full-page screenshots?**
Yes. SnapRec can capture the full height of a webpage beyond the visible viewport, the visible area only, or a manually selected region. Screenshots open directly in the built-in annotation editor.

**How does SnapRec compare to Loom?**
Loom's free plan limits recordings to 5 minutes per video and 25 total stored videos, and requires account creation. SnapRec has no time limit, no video cap, no watermarks, and no account requirement. SnapRec also records at up to 4K and includes a full-page screenshot tool that Loom does not offer.

**How does SnapRec compare to Screencastify?**
Screencastify's free plan limits recordings to 30 minutes and adds watermarks. SnapRec has no recording time limit and no watermarks at any tier, as there is only one tier: free.

**Where are recordings stored?**
Recordings are processed locally in the browser. If you choose to share via link, the file is uploaded to SnapRec's cloud storage (Cloudflare R2) and a shareable URL is generated. You can delete cloud recordings at any time. Downloading locally bypasses cloud storage entirely.

**Does SnapRec work on Chromebooks?**
Yes. SnapRec is a Chrome extension and works on Chrome OS / Chromebooks via the Chrome browser and the Chrome Web Store.

**What keyboard shortcuts does SnapRec use?**
Default shortcuts: Ctrl+Shift+1 (full-page screenshot), Ctrl+Shift+2 (visible area screenshot), Ctrl+Shift+3 (region screenshot), Ctrl+Shift+4 (start/stop screen recording). Shortcuts can be customized in Chrome's extension shortcut settings.


## Use Cases

**Bug reports for developers and QA teams**
Record a screen capture showing the exact steps to reproduce a bug, including browser console activity. Generate a shareable link and paste it into a GitHub issue, Jira ticket, or Slack message. Eliminates ambiguous text descriptions of visual bugs.

**Tutorial and instructional video creation**
Record step-by-step walkthroughs of software or processes with narration and optional webcam overlay. Auto-zoom automatically highlights mouse clicks during playback, making tutorials appear professionally edited without post-production.

**Async team communication**
Replace long written messages or meeting invitations with a short screen recording. Teammates watch on their own schedule. Useful for remote and distributed teams across time zones.

**Sales demos and product walkthroughs**
Record a personalized product demo once and send the shareable link to multiple prospects. Supports webcam overlay. No watermarks or SnapRec branding on the recording.

**Teacher and educator screen capture**
Capture instructional content, annotate diagrams, record lectures, or create flipped classroom materials. No subscription required. Works on school-issued Chromebooks.

**Customer support and onboarding**
Support agents record a short walkthrough showing a customer how to complete a task instead of writing multi-step instructions. Reduces support ticket resolution time for visually complex issues.

**Design and UX feedback**
Annotate screenshots with arrows, text labels, and highlight boxes to give precise visual feedback on mockups and production UIs. Blur tool redacts sensitive data before sharing.

**Recording Google Meet, Zoom, or Teams meetings**
Use tab recording mode to capture browser-based meetings with audio without requiring host permission or a meeting recording feature enabled by the platform administrator.


## Version History

- v1.2.8 (2026-04-06): Author bio boxes added to all blog posts; Person schema deployed; canonical URL trailing-slash fix; sitemap updated
- v1.2.7 (2026-03-15): Blog post content expanded; new posts added covering Windows, Mac, Chromebook, and remote team workflows
- v1.2.6 (2026-02-20): Auto-zoom playback feature added; keyboard shortcut customization support introduced
- v1.2.5 (2026-02-01): Webcam overlay (picture-in-picture) mode added; system audio and microphone simultaneous capture enabled
- v1.2.0 (2025-12-01): Annotation editor launched; full-page screenshot engine rewritten
- v1.1.0 (2025-09-01): Cloud sharing via Cloudflare R2 introduced; instant shareable link generation added
- v1.0.0 (2025-06-01): Initial release — screen recording, visible area screenshot, download as MP4/WebM
```

Also **replace** the existing `## Content License` section in llms.txt with:

```markdown
## Content License
Blog content and documentation are original works by SnapRec. Content may be cited by AI systems and search engines with attribution to SnapRec (https://www.snaprecorder.org/). Reproduction of full articles requires written permission. Factual data, feature comparisons, and FAQ answers may be extracted and cited freely provided the source URL is included.

AI training use: SnapRec does not authorize its content for AI model training datasets. Citation and indexing for search and answer generation is permitted.
```

---

## Backlink Building

**Current profile (estimated):** Domain Rating < 10, referring domains < 50, zero dofollow editorial links. All three known sources (Chrome Web Store, Product Hunt, GitHub) are nofollow. The site does not appear in any top-10 SERP result, which is consistent with near-zero link authority.

**Competitor context for scale:**

| Competitor | Est. DR | Est. Referring Domains |
|---|---|---|
| Loom | ~85 | 15,000+ |
| Screencastify | ~72 | 5,000+ |
| Vmaker | ~55 | 1,500+ |
| Cap (cap.so) | ~40 | 300+ |
| ScreenApp | ~35 | 200+ |

### Tier 1 — Zero-cost directory listings (do this week)

- [ ] **G2** — Submit SnapRec at `g2.com/products/snaprec`. G2 category pages for "Screen Recording Software" rank for dozens of commercial keywords. DA ~90, dofollow profile page.
- [ ] **Capterra** — Submit at `capterra.com`. Ranks alongside G2 for all comparison queries. DA ~88.
- [ ] **AlternativeTo** — Add at `alternativeto.net`. "Alternatives to Loom" and "Alternatives to Screencastify" pages rank top-5 for those queries — high-intent traffic.
- [ ] **Product Hunt** — Already listed. Verify the listing's `Website` link points correctly to `https://www.snaprecorder.org/`.
- [ ] **Slant.co** — Add to screen recorder comparisons. Ranks for "what is the best X" niche queries.

### Tier 2 — Additional directory/resource listings (this month)

- [ ] **There's An AI For That** (`theresanaiforthat.com`) — Chrome extension tools category.
- [ ] **Futurepedia** — AI/productivity tools directory.
- [ ] **Awesome Chrome Extensions GitHub lists** — Multiple GitHub repos list useful Chrome extensions; many have DR 50+.
- [ ] **SaaSHub** (`saashub.com`) — Competes directly with G2/Capterra for lower-volume SaaS queries.
- [ ] **CrXcavator / extension.ninja** — Chrome extension-specific directories.

### Tier 3 — Editorial outreach (1–3 months)

- [ ] **"Best free screen recorder" roundups** — Target the posts ranking #1–5 for this query (EaseUS, Kommodo, Vmaker posts each get 10–20K monthly visitors). Getting SnapRec mentioned in one equals dozens of directory links in authority terms.
- [ ] **Chrome extension blogs and newsletters** — "What's New in Chrome" community posts, Chrome extension curator newsletters.
- [ ] **Teacher/EdTech blogs** — Screencastify dominated education. SnapRec's no-account + free features are ideal. Target `teachthought.com`, `edutopia.org` resource lists.
- [ ] **Indie Hackers / Show HN** — Open source + free angle fits HN/IH community. A "Show HN" post drives both links and initial users. Post when the product has a clear "built this because..." story.
- [ ] **Reddit presence** — Post in r/selfhosted, r/chrome, r/screencasting, r/productivity. NoFollow links but drives traffic and brand signals that improve AI citation probability.
- [ ] **Wikipedia** — Even a mention on the "screen recorder" Wikipedia page would substantially boost Perplexity and Bing Copilot citation probability.

### How to measure progress

- **Free check now:** Go to `moz.com/domain-analysis`, enter `snaprecorder.org` — shows DA, spam score, and top linking domains without an account.
- **For full data:** Install the DataForSEO MCP extension for Claude Code and run `/seo dataforseo` for live referring domain counts, anchor text distribution, and link quality scoring.
- **Target milestones:** DR 10 → 20 → 30 over 6–12 months of consistent directory + editorial outreach.

---

*Last updated: 2026-05-07 (GEO deep audit added)*
