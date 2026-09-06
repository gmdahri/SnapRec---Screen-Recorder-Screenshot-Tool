# Founder implementation plan

Baseline: main 9453f93. Scope: trust, reliability, measurement, repeat usage, SEO and releases.

| Workstream | Implementation and acceptance | Status |
|---|---|---|
| Ownership | Derive owner from authentication; prevent supplied-id updates and insecure legacy claims; test cross-owner attempts | Implemented; staging gate |
| Uploads | Server-generated keys, owner-bound upload reservations, MIME/size limits and per-owner budgets; update callers | Implemented; staging gate |
| Sharing | Enforce private/off access on metadata, media and interactions; owner controls; short-lived signed links | Implemented; staging gate |
| Deletion | Remove media safely before database removal; retain retryability on storage errors | Implemented; staging gate |
| Recovery | Persist recording chunks while recording; expose recoverable output; preserve local capture during upload errors | Implemented; staging gate |
| Measurement | Stop metadata reads counting as views; qualified deduplicated viewer events; clear coverage and funnel definitions | Implemented; staging gate |
| Repeat usage | Copy-ready issue report and focused developer workflow; keep existing comments/resolution | Implemented; staging gate |
| Trust copy | Match shortcuts, signup boundaries, privacy and limits across public surfaces | Implemented; staging gate |
| SEO | Revalidate old checklist; correct canonical/schema/route consistency and automate checks; focused audience page | Implemented; staging gate |
| Releases | Check production config and version consistency; validate builds and extension artifact | Implemented; staging gate |
| Operations | Dashboard baselines, actual cost budgets, five observed sessions, ten interviews, five pilot teams | Requires real usage/account data and founder participation |

Rollout: apply additive migrations first, deploy server and web together, then release the extension; restrictive upload changes require a coordinated client rollout. No production data migration or deployment is performed by preparing this branch. Review backward compatibility explicitly before release. Existing share links remain public unless their owner turns them off; previously issued media URLs remain valid until expiry.

Validation: targeted authorization/access tests; recording persistence/recovery tests; affected workspace tests and builds; SEO/release checks. Production R2 and browser capture checks require a staging deployment with credentials and Chrome media permissions.

## Verification and delivery status

- Server build passed; server tests: 121 passing.
- Extension suite: 252 passing, including durable journal recovery.
- Web production build passed. Full web run: 1,034 passing and five blocked by missing Chrome (two browser geometry suites); focused media URL renewal tests: 10 passing.
- Release configuration check and git whitespace check passed.
- No production deployment, database migration, storage cleanup, store submission or external messaging has been performed.
- Staging remains mandatory for actual R2 conditional uploads, media capture/long-recording recovery, private access and signed URL renewal. See founder-rollout.md for the coordinated release sequence.
- Product scope delivered: copy-ready bug reports and developer workflow. Invited-user ACLs, configurable link expiry and team billing remain deferred; user interviews, dashboard baselines and paid pilots require real users/account access.
