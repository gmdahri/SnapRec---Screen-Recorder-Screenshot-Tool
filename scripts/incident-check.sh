#!/usr/bin/env bash
# Read-only incident check for the recordings write-path holes.
# The SQL checks from docs/security-incident-check.md, in one run:
#
#   Q0  Is the sweep running?
#   A   Recordings sharing a storage key (QA, QA2, QF)
#   B   Guest rows registered on a key another recording already had (QB)
#   E   Owned rows rewritten through the old POST /recordings (QE, QE2)
#
# Usage:
#   DATABASE_URL='postgresql://user:pass@host:5432/db' scripts/incident-check.sh
#
# Safety:
#   - Everything runs inside BEGIN READ ONLY ... ROLLBACK, and the session
#     also defaults to read-only transactions, so the server itself refuses
#     any write. There are no write statements in this file.
#   - Any error stops the run; the open transaction is then discarded when
#     the connection closes, never committed.
#   - The output is counts, recording ids, created dates and a few derived
#     labels (group number, guest/user, true/false). No emails, names,
#     titles or file keys are selected.

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set." >&2
  exit 1
fi
command -v psql >/dev/null || { echo "psql not found." >&2; exit 1; }

# sslmode=require unless the URL says otherwise (a URL parameter wins).
export PGSSLMODE="${PGSSLMODE:-require}"
# Belt and braces: every transaction in this session defaults to read-only,
# and a slow query is cut off instead of holding locks.
export PGOPTIONS="${PGOPTIONS:-} -c default_transaction_read_only=on -c statement_timeout=120s"

psql "$DATABASE_URL" --no-psqlrc --quiet -v ON_ERROR_STOP=1 <<'SQL'
\pset footer off
\pset null '-'

BEGIN READ ONLY;

\echo
\echo '== Q0. Is the sweep running? Expired guest rows that are still here'
\echo '   Many old rows: the sweep has not been running, so no file was removed through it.'
SELECT count(*)         AS expired_not_swept,
       min("expiresAt") AS oldest_expiry
FROM sr_recordings
WHERE "expiresAt" < now();

\echo
\echo '== A. Storage keys used by more than one recording'
\echo '   Expected: 0. A user + guest group where the guest row is later is the deletion attack (see B).'
SELECT count(DISTINCT "fileUrl") AS shared_keys,
       count(*)                  AS recordings_involved
FROM sr_recordings
WHERE "fileUrl" IN (SELECT "fileUrl" FROM sr_recordings GROUP BY "fileUrl" HAVING count(*) > 1);

\echo '   Rows (key_group numbers rows that share one key; has_editor_project is QF):'
SELECT dense_rank() OVER (ORDER BY r."fileUrl")                 AS key_group,
       r.id                                                     AS recording_id,
       r."createdAt"                                            AS created_at,
       CASE WHEN r."userId" IS NULL THEN 'guest' ELSE 'user' END AS kind,
       EXISTS (SELECT 1 FROM sr_video_projects p
               WHERE p."sourceRecordingId" = r.id)              AS has_editor_project
FROM sr_recordings r
WHERE r."fileUrl" IN (SELECT "fileUrl" FROM sr_recordings GROUP BY "fileUrl" HAVING count(*) > 1)
ORDER BY key_group, r."createdAt";

\echo
\echo '== A2. Keys that differ only by case, surrounding slashes or whitespace'
\echo '   Not the same R2 object; informational.'
WITH n AS (
  SELECT id, "createdAt", "fileUrl", lower(btrim("fileUrl", E' /\t\n')) AS nk
  FROM sr_recordings
), near AS (
  SELECT nk FROM n GROUP BY nk HAVING count(DISTINCT "fileUrl") > 1
)
SELECT count(DISTINCT n.nk) AS near_duplicate_groups,
       count(*)             AS recordings_involved
FROM n JOIN near USING (nk);

\echo '   Rows (spelling numbers the distinct spellings within a group):'
WITH n AS (
  SELECT id, "createdAt", "fileUrl", lower(btrim("fileUrl", E' /\t\n')) AS nk
  FROM sr_recordings
), near AS (
  SELECT nk FROM n GROUP BY nk HAVING count(DISTINCT "fileUrl") > 1
)
SELECT dense_rank() OVER (ORDER BY n.nk)                       AS near_group,
       dense_rank() OVER (PARTITION BY n.nk ORDER BY n."fileUrl") AS spelling,
       n.id                                                    AS recording_id,
       n."createdAt"                                           AS created_at
FROM n JOIN near USING (nk)
ORDER BY near_group, spelling, n."createdAt";

\echo
\echo '== B. Guest rows registered on a key another recording already had'
\echo '   registered_after_other = t is the attack shape. guest_expired = t: the sweep was due'
\echo '   to remove that file; check it with the R2 cross-check (D) in the doc.'
SELECT count(*)                                            AS pairs,
       count(*) FILTER (WHERE g."createdAt" > o."createdAt") AS registered_after_other
FROM sr_recordings g
JOIN sr_recordings o ON o."fileUrl" = g."fileUrl" AND o.id <> g.id
WHERE g."userId" IS NULL;

\echo '   Rows:'
SELECT g.id                                                     AS guest_recording,
       g."createdAt"                                            AS guest_created_at,
       o.id                                                     AS other_recording,
       o."createdAt"                                            AS other_created_at,
       CASE WHEN o."userId" IS NULL THEN 'guest' ELSE 'user' END AS other_kind,
       g."createdAt" > o."createdAt"                            AS registered_after_other,
       g."expiresAt" < now()                                    AS guest_expired
FROM sr_recordings g
JOIN sr_recordings o ON o."fileUrl" = g."fileUrl" AND o.id <> g.id
WHERE g."userId" IS NULL
ORDER BY g."createdAt" DESC;

\echo
\echo '== E. Owned rows that carry a guest expiry (rewritten through the old POST /recordings)'
\echo '   Expected: 0. Each row is very likely a victim: note the ids BEFORE deploying the server.'
SELECT count(*) AS owned_with_expiry
FROM sr_recordings
WHERE "userId" IS NOT NULL AND "expiresAt" IS NOT NULL;

\echo '   Rows:'
SELECT r.id          AS recording_id,
       r."createdAt" AS created_at
FROM sr_recordings r
WHERE r."userId" IS NOT NULL AND r."expiresAt" IS NOT NULL
ORDER BY r."updatedAt" DESC;

\echo
\echo '== E2. Owned rows that still carry a guestId'
\echo '   Mostly the old share page handing the extension row to its owner; read with E, not alone.'
SELECT count(*) AS owned_with_guest_id
FROM sr_recordings
WHERE "userId" IS NOT NULL AND "guestId" IS NOT NULL;

ROLLBACK;
\echo
\echo 'Done. Transaction rolled back; nothing was changed.'
SQL
