/** P7 E3.1 — undo/redo over editor state.
 *
 * Snapshots rather than inverse commands. The editable state here is small —
 * trim points, cuts, zoom keyframes — so storing whole snapshots is cheaper to
 * get right than writing an inverse for every operation, and it cannot drift
 * out of sync the way paired do/undo implementations do.
 *
 * The cap exists because a drag can produce a snapshot per frame; without it a
 * long session holds every intermediate state of every drag.
 *
 * Deliberately not covered: undoing across a publish. Once footage is
 * published, undoing the edit that produced it would leave the editor
 * disagreeing with what viewers see — that needs a separate decision (plan
 * E3.1 note and edge case list), so callers reset the history instead. */

export const DEFAULT_LIMIT = 50;

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  limit: number;
}

export function createHistory<T>(present: T, limit = DEFAULT_LIMIT): History<T> {
  return { past: [], present, future: [], limit };
}

/** Records a new state. Redo is discarded — once you act from a rewound point,
 * the branch you had gone down no longer follows from where you are. */
export function record<T>(history: History<T>, next: T): History<T> {
  if (Object.is(next, history.present)) return history;

  const past = [...history.past, history.present];
  // Drop from the far end: the oldest states are the least likely to be wanted.
  const trimmed = past.length > history.limit ? past.slice(past.length - history.limit) : past;

  return { ...history, past: trimmed, present: next, future: [] };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

export function undo<T>(history: History<T>): History<T> {
  if (!canUndo(history)) return history;
  const previous = history.past[history.past.length - 1];
  return {
    ...history,
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: History<T>): History<T> {
  if (!canRedo(history)) return history;
  const [next, ...rest] = history.future;
  return {
    ...history,
    past: [...history.past, history.present],
    present: next,
    future: rest,
  };
}

/** Forgets everything before the current state. Used after publishing and after
 * loading a project, where the states behind the present no longer describe
 * anything the user can meaningfully return to. */
export function resetHistory<T>(history: History<T>, present: T = history.present): History<T> {
  return { ...history, past: [], present, future: [] };
}
