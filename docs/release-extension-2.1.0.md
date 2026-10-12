# Extension 2.1.0: release plan

The first store release since v2.0.9 (`a0039d3`). It carries every extension change since then: the ones already on `main` (offscreen-owned upload with recovery, session-expiry handling, the handoff race fix) and the ones on the stacked branches `fix/copy-link` → `fix/stop-experience` → `fix/webm-duration-seek` → `chore/extension-release`.

**Cut the release from `fix/review-phase-2-3`**, which is stacked on `chore/extension-release` and holds the fixes from a review of the stop, handoff and recovery paths (listed below). Besides the upload and playback work, `chore/extension-release` carries these fixes:
- **Pause and Resume** reach the recorder again (`561a9cc`, cherry-picked from `c3d1b5c` on `ui/recording-panel`). They were broken in v2.0.9: the bar showed "paused" while the recorder kept recording.
- **Cancel during the countdown** (from the popup) stops the recording from starting (`49eb193`).
- **Dismissing the picker** no longer closes an offscreen document that is still finishing the last recording (`3014f44`).

`ui/recording-panel` (the panel and new control bar, behind a flag) is **not** in this release. Nothing else on it is needed for 2.1.0. `300064f` would make the popup's Screen / Window / Tab choice open the picker on that view, but v2.0.9 ignores that choice too, so it can wait for the next release.

Package it with an explicit version: `./ship-to-store.sh 2.1.0`.

From the review (`fix/review-phase-2-3`):
- A recording started while the previous one is still uploading gets its own upload (it used to be dropped).
- A crash after Stop no longer lets recovery publish a cut-off file that claims to be whole.
- A part from an aborted upload never joins the next recording's upload.
- The background IndexedDB copy always settles, so a full disk no longer pins the recording in memory.
- A recording the page never took stays held until it is saved to Downloads, and the fallback saves only that recording.
- A completion whose answer was lost is recognised as done instead of aborted.
- While uploading, the extension repeats its last report every 10 s. A share page that hears nothing for 45 s stops showing "Finishing upload…" and offers Download and Generate.

## Order

1. **Merge** `fix/copy-link`, `fix/stop-experience`, `fix/webm-duration-seek`, `chore/extension-release`, `fix/review-phase-2-3` into `main`, in that order. Each is stacked on the one before, so each merge is a fast-forward.
2. **Check the Cloudflare Pages build environment:** `VITE_EXTENSION_ID` must be `lgafjgnifbjeafallnkkfpljgbilfajg`. A production build of the web now accepts a recording only from that id (plus `VITE_EXTENSION_IDS`, if set); a wrong value would refuse every recording.
3. **Deploy the web and the server** (a push to `main` deploys both). The web must be live **before** the store release: the new extension opens the share page while the upload is still running, and the current production page would neither show the progress nor wait for it — it could offer "Generate shareable link" and upload a second copy. The new page works with v2.0.9 too.
4. **Run the manual QA** in `docs/qa-recording-reliability.md` against production, on the unpacked build. Also check that **Pause / Resume** from the in-page bar and the popup stops and restarts the timer, and that the share page's recording has no paused section.
5. **Switch `apps/extension/background/config.js` back to the production URLs.** `ship-to-store.sh` now refuses to package otherwise; `node apps/extension/scripts/check-release-config.mjs` checks it on its own.
6. `./ship-to-store.sh 2.1.0`, then upload `apps/snaprec-extension-v2.1.0.zip`.
7. **Once the store has published it**, set `apps/web/public/version.json` to `2.1.0` and deploy the web, so installed copies are told to update. It currently says 2.0.8, behind the store's 2.0.9.

## Permissions

None changed: `manifest.json` is identical to v2.0.9's apart from the version the script sets. The new files (`offscreen/handoff-host.js`, `background/webm-cues.js`) run in the existing offscreen document, and the handoff frame was already web-accessible.

## Release notes (for the store listing)

> **Your recordings, safer and faster**
>
> - **Your share page opens the moment you stop**, whatever the length of the recording. It plays right away from your computer while the upload finishes in the background, and shows its progress.
> - **Long recordings play and seek properly.** The player shows the real length, and you can jump anywhere — including in the link you send.
> - **Recordings survive Chrome's background clean-up.** A long or quiet recording no longer loses its upload when Chrome pauses the extension.
> - **If the upload can't finish**, you're told why, and you can download the recording or generate the link again. Nothing is lost.
> - **"Copy link" always copies the real link** to your recording.
> - **A slow connection no longer cuts off the end of a recording.**
> - **Pause works again**, and **Cancel** during the 3-2-1 countdown stops the recording from starting.

## PostHog: before and after

Every extension event carries `extension_version`, so compare **2.0.9 against 2.1.0** rather than splitting by date alone: store updates roll out over days, and both versions will be live side by side for a while. Use the store publication date as the "after" start, and the same number of days before it as "before".

| Metric | Definition | Before (2.0.9) | Expected after |
|---|---|---|---|
| Upload success | `upload_completed` ÷ `upload_started`, per version | baseline | up: the worker-termination loss and the 200 s Stop cap are gone |
| Upload failure reasons | `upload_failed` broken down by `error_reason` | mostly `finish_timeout`, `part_failed`, `begin_failed` | `finish_timeout` gone; `stalled` and `retries_exhausted` appear, and should be rare |
| Recovered uploads | `upload_completed` where `recovered = true` | 0 (no recovery in 2.0.9) | small, non-zero |
| Index skipped | `upload_index_skipped` ÷ `upload_completed` | — | near 0 |
| Recording reaches its page | funnel `recording_started` → `share_page_viewed` within 1 hour | baseline | up |
| Uninstall rate | `/uninstall-survey` pageviews per week ÷ active installs (Chrome Web Store dashboard), plus `uninstall_survey_submitted` reasons | baseline | flat or down |

Notes:
- `share_page_viewed` is sent by the web app. It joins the extension's events in a funnel only for people whose analytics identity was handed to the extension (`lib/extensionIdentity.ts`); compare its conversion **rate** between versions rather than absolute counts.
- Also watch `recording_download_failed` with `surface: auto_save`: it fires when a recording never reached its page and could not be saved to disk either. It should stay near zero.
- Server side, for recordings still coming from 2.0.9: Cloud Run logs `Deleted <key>: a completed video/webm that does not start with the WebM header` for each file the header check refused.

## Known limitations

- A recording **recovered after a crash** has no seek index (it is written at Stop). It plays and shows its stored duration; seeking over the network is slow.
- Recordings already on R2, and everything v2.0.9 keeps making until people update, have no index either. The share page shows their stored duration.
- v2.0.9 itself still drops a recording's tail when a part is uploading at Stop (found while measuring for this release). Only updating fixes that.
