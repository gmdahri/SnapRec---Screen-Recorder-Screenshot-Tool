"""
Visual SEO and Mobile Rendering Audit Script
Captures screenshots at multiple viewports for homepage and blog.
Also extracts meta tags, OG data, favicon, and heading structure.
"""

from playwright.sync_api import sync_playwright
import json, os

URLS = {
    "homepage": "https://www.snaprecorder.org/",
    "blog": "https://www.snaprecorder.org/blog",
}

VIEWPORTS = [
    {"name": "desktop", "width": 1920, "height": 1080},
    {"name": "laptop",  "width": 1366, "height": 768},
    {"name": "tablet",  "width": 768,  "height": 1024},
    {"name": "mobile",  "width": 375,  "height": 812},
]

OUTPUT_DIR = "/Users/codincops/Desktop/Projects/screenshoter/screenshots"
os.makedirs(OUTPUT_DIR, exist_ok=True)


def extract_meta(page):
    return page.evaluate("""() => {
        const get = (sel) => {
            const el = document.querySelector(sel);
            return el ? (el.content || el.getAttribute('href') || el.innerText) : null;
        };
        const getAllMeta = (prop, attr='property') => {
            const els = document.querySelectorAll(`meta[${attr}="${prop}"]`);
            return Array.from(els).map(e => e.content);
        };

        // Headings
        const headings = {};
        ['h1','h2','h3'].forEach(tag => {
            headings[tag] = Array.from(document.querySelectorAll(tag))
                .map(e => e.innerText.trim().slice(0, 120));
        });

        // Images missing alt
        const imgs = Array.from(document.querySelectorAll('img'));
        const missingAlt = imgs.filter(i => !i.alt || i.alt.trim() === '').map(i => i.src.slice(0, 100));

        // CTAs (buttons + anchor buttons)
        const ctas = Array.from(document.querySelectorAll('a[href], button'))
            .filter(el => {
                const txt = el.innerText.trim();
                return txt.length > 0 && txt.length < 60;
            })
            .slice(0, 20)
            .map(el => ({tag: el.tagName, text: el.innerText.trim(), href: el.href || null}));

        // Favicon
        const favicon = get('link[rel="icon"]') || get('link[rel="shortcut icon"]') || get('link[rel="apple-touch-icon"]');

        // Canonical
        const canonical = get('link[rel="canonical"]');

        // Viewport meta
        const viewportMeta = get('meta[name="viewport"]');

        // Font sizes – check body computed font size
        const bodyFont = window.getComputedStyle(document.body).fontSize;

        // Contrast check on first paragraph
        const p = document.querySelector('p');
        let pContrast = null;
        if (p) {
            const s = window.getComputedStyle(p);
            pContrast = {color: s.color, background: s.backgroundColor};
        }

        return {
            title: document.title,
            meta_description: get('meta[name="description"]'),
            canonical,
            viewport_meta: viewportMeta,
            og_title: getAllMeta('og:title').join(' | ') || null,
            og_description: getAllMeta('og:description').join(' | ') || null,
            og_image: getAllMeta('og:image').join(' | ') || null,
            og_type: getAllMeta('og:type').join(' | ') || null,
            twitter_card: get('meta[name="twitter:card"]'),
            twitter_image: get('meta[name="twitter:image"]'),
            favicon,
            headings,
            missing_alt_images: missingAlt,
            ctas,
            body_font_size: bodyFont,
            paragraph_style: pContrast,
            total_images: imgs.length,
        };
    }""")


def check_above_fold(page, width, height):
    """Check if H1 and primary CTA are visible in the viewport."""
    return page.evaluate(f"""() => {{
        const vw = {width};
        const vh = {height};

        const h1 = document.querySelector('h1');
        const h1Rect = h1 ? h1.getBoundingClientRect() : null;
        const h1Visible = h1Rect ? (h1Rect.top < vh && h1Rect.bottom > 0) : false;

        // Primary CTA: first prominent button/link
        const ctaCandidates = Array.from(document.querySelectorAll('a[href], button'))
            .filter(el => {{
                const txt = el.innerText.trim().toLowerCase();
                return txt.includes('start') || txt.includes('get') || txt.includes('try') ||
                       txt.includes('download') || txt.includes('install') || txt.includes('sign') ||
                       txt.includes('free') || txt.includes('record');
            }});

        const primaryCta = ctaCandidates[0];
        const ctaRect = primaryCta ? primaryCta.getBoundingClientRect() : null;
        const ctaVisible = ctaRect ? (ctaRect.top < vh && ctaRect.bottom > 0 && ctaRect.top >= 0) : false;

        // Check for horizontal scroll
        const hasHorizontalScroll = document.documentElement.scrollWidth > vw;

        return {{
            h1_text: h1 ? h1.innerText.trim().slice(0, 120) : null,
            h1_visible_above_fold: h1Visible,
            h1_top: h1Rect ? Math.round(h1Rect.top) : null,
            primary_cta_text: primaryCta ? primaryCta.innerText.trim() : null,
            primary_cta_visible: ctaVisible,
            cta_top: ctaRect ? Math.round(ctaRect.top) : null,
            has_horizontal_scroll: hasHorizontalScroll,
            scroll_width: document.documentElement.scrollWidth,
            viewport_width: vw,
        }};
    }}""")


def run_audit():
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch()

        for page_key, url in URLS.items():
            results[page_key] = {"url": url, "viewports": {}, "meta": None}

            # --- Meta extraction at desktop ---
            ctx = browser.new_context(viewport={"width": 1920, "height": 1080})
            page = ctx.new_page()
            print(f"Loading {url} for meta extraction...")
            page.goto(url, wait_until='networkidle', timeout=30000)
            results[page_key]["meta"] = extract_meta(page)
            ctx.close()

            # --- Screenshot + above-fold check at each viewport ---
            for vp in VIEWPORTS:
                vp_name = vp["name"]
                print(f"  Capturing {page_key} @ {vp_name} ({vp['width']}x{vp['height']})...")
                ctx = browser.new_context(
                    viewport={"width": vp["width"], "height": vp["height"]},
                    user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1" if vp_name == "mobile" else None
                )
                page = ctx.new_page()
                page.goto(url, wait_until='networkidle', timeout=30000)

                # Above-fold check
                fold_data = check_above_fold(page, vp["width"], vp["height"])
                results[page_key]["viewports"][vp_name] = fold_data

                # Screenshot
                out_path = f"{OUTPUT_DIR}/{page_key}_{vp_name}.png"
                page.screenshot(path=out_path, full_page=False)
                results[page_key]["viewports"][vp_name]["screenshot"] = out_path
                ctx.close()

        browser.close()

    # Save JSON results
    json_path = f"{OUTPUT_DIR}/audit_data.json"
    with open(json_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nAudit data saved to {json_path}")
    return results


if __name__ == "__main__":
    data = run_audit()
    print(json.dumps(data, indent=2))
