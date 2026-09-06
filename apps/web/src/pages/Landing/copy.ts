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

/** Checked against vendor pricing pages on 6 September 2026. */
export const COMPARISON_CHECKED = '6 September 2026';

export const COMPARISON: ComparisonRow[] = [
  { row: 'Recording length', snap: 'No software time cap; device capacity applies', loom: '5 minutes per video', cast: '30 minutes per video' },
  { row: 'Free video allowance', snap: 'Local captures unlimited; cloud allowances apply', loom: '25 videos per person', cast: '10 videos' },
  { row: 'Cloud link sharing', snap: 'Available', loom: 'Available', cast: 'Available' },
];

/** The four rows that survive at 390px. Screencastify moves behind a link to
 * the desktop table rather than being squeezed into a third column. */
export const MOBILE_COMPARISON = [
  { row: 'Recording length', snap: 'Unlimited', loom: '5 min' },
  { row: 'Videos stored', snap: 'Cloud allowances apply', loom: '25' },
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
    a: 'No. Recording, screenshots, annotation and downloading all work without signing in — captures are saved to your device. An account adds cloud storage, a library, share links, comments and view counts.',
  },
  {
    n: 2, q: 'Is there a watermark or a time limit?',
    a: 'No watermark, and no cap on recording length on the free plan. Device capacity limits long recordings. Cloud file-size and daily upload allowances apply.',
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
    a: 'Watch or view, comment, react, and download. You can turn any link off; previously issued media URLs expire within five minutes.',
  },
  {
    n: 6, q: 'Which browsers work?',
    a: 'The extension needs Chrome or another Chromium browser. Viewing, commenting and downloading work in any modern browser, including on phones.',
  },
];
