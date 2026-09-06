# Measurement and pilot playbook

Use the same date window and display sample sizes. Never use Chrome's public user count as WAU. No live analytics or infrastructure bills were available during implementation.

## Weekly dashboard specification

- Activation within 24h: observed extension installs that complete a usable downloaded capture or ready share link / observed installs. Split local and cloud paths; join identities only when tracking consent permits it. `recording_completed` means capture stopped, not downloaded or shared.
- Capture success: usable outputs / initiated capture attempts. Break permission cancellation out from failures. Segment extension version, browser and output type.
- Weekly active creators: distinct creators with a usable capture in seven days; exclude founder, tests and bots.
- Week-four retention: activated creators completing another usable output in days 22–28 / activated creators whose full window has elapsed.
- Qualified shared views: session-deduplicated API view records, posted after five visible seconds of playing video or a loaded image. Signed-in owners excluded; website analytics consent required. This is an instrumented metric, not proof that bots cannot call the API.
- Watch coverage remains explicitly limited to signed-in viewers; do not present it as an all-viewer completion rate. Anonymous qualified views and `qualified_view` events now supply consented reach, not personalized watch histories.
- Viewer-to-creator: attributable qualified viewers reaching their own first usable capture in seven days. Report consent/identity attribution gaps.
- Cost: actual R2, API, database and email expense per weekly active creator and per successful shared capture. Record storage GB and uploaded bytes. Set alerts in the billing providers.

Existing view totals contain legacy metadata-fetch increments. Do not compare historical counts directly with new qualified views. Use the migration/release date as the metric definition boundary; do not rewrite historical counts without a reviewed backfill.

## Five observation sessions

Recruit five people in the target audience. Ask each to reproduce a real recent issue, capture it, explain it, share/download it and find it again. Observe without coaching. Record where they hesitate, fail, or need help, plus time to first usable output. Ask permission before recording their session.

## Ten interviews and five-team pilot

Interview five developers/QA and five agency/client-facing users. Ask about their last actual bug report, current tool, weekly frequency, failed handoffs and confidential-data constraints. Avoid promising features or soliciting speculative feature lists.

Pilot the current capture → precise comments → resolution workflow with five teams. Try the copy-ready bug report before building a deep issue-tracker integration. Internal gate: three teams using it weekly for three weeks; then test a clearly separate paid service. No messages, invitations, price changes, or payments have been sent or configured in this implementation.
