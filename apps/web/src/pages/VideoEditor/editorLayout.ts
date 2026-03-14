/**
 * One width for Trim sidebar, Media gallery, and Media nav so switching tools doesn’t jump the layout.
 * 20rem (320px) everywhere.
 */
export const EDITOR_LEFT_PANEL_WIDTH =
  'w-80 min-w-[20rem] max-w-[20rem] shrink-0 flex-none' as const;

/** Per-project editor storage cap (single video workflow). */
export const EDITOR_STORAGE_LIMIT_BYTES = 100 * 1024 * 1024; // 100 MB
