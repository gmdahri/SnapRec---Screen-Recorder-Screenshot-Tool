export interface BlogPost {
    slug: string;
    title: string;
    description: string;
    keywords: string;
    date: string;
    readTime: string;
    category: 'tutorial' | 'comparison' | 'tips';
    heroIcon: string;
    content: string;
}

export const blogPosts: BlogPost[] = [
    {
        slug: 'how-to-record-screen-chrome-free',
        title: 'How to Record Your Screen on Chrome for Free (2026)',
        description: 'Learn how to record your screen on Chrome for free with no watermarks, no time limits, and 4K quality. Step-by-step guide using SnapRec.',
        keywords: 'how to record screen on chrome, free screen recorder chrome, screen recording chrome, record screen free, chrome screen recorder, how to screen record, record screen on chromebook, screen recorder chrome extension free',
        date: '2026-03-01',
        readTime: '5 min read',
        category: 'tutorial',
        heroIcon: 'videocam',
        content: `
<h2 id="why-record-screen">Why Record Your Screen on Chrome?</h2>
<p>Screen recording has become essential for remote teams, educators, and content creators. Whether you're creating a product walkthrough, recording a bug report, or making a tutorial video, having a reliable screen recorder built right into your browser saves time and eliminates the need for bulky desktop software.</p>
<p>In this guide, we'll show you how to record your screen on Chrome in just 3 clicks — completely free, with no watermarks, and in up to 4K quality.</p>

<h2 id="what-you-need">What You Need</h2>
<ul>
<li><strong>Google Chrome</strong>, Microsoft Edge, or Brave browser</li>
<li><strong>SnapRec extension</strong> — a free, lightweight Chrome extension</li>
<li>That's it. No account required to start recording.</li>
</ul>

<h2 id="step-by-step">Step-by-Step: Record Your Screen on Chrome</h2>

<h3>Step 1: Install SnapRec</h3>
<p>Head to the <a href="https://chromewebstore.google.com/detail/snaprec-screen-recorder-s/lgafjgnifbjeafallnkkfpljgbilfajg" target="_blank" rel="noopener noreferrer">Chrome Web Store</a> and click <strong>"Add to Chrome"</strong>. The extension installs in seconds and requires minimal permissions.</p>

<h3>Step 2: Click the SnapRec Icon</h3>
<p>Click the SnapRec icon in your browser toolbar. You'll see options to:</p>
<ul>
<li><strong>Record Screen</strong> — capture your entire screen, a specific window, or a browser tab</li>
<li><strong>Take Screenshot</strong> — capture the visible area, full page, or a selected region</li>
</ul>

<h3>Step 3: Choose Your Recording Mode</h3>
<p>Select what you want to record:</p>
<ul>
<li><strong>Full Screen</strong> — records everything on your display</li>
<li><strong>Browser Tab</strong> — records just the current tab (great for app demos)</li>
<li><strong>Window</strong> — records a specific application window</li>
</ul>
<p>You can also enable your <strong>webcam overlay</strong> and <strong>microphone</strong> for narrated recordings.</p>

<h3>Step 4: Hit Record</h3>
<p>Click the record button. Chrome will ask you to confirm which screen or tab to share. Select your target and recording begins immediately.</p>

<h3>Step 5: Stop and Save</h3>
<p>Click the stop button when you're done. Your recording appears instantly in SnapRec's viewer where you can:</p>
<ul>
<li><strong>Download</strong> the video locally</li>
<li><strong>Generate a shareable link</strong> to send to anyone</li>
<li><strong>Save to your account</strong> for later access</li>
</ul>

<h2 id="features">Key Features of SnapRec Screen Recorder</h2>
<table>
<thead><tr><th>Feature</th><th>SnapRec (Free)</th><th>Others (Paid)</th></tr></thead>
<tbody>
<tr><td>4K Recording</td><td>✅ Yes</td><td>Usually paid tier</td></tr>
<tr><td>Watermarks</td><td>❌ None</td><td>Often added on free plans</td></tr>
<tr><td>Time Limit</td><td>∞ Unlimited</td><td>5-10 min on free plans</td></tr>
<tr><td>Webcam Overlay</td><td>✅ Yes</td><td>Varies</td></tr>
<tr><td>System Audio</td><td>✅ Yes</td><td>Varies</td></tr>
<tr><td>Cloud Sharing</td><td>✅ Free</td><td>Usually paid</td></tr>
</tbody>
</table>

<h2 id="tips">Pro Tips for Better Screen Recordings</h2>
<ol>
<li><strong>Close unnecessary tabs</strong> — reduces distractions and improves performance</li>
<li><strong>Use a good microphone</strong> — even a basic headset dramatically improves audio clarity</li>
<li><strong>Plan your recording</strong> — know what you'll show before hitting record</li>
<li><strong>Use the tab recording mode</strong> — captures system audio perfectly for demos</li>
<li><strong>Share via link</strong> — faster than uploading to YouTube for quick team shares</li>
</ol>

<h2 id="faq">Frequently Asked Questions</h2>
<h3>Can I record my screen on Chrome without an extension?</h3>
<p>Chrome doesn't have a built-in screen recorder. You need either a browser extension like SnapRec or a desktop application. SnapRec is the lightest option — it's under 1MB and works instantly.</p>

<h3>Is SnapRec really free?</h3>
<p>Yes, 100% free. No hidden limits, no watermarks, no time caps, and no mandatory sign-up.</p>

<h3>Does it work on Chromebook?</h3>
<p>Yes! SnapRec works on any device that runs Chrome, including Chromebooks.</p>
        `,
    },
    {
        slug: 'best-free-screen-recorders-no-watermark',
        title: '5 Best Free Screen Recorders in 2026 — No Watermark, No Limits',
        description: 'Compare the best free screen recorders that don\'t add watermarks. We review SnapRec, OBS, ShareX, and more to find the best option for you.',
        keywords: 'best free screen recorder, screen recorder no watermark, free screen recorder no watermark, screen recorder free, best screen recorder 2026, free recording software, screen capture free',
        date: '2026-03-01',
        readTime: '7 min read',
        category: 'comparison',
        heroIcon: 'compare',
        content: `
<h2 id="intro">Finding a Truly Free Screen Recorder</h2>
<p>Most "free" screen recorders come with a catch: watermarks, time limits, or forced sign-ups. We tested dozens of tools and found the 5 that are genuinely free with no strings attached.</p>

<h2 id="comparison-table">Quick Comparison</h2>
<table>
<thead><tr><th>Tool</th><th>Platform</th><th>Watermark</th><th>Time Limit</th><th>Cloud Sharing</th><th>Best For</th></tr></thead>
<tbody>
<tr><td><strong>SnapRec</strong></td><td>Chrome Extension</td><td>❌ None</td><td>∞ Unlimited</td><td>✅ Free</td><td>Quick recordings & sharing</td></tr>
<tr><td><strong>OBS Studio</strong></td><td>Desktop App</td><td>❌ None</td><td>∞ Unlimited</td><td>❌ No</td><td>Streaming & advanced setups</td></tr>
<tr><td><strong>ShareX</strong></td><td>Windows Only</td><td>❌ None</td><td>∞ Unlimited</td><td>✅ Via integrations</td><td>Power users on Windows</td></tr>
<tr><td><strong>Screencastify</strong></td><td>Chrome Extension</td><td>✅ Yes (free)</td><td>30 min</td><td>✅ Paid</td><td>Education</td></tr>
<tr><td><strong>Loom</strong></td><td>Desktop + Extension</td><td>❌ None</td><td>5 min (free)</td><td>✅ Paid</td><td>Business messaging</td></tr>
</tbody>
</table>

<h2 id="snaprec">1. SnapRec — Best Free Chrome Extension</h2>
<p><strong>Price:</strong> 100% Free | <strong>Platform:</strong> Chrome, Edge, Brave</p>
<p>SnapRec is a lightweight Chrome extension that records your screen in up to 4K with no watermarks and no time limits. It's the fastest way to make a recording and share it via link.</p>
<h3>Pros</h3>
<ul>
<li>Truly free — no premium tier, no watermarks, no time limits</li>
<li>4K recording with webcam overlay and audio</li>
<li>Instant cloud sharing via link</li>
<li>Built-in screenshot tool with annotation editor</li>
<li>Works on all Chromium browsers</li>
</ul>
<h3>Cons</h3>
<ul>
<li>Browser-based only (no native desktop recording)</li>
<li>Newer tool with a smaller community</li>
</ul>
<p><strong>Verdict:</strong> Best for anyone who wants a fast, no-nonsense screen recorder directly in their browser. If you don't need OBS-level complexity, SnapRec is the easiest option.</p>

<h2 id="obs">2. OBS Studio — Best for Advanced Users</h2>
<p><strong>Price:</strong> Free & Open Source | <strong>Platform:</strong> Windows, Mac, Linux</p>
<p>OBS (Open Broadcaster Software) is the gold standard for screen recording and live streaming. It's incredibly powerful but has a steep learning curve.</p>
<h3>Pros</h3>
<ul>
<li>Extremely customizable with scenes, sources, and filters</li>
<li>Supports live streaming to Twitch, YouTube, etc.</li>
<li>Free and open source with no limitations</li>
</ul>
<h3>Cons</h3>
<ul>
<li>Complex setup — not beginner-friendly</li>
<li>No built-in sharing or cloud features</li>
<li>Resource-intensive — can slow down lower-end machines</li>
</ul>

<h2 id="sharex">3. ShareX — Best for Windows Power Users</h2>
<p><strong>Price:</strong> Free & Open Source | <strong>Platform:</strong> Windows only</p>
<p>ShareX is an incredibly feature-rich capture tool for Windows. It handles screenshots, screen recordings, GIFs, and even OCR text recognition.</p>
<h3>Pros</h3>
<ul>
<li>Massive feature set (screen recording, GIFs, OCR, file uploads)</li>
<li>Highly customizable workflows and hotkeys</li>
<li>Upload to 80+ cloud services</li>
</ul>
<h3>Cons</h3>
<ul>
<li>Windows only</li>
<li>Overwhelming UI for beginners</li>
<li>No webcam overlay for recordings</li>
</ul>

<h2 id="screencastify">4. Screencastify — Best for Education</h2>
<p><strong>Price:</strong> Free (limited) / Paid | <strong>Platform:</strong> Chrome Extension</p>
<p>Popular with teachers and students, Screencastify is easy to use but the free plan adds watermarks and limits recordings to 30 minutes.</p>
<h3>Pros</h3>
<ul>
<li>Very simple and beginner-friendly</li>
<li>Built for education with Google Classroom integration</li>
</ul>
<h3>Cons</h3>
<ul>
<li>Watermark on free recordings</li>
<li>30-minute time limit on free plan</li>
<li>Need to pay for full features</li>
</ul>

<h2 id="loom">5. Loom — Best for Business Messaging</h2>
<p><strong>Price:</strong> Free (limited) / Paid | <strong>Platform:</strong> Desktop + Chrome Extension</p>
<p>Loom is designed for async video messaging in teams. The free plan limits recordings to 5 minutes and 25 videos.</p>
<h3>Pros</h3>
<ul>
<li>Beautiful sharing experience</li>
<li>Viewer analytics and engagement tracking</li>
<li>Team workspace features</li>
</ul>
<h3>Cons</h3>
<ul>
<li>5-minute limit on free plan</li>
<li>25 video limit on free plan</li>
<li>Paid plans start at $12.50/month</li>
</ul>

<h2 id="verdict">The Verdict</h2>
<p>For most people who need a quick, reliable screen recorder without the hassle:</p>
<ul>
<li><strong>Use SnapRec</strong> if you want instant recording + sharing from your browser</li>
<li><strong>Use OBS</strong> if you need studio-grade control or live streaming</li>
<li><strong>Use ShareX</strong> if you're a Windows power user who wants everything in one tool</li>
</ul>
        `,
    },
    {
        slug: 'how-to-take-full-page-screenshot-chrome',
        title: 'How to Take a Full-Page Screenshot in Chrome (3 Easy Methods)',
        description: 'Learn 3 easy ways to capture a full-page screenshot in Chrome — using DevTools, Chrome\'s built-in tool, and the SnapRec extension.',
        keywords: 'full page screenshot chrome, screenshot entire page chrome, how to take full page screenshot, chrome screenshot extension, full page capture, screenshot whole page, scrolling screenshot chrome',
        date: '2026-03-01',
        readTime: '4 min read',
        category: 'tutorial',
        heroIcon: 'screenshot_monitor',
        content: `
<h2 id="intro">Why Full-Page Screenshots?</h2>
<p>Sometimes you need to capture an entire webpage — not just what's visible on your screen. Whether it's a design review, bug documentation, or saving a receipt, a full-page screenshot captures everything from top to bottom in one image.</p>
<p>Here are 3 ways to do it in Chrome, from quickest to most powerful.</p>

<h2 id="method-1">Method 1: Chrome DevTools (Built-in, No Extension)</h2>
<p>Chrome has a hidden full-page screenshot feature in DevTools:</p>
<ol>
<li>Press <code>Ctrl+Shift+I</code> (Windows) or <code>Cmd+Option+I</code> (Mac) to open DevTools</li>
<li>Press <code>Ctrl+Shift+P</code> (Windows) or <code>Cmd+Shift+P</code> (Mac) to open the Command Menu</li>
<li>Type <strong>"screenshot"</strong> and select <strong>"Capture full-size screenshot"</strong></li>
<li>The screenshot saves automatically to your Downloads folder</li>
</ol>
<p><strong>Pros:</strong> No extension needed, works immediately<br/>
<strong>Cons:</strong> Multiple steps, no annotation tools, can miss dynamic content</p>

<h2 id="method-2">Method 2: SnapRec Extension (Recommended)</h2>
<p>The fastest and most feature-rich method:</p>
<ol>
<li>Install <a href="https://chromewebstore.google.com/detail/snaprec-screen-recorder-s/lgafjgnifbjeafallnkkfpljgbilfajg" target="_blank" rel="noopener noreferrer">SnapRec from the Chrome Web Store</a></li>
<li>Click the SnapRec icon → <strong>Full Page Screenshot</strong></li>
<li>SnapRec automatically scrolls and captures the entire page</li>
<li>The screenshot opens in SnapRec's <strong>built-in editor</strong> where you can annotate, blur, highlight, or crop</li>
<li>Download or share via link</li>
</ol>
<p><strong>Pros:</strong> One-click, built-in editor, share via link, supports annotation<br/>
<strong>Cons:</strong> Requires extension installation</p>

<h2 id="method-3">Method 3: Print to PDF (Workaround)</h2>
<p>If you just need a quick save of a full page:</p>
<ol>
<li>Press <code>Ctrl+P</code> (Windows) or <code>Cmd+P</code> (Mac)</li>
<li>Change destination to <strong>"Save as PDF"</strong></li>
<li>Click <strong>Save</strong></li>
</ol>
<p><strong>Pros:</strong> No tools needed, preserves text as selectable<br/>
<strong>Cons:</strong> Not an image, formatting may break, no annotation</p>

<h2 id="comparison">Which Method Should You Use?</h2>
<table>
<thead><tr><th>Method</th><th>Speed</th><th>Quality</th><th>Annotation</th><th>Sharing</th></tr></thead>
<tbody>
<tr><td>DevTools</td><td>⭐⭐</td><td>⭐⭐⭐</td><td>❌</td><td>❌</td></tr>
<tr><td><strong>SnapRec</strong></td><td>⭐⭐⭐</td><td>⭐⭐⭐</td><td>✅</td><td>✅</td></tr>
<tr><td>Print to PDF</td><td>⭐⭐⭐</td><td>⭐⭐</td><td>❌</td><td>❌</td></tr>
</tbody>
</table>
<p><strong>Our recommendation:</strong> Use SnapRec for regular screenshot workflows. The built-in annotation editor and cloud sharing make it the most productive option.</p>

<h2 id="faq">FAQ</h2>
<h3>Can I take a scrolling screenshot on Chrome mobile?</h3>
<p>Chrome on Android supports scrolling screenshots natively (Android 12+). On iOS, you can take a full-page screenshot in Safari but not Chrome.</p>

<h3>Why is my full-page screenshot cut off?</h3>
<p>Some pages use lazy-loading for images. Try scrolling to the bottom of the page first before capturing, or use SnapRec which handles this automatically.</p>
        `,
    },
    {
        slug: 'snaprec-vs-loom-free-alternative',
        title: 'SnapRec vs Loom — The Best Free Screen Recorder Alternative (2026)',
        description: 'SnapRec is the free Loom alternative with no time limits, no watermarks, and 4K recording. See how they compare feature by feature.',
        keywords: 'loom alternative free, snaprec vs loom, free loom alternative, screen recorder vs loom, loom free alternative, loom competitor, screen recorder like loom',
        date: '2026-03-01',
        readTime: '6 min read',
        category: 'comparison',
        heroIcon: 'balance',
        content: `
<h2 id="intro">Looking for a Free Loom Alternative?</h2>
<p>Loom is one of the most popular screen recording tools for async video communication. But with its free plan limited to <strong>5-minute recordings</strong> and <strong>25 total videos</strong>, many users are looking for alternatives that don't restrict their usage.</p>
<p>Enter <strong>SnapRec</strong> — a free Chrome extension that offers unlimited recording with no watermarks, up to 4K quality. Let's see how they compare.</p>

<h2 id="comparison">Feature-by-Feature Comparison</h2>
<table>
<thead><tr><th>Feature</th><th>SnapRec (Free)</th><th>Loom Free</th><th>Loom Business ($12.50/mo)</th></tr></thead>
<tbody>
<tr><td>Recording Length</td><td>∞ Unlimited</td><td>5 minutes</td><td>∞ Unlimited</td></tr>
<tr><td>Number of Videos</td><td>∞ Unlimited</td><td>25 videos</td><td>∞ Unlimited</td></tr>
<tr><td>Watermarks</td><td>❌ None</td><td>❌ None</td><td>❌ None</td></tr>
<tr><td>Resolution</td><td>Up to 4K</td><td>720p</td><td>4K</td></tr>
<tr><td>Webcam Overlay</td><td>✅</td><td>✅</td><td>✅</td></tr>
<tr><td>System Audio</td><td>✅</td><td>✅</td><td>✅</td></tr>
<tr><td>Cloud Sharing</td><td>✅ Free</td><td>✅</td><td>✅</td></tr>
<tr><td>Screenshots</td><td>✅ Full-page + annotation</td><td>❌</td><td>❌</td></tr>
<tr><td>Price</td><td><strong>$0</strong></td><td>$0 (limited)</td><td>$12.50/mo/user</td></tr>
</tbody>
</table>

<h2 id="when-snaprec">When to Choose SnapRec</h2>
<ul>
<li>You want <strong>truly unlimited</strong> recordings with no per-video or per-minute caps</li>
<li>You need <strong>4K quality</strong> without paying for a premium plan</li>
<li>You also need a <strong>screenshot tool</strong> with annotation capabilities</li>
<li>You prefer a <strong>lightweight browser extension</strong> over installing a desktop app</li>
<li>You're a solo creator, freelancer, or small team that doesn't need enterprise features</li>
</ul>

<h2 id="when-loom">When to Choose Loom</h2>
<ul>
<li>You're in a <strong>large organization</strong> that needs workspace management and admin controls</li>
<li>You need <strong>viewer analytics</strong> (who watched, how much they watched)</li>
<li>You need <strong>CRM integrations</strong> (Salesforce, HubSpot, etc.)</li>
<li>You have the budget for $12.50/user/month</li>
</ul>

<h2 id="bottom-line">The Bottom Line</h2>
<p>Loom is a great product, but its free plan is too restrictive for most users. If you're hitting the 5-minute wall or the 25-video limit, SnapRec gives you everything you need — completely free.</p>
<p><strong>SnapRec is what Loom's free plan should be:</strong> unlimited recordings, 4K quality, cloud sharing, and screenshots — all at $0.</p>
        `,
    },
    {
        slug: 'record-screen-with-audio-webcam-chrome',
        title: 'How to Record Screen with Audio and Webcam on Chrome',
        description: 'Step-by-step guide to recording your screen with system audio, microphone, and webcam overlay on Chrome using SnapRec — 100% free.',
        keywords: 'screen recorder with audio, record screen with webcam, chrome screen recorder audio, screen recording with webcam overlay, how to record screen with sound, screen recorder microphone, record browser tab with audio',
        date: '2026-03-01',
        readTime: '5 min read',
        category: 'tutorial',
        heroIcon: 'mic',
        content: `
<h2 id="intro">Recording with Audio and Webcam — Why It Matters</h2>
<p>A screen recording without audio is like a presentation without a speaker. Adding your voice narration and a webcam overlay transforms a simple screen capture into a professional video message, tutorial, or demo.</p>
<p>Here's how to record your screen with both audio and webcam on Chrome — completely free.</p>

<h2 id="setup">Setting Up SnapRec for Audio + Webcam Recording</h2>

<h3>Step 1: Install SnapRec</h3>
<p>If you haven't already, install <a href="https://chromewebstore.google.com/detail/snaprec-screen-recorder-s/lgafjgnifbjeafallnkkfpljgbilfajg" target="_blank" rel="noopener noreferrer">SnapRec from the Chrome Web Store</a>. It's free and takes seconds.</p>

<h3>Step 2: Open SnapRec and Configure</h3>
<p>Click the SnapRec icon in your toolbar and configure your recording:</p>
<ul>
<li><strong>Microphone:</strong> Toggle ON to capture your narration</li>
<li><strong>System Audio:</strong> Toggle ON to capture sounds from your computer (app sounds, music, etc.)</li>
<li><strong>Webcam:</strong> Toggle ON to show your face in a picture-in-picture overlay</li>
</ul>

<h3>Step 3: Choose What to Record</h3>
<p>Select your recording target:</p>
<ul>
<li><strong>Browser Tab</strong> — best for web app demos, as it captures tab audio perfectly</li>
<li><strong>Full Screen</strong> — best for multi-app workflows</li>
<li><strong>Window</strong> — best for recording a specific application</li>
</ul>

<h3>Step 4: Record and Share</h3>
<p>Hit record, demonstrate what you need, and stop when done. Your video is ready to download or share via link instantly.</p>

<h2 id="audio-tips">Getting the Best Audio Quality</h2>
<ol>
<li><strong>Use a headset or external mic</strong> — built-in laptop mics pick up keyboard noise and fan sounds</li>
<li><strong>Record in a quiet room</strong> — background noise is distracting in recordings</li>
<li><strong>Use tab recording for system audio</strong> — when recording a browser tab, Chrome captures the tab's audio directly, which gives perfect quality</li>
<li><strong>Test before recording</strong> — make a quick 5-second test to check mic levels</li>
</ol>

<h2 id="webcam-tips">Webcam Overlay Best Practices</h2>
<ul>
<li><strong>Position matters</strong> — place the webcam overlay in a corner that doesn't block important content</li>
<li><strong>Good lighting</strong> — face a window or light source for a clear, professional look</li>
<li><strong>Eye contact</strong> — look at the camera, not your screen, when speaking to the viewer</li>
<li><strong>Clean background</strong> — a tidy background or blurred background looks more professional</li>
</ul>

<h2 id="use-cases">Use Cases for Audio + Webcam Recordings</h2>
<table>
<thead><tr><th>Use Case</th><th>Audio</th><th>Webcam</th><th>Why?</th></tr></thead>
<tbody>
<tr><td>Product demo</td><td>✅ Mic</td><td>✅ Yes</td><td>Personal touch builds trust</td></tr>
<tr><td>Bug report</td><td>✅ Mic</td><td>❌ No</td><td>Narrate the steps to reproduce</td></tr>
<tr><td>Tutorial video</td><td>✅ Mic + System</td><td>✅ Yes</td><td>Teaching is more engaging face-to-face</td></tr>
<tr><td>Code review</td><td>✅ Mic</td><td>Optional</td><td>Walk through changes verbally</td></tr>
<tr><td>Sales pitch</td><td>✅ Mic</td><td>✅ Yes</td><td>Builds rapport with prospects</td></tr>
</tbody>
</table>

<h2 id="faq">FAQ</h2>
<h3>Why can't I hear system audio in my recording?</h3>
<p>System audio capture works best when recording a <strong>browser tab</strong>. If you're recording the full screen, some operating systems (especially macOS) require additional configuration. Recording a specific tab gives you perfect audio every time.</p>

<h3>Can I change the webcam position during recording?</h3>
<p>The webcam overlay position is set before recording starts. Choose the corner that works best for your content before hitting record.</p>

<h3>Does webcam recording affect video quality?</h3>
<p>No. The webcam overlay is composited into the recording without affecting the screen capture resolution. You still get up to 4K quality for the screen portion.</p>
        `,
    },
];

export const getPostBySlug = (slug: string): BlogPost | undefined => {
    return blogPosts.find((post) => post.slug === slug);
};

export const getRelatedPosts = (currentSlug: string, count = 3): BlogPost[] => {
    const current = getPostBySlug(currentSlug);
    if (!current) return blogPosts.slice(0, count);

    return blogPosts
        .filter((post) => post.slug !== currentSlug)
        .sort((a, b) => {
            if (a.category === current.category && b.category !== current.category) return -1;
            if (a.category !== current.category && b.category === current.category) return 1;
            return 0;
        })
        .slice(0, count);
};

export const categories = [
    { key: 'all', label: 'All Posts', icon: 'article' },
    { key: 'tutorial', label: 'Tutorials', icon: 'school' },
    { key: 'comparison', label: 'Comparisons', icon: 'compare' },
    { key: 'tips', label: 'Tips & Tricks', icon: 'lightbulb' },
] as const;
