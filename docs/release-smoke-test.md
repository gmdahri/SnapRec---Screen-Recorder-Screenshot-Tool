# Release smoke test: recordings write path

A manual checklist for the web, server and extension release that hardens the recordings write endpoints. It covers every flow that touches `POST /recordings`, the upload endpoints (`upload-url`, `upload/begin`, `upload/part`, `upload/complete`, `upload/abort`) and the share page, for guests and signed-in users.

Run it once against **staging** before production, then again after each production step.

## What ships

| Branch | Commits | What changes for callers |
|---|---|---|
| `fix/recordings-insert-only` | `7af23b2` web | "Generate shareable link" and "Open Video Editor" on a fresh capture stop posting the extension's id |
| | `41a40fc` server | `POST /recordings` is insert-only. An existing id gets **200** (same owner, same file) or **409**. A body `userId` must match the token, otherwise **403**. A non-UUID `id` gets **400**. |
| | `08a1a71` server | Upload endpoints answer **409** for a key that already holds a file |
| | `e21135a` server | A `fileUrl` already used by another recording gets **409** on create, `PATCH`, publish and the video editor's `newFileUrl`. The sweep spares shared files. |
| | `7387ab2` server | `GET /recordings/:id` no longer returns any `guestId` |
| | `8c3a27e` server | A token that doesn't verify gets **401** on `POST /recordings`, comments, reactions and progress. Before, it was treated as a guest. No token is still a guest. |
| | `0d369f4` web | "Your session expired" message, sign-in prompt, and resume after sign-in |
| `fix/worker-termination-upload` | through `dede444` extension | The offscreen document owns the upload, with recovery. The extension handles 200/409/401. |

## Deploy order

1. **Web** (Cloudflare Pages): `7af23b2` and `0d369f4`. Both work against the old server.
2. **Server** (Cloud Run): all five server commits together. Deploy only after step 1 is live, because the old share page relies on the overwrite this release removes.
3. **Extension** (Chrome Web Store): later, independently. It works against either server.

Before step 1, record the **baseline**: run every query in *Logs to check* below over the previous 24 hours and save the numbers.

## Accounts and data

- A **guest** browser profile: signed out, extension installed, site data cleared.
- A **signed-in** profile: your own Google account.
- Probe the server **only with recordings you created during this test**. Never use other people's ids or keys.
- Note each recording id you create; the curl probes below reuse them.

## Checklist

Each step lists the requests it should produce, so a failure can be matched to the endpoint. All of them can be seen in DevTools → Network on the page or in the offscreen document.

### A. Extension (the extension always uploads as a guest today)

| # | Step | Expected |
|---|---|---|
| A1 | Guest profile: record about 30 s, then Stop | `upload/begin` 201 → `upload/part` 201 (×n) → `upload/complete` 201 → `POST /recordings` **201** with `guestId` and no `Authorization`. The share tab opens and plays the whole recording. |
| A2 | Signed-in profile: same as A1 | Same as A1. The extension holds no session, so it's a guest row. |
| A3 | Screenshot (visible area), then "Create share link" in the editor | `upload-url` 201 → R2 PUT 200 → `POST /recordings` **201**. The link opens. |
| A4 | Offline screenshot queue: take a screenshot offline, then reconnect | The queued capture uploads once you're back online. `POST /recordings` 201, no id sent. |
| A5 | *(new extension only)* Record for 2 min, quit Chrome, relaunch, click the extension icon | `upload/complete` 201 → `POST /recordings` **201**. PostHog shows `upload_completed` with `recovered: true`. Relaunching again creates no second row. |
| A6 | Stop the recording from Chrome's "Stop sharing" bar | Same as A1. |

### B. Share page: fresh capture (from A1)

| # | Step | Expected |
|---|---|---|
| B1 | Guest: on the fresh capture, click "Generate shareable link" | The **sign-in modal appears**. Before this release it silently did nothing on this surface. |
| B2 | Signed in: click "Generate shareable link" before "Copy link" appears | `upload-url` 201 → R2 PUT → `POST /recordings` **201** with **no `id`** in the body → page goes to `/v/<new id>`. **No 409.** |
| B3 | Signed in: "Open Video Editor" on a fresh capture | `POST /recordings` **201** with no `id` → `POST /video-projects` 201 → the editor opens. Before this release this relied on the overwrite; with the new server and **old** web it gets 409 (see *Rollback*). |
| B4 | **Session expired.** Signed in, open DevTools → Application → Local Storage → `sb-…-auth-token`, change one character of `access_token`, reload, then click "Generate shareable link" | `POST /recordings` **401** → toast "Your session expired. Sign in again — your recording is still on this device." → the modal titled **"Your session expired"** opens. The player still plays and the URL doesn't change. **No second `POST /recordings`** (no guest retry). PostHog: `auth_modal_triggered` with `trigger: session_expired`. |
| B5 | Continue B4: sign in with Google | After the redirect the capture is still on the page, and the upload **resumes on its own** (`POST /recordings` 201 → `/v/<id>`). |
| B6 | Same as B4, but with "Open Video Editor" | The same message and modal; the editor opens after sign-in. |

### C. Share page: viewing a link

| # | Step | Expected |
|---|---|---|
| C1 | Open a guest recording's link in a private window | It plays. In the `GET /recordings/:id` response, search for `guestId`: **no matches** (recording, reactions or comments). |
| C2 | Guest: react and comment | `POST …/reactions` 201, `POST …/comments` 201 (no token sent). |
| C3 | Signed in: react, comment, watch for 30 s | 201s. `POST …/progress` 201 every few seconds. |
| C4 | Signed in with a tampered token (as in B4): react, then comment | **401** for each, and **nothing is posted**, as a guest or otherwise. Known gap: the reaction and comment handlers have no error handling yet, so the page shows **no message** (a typed comment stays in the box). The session-expired prompt covers uploads (B4, D3) only. |
| C5 | Signed in: "Save to account" on your **own web-made** guest screenshot | `POST /recordings/claim` 200, and it appears in Library. (Recordings the extension made can't be claimed from the web yet: the two use different guest ids. This is known.) |

### D. Screenshot editor (web)

| # | Step | Expected |
|---|---|---|
| D1 | Guest: annotate a screenshot, then "Create share link" | Sign-in gate, as before. |
| D2 | Signed in: "Create share link" | `upload-url` 201 → `POST /recordings` **201** (`userId` equal to your id, sent with your token) → `/editor/<id>`. |
| D3 | Signed in with a tampered token: "Create share link" | `POST /recordings` **401** (or 403 if the token is missing) → "Your session expired. Sign in again to share this screenshot." → the "Your session expired" modal. The canvas is untouched. |

### E. Server probes

Run these from a terminal against the API, using only ids and keys from recordings you created above. `$API` is the API base URL, `$T` a valid access token (copied from the `Authorization` header in DevTools), `$ID` your recording's id, and `$KEY` its file key (the `fileUrl` before signing, or the path of the signed URL).

```bash
# E1 upload over an existing file -> 409
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/recordings/upload-url" \
  -H 'Content-Type: application/json' -d "{\"fileName\":\"$KEY\",\"contentType\":\"video/webm\"}"
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/recordings/upload/begin" \
  -H 'Content-Type: application/json' -d "{\"fileName\":\"$KEY\",\"contentType\":\"video/webm\"}"

# E2 someone else's id -> 409, and the row is unchanged afterwards
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/recordings" -H 'Content-Type: application/json' \
  -d "{\"id\":\"$ID\",\"title\":\"x\",\"fileUrl\":\"probe.webm\",\"type\":\"video\",\"guestId\":\"guest_probe\"}"

# E3 someone else's file key under a new id -> 409
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/recordings" -H 'Content-Type: application/json' \
  -d "{\"title\":\"x\",\"fileUrl\":\"$KEY\",\"type\":\"video\",\"guestId\":\"guest_probe\"}"

# E4 a body userId without a token -> 403
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/recordings" -H 'Content-Type: application/json' \
  -d '{"title":"x","fileUrl":"probe-2.webm","type":"video","userId":"someone"}'

# E5 an expired/garbage token -> 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/recordings" -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer not-a-jwt' -d '{"title":"x","fileUrl":"probe-3.webm","type":"video"}'

# E6 a non-UUID id -> 400
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/recordings" -H 'Content-Type: application/json' \
  -d '{"id":"abc","title":"x","fileUrl":"probe-4.webm","type":"video","guestId":"guest_probe"}'

# E7 the public view has no guestId
curl -s "$API/recordings/$ID" | grep -c guestId    # expect 0

# E8 an idempotent retry by the owner -> 200 (re-send exactly what created the row, with your token)
```

Then re-fetch `$API/recordings/$ID` and confirm its `title`, `fileUrl` and `expiresAt` are what they were before the probes.

## Logs to check

Cloud Run writes a request log for every call. Set these once (in production the service is `snaprec` in `us-central1`):

```bash
PROJECT=$(gcloud config get-value project)
SINCE='2026-10-10T00:00:00Z'   # the deploy time, in UTC
BASE="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"snaprec\" AND logName=\"projects/$PROJECT/logs/run.googleapis.com%2Frequests\" AND timestamp>=\"$SINCE\""

# Collapse ids and file names so requests group by endpoint.
norm() { sed -E 's#https?://[^/]+##; s#\?.*##; s#[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}#:id#g; s#(/recordings/(status|stream|download-url))/[^ ]+#\1/:file#'; }
```

**4xx rate by endpoint:**

```bash
gcloud logging read "$BASE" --limit=50000 --format='value(httpRequest.requestMethod,httpRequest.requestUrl,httpRequest.status)' \
  | awk '{print $1, $2, $3}' | norm \
  | awk '{k=$1" "$2; total[k]++; if ($3>=400 && $3<500) bad[k]++}
         END {for (k in total) printf "%6d %6d %5.1f%%  %s\n", total[k], bad[k], 100*bad[k]/total[k], k}' \
  | sort -k3 -rn | head -30
```

**Each status that matters here, by endpoint:**

```bash
for s in 409 403 401 400; do
  echo "== $s"
  gcloud logging read "$BASE AND httpRequest.status=$s" --limit=5000 \
    --format='value(httpRequest.requestMethod,httpRequest.requestUrl)' | norm | sort | uniq -c | sort -rn | head
done
```

**Sweep outcomes** (application logs, not request logs):

```bash
gcloud logging read "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"snaprec\" AND timestamp>=\"$SINCE\" AND (textPayload:\"Sweep deleted\" OR textPayload:\"Sweep: kept\" OR textPayload:\"Sweep: could not delete\")" \
  --limit=200 --format='value(timestamp,textPayload)'
```

### What to expect, and when to roll back

| Signal | Expected after deploy | Investigate / roll back if |
|---|---|---|
| **409 on `upload-url`, `upload/begin`, `upload/complete`** | About 0. No legitimate client writes over an existing key. | Any steady rate. A client is reusing keys, so find it before users lose uploads. |
| **409 on `POST /recordings`** | About 0 (rare retries resolve as 200). | Climbing, especially from the share page: an old web bundle is still posting the extension's id. Check that step 1 is live, then roll back the server. |
| **403 on `POST /recordings`** | Low: signed-in users whose token is gone but whose page still sends `userId`. | A spike right after deploy, with B2/D2 failing in the checklist. |
| **401 on `POST /recordings`, `…/comments`, `…/reactions`** | Low: lapsed sessions, now reported instead of silently filed as guests. | Signed-in users with **fresh** sessions getting 401 (B2/C3 failing), which would point to token verification, not expiry. |
| **401 on `…/progress`** | **A steady trickle is normal.** The watch heartbeat sends the viewer's token every few seconds, so a viewer whose session lapsed produces a run of 401s until they reload. | It dominates all progress traffic. |
| **400 on `POST /recordings`** | About 0. A non-UUID `id` is the only new cause. | Any rate: some client sends ids that aren't UUIDs. |
| **5xx on `POST /recordings`** | At or below baseline. A non-UUID id used to reach Postgres as a 500; that's now a 400. | Above baseline. |
| **`Sweep: kept …`** | Occasional at most: rows that point at another recording's file, planted before this release. Each one is worth a look. | — |
| **`Sweep deleted N`** | Similar to baseline. | 0 for hours while guest uploads continue: check the sweep job. |
| PostHog `auth_modal_triggered` with `trigger: session_expired` | Low and steady. | — |

## Rollback

- **Server:** move Cloud Run traffic back to the previous revision (`gcloud run services update-traffic snaprec --region us-central1 --to-revisions=<previous>=100`). No migration ran and no data changed, so this is instant. It **reopens** every hole this release closes.
- **Web:** roll back on Cloudflare Pages **only after** the server is rolled back. The old web with the new server breaks "Open Video Editor" on fresh captures (409).
- **Extension:** no rollback is needed for the server change; it handles both servers.
