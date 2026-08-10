import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = readFileSync(join(SRC, 'VideoEditorContext.tsx'), 'utf8');

/** The context's value object and its dependency array are maintained by hand,
 * and drift between them is silent: the memo simply stops recomputing and every
 * consumer reads a stale value forever.
 *
 * Two bugs of exactly this shape shipped. `exportProgress` was in the value and
 * not the deps, so the export dialog sat at "0% · frame 0 of 0" for the whole
 * encode. And saveProject read `cuts`, both fades and `normalizeAudio` without
 * listing them, so it kept the identity it had at mount: remove six silences,
 * press Save draft, and the PATCH went out with `cuts: []` while the UI showed
 * the edit and the save reported success.
 *
 * eslint's react-hooks/exhaustive-deps would have caught both. It has never
 * run here — eslint itself throws on load in this repo — which is why this is
 * a test rather than a lint rule. */

function block(from: string, open: string, close: string): string {
  const at = FILE.indexOf(from);
  expect(at).toBeGreaterThan(-1);
  const body = FILE.slice(at);
  return body.slice(body.indexOf(open) + open.length, body.indexOf(close));
}

/** Shorthand entries only — `foo,` rather than `foo: bar(baz)`. Those are the
 * ones where the value IS the identifier, so the identifier must be a dep.
 * Computed entries like `canUndoEdit: canUndo(editHistory)` depend on
 * `editHistory` instead, and are checked by the compiler, not by name. */
const shorthand = (src: string) => src.match(/^\s{6}([A-Za-z_$][\w$]*),\s*$/gm)?.map(l => l.trim().replace(',', '')) ?? [];

describe('the context value and its dependency array agree', () => {
  const valueObj = block('const value = useMemo(', '() => ({', '    }),');
  const depsArr = block('const value = useMemo(', '    }),', '  );');
  const deps = new Set(shorthand(depsArr));

  it('reads a plausible number of keys', () => {
    expect(shorthand(valueObj).length).toBeGreaterThan(50);
    expect(deps.size).toBeGreaterThan(50);
  });

  it('lists every value it exposes, except the stable setters', () => {
    // A useState setter keeps its identity for the life of the component, so
    // omitting one cannot stale anything. Everything else can.
    const missing = shorthand(valueObj)
      .filter(k => !deps.has(k))
      .filter(k => !/^set[A-Z]/.test(k));
    expect(missing).toEqual([]);
  });
});

describe('saveProject writes what the editor is actually showing', () => {
  const payload = block('const saveProject = useCallback', 'const timelineJson = {', '    };');
  const depsArr = block('const saveProject = useCallback', '  }, [', '  ]);');
  const deps = new Set(depsArr.match(/[A-Za-z_$][\w$]*/g) ?? []);

  it('depends on every field it puts in the payload', () => {
    // Shorthand again: `cuts,` in the payload means the callback closes over
    // `cuts`, so it has to be a dependency or the save sends the mount value.
    const fields = shorthand(payload);
    expect(fields.length).toBeGreaterThan(2);
    expect(fields.filter(f => !deps.has(f))).toEqual([]);
  });

  it('still carries the cuts and the fades', () => {
    for (const field of ['cuts', 'fadeInSec', 'fadeOutSec', 'normalizeAudio']) {
      expect(deps.has(field)).toBe(true);
    }
  });
});
