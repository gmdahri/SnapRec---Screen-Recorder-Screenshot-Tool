import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  backoffMs, enqueue, markDone, markFailed, markUploading, nextPending, prune,
} from '../background/queue.core.js';

const item = (id, at = 1000) => ({ id, fileName: `${id}.webm`, bytes: 7_200_000, createdAt: at });

describe('offline upload queue', () => {
  it('queues a capture without losing it', () => {
    const q = enqueue([], item('c1'));
    expect(q).toHaveLength(1);
    expect(q[0].status).toBe('pending');
    expect(q[0].attempts).toBe(0);
  });

  it('never enqueues the same capture twice', () => {
    expect(enqueue(enqueue([], item('c1')), item('c1'))).toHaveLength(1);
  });

  it('resumes from the recorded offset rather than restarting', () => {
    let q = enqueue([], item('c1'));
    q = markUploading(q, 'c1', 62);
    q = markFailed(q, 'c1', 'network', 62);
    expect(q[0].status).toBe('pending');
    expect(q[0].offsetPct).toBe(62);
    expect(q[0].attempts).toBe(1);
  });

  it('backs off exponentially, capped at fifteen minutes', () => {
    expect(backoffMs(0)).toBe(30_000);
    expect(backoffMs(1)).toBe(60_000);
    expect(backoffMs(2)).toBe(120_000);
    expect(backoffMs(10)).toBe(900_000);
  });

  it('serves the oldest pending item first', () => {
    let q = enqueue(enqueue([], item('c1', 1000)), item('c2', 2000));
    expect(nextPending(q).id).toBe('c1');
    q = markDone(q, 'c1', 'https://x');
    expect(nextPending(q).id).toBe('c2');
  });

  it('does not serve an item that is already uploading', () => {
    expect(nextPending(markUploading(enqueue([], item('c1')), 'c1', 10))).toBeNull();
  });

  it('keeps a completed item long enough for the popup to show its link', () => {
    const q = markDone(enqueue([], item('c1')), 'c1', 'https://x');
    expect(q[0].status).toBe('done');
    expect(q[0].url).toBe('https://x');
  });

  it('prunes completed items after the retention window, never pending ones', () => {
    let q = enqueue(enqueue([], item('c1', 0)), item('c2', 0));
    q = markDone(q, 'c1', 'https://x');
    expect(prune(q, 86_400_001, 86_400_000).map((i) => i.id)).toEqual(['c2']);
  });

  it('the classic-script copy has not drifted from the tested module', () => {
    // Order matters: strip the whole `export { ... };` block BEFORE stripping
    // a leading `export ` keyword, or the first rule eats the keyword and
    // leaves an orphaned brace list behind.
    const normalise = (s) => s
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/globalThis\.SnapRecQueue[\s\S]*$/, '')
      .replace(/export\s*\{[^}]*\};?/g, '')
      .replace(/^\s*export\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    const core = readFileSync(resolve(__dirname, '../background/queue.core.js'), 'utf8');
    const classic = readFileSync(resolve(__dirname, '../background/queue.js'), 'utf8');
    expect(normalise(classic)).toBe(normalise(core));
  });
});
