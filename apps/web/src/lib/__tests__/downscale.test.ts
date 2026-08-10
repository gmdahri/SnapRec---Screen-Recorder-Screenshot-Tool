import { describe, expect, it, beforeEach } from 'vitest';
import {
  coverCrop, halvingSteps, drawCoverDownscaled, releaseScratch, type DrawTarget,
} from '../downscale';

describe('the crop that fills a plate without distorting it', () => {
  it('trims the sides of a source wider than the box', () => {
    // 2:1 into 16:9 — full height kept, width cut to 16/9 of it.
    expect(coverCrop(2000, 1000, 1600, 900)).toEqual({
      sx: (2000 - 1000 * (16 / 9)) / 2, sy: 0, sw: 1000 * (16 / 9), sh: 1000,
    });
  });

  /** The real case: a Retina desktop is 1.54:1, taller than the 16:9 plate. */
  it('trims the top and bottom of a source taller than the box', () => {
    const { sx, sy, sw, sh } = coverCrop(3600, 2338, 1600, 900);
    expect(sx).toBe(0);
    expect(sw).toBe(3600);
    expect(sh).toBeCloseTo(3600 / (16 / 9), 5);
    expect(sy).toBeCloseTo((2338 - sh) / 2, 5);
  });

  it('crops nothing when the ratios already agree', () => {
    expect(coverCrop(1920, 1080, 640, 360)).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080 });
  });

  /** A video reports 0×0 until metadata lands, and the card may be laid out at
   * zero width before first paint. Neither is an error worth throwing over. */
  it('returns an empty rectangle when a dimension is missing', () => {
    expect(coverCrop(0, 0, 640, 360)).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 });
    expect(coverCrop(1920, 1080, 0, 0)).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 });
  });
});

describe('how many halvings a reduction needs', () => {
  it('stops while the intermediate is still at or above the target', () => {
    // 3600 -> 1800 -> 900; halving again would land under 560.
    expect(halvingSteps(3600, 560)).toBe(2);
  });

  it('takes none when the source is already near the target', () => {
    expect(halvingSteps(800, 560)).toBe(0);
    expect(halvingSteps(560, 560)).toBe(0);
  });

  /** An upscale is a single draw. Halving first would only throw detail away. */
  it('takes none when the target is larger than the source', () => {
    expect(halvingSteps(320, 560)).toBe(0);
  });

  it('refuses to loop on a missing dimension', () => {
    expect(halvingSteps(0, 560)).toBe(0);
    expect(halvingSteps(3600, 0)).toBe(0);
  });
});

/** Records every draw so the halving chain can be asserted without a canvas. */
function fakeCanvas(label: string, log: string[]): DrawTarget {
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low' as ImageSmoothingQuality,
      drawImage(
        _src: unknown, sx: number, sy: number, sw: number, sh: number,
        _dx: number, _dy: number, dw: number, dh: number,
      ) {
        log.push(`${label}<- (${sx},${sy} ${sw}x${sh}) => ${dw}x${dh}`);
      },
    }),
  };
  return canvas as unknown as DrawTarget;
}

describe('drawing a frame down to card size', () => {
  beforeEach(() => releaseScratch());

  const source = {} as CanvasImageSource;

  it('halves its way down rather than reducing in one leap', () => {
    const log: string[] = [];
    let made = 0;
    const target = fakeCanvas('target', log);
    target.width = 560;
    target.height = 316;

    expect(drawCoverDownscaled(source, 3600, 2338, target, {
      createCanvas: () => fakeCanvas(`scratch${made++}`, log),
    })).toBe(true);

    // Two halvings then the final draw — never one 3600 -> 560 step.
    expect(log).toHaveLength(3);
    expect(log[0]).toMatch(/^scratch0<-/);
    expect(log[0]).toMatch(/=> 1800x1016$/);
    expect(log[1]).toBe('scratch1<- (0,0 1800x1016) => 900x508');
    expect(log[2]).toBe('target<- (0,0 900x508) => 560x316');
  });

  /** The first halving reads the video directly. Copying a 3600×2338 frame into
   * a full-size scratch canvas first would cost 33MB for nothing. */
  it('never allocates a scratch canvas at full source size', () => {
    const log: string[] = [];
    const target = fakeCanvas('target', log);
    target.width = 560;
    target.height = 316;

    drawCoverDownscaled(source, 3600, 2338, target, {
      createCanvas: () => fakeCanvas('s', log),
    });
    // The first draw reads the video and lands at half the crop. A full-size
    // intermediate would be 3600 wide and cost 33MB per card.
    expect(log[0]).toMatch(/=> 1800x1016$/);
  });

  it('draws once when the source is already near the target', () => {
    const log: string[] = [];
    const target = fakeCanvas('target', log);
    target.width = 560;
    target.height = 316;

    target.height = 315;   // 16:9, so the crop is the whole frame
    drawCoverDownscaled(source, 800, 450, target, {
      createCanvas: () => fakeCanvas('scratch', log),
    });
    expect(log).toEqual(['target<- (0,0 800x450) => 560x315']);
  });

  it('reuses the scratch canvases across draws instead of growing a pool', () => {
    const log: string[] = [];
    let made = 0;
    const target = fakeCanvas('target', log);
    target.width = 560;
    target.height = 316;
    const opts = { createCanvas: () => { made += 1; return fakeCanvas('s', log); } };

    drawCoverDownscaled(source, 3600, 2338, target, opts);
    drawCoverDownscaled(source, 3600, 2338, target, opts);
    drawCoverDownscaled(source, 3600, 2338, target, opts);
    expect(made).toBe(2);
  });

  it('declines to draw before the source or the card has a size', () => {
    const log: string[] = [];
    const target = fakeCanvas('target', log);
    target.width = 560;
    target.height = 316;
    expect(drawCoverDownscaled(source, 0, 0, target, {})).toBe(false);

    const unsized = fakeCanvas('target', log);
    expect(drawCoverDownscaled(source, 3600, 2338, unsized, {})).toBe(false);
    expect(log).toEqual([]);
  });
});
