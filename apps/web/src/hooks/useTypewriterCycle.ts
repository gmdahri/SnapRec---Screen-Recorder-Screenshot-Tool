import { useEffect, useState } from 'react';

const TYPE_MS = 45;
const ERASE_MS = 25;
const HOLD_MS = 1400;

/** The label types one phrase in, holds it long enough to read, erases it, and
 * moves to the next — forever. Erasing runs faster than typing because a
 * viewer re-reading text they have already seen only needs the motion cue.
 *
 * Returns the string for this render. Reduced motion collapses the whole
 * machine to the shortest phrase, which is the one that still reads as a
 * label rather than a sentence. */
export function useTypewriterCycle(phrases: string[]): string {
  const [text, setText] = useState('');

  const still = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  useEffect(() => {
    if (still) return;

    let phrase = 0;
    let chars = 0;
    let erasing = false;
    let timer: ReturnType<typeof setTimeout>;

    const step = () => {
      const target = phrases[phrase];

      if (!erasing && chars === target.length) {
        erasing = true;
        timer = setTimeout(step, HOLD_MS);
        return;
      }

      if (erasing && chars === 0) {
        erasing = false;
        phrase = (phrase + 1) % phrases.length;
        // Flow straight into typing the next phrase; no hold at empty.
        timer = setTimeout(step, TYPE_MS);
        return;
      }

      chars += erasing ? -1 : 1;
      setText(phrases[phrase].slice(0, chars));
      timer = setTimeout(step, erasing ? ERASE_MS : TYPE_MS);
    };

    timer = setTimeout(step, TYPE_MS);
    return () => clearTimeout(timer);
  }, [phrases, still]);

  if (still) return phrases.reduce((a, b) => (b.length < a.length ? b : a));
  return text;
}
