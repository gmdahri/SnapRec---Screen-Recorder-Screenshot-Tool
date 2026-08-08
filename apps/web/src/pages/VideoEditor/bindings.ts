import type { Binding } from '../../lib/shortcuts';

/** Verbatim from scene V1's keyboard panel:
 * space plays · ← → step edit points · , . nudge one frame · S splits ·
 * Z adds a zoom · I O set trim in and out · ⌘Z undo · Esc deselects. */
export const VIDEO_BINDINGS: Binding[] = [
  { key: ' ', label: 'Play', description: 'Play or pause', scope: 'video' },
  { key: 'arrowleft', label: 'Previous edit point', description: 'Step to the previous edit point', scope: 'video' },
  { key: 'arrowright', label: 'Next edit point', description: 'Step to the next edit point', scope: 'video' },
  { key: ',', label: 'Nudge back', description: 'Nudge one frame back', scope: 'video' },
  { key: '.', label: 'Nudge forward', description: 'Nudge one frame forward', scope: 'video' },
  { key: 's', label: 'Split', description: 'Split at the playhead', scope: 'video' },
  { key: 'z', label: 'Add zoom', description: 'Add a zoom region at the playhead', scope: 'video' },
  { key: 'i', label: 'Set trim in', description: 'Set the trim in point', scope: 'video' },
  { key: 'o', label: 'Set trim out', description: 'Set the trim out point', scope: 'video' },
  { key: 'mod+z', label: 'Undo', description: 'Undo', scope: 'video' },
  { key: 'mod+shift+z', label: 'Redo', description: 'Redo', scope: 'video' },
  { key: 'escape', label: 'Deselect', description: 'Deselect', scope: 'video' },
];
