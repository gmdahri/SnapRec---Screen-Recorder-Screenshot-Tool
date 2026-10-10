# Security incident check: recordings write path

Read-only checks for whether the holes closed on `fix/recordings-insert-only` were used before the fix shipped. **Nothing here writes, deploys, or changes data.** Run them against production once, before or right after the server deploy, and keep the output.

| Hole | Fixed by | What an attacker needed |
|---|---|---|
| Overwrite any stored file through `upload-url`, or `upload/begin` + `complete` | `08a1a71` | A share link (the key is in `GET /recordings/:id`) |
| Delete any stored file: register a guest row on its key; the sweep deletes the key an hour later | `e21135a` | A share link |
| Rewrite any recording by posting its id to `POST /recordings` (upsert) | `41a40fc` | A share link |
| Claim another guest's recording with the guestId from `GET /recordings/:id` | `7387ab2` | A share link and an account |

## What can and can't be known

- **The database has no history.** A row that was overwritten and then swept is gone. The queries find what's **still there**. For anything already deleted, see *Going further*.
- **Request logs have no bodies.** Cloud Run logs the method, path, status, IP and user agent of each request, but not which id or key was in the body. They can show *that* someone called `upload-url` or `POST /recordings`, not *what for*.
- **The server logs multipart keys but not presigned-PUT keys.** `StorageService` logs `Multipart upload opened for <key>` and `completed for <key>`. Signing a PUT logs nothing.
- **R2 keeps the evidence for overwrites.** Every object has a `LastModified`, and no legitimate flow rewrites a key after its recording is registered:
  - the extension completes before registering;
  - the web uploads before creating the row;
  - publishing and the video editor write *new* keys.

  An object modified well after its recording was registered was overwritten.
- **Cloud Run request logs are kept for 30 days** in the `_Default` bucket, unless retention was changed. Older activity can only be judged from the database and R2.
- **None of the upload endpoints require a token**, so every call to them is "anonymous" in the sense of the question.

## Running the SQL

Use a read-only transaction, so nothing can change even if a query is mistyped. Never select `sr_users.email`; none of these queries do.

```bash
cd apps/server
set -a; . ./.env; set +a          # DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME
export PGPASSWORD="$DB_PASSWORD"
PSQL="psql host=$DB_HOST port=$DB_PORT user=$DB_USERNAME dbname=$DB_NAME sslmode=require"
# Save the queries below into checks.sql (outside the repo), then:
$PSQL -v ON_ERROR_STOP=1 -c 'BEGIN TRANSACTION READ ONLY;' -f checks.sql -c 'ROLLBACK;'
```

Or paste each query into the Supabase SQL editor, wrapped in `BEGIN TRANSACTION READ ONLY; … ROLLBACK;`. Each query below is self-contained.

These queries were run against the real schema (built from the entities), seeded with each attack pattern plus legitimate look-alikes. Every query parsed and flagged exactly the planted rows.

### Q0. Is the sweep running?

```sql
-- ---------------------------------------------------------------------------
-- Q0. Is the sweep running? Expired guest rows that are still here.
-- ---------------------------------------------------------------------------
SELECT count(*) AS expired_not_swept,
       min("expiresAt") AS oldest_expiry
FROM sr_recordings
WHERE "expiresAt" < now();
```

If `expired_not_swept` is large and `oldest_expiry` is old, the sweep has not been running. That's bad for storage, but it also means **no file was deleted through the sweep hole** in that window, and rows planted on someone else's key are probably still here for QB to find. Check Cloud Scheduler as well: `POST /recordings/sweep-expired` in the request logs (L4).

### (a) Recordings sharing a storage key

```sql
-- ---------------------------------------------------------------------------
-- QA. Storage keys used by more than one recording (exact match).
-- ---------------------------------------------------------------------------
SELECT r."fileUrl",
       count(*)                                         AS rows,
       array_agg(r.id ORDER BY r."createdAt")           AS recording_ids,
       array_agg(CASE WHEN r."userId" IS NULL THEN 'guest' ELSE 'user' END
                 ORDER BY r."createdAt")                AS kinds,
       min(r."createdAt")                               AS first_registered,
       max(r."createdAt")                               AS last_registered
FROM sr_recordings r
GROUP BY r."fileUrl"
HAVING count(*) > 1
ORDER BY last_registered DESC;
```

- **No rows:** no two recordings point at the same file. That's the expected state.
- **A `user` + `guest` group, where the guest row is the later one:** the deletion attack (b). Look at QB.
- **Two `user` rows:** an owner repointed their recording at someone else's file through `PATCH` or publish. That's low impact, but still worth knowing who did it.

```sql
-- ---------------------------------------------------------------------------
-- QA2. Keys that differ only by case, surrounding slashes or whitespace.
-- Not the same R2 object (R2 keys are exact), but worth eyeballing.
-- ---------------------------------------------------------------------------
SELECT lower(btrim(r."fileUrl", E' /\t\n')) AS normalized_key,
       count(DISTINCT r."fileUrl")          AS spellings,
       array_agg(DISTINCT r."fileUrl")      AS keys
FROM sr_recordings r
GROUP BY 1
HAVING count(DISTINCT r."fileUrl") > 1;
```

R2 keys are exact (`Video.webm` and `video.webm` are different objects), so these are **not** shared files. Listed because a client or attacker producing near-duplicate keys is worth knowing about.

### (b) Guest rows on a key another recording already had

```sql
-- ---------------------------------------------------------------------------
-- QB. Guest rows registered on a key another recording already had.
-- registered_after_other = true is the attack shape (finding 2).
-- ---------------------------------------------------------------------------
SELECT g.id                              AS guest_recording,
       g."createdAt"                     AS guest_registered,
       g."expiresAt"                     AS guest_expires,
       o.id                              AS other_recording,
       CASE WHEN o."userId" IS NULL THEN 'guest' ELSE 'user' END AS other_kind,
       o."createdAt"                     AS other_registered,
       g."createdAt" > o."createdAt"     AS registered_after_other,
       g."fileUrl"
FROM sr_recordings g
JOIN sr_recordings o ON o."fileUrl" = g."fileUrl" AND o.id <> g.id
WHERE g."userId" IS NULL
ORDER BY g."createdAt" DESC;
```

- `registered_after_other = true` is the attack shape: a guest row registered on a key that already belonged to someone.
- `guest_expires` in the past means the sweep was due to delete that file. Check whether it still exists with the R2 cross-check below (section D).
- `registered_after_other = false` means the guest row came first, and the *other* row is the late one; look at that row instead.

### (e) Recordings rewritten through POST /recordings with an existing id

```sql
-- ---------------------------------------------------------------------------
-- QE. Owned rows that carry a guest expiry. Under the old POST /recordings,
-- an anonymous POST with an owned recording's id rewrote it as a guest
-- upload: owner kept, guestId and expiresAt set. No legitimate flow leaves
-- an owned row with an expiry (claiming clears it; an owned create sets null).
-- ---------------------------------------------------------------------------
SELECT r.id, r."createdAt", r."updatedAt", r."expiresAt",
       r."guestId" IS NOT NULL AS has_guest_id,
       r.title, r."fileUrl"
FROM sr_recordings r
WHERE r."userId" IS NOT NULL
  AND r."expiresAt" IS NOT NULL
ORDER BY r."updatedAt" DESC;
```

Each row is very likely a victim. The old `POST /recordings` kept the owner but set `guestId` and a one-hour `expiresAt` when an anonymous request posted an owned recording's id. No legitimate flow leaves an owned row with an expiry:
- claiming clears the expiry;
- creating an owned row never sets one.

`title` and `fileUrl` are the attacker's values. The sweep will delete the row once `expiresAt` passes, unless the server fix is already live. If you find any, note the ids **before** deploying, and restore the original `fileUrl` and `title` from a backup.

```sql
-- ---------------------------------------------------------------------------
-- QE2. Owned rows that still carry a guestId. Mostly the old share page's
-- legitimate overwrite of the extension's guest row (owner set, expiry
-- cleared). Listed for completeness; read with QE, not alone.
-- ---------------------------------------------------------------------------
SELECT count(*) AS owned_with_guest_id
FROM sr_recordings
WHERE "userId" IS NOT NULL AND "guestId" IS NOT NULL;
```

Informational. The old share page's legitimate "Open Video Editor" flow produced owned rows that keep the extension's `guestId`, with no expiry. A count here isn't evidence of anything on its own.

### Rows the new key rule now blocks

```sql
-- ---------------------------------------------------------------------------
-- QF. Rows the new key rule now blocks. PATCH /recordings/:id or publish
-- sending one of these keys — including the row's own current key — gets
-- 409 while another recording holds it.
-- ---------------------------------------------------------------------------
SELECT r.id, CASE WHEN r."userId" IS NULL THEN 'guest' ELSE 'user' END AS kind,
       r."fileUrl", r."createdAt",
       (SELECT count(*) FROM sr_recordings o WHERE o."fileUrl" = r."fileUrl" AND o.id <> r.id) AS others_with_key,
       EXISTS (SELECT 1 FROM sr_video_projects p WHERE p."sourceRecordingId" = r.id) AS has_editor_project
FROM sr_recordings r
WHERE EXISTS (SELECT 1 FROM sr_recordings o WHERE o."fileUrl" = r."fileUrl" AND o.id <> r.id)
ORDER BY r."fileUrl", r."createdAt";
```

After `e21135a`, `PATCH /recordings/:id` and publish answer **409** for a key another recording holds. That includes **re-sending a row's own current key** while another row shares it. Nothing in the web or extension re-sends an unchanged key, so this matters only for rows listed here, and every row here is already suspicious under (a). `has_editor_project` marks the ones the video editor might try to publish over; that writes a new key, so it isn't blocked.

## (c) and (d): the R2 cross-check

This lists the bucket (`ListObjectsV2`, read-only) and compares each object's `LastModified` with the registration time of the recording that uses it. It writes nothing.

```bash
cd apps/server
$PSQL -c "\copy (SELECT id, \"fileUrl\", \"createdAt\", (\"userId\" IS NULL) AS guest, \"expiresAt\" FROM sr_recordings) TO 'recording-keys.csv' CSV HEADER"
cat > /path/outside/repo/r2-crosscheck.mjs <<'JS'
// Read-only. Lists the bucket (ListObjectsV2) and compares it with the
// recordings export. Writes nothing anywhere.
//   node r2-crosscheck.mjs recording-keys.csv            # lists R2 (reads apps/server/.env)
//   node r2-crosscheck.mjs recording-keys.csv listing.json   # offline, from a saved listing
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const [csvPath, listingPath] = process.argv.slice(2);
const MARGIN_MIN = Number(process.env.MARGIN_MIN ?? 15);

const rows = readFileSync(csvPath, 'utf8').trim().split('\n').slice(1).map((line) => {
  const [id, fileUrl, createdAt, guest, expiresAt] = line.split(',');
  return { id, fileUrl, createdAt: new Date(createdAt), guest: guest === 't', expiresAt: expiresAt ? new Date(expiresAt) : null };
});

// Resolved from the current directory (run it from apps/server), because an
// ES module outside the repo ignores NODE_PATH.
const requireFromCwd = createRequire(pathToFileURL(`${process.cwd()}/`));

async function listBucket() {
  const { S3Client, ListObjectsV2Command } = requireFromCwd('@aws-sdk/client-s3');
  requireFromCwd('dotenv').config({ path: process.env.ENV_FILE ?? '.env' });
  const s3 = new S3Client({ region: 'auto', forcePathStyle: true,
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
  const out = []; let token;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME, ContinuationToken: token }));
    for (const o of page.Contents ?? []) out.push({ key: o.Key, lastModified: o.LastModified.toISOString(), size: o.Size });
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return out;
}

const listing = listingPath ? JSON.parse(readFileSync(listingPath, 'utf8')) : await listBucket();
const objects = new Map(listing.map((o) => [o.key, { ...o, lastModified: new Date(o.lastModified) }]));

// C: written after the recording that uses it was registered.
const rewritten = rows.filter((r) => objects.has(r.fileUrl)
  && objects.get(r.fileUrl).lastModified - r.createdAt > MARGIN_MIN * 60_000);
// D: a live recording whose file is gone. Expired guest rows are excluded:
// their file going is the sweep doing its job.
const now = Date.now();
const missing = rows.filter((r) => !objects.has(r.fileUrl) && !(r.expiresAt && r.expiresAt < now));

console.log(`objects: ${objects.size}  recordings: ${rows.length}  margin: ${MARGIN_MIN} min`);
console.log(`\nC. files rewritten after registration (${rewritten.length}):`);
for (const r of rewritten) console.log(`  ${r.id}  ${r.guest ? 'guest' : 'user '}  registered ${r.createdAt.toISOString()}  modified ${objects.get(r.fileUrl).lastModified.toISOString()}  ${r.fileUrl}`);
console.log(`\nD. live recordings with no file (${missing.length}):`);
for (const r of missing) console.log(`  ${r.id}  ${r.guest ? 'guest' : 'user '}  registered ${r.createdAt.toISOString()}  ${r.fileUrl}`);
JS
node /path/outside/repo/r2-crosscheck.mjs recording-keys.csv     # run from apps/server: it resolves the SDK from here
rm recording-keys.csv            # it lists every recording's key; don't leave it lying around
```

The script's logic was run against a seeded local export and a saved listing. It flagged the rewritten file under C and the two missing files under D, and nothing legitimate. It assumes keys contain no commas, which holds for every key the clients generate. `MARGIN_MIN` (default 15) is how long after registration a write still counts as part of the upload.

- **C. Files rewritten after registration.** Each line is an object written more than 15 minutes after its recording was registered, which is how an overwrite through `upload-url` or multipart shows. Expect zero. For each hit, open the recording and confirm the content is what its owner uploaded. If several rows share the key (QA), all of them are listed.
- **D. Live recordings with no file.** Each line is a recording that isn't an expired guest row and whose key is missing from R2. A file deleted by the sweep hole shows here, as do rows whose upload never finished. Cross-reference with QB: a missing key that a guest row also pointed at is very likely a deletion through the sweep.

## Cloud Run logs

```bash
PROJECT=$(gcloud config get-value project)
SINCE='2026-09-10T00:00:00Z'       # as far back as retention allows
RUN="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"snaprec\" AND timestamp>=\"$SINCE\""
REQ="$RUN AND logName=\"projects/$PROJECT/logs/run.googleapis.com%2Frequests\""
nocolor() { perl -pe 's/\e\[[0-9;]*m//g'; }
```

### L1 (c, multipart): uploads opened on a key that already had a recording

```bash
gcloud logging read "$RUN AND textPayload:\"Multipart upload opened for\"" --limit=100000 \
  --format='value(timestamp,textPayload)' | nocolor \
  | perl -ne 'print "$1,$2\n" if /^(\S+)\s.*Multipart upload opened for (.+?): \S+$/' > multipart-opened.csv
python3 - <<'PY'
import csv, datetime as d
reg = {}
for r in csv.DictReader(open('recording-keys.csv')):
    t = d.datetime.fromisoformat(r['createdAt'].replace(' ', 'T'))
    reg[r['fileUrl']] = min(t, reg.get(r['fileUrl'], t))
for line in open('multipart-opened.csv'):
    ts, key = line.rstrip('\n').split(',', 1)
    opened = d.datetime.fromisoformat(ts.replace('Z', '+00:00'))
    if key in reg and opened > reg[key]:
        print('OPENED ON A REGISTERED KEY', opened.isoformat(), key, 'registered', reg[key].isoformat())
PY
```

No output is the expected result. A hit means someone opened a multipart upload on a key whose recording already existed, which is an overwrite attempt. Check whether it completed: search `textPayload:"Multipart upload completed for <key>"`.

### L2 (c, presigned PUT): who calls `upload-url`

Signing logs no key, so this only profiles the callers. Use the R2 cross-check (C) for the evidence.

```bash
gcloud logging read "$REQ AND httpRequest.requestUrl:\"/recordings/upload-url\"" --limit=100000 \
  --format='value(httpRequest.remoteIp,httpRequest.userAgent)' | sort | uniq -c | sort -rn | head -30
```

Legitimate callers are Chrome on the share page or editor, and the extension (a Chrome user agent). Investigate `curl`, `python-requests`, `Go-http-client`, headless agents, or a single IP with far more calls than any user could make.

### L3 (e): who calls `POST /recordings`, and from where

```bash
gcloud logging read "$REQ AND httpRequest.requestMethod=\"POST\" AND httpRequest.requestUrl=~\"/recordings$\"" --limit=100000 \
  --format='value(httpRequest.remoteIp,httpRequest.userAgent,httpRequest.status)' | sort | uniq -c | sort -rn | head -30
```

Bodies aren't logged, so this can't show which id was posted; QE is the evidence. Use this to profile any IP or agent behind a QE hit: unusual user agents, or one IP that also fetched many different `/recordings/<id>` (L5).

### L4 (d): the sweep

```bash
gcloud logging read "$REQ AND httpRequest.requestUrl:\"/recordings/sweep-expired\"" --limit=5000 \
  --format='value(timestamp,httpRequest.status)' | head
gcloud logging read "$RUN AND (textPayload:\"Sweep deleted\" OR textPayload:\"Sweep: kept\" OR textPayload:\"could not delete\")" \
  --limit=5000 --format='value(timestamp,textPayload)' | nocolor | head -50
```

- No `sweep-expired` requests (or only 404s, meaning the secret is unset) means the sweep never ran, so the deletion hole never fired. Confirm with Q0.
- `Sweep deleted N` lines show when deletions happened, but not which keys; use them to date the D findings.
- `Sweep: kept …` lines can only appear after `e21135a` is deployed. Each one is a row that was pointing at another recording's file and has now been stopped.

### L5: one client reading many recordings

```bash
gcloud logging read "$REQ AND httpRequest.requestMethod=\"GET\" AND httpRequest.requestUrl=~\"/recordings/[0-9a-f-]{36}$\"" --limit=200000 \
  --format='value(httpRequest.remoteIp,httpRequest.requestUrl)' \
  | perl -pe 's#https?://[^/]+##' | sort -u | awk '{print $1}' | uniq -c | sort -rn | head -20
```

The number of **distinct recordings** each IP read. A viewer reads a handful; an IP reading hundreds was collecting keys or guest ids. Cross-check those IPs with L2 and L3.

## Going further: rows that are already gone

A recording overwritten and then swept, or a file deleted by the sweep, leaves nothing in the live database. To find those, restore a Supabase backup from before the earliest suspicious activity into a **separate** database (never over production), then compare:
- recordings present in the backup and missing now, with no `DELETE /recordings/<id>` in the request logs for that id: deleted by the sweep;
- recordings whose `fileUrl` or `title` differs between the backup and now, with no `PATCH /recordings/<id>` or `/publish` logged: rewritten.

## Reading the results together

| You see | It means | Do |
|---|---|---|
| Nothing in QA, QB, QE, C, D or L1 | No sign the holes were used, within what can be seen | Keep the output with the release record |
| QE rows | Recordings rewritten through the upsert; swept within the hour if the fix isn't live | Note the ids, deploy the fix, restore `title`/`fileUrl` from a backup, tell the owners |
| QB with `registered_after_other`, plus D for the same key | A file deleted through the sweep hole | Restore the object from R2 versioning or a backup if any exists; tell the owner |
| C hits | Files replaced through the upload endpoints | Compare with the owner's copy; tell the owner; profile the caller (L2) |
| L1 hits | Multipart overwrite attempts | Same as C |
| D hits with no matching QB | Usually uploads that never finished | Low priority, but tell the owner if the recording matters |
