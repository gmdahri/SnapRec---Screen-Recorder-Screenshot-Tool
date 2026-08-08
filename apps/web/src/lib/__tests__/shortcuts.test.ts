import { describe, expect, it } from 'vitest';
import { createRegistry, matches, prettyKey, tooltipFor, type Binding } from '../shortcuts';

const b = (key: string, label: string, scope: Binding['scope'] = 'video'): Binding =>
  ({ key, label, description: label, scope });

describe('shortcut registry', () => {
  it('refuses to bind the same key twice in one scope', () => {
    expect(() => createRegistry([b('s', 'Split'), b('s', 'Save')]))
      .toThrow(/duplicate binding: s \(video\)/);
  });

  it('allows the same key in different scopes', () => {
    expect(() => createRegistry([b('s', 'Split', 'video'), b('s', 'Shape', 'image')]))
      .not.toThrow();
  });

  it('matches a bare key only when no modifier is held', () => {
    const binding = b('s', 'Split');
    expect(matches(binding, new KeyboardEvent('keydown', { key: 's' }))).toBe(true);
    expect(matches(binding, new KeyboardEvent('keydown', { key: 's', metaKey: true }))).toBe(false);
  });

  it('matches a modified binding on either platform modifier', () => {
    const binding = b('mod+z', 'Undo');
    expect(matches(binding, new KeyboardEvent('keydown', { key: 'z', metaKey: true }))).toBe(true);
    expect(matches(binding, new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))).toBe(true);
    expect(matches(binding, new KeyboardEvent('keydown', { key: 'z' }))).toBe(false);
  });

  it('distinguishes shift-modified bindings', () => {
    const redo = b('mod+shift+z', 'Redo');
    expect(matches(redo, new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true }))).toBe(true);
    expect(matches(redo, new KeyboardEvent('keydown', { key: 'z', metaKey: true }))).toBe(false);
  });

  it('renders modifier symbols per platform, explicitly — not by sniffing', () => {
    expect(prettyKey('mod+z', true)).toBe('⌘Z');
    expect(prettyKey('mod+z', false)).toBe('CtrlZ');
    expect(prettyKey('mod+shift+z', true)).toBe('⌘⇧Z');
    expect(prettyKey('s', true)).toBe('S');
    expect(prettyKey('arrowright', true)).toBe('→');
    expect(prettyKey(' ', true)).toBe('space');
  });

  it('renders a tooltip naming the shortcut, because icon-only controls must', () => {
    expect(tooltipFor('Split', b('s', 'Split'), true)).toBe('Split — S');
    expect(tooltipFor('Split', undefined, true)).toBe('Split');
  });

  it('ignores a keystroke aimed at a text field', () => {
    const registry = createRegistry([b('s', 'Split')]);
    const input = document.createElement('input');
    document.body.appendChild(input);

    let fired = false;
    const event = new KeyboardEvent('keydown', { key: 's' });
    Object.defineProperty(event, 'target', { value: input });
    registry.handle(event, () => { fired = true; });

    expect(fired).toBe(false);
  });

  it('fires for a keystroke outside a text field', () => {
    const registry = createRegistry([b('s', 'Split')]);
    let fired: string | null = null;
    const event = new KeyboardEvent('keydown', { key: 's' });
    Object.defineProperty(event, 'target', { value: document.body });
    registry.handle(event, binding => { fired = binding.label; });

    expect(fired).toBe('Split');
  });
});
