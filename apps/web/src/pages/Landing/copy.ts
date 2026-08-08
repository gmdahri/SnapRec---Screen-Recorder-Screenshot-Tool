/** Every string on the landing page, in one file.
 *
 * Copy lives as data so it is reviewable without reading JSX, and so the
 * comparison table's factual claims sit somewhere a person can audit them. */

export const DEMO_STEPS = [
  {
    key: 'capture', label: 'Capture',
    body: 'Record a tab, window or whole screen, or take a visible-area, region or full-page screenshot. Starts in one click from the toolbar.',
  },
  {
    key: 'refine', label: 'Refine',
    body: 'Trim the dead air, speed up the slow parts, let auto-zoom follow your clicks. On screenshots: arrows, text, numbered steps, blur or redact.',
  },
  {
    key: 'share', label: 'Share',
    body: 'Upload to get a link, or keep it local and download the file. Comments come back on the timeline or pinned to the exact spot on the image.',
  },
] as const;

export interface ComparisonRow {
  row: string;
  snap: string;
  loom: string;
  cast: string;
}

/** ⚠️ FACTUAL CLAIMS ABOUT NAMED COMPETITORS.
 *
 * Every Loom and Screencastify cell is that vendor's published free-tier limit.
 * They change, and a wrong cell on a page that names a competitor is the most
 * likely thing here to draw a complaint.
 *
 * RE-VERIFY ALL 24 COMPETITOR CELLS against loom.com/pricing and
 * screencastify.com/pricing before this ships, and update COMPARISON_CHECKED
 * to the date you checked. */
export const COMPARISON_CHECKED = 'Aug 2026';

export const COMPARISON: ComparisonRow[] = [
  { row: 'Recording length', snap: 'No cap', loom: 'Up to 5 minutes per video', cast: 'Up to 5 minutes per video' },
  { row: 'Watermark', snap: 'None', loom: 'None', cast: 'None' },
  { row: 'Account required to record', snap: 'No — saves locally', loom: 'Yes', cast: 'Yes' },
  { row: 'Number of videos kept', snap: 'No cap on the free plan', loom: '25 videos', cast: '10 videos' },
  { row: 'Screenshots', snap: 'Visible area, region, full page', loom: 'Basic screenshot', cast: 'Not included' },
  { row: 'Annotation editor', snap: 'Arrows, text, shapes, steps, blur, redact, crop', loom: 'Limited', cast: 'Limited' },
  { row: 'Webcam and system audio', snap: 'Both, free', loom: 'Both, free', cast: 'Webcam free; audio varies' },
  { row: 'Automatic zoom on clicks', snap: 'Yes, free', loom: 'Paid plans', cast: 'Not included' },
  { row: 'Trim and edit', snap: 'Trim, speed, zoom regions', loom: 'Trim only on free', cast: 'Trim, some editing' },
  { row: 'Cloud link sharing', snap: 'Yes, with comments and reactions', loom: 'Yes, with comments', cast: 'Yes' },
  { row: 'Export options', snap: 'MP4, WebM, GIF, PNG, JPG', loom: 'MP4 download', cast: 'MP4, Google Drive' },
  { row: 'Save to Google Drive', snap: 'Yes', loom: 'No', cast: 'Yes' },
];

/** The four rows that survive at 390px. Screencastify moves behind a link to
 * the desktop table rather than being squeezed into a third column. */
export const MOBILE_COMPARISON = [
  { row: 'Recording length', snap: 'Unlimited', loom: '5 min' },
  { row: 'Videos stored', snap: 'Unlimited', loom: '25' },
  { row: 'Watermark', snap: 'None', loom: 'None' },
  { row: 'Viewer account needed', snap: 'No', loom: 'No' },
] as const;

export interface Faq {
  n: number;
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  {
    n: 1, q: 'Do I need an account?',
    a: 'No. Recording, screenshots, annotation and downloading all work without signing in — captures are saved to your device. An account adds permanent cloud storage, a library, share links, comments and view counts.',
  },
  {
    n: 2, q: 'Is there a watermark or a time limit?',
    a: 'No watermark, and no cap on recording length on the free plan. Very long recordings take longer to upload and process, which is a practical limit rather than a product one.',
  },
  {
    n: 3, q: 'Where are my recordings stored?',
    a: 'Locally first, always. Uploading is a separate step you choose, and you can connect Google Drive to keep a copy there too.',
  },
  {
    n: 4, q: 'Can I record system audio and my webcam?',
    a: 'Yes — microphone, tab or system audio and webcam, together or separately. The webcam overlay can be moved and resized while you record.',
  },
  {
    n: 5, q: 'What can viewers do with a link?',
    a: 'Watch or view, comment, react, and download if you allow it. You can turn any link off, which stops it working immediately.',
  },
  {
    n: 6, q: 'Which browsers work?',
    a: 'The extension needs Chrome or another Chromium browser. Viewing, commenting and downloading work in any modern browser, including on phones.',
  },
];
