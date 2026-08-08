import { describe, expect, it } from 'vitest';
import { SECTIONS } from '../Settings/sections';

describe('Settings', () => {
  it('holds the seven sections in the prototype order', () => {
    expect(SECTIONS.map(s => s.title)).toEqual([
      'Capture defaults',
      'Microphone and camera',
      'Sharing and privacy',
      'Notifications',
      'Storage and downloads',
      'Connected apps',
      'Delete account',
    ]);
  });

  it('marks the extension-owned settings so they are not silently web-only', () => {
    expect(SECTIONS.find(s => s.title === 'Capture defaults')!.note)
      .toBe('used by the extension');
  });

  it('explains every setting whose cost is not obvious', () => {
    const quality = SECTIONS.flatMap(s => s.fields).find(f => f.label === 'Recording quality')!;
    expect(quality.help).toBe('Higher quality means larger files and slower uploads.');
  });

  it('explains what a countdown is for', () => {
    const countdown = SECTIONS.flatMap(s => s.fields)
      .find(f => f.label === 'Countdown before recording')!;
    expect(countdown.help).toBe('Gives you a moment to switch tabs.');
  });

  it('says auto-zoom regions are removable, so it is not a trap', () => {
    const zoom = SECTIONS.flatMap(s => s.fields).find(f => f.label === 'Zoom in on clicks')!;
    expect(zoom.help).toContain('remove them in the editor');
  });

  it('puts account deletion last and marks it destructive', () => {
    const last = SECTIONS.at(-1)!;
    expect(last.title).toBe('Delete account');
    expect(last.destructive).toBe(true);
  });

  it('gives every field a stable key so state can be persisted', () => {
    const keys = SECTIONS.flatMap(s => s.fields).map(f => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
