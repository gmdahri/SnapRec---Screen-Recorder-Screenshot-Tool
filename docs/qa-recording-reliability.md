# QA: recording reliability

Manual checks for the offscreen-owned streaming upload (`apps/extension/background/stream-upload.js`). Run them on a build loaded unpacked from `apps/extension`, against production or a staging API.

The automated suites cover the logic: `npm test --workspace=apps/extension`, especially `tests/workerTermination.test.js` and `tests/streamUpload.test.js`. This list covers what only a real browser, real network and real user behaviour can show.

## Before you start

- **Do not keep DevTools open on the service worker.** An attached debugger keeps the worker alive, which hides the exact failure these checks exist for. Watch it from `chrome://serviceworker-internals` (status *RUNNING* / *STOPPED*) or from the "service worker (Inactive)" label on `chrome://extensions`.
- To see upload logs, inspect the **offscreen document** instead. It appears under "Inspect views" on `chrome://extensions` while a recording runs.
- Open PostHog → Activity, filtered to `upload_*` events from your install. Every scenario below says which events to expect.
- Note the time you start each scenario. PostHog and the server logs are easier to match by time than by id.

Pass criteria shared by every scenario:

- The share page (`/v`) plays the whole recording, and nothing is missing at the end.
- Exactly **one** recording row is created. Check Library when signed in, or the `POST /recordings` count in the Cloud Run logs.
- No "Recording" overlay or popup timer is left behind in any tab.

## 1. Idle for 5 minutes (the original bug)

1. Start a **screen** recording of a static window, such as a document or a slide.
2. Move the mouse **outside** the browser and leave it for 5 minutes.
3. Within about 30 s, confirm that `chrome://serviceworker-internals` shows the worker **STOPPED**.
4. Stop with the in-page bar.

Expect:
- The share page plays all 5 minutes.
- **Signed in:** the recording appears in Library.
- **Guest:** "Save to account" claims it.
- PostHog shows `upload_started`, then `upload_completed` with `recovered: false`, `duration_seconds` ≈ 300 and `progress_save_failures: 0`.
- There is no `upload_failed`.

Before the fix this scenario left the multipart upload open and created no row.

## 2. Browser quit mid-recording

1. Record for about 2 minutes with something moving, so several 5 MB parts upload. You'll see `Part uploaded` lines in the offscreen console.
2. Quit Chrome entirely (⌘Q / Alt+F4). Don't stop the recording.
3. Relaunch Chrome and click the SnapRec icon. Any event that starts the worker will do.

Expect:
- PostHog shows `upload_completed` with `recovered: true`. Its `parts` matches the parts uploaded before the quit.
- A new **guest** row titled "Video Recording …" is created. After sign-in, it's claimable.
- It plays up to the last part that reached R2. The seconds after that existed only in memory and are lost by design.
- The popup shows **no** running recording, and no page shows the recording overlay.
- Relaunching a second time creates **no** second row and sends no second `upload_completed`.

Variant: quit within the first 10 seconds, before any part could upload.
- Expect `upload_failed` with `error_reason: interrupted_before_first_part`, and no row.

## 3. Offline mid-recording

Turn off the network at the OS level (Wi-Fi off). DevTools network throttling doesn't affect the offscreen document.

**3a. Offline for a while, then back online before Stop**
1. Record for 30 s, go offline for about 2 minutes, then come back online.
2. Record for another 30 s, then stop.

Expect:
- The full recording plays from the share link, opened in a second browser.
- **At most 3** `upload_part_failed` events with `final: false`, not one per second of the outage.
- Then `upload_completed` with `recovered: false`.

**3b. Still offline at Stop**
1. Record, go offline, and stop while still offline.

Expect:
- The share page still opens and plays the full recording from the local copy.
- Known issue: for about 2 minutes the page alternates between the player and "Preparing your recording…". This happens whenever the server has no row for the recording; see the open issues below.
- PostHog may show **nothing** for this scenario. The extension sends events fire-and-forget, with no queue (only the install event is queued), so `upload_part_failed` with `final: true` and `upload_failed` with `error_reason: part_failed` are sent while offline and lost. Confirm the outcome in the offscreen console instead. If you see these events in PostHog, the network wasn't fully down.
- No row is created. After reconnecting, **Generate shareable link** (signed in) uploads the whole recording.
- There must **not** be a row that plays a recording with its end missing.

**3c. Connection hangs instead of failing**
1. Simulate a hung connection, for example with a firewall rule that drops packets to `*.r2.cloudflarestorage.com` instead of rejecting them, then stop.

Expect:
- The share tab opens within about 3½ minutes at worst, not never.
- PostHog shows `upload_failed` with `error_reason` set to `finish_timeout` or `recording_failed`.

## 4. Multiple tabs

1. Start recording **this tab** in tab A, and make a few clicks there.
2. Switch to tabs B and C and browse, including a navigation in B.
3. Close tab A while recording.
4. Stop from the popup, which is no longer the in-page bar.

Expect:
- Every tab's overlay disappears.
- There is one recording and one `upload_completed`.
- In the video editor, auto-zoom includes the clicks made in tab A **before** the worker went idle. This checks that click metadata survives the worker being terminated.

Repeat once, stopping with Chrome's own **"Stop sharing"** bar instead.

## 5. Long recording (35+ minutes)

1. Record a full screen for 35–40 minutes with normal activity, then stop.

Expect:
- PostHog shows `upload_completed` with `duration_seconds` ≈ the real length and `file_size_mb` plausible for it.
- The row exists on the server and plays from a share link in another browser.

**Known open issue:** the share tab can stay on "Preparing your recording…" indefinitely for recordings this long. Saving the local copy to IndexedDB takes longer than `/v` takes to load, and the extension starts watching for the page only after the save finishes, so it misses it. This was reproduced with a real 2.9 GB, 36-minute recording. It's separate from this change. Record the outcome either way, and note how long Stop took to open the tab.

## 6. Back-to-back after a crash

1. Do scenario 2 up to the quit, relaunch, and **immediately** start a new recording, before opening anything else.
2. Record 2 minutes and stop.

Expect:
- Both recordings end up as rows: the recovered one and the new one.
- Neither has the other's content.
- The new one has `recovered: false`.

## Reporting

For any failure, capture:
- the offscreen document's console
- `chrome://serviceworker-internals` status at the time
- the PostHog `upload_*` events
- the `/v` page's console
- the time window, for matching Cloud Run logs
