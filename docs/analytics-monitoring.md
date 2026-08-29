# Analytics monitoring

Why this file exists: `extension_installed` read zero for a week while the
Chrome Web Store recorded ~12 installs a day, and nothing anywhere reported a
fault. Every layer was behaving correctly by its own lights — the client sent,
PostHog accepted, the funnel rendered. The failure was only visible to someone
who thought to compare two numbers that live in different products.

## The alert to create

PostHog → **New insight** → **SQL**. Save it, then **Alerts** → *notify when
`tracking_broken` is above 0*, checked daily.

```sql
SELECT
    if(
        countIf(event = 'extension_installed') = 0
        AND countIf(event = 'chrome_store_link_clicked') > 0,
        1, 0
    ) AS tracking_broken
FROM events
WHERE timestamp > now() - INTERVAL 48 HOUR
```

The `chrome_store_link_clicked > 0` half is what keeps it quiet: it fires only
when people are demonstrably still clicking through to the store and no install
is coming back, never on a genuinely dead weekend.

Two days of store clicks with zero installs is not plausible traffic — at the
observed rate it is roughly 24 installs unaccounted for.

A companion insight worth keeping on the dashboard, which would have shown the
same problem as a shape rather than an alarm:

```sql
SELECT
    toDate(timestamp) AS day,
    countIf(event = 'chrome_store_link_clicked') AS store_clicks,
    countIf(event = 'extension_installed')       AS installs,
    countIf(event = 'recording_started')         AS recordings
FROM events
WHERE timestamp > now() - INTERVAL 30 DAY
GROUP BY day
ORDER BY day DESC
```

## The funnel needs person-level joining

`pageview → chrome_store_link_clicked → extension_installed → recording_started`
spans two contexts that mint their own identities: posthog-js in the browser,
and a locally generated UUID in the Manifest V3 service worker, which has no
localStorage for posthog-js to use and cannot load it anyway.

`apps/web/src/lib/extensionIdentity.ts` hands the web `distinct_id` to the
extension, which aliases its own id onto it (`$create_alias` in
`background/analytics.js`). PostHog applies the merge to events already
ingested, so the funnel repairs backwards as well as forwards.

If steps 3–4 ever read zero again while raw event counts are healthy, the
handshake is the first thing to check — not the capture code.

## Things that look like breakage and are not

- **An install is not reported the instant it happens.** The event waits up to
  five minutes for the web handshake, because `install_source` is knowable only
  in the tab that performed the install. After that it sends anyway with
  `install_source: 'unknown'`.
- **`extension_installed` never fires on an update.** `onInstalled` also fires
  with `update` and `chrome_update`; counting those would spike the install
  number for the entire user base on every release.
- **Shipping the code is not deploying it.** A fix in `apps/extension` reaches
  users only after a Chrome Web Store review. Until then the version live in the
  wild is whatever `clients2.google.com/service/update2/crx` reports, which is
  the honest answer to "is this deployed":

  ```
  curl -s "https://clients2.google.com/service/update2/crx?response=updatecheck\
  &prodversion=126.0&acceptformat=crx3&x=id%3D<extension-id>%26uc"
  ```

## The uninstall survey

`chrome.runtime.setUninstallURL` points at a URL the browser stores at install
time and opens, unattended, once. There is no error path and nobody to notice a
redirect — which is how `/uninstall-survey` spent a week 308-ing to the
homepage while every uninstaller saw marketing copy instead of the form.

Installed copies keep requesting whatever URL they stored, so the fix that
reaches existing users is the rule in `apps/web/public/_redirects`, not the one
in the extension. Verify the deployed behaviour rather than the rule:

```
curl -sIL https://www.snaprecorder.org/uninstall-survey | grep -iE '^HTTP|^location'
```

The last hop must be `200`, and the page it lands on must render the form.
`apps/web/src/pages/__tests__/UninstallSurvey.test.tsx` pins the redirect pair,
but a passing test only proves the rules are written — it cannot see what
Cloudflare does with them.
