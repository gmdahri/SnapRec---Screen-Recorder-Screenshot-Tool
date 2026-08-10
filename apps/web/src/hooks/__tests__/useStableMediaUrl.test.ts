import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { sameMediaObject, useStableMediaUrl } from '../useStableMediaUrl';

const signed = (sig: string) => `https://r2.example.com/videos/clip.webm?X-Amz-Signature=${sig}`;

describe('recognising the same stored object', () => {
  /** The whole point: the server re-signs on every read, so these two strings
   * are different but name one file. */
  it('ignores a re-signed query string', () => {
    expect(sameMediaObject(signed('aaa'), signed('bbb'))).toBe(true);
  });

  it('sees a different file as different', () => {
    expect(sameMediaObject(signed('aaa'), 'https://r2.example.com/videos/other.webm?X-Amz-Signature=aaa'))
      .toBe(false);
  });

  it('sees a different host as different', () => {
    expect(sameMediaObject(signed('a'), 'https://other.example.com/videos/clip.webm?X-Amz-Signature=a'))
      .toBe(false);
  });

  it('compares relative URLs on everything before the query', () => {
    expect(sameMediaObject('/media/clip.webm?sig=1', '/media/clip.webm?sig=2')).toBe(true);
    expect(sameMediaObject('/media/clip.webm?sig=1', '/media/two.webm?sig=1')).toBe(false);
  });

  /** Two object URLs are distinct handles even when they wrap one blob, and
   * they never churn, so there is nothing to hold still. */
  it('treats blob URLs as never interchangeable', () => {
    expect(sameMediaObject('blob:http://x/1', 'blob:http://x/2')).toBe(false);
  });

  it('handles nothing on either side', () => {
    expect(sameMediaObject(undefined, undefined)).toBe(true);
    expect(sameMediaObject(signed('a'), undefined)).toBe(false);
  });
});

describe('the URL handed to the player', () => {
  /** The reload-on-comment bug: a mutation invalidates the query, the refetch
   * returns a freshly signed URL, and the element restarts from 0:00. */
  it('does not change when only the signature was refreshed', () => {
    const { result, rerender } = renderHook(({ url }) => useStableMediaUrl(url), {
      initialProps: { url: signed('first') },
    });
    const first = result.current;

    rerender({ url: signed('second') });
    expect(result.current).toBe(first);

    rerender({ url: signed('third') });
    expect(result.current).toBe(first);
  });

  it('does change when the recording points at another file', () => {
    const { result, rerender } = renderHook(({ url }) => useStableMediaUrl(url), {
      initialProps: { url: signed('a') },
    });
    const other = 'https://r2.example.com/videos/replacement.webm?X-Amz-Signature=a';
    rerender({ url: other });
    expect(result.current).toBe(other);
  });

  it('reports nothing before a URL exists, and pins the first real one', () => {
    const { result, rerender } = renderHook(
      ({ url }) => useStableMediaUrl(url),
      { initialProps: { url: undefined as string | undefined } },
    );
    expect(result.current).toBeUndefined();

    rerender({ url: signed('a') });
    expect(result.current).toBe(signed('a'));

    rerender({ url: signed('b') });
    expect(result.current).toBe(signed('a'));
  });
});
