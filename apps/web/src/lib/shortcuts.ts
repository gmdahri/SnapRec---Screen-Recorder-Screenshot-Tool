/** One registry per scope so a shortcut cannot be silently bound twice.
 *
 * The editors have 20+ bindings between them and every icon-only control must
 * name its shortcut in a tooltip. Both facts argue for a single table rather
 * than scattered keydown handlers. */

export interface Binding {
  /** 's', 'mod+z', 'mod+shift+z'. `mod` is ⌘ on Apple, Ctrl elsewhere. */
  key: string;
  label: string;
  description: string;
  scope: 'video' | 'image' | 'global';
}

export interface Registry {
  bindings: Binding[];
  find(label: string): Binding | undefined;
  handle(event: KeyboardEvent, run: (binding: Binding) => void): void;
}

export function createRegistry(bindings: Binding[]): Registry {
  const seen = new Set<string>();
  for (const binding of bindings) {
    const id = `${binding.key.toLowerCase()} (${binding.scope})`;
    if (seen.has(id)) throw new Error(`duplicate binding: ${id}`);
    seen.add(id);
  }

  return {
    bindings,
    find: label => bindings.find(b => b.label === label),
    handle(event, run) {
      // A single-key shortcut must never fire while the user is typing —
      // pressing S in a title field should write an S, not split a clip.
      const target = event.target as HTMLElement | null;
      if (target && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.isContentEditable
      )) return;

      const hit = bindings.find(b => matches(b, event));
      if (hit) {
        event.preventDefault();
        run(hit);
      }
    },
  };
}

interface ParsedKey {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  base: string;
}

function parse(key: string): ParsedKey {
  const parts = key.toLowerCase().split('+');
  return {
    mod: parts.includes('mod'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    // The last segment is the key itself. Split on '+' keeps ' ' intact
    // because a lone space never contains one.
    base: key === ' ' ? ' ' : parts[parts.length - 1],
  };
}

export function matches(binding: Binding, event: KeyboardEvent): boolean {
  const parsed = parse(binding.key);
  const mod = event.metaKey || event.ctrlKey;
  return event.key.toLowerCase() === parsed.base
    && mod === parsed.mod
    && event.shiftKey === parsed.shift
    && event.altKey === parsed.alt;
}

const NAMED: Record<string, string> = {
  ' ': 'space',
  arrowleft: '←',
  arrowright: '→',
  arrowup: '↑',
  arrowdown: '↓',
  escape: 'Esc',
  enter: '⏎',
};

/** Platform is a parameter, not a sniff.
 *
 * `navigator.platform` is deprecated and empty in jsdom, so a component that
 * sniffed internally would render differently in tests than in a browser and
 * the difference would be invisible. Callers pass `isApple` from one place. */
export function prettyKey(key: string, isApple: boolean): string {
  const parsed = parse(key);
  const base = NAMED[parsed.base]
    ?? (parsed.base.length === 1 ? parsed.base.toUpperCase() : parsed.base);

  return [
    parsed.mod ? (isApple ? '⌘' : 'Ctrl') : '',
    parsed.shift ? '⇧' : '',
    parsed.alt ? '⌥' : '',
    base,
  ].join('');
}

/** Every icon-only control gets one of these. */
export function tooltipFor(
  label: string,
  binding: Binding | undefined,
  isApple: boolean,
): string {
  return binding ? `${label} — ${prettyKey(binding.key, isApple)}` : label;
}

/** Resolved once, at the app edge, and threaded down. */
export function detectApple(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}
