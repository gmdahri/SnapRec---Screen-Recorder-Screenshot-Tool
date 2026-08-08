import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PRIMITIVES = resolve(__dirname, '../primitives');

/** tokens.css is the single source of truth. A hex literal in a primitive is a
 * colour that cannot be changed centrally and will not follow a theme — so it
 * is a bug, not a shortcut. */
const LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\s*\(/;

describe('primitives never hardcode colour', () => {
  it('contains no colour literal outside tokens.css', () => {
    const offenders: string[] = [];

    for (const file of readdirSync(PRIMITIVES)) {
      const src = readFileSync(resolve(PRIMITIVES, file), 'utf8');
      for (const [i, line] of src.split('\n').entries()) {
        if (LITERAL.test(line)) {
          offenders.push(`${file}:${i + 1}  ${line.trim()}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
