# Responsive Video Viewer Redesign

## Goal

Restyle the existing desktop and mobile video viewer to match the approved reference image. Preserve all current behavior, data flow, permissions, callbacks, player controls, comment anchors, loading states, and frame generation.

## Visual Direction

The reference image is the source of truth. Use a restrained production-review aesthetic: near-black chrome and media stage, cool light-gray page and panels, fine gray borders, white surfaces, and cyan accents for active state, playback progress, timestamps, and primary share actions. Keep corners square, spacing compact, typography functional, and shadows absent or minimal. Continue using the repository's bundled fonts and `--sr-*` design tokens; do not introduce a competing theme, gradients, hard-coded component colors, or `dark:` variants.

## Desktop Layout

- A compact dark header contains Back, title, shared status, Download, Edit, Copy link, and overflow actions according to existing permissions.
- Below it, use a two-column workspace: a dominant video/content column and a fixed-width discussion rail.
- The video sits in a dark framed stage. Existing native/custom playback behavior remains unchanged.
- Title, owner/date/duration/resolution, description, and Views/Watched/Comments statistics sit directly below the stage.
- Rename the visible `FRAMES` section to `CHAPTERS`. Keep the existing generated frame cards, timestamps, selection, seeking, blocked state, and loading behavior unchanged.
- The right rail exposes Comments, disabled Transcript, and Details tabs. Transcript must be visibly muted, non-interactive, and marked disabled for assistive technology.
- Keep the existing comment list, resolution controls, timestamps, empty states, and anchored composer.

## Mobile Layout

Use the same palette and hierarchy in a single-column layout. The header actions collapse using the existing mobile action behavior. Place the full-width player first, followed by metadata, statistics, rail tabs/content, composer, and horizontally scrollable chapter cards. Preserve touch targets, keyboard focus, and current mobile interactions.

## Data and Behavior

No API, backend, route, state-management, or recording-model changes are permitted. Display the existing `watchedPercent` value when supplied; retain the current omission when it is `null`. “Chapters” is presentation-only and does not create a chapter model. Transcript is presentation-only and disabled.

## Verification

Update presentation-focused tests only where labels or disabled-tab semantics change. Run the viewer, share-surface, mobile-share, and related web test suites plus the web build. Visually inspect representative desktop and mobile widths against the supplied reference, including empty comments, populated comments, unavailable frames, and missing watched percentage.
