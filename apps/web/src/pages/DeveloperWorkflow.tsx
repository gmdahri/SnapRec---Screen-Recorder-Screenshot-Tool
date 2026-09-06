import { LandingNavbar, LandingFooter, SEO, AddToChromeButton } from '../components';
import { Link } from 'react-router-dom';
export default function DeveloperWorkflow() {
  return <div style={{ background: 'var(--sr-surface-paper)', color: 'var(--sr-text-primary-on-light)' }}>
    <SEO title="Record a bug report with screenshots — SnapRec" url="/screen-recorder-for-developers" description="Show a bug, annotate the exact problem, and share a recording with your team. Screen recording and screenshot feedback for developers and agencies." />
    <LandingNavbar />
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '140px 24px 80px' }}>
      <h1>Show the bug. Make the next step clear.</h1>
      <p>Record the steps that fail, point to the problem, and share the context your teammate needs to reproduce it.</p>
      <AddToChromeButton />
      <h2>A report someone can act on</h2>
      <ol><li>Capture the shortest sequence that reproduces the issue. Include narration if it helps.</li>
      <li>Annotate a screenshot or trim your recording. Redact sensitive information before uploading.</li>
      <li>Generate a link. Open “Prepare a bug report” to add reproduction steps, expected behavior, and actual behavior.</li>
      <li>Copy the report into your issue tracker. Use timestamped or pinned comments to clarify feedback and resolve questions.</li></ol>
      <h2>Keep client work under your control</h2>
      <p>Capture and download locally without signing up. Uploaded captures can be viewed by anyone with the link until you turn sharing off from Shared. Already-issued media URLs expire within five minutes; copies someone downloaded cannot be recalled.</p>
      <h2>Know the limits before you start</h2>
      <p>There is no software recording time cap. Long recordings and high resolutions depend on your device, browser storage, and available memory. Cloud file-size and daily allowances apply; download locally if a capture exceeds them.</p>
      <h2>When to use a screenshot or a recording</h2>
      <p>Use an annotated screenshot for a layout problem or a single incorrect value. Record a short video for timing issues, navigation failures, or a sequence that is difficult to explain. A useful report includes the expected result and what actually happened.</p>
      <p>After a browser interruption, open Recover recordings from the extension popup to download the saved portion. Review the output before deleting its local copy.</p>
      <p><Link to="/how-it-works/">See the capture walkthrough</Link> · <Link to="/privacy/">Read about data and sharing</Link></p>
    </main><LandingFooter />
  </div>;
}
