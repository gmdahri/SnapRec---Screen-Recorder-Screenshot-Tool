# Viewer Space Utilization Design

## Goal

Use the desktop viewer's empty right-side space and extend the discussion rail from the video top to the Chapters boundary. Preserve the existing one-viewport layout, 16:9 media, internal scrolling, mobile layout, and all application behavior.

## Desktop Layout

Replace the current capped workspace plus separate content column with one full-width grid containing:

- a height-limited 16:9 video stage in the left column;
- the existing title, metadata, description, and statistics directly below the stage;
- the discussion rail in the right column, spanning both the stage and metadata rows;
- Chapters below the left column only.

The rail's bottom border and pinned composer align with the top edge of the Chapters section. Its width is flexible, with the existing 312px size as a minimum, so it consumes space that currently remains blank on wide screens. The video must not stretch or lose its 16:9 ratio.

## Responsive Behavior

At desktop widths (`>=1024px`), the page remains locked to one viewport. Comments scroll inside the rail and unusually long metadata scrolls inside its own left-column region. At narrower widths, retain the current natural-scrolling stacked/mobile layouts without applying the desktop row span.

## Scope and Behavior

This is presentation-only. Do not change callbacks, state, player controls, permissions, comment behavior, watched percentage, Transcript semantics, Chapters/frame generation, APIs, routes, or backend models. Continue using existing `--sr-*` tokens and square panel styling.

## Verification

Extend the Chromium geometry coverage to prove that the grid uses the desktop page width, the rail spans the stage and metadata rows, its bottom aligns with the Chapters top, the stage remains 16:9, and the document does not scroll. Retain coverage for short-wide desktops, the 1024px boundary, internal scrolling, and mobile behavior. Run the share tests, full web suite, and production build.
