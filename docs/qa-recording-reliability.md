# QA: recording reliability

Manual checks for the extension release that moves the upload into the offscreen document and opens the share tab at Stop, plus the server and web changes it relies on.

Run every check in real Chrome on a build loaded unpacked from `apps/extension`, against production or a staging API, with `background/config.js` on the production URLs (`node apps/extension/scripts/check-release-config.mjs` says so).

The automated suites cover the logic: `npm test --workspace=apps/extension`, especially `tests/workerTermination.test.js`, `tests/stopExperience.test.js`, `tests/streamFinish.test.js` and `tests/recordingIndex.test.js`. This list covers what only a real browser, real network and real user behaviour can show.

## Before you start

- **Do not keep DevTools open on the service worker.** An attached debugger keeps the worker alive, which hides the exact failure these checks exist for. Watch it from `chrome://serviceworker-internals` (status *RUNNING* / *STOPPED*) or from the "service worker (Inactive)" label on `chrome://extensions`.
- To see upload logs, inspect the **offscreen document** instead. It appears under "Inspect views" on `chrome://extensions` while a recording runs, and it stays open after Stop until its upload has finished and the page has the recording.
- Open PostHog → Activity, filtered to `upload_*` events and `extension_version`. Every scenario below says which events to expect.
- Note the time you start each scenario. PostHog and the server logs are easier to match by time than by id.

Pass criteria shared by every scenario:

- **The share tab opens within about a second of Stop**, whatever the recording's length or the network. It plays the recording from this device straight away.
- **The player shows the real duration** (not `--:--`), and clicking anywhere on the timeline jumps there.
- While the upload finishes, the page says "Finishing your recording — uploading X of Y MB" with a bar, and "Copy link" is disabled ("Finishing upload…").
- When the upload is done, the page says "link ready", the address bar becomes `/v/<id>` without a reload, and **Copy link copies `https://www.snaprecorder.org/v/<id>`**, never `/v?fresh=true`.
- Exactly **one** recording row is created. Check Library when signed in, or the `POST /recordings` count in the Cloud Run logs.
- No "Recording" overlay or popup timer is left behind in any tab.

## 1. Idle for 5 minutes

1. Start a **screen** recording of a static window, such as a document or a slide.
2. Move the mouse **outside** the browser and leave it for 5 minutes.
3. Within about 30 s, confirm that `chrome://serviceworker-internals` shows the worker **STOPPED**.
4. Stop with the in-page bar.

Expect:
- The share page plays all 5 minutes, shows 5:00, and seeks.
- **Signed in:** the recording appears in Library.
- **Guest:** "Save to account" claims it.
- PostHog shows `upload_started`, then `upload_completed` with `recovered: false`, `duration_seconds` ≈ 300 and `progress_save_failures: 0`.
- There is no `upload_failed`.

## 2. Browser quit mid-recording, then reopen

1. Record for about 2 minutes with something moving, so several 5 MB parts upload. You'll see `Part uploaded` lines in the offscreen console.
2. Quit Chrome entirely (⌘Q / Alt+F4). Don't stop the recording.
3. Relaunch Chrome and click the SnapRec icon. Any event that starts the worker will do.

Expect:
- PostHog shows `upload_completed` with `recovered: true`. Its `parts` matches the parts uploaded before the quit.
- A new **guest** row titled "Video Recording …" is created. After sign-in, it's claimable.
- It plays up to the last part that reached R2. The seconds after that existed only in memory and are lost by design.
- **Known limitation:** a recovered recording has no seek index (that is written at Stop, which never happened). The page shows its stored duration; seeking works but is slow over the network.
- The popup shows **no** running recording, and no page shows the recording overlay.
- Relaunching a second time creates **no** second row and sends no second `upload_completed`.

Variant: quit within the first 10 seconds, before any part could upload.
- Expect `upload_failed` with `error_reason: interrupted_before_first_part`, and no row.

## 3. Offline

Turn off the network at the OS level (Wi-Fi off). DevTools network throttling doesn't affect the offscreen document.

**3a. Offline mid-recording, then back online before Stop**
1. Record for 30 s, go offline for about 2 minutes, then come back online.
2. Record for another 30 s, then stop.

Expect:
- The full recording plays from the share link, opened in a second browser, with its duration and seeking.
- **At most 3** `upload_part_failed` events with `final: false`, not one per second of the outage.
- Then `upload_completed` with `recovered: false`.

**3b. Offline at Stop**
1. Record, go offline, and stop while still offline.

Expect:
- The share tab opens at once and plays the full recording from this device, with its duration and seeking.
- Within a few seconds to a minute, the page says **"Couldn't finish uploading."** with the reason, and offers **Download** and **Generate shareable link**.
- **Download** works while signed out, and saves the whole recording.
- PostHog may show **nothing** for this scenario: events are sent fire-and-forget and are lost offline. Confirm the outcome in the offscreen console instead.
- No row is created. After reconnecting, **Generate shareable link** (signed in) uploads the whole recording.
- There must **not** be a row that plays a recording with its end missing.

**3c. Connection hangs instead of failing**
1. Simulate a hung connection, for example with a firewall rule that drops packets to `*.r2.cloudflarestorage.com` instead of rejecting them, then stop.

Expect:
- The share tab opens at once.
- About a minute later the page says "Couldn't finish uploading. The connection stopped moving for a minute."
- PostHog shows `upload_failed` with `error_reason: stalled`.

## 4. Multiple tabs

1. Start recording **this tab** in tab A, and make a few clicks there.
2. Switch to tabs B and C and browse, including a navigation in B.
3. Close tab A while recording.
4. Stop from the popup, which is no longer the in-page bar.

Expect:
- Every tab's overlay disappears.
- There is one recording and one `upload_completed`.
- In the video editor, auto-zoom includes the clicks made in tab A **before** the worker went idle.

Repeat once, stopping with Chrome's own **"Stop sharing"** bar instead.

## 5. Long recording (35+ minutes), through the share page

1. Record a full screen for 35–40 minutes with normal activity, then stop.

Expect:
- **The share tab opens within about a second.** Note the time it took.
- The player shows the full length (for example 37:12) at once, and clicking near the end plays from there.
- The progress line counts up to "link ready".
- Open the `/v/<id>` link in another browser or a private window:
  - the duration is right and seeking to near the end starts within a few seconds;
  - DevTools → Network on the video request: responses are `206` with `Content-Range`, and the total transferred stays a few MB after a seek (not the whole file).
- PostHog shows `upload_completed` with `duration_seconds` ≈ the real length and `file_size_mb` plausible for it, and no `upload_index_skipped`.

Check the R2 copy's range support directly (the URL is the video request in the Network tab; it is signed, so don't paste it anywhere):

```bash
curl -s -D - -o /dev/null -H 'Range: bytes=0-99' '<video request URL>' | grep -iE '^HTTP|accept-ranges|content-range'
```

Expect `206`, `Accept-Ranges: bytes`, and `Content-Range: bytes 0-99/<size>`.

## 6. Recording again right away

**6a. After a crash.**
1. Do scenario 2 up to the quit, relaunch, and **immediately** start a new recording, before opening anything else.
2. Record 2 minutes and stop.

Expect:
- Both recordings end up as rows: the recovered one and the new one.
- Neither has the other's content.
- The new one has `recovered: false`.

**6b. While the last one is still uploading.**
1. Throttle the uplink (scenario 8), record 5 minutes and stop.
2. While its page still says "uploading", start and stop a second, short recording.

Expect:
- Each share page shows its own recording and its own progress, and both end at "link ready".
- Two rows, each playing its own recording.

## 7. A slow start (`upload/begin` answers late)

The bug behind unplayable files with v2.0.9: anything recorded before `upload/begin` answered was dropped, including the file's header.

1. Add delay to the API only, for example a Network Link Conditioner profile with 3,000 ms of latency, or a proxy that delays `POST /recordings/upload/begin` by 3 s.
2. Start a recording, wait 30 s, stop, and remove the delay.

Expect:
- The share page and the `/v/<id>` link both play it from the very start.
- Download the R2 copy and check its first bytes: `xxd -l 4 file.webm` shows `1a45 dfa3`.

## 8. A slow uplink

1. Throttle the **upload** below the recording's bitrate, for example 1–4 Mbit/s up with a Network Link Conditioner profile.
2. Record 10 minutes of a busy screen (a video playing), then stop.

Expect:
- The tab opens at once and plays the recording.
- The progress line counts up; after about 15 s of low throughput it says **"Uploading slowly"** and that the recording is safe on this device.
- It finishes at "link ready", however long that takes, as long as bytes keep moving.
- In Chrome's Task Manager, the extension's and the tab's memory do not jump when the page receives the recording.

## 9. The share tab closed early

1. Stop a 2-minute recording, and close the share tab before it finishes loading.

Expect:
- Nothing is saved to Downloads.
- Signed in: the recording appears in Library once its upload finishes.
- On `chrome://extensions`, the offscreen document closes after the upload is done.

## 10. The old extension against the new web

With v2.0.9 installed from the Chrome Web Store:
- A recording still opens its share page and plays.
- A recording whose upload lost its header (scenario 7 with v2.0.9) gets **no** link, rather than a dead one; the page offers Generate shareable link and Download.

## Reporting

For any failure, capture:
- the offscreen document's console
- `chrome://serviceworker-internals` status at the time
- the PostHog `upload_*` events
- the `/v` page's console
- the time window, for matching Cloud Run logs
