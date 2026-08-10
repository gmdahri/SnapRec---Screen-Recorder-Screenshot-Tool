import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import puppeteer from 'puppeteer';
import { MobileVideoShare } from '../MobileVideoShare';
import { MobileImageShare } from '../MobileImageShare';
import type { ShareComment } from '../anchors';

const video = { id: 'c1', title: 'Bug repro', owner: 'Priya', durationMs: 47_000, allowDownload: true };
const image = { id: 'c2', title: 'Plan selection', owner: 'Priya', width: 2880, height: 1620, allowDownload: true };

const vComments: ShareComment[] = [
  { id: '1', author: 'Sam', body: 'Which build?', createdAt: '', index: 1,
    anchor: { kind: 'timecode', ms: 39_000 }, needsReply: true, resolved: false },
];
const iComments: ShareComment[] = [
  { id: '1', author: 'Sam', body: 'Move this', createdAt: '', index: 1,
    anchor: { kind: 'point', x: 0.3, y: 0.4 }, needsReply: false, resolved: false },
];

const noop = () => {};

describe('mobile video share (C3)', () => {
  it('uses the mobile header actions without losing their callbacks', async () => {
    const onBack = vi.fn();
    const onDownload = vi.fn();
    const onEdit = vi.fn();
    const onCopyLink = vi.fn();
    const user = userEvent.setup();
    render(<MobileVideoShare
      capture={{ ...video, canEdit: true }}
      comments={vComments}
      onSeek={noop}
      onPost={noop}
      onBack={onBack}
      onDownload={onDownload}
      onEdit={onEdit}
      onCopyLink={onCopyLink}
    />);

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Capture actions' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(onCopyLink).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(screen.getByRole('button', { name: 'Download' }));
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it('hides Edit from viewers without permission', async () => {
    render(<MobileVideoShare capture={{ ...video, canEdit: false }} comments={vComments}
      onSeek={noop} onPost={noop} onEdit={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('switches between comments and capture details', async () => {
    render(<MobileVideoShare
      capture={{
        ...video,
        createdAt: '2026-08-09T10:00:00Z',
        dimensions: '1920 × 1080',
        description: 'Safari checkout recording.',
        views: 12,
      }}
      comments={vComments}
      onSeek={noop}
      onPost={noop}
    />);

    const commentsTab = screen.getByRole('tab', { name: /Comments/ });
    const transcriptTab = screen.getByRole('tab', { name: /Transcript/ });
    const detailsTab = screen.getByRole('tab', { name: 'Details' });
    expect(commentsTab).toHaveAttribute('id', 'mobile-comments-tab');
    expect(commentsTab).toHaveAttribute('aria-controls', 'mobile-comments-panel');
    expect(screen.getByRole('tabpanel', { name: /Comments/ }))
      .toHaveAttribute('id', 'mobile-comments-panel');
    expect(transcriptTab).toHaveAttribute('id', 'mobile-transcript-tab');
    expect(transcriptTab).not.toHaveAttribute('aria-controls');

    await userEvent.click(detailsTab);
    const details = screen.getByRole('tabpanel', { name: 'Details' });
    expect(detailsTab).toHaveAttribute('id', 'mobile-details-tab');
    expect(detailsTab).toHaveAttribute('aria-controls', 'mobile-details-panel');
    expect(details).toHaveAttribute('id', 'mobile-details-panel');
    expect(within(details).getByText('Dimensions')).toBeInTheDocument();
    expect(within(details).getByText('1920 × 1080')).toBeInTheDocument();
    expect(screen.queryByLabelText('Write a comment')).toBeNull();

    await userEvent.click(screen.getByRole('tab', { name: /Comments/ }));
    expect(screen.getByLabelText('Write a comment')).toBeInTheDocument();
  });

  it('shows watched progress, unavailable transcript, and chapter jump targets', () => {
    const frames = [
      { startSec: 0, sampleSec: 0.5, dataUrl: 'data:image/jpeg;base64,AAA' },
      { startSec: 39, sampleSec: 39.5, dataUrl: null },
    ];
    render(<MobileVideoShare capture={{ ...video, watchedPercent: 87 }} comments={vComments}
      frames={frames} onSeek={noop} onPost={noop} />);

    expect(screen.getByText('87%')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Transcript/ }))
      .toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('tab', { name: /Transcript/ })).toBeDisabled();
    expect(screen.getByTestId('mobile-chapters')).toHaveTextContent('CHAPTERS');
    expect(screen.getAllByRole('button', { name: /Jump to/ })).toHaveLength(2);
  });

  it('omits watched progress when it is null or absent', () => {
    const { rerender } = render(<MobileVideoShare
      capture={{ ...video, watchedPercent: null }} comments={vComments} onSeek={noop} onPost={noop}
    />);
    expect(screen.queryByText('WATCHED')).toBeNull();
    expect(screen.queryByText('87%')).toBeNull();

    rerender(<MobileVideoShare capture={video} comments={vComments} onSeek={noop} onPost={noop} />);
    expect(screen.queryByText('WATCHED')).toBeNull();
    expect(screen.queryByText('87%')).toBeNull();
  });

  it('seeks when a chapter is selected', async () => {
    const onSeek = vi.fn();
    const frames = [
      { startSec: 0, sampleSec: 0.5, dataUrl: 'data:image/jpeg;base64,AAA' },
      { startSec: 39, sampleSec: 39.5, dataUrl: null },
    ];
    const user = userEvent.setup();
    render(<MobileVideoShare capture={video} comments={vComments} frames={frames}
      onSeek={onSeek} onPost={noop} />);

    await user.click(screen.getByRole('button', { name: 'Jump to 0:39' }));
    expect(onSeek).toHaveBeenCalledWith(39_000);
  });

  it('says when mobile chapter previews are still generating', () => {
    const frames = [{ startSec: 0, sampleSec: 0.5, dataUrl: null }];
    render(<MobileVideoShare capture={video} comments={vComments} frames={frames}
      framesGenerating onSeek={noop} onPost={noop} />);
    expect(screen.getByTestId('mobile-chapters')).toHaveTextContent('generating…');
  });

  it('says when mobile chapter previews are blocked for the file', () => {
    const frames = [{ startSec: 0, sampleSec: 0.5, dataUrl: null }];
    render(<MobileVideoShare capture={video} comments={vComments} frames={frames}
      framesBlocked onSeek={noop} onPost={noop} />);
    expect(screen.getByTestId('mobile-chapters'))
      .toHaveTextContent('previews unavailable for this file');
  });

  it('pins the player so seeking never scrolls it out of view', () => {
    render(<MobileVideoShare capture={video} comments={vComments} onSeek={noop} onPost={noop} />);
    expect(screen.getByTestId('sticky-player').dataset.sticky).toBe('true');
  });

  it('keeps the player pinned to the viewport during document scrolling', async () => {
    const css = await readFile(resolve(process.cwd(), 'src/index.css'), 'utf8');
    const longThread = Array.from({ length: 24 }, (_, index): ShareComment => ({
      ...vComments[0],
      id: `long-${index}`,
      body: `Comment ${index} makes the mobile document tall enough to scroll.`,
      index,
    }));
    const markup = renderToStaticMarkup(<MobileVideoShare
      capture={video} comments={longThread} onSeek={noop} onPost={noop}
    />);
    const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const browser = await puppeteer.launch({
      headless: true,
      ...(existsSync(systemChrome) ? { executablePath: systemChrome } : {}),
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 720, deviceScaleFactor: 1 });
      await page.setContent(`<style>${css}\nbody { margin: 0; }</style>${markup}`);

      const geometry = await page.evaluate(async () => {
        const player = document.querySelector<HTMLElement>('.sr-mobile-viewer-player');
        const viewer = document.querySelector<HTMLElement>('.sr-mobile-viewer');
        if (!player || !viewer) throw new Error('Mobile viewer fixture did not render');

        window.scrollTo(0, 500);
        await new Promise<void>(resolveFrame => requestAnimationFrame(() => resolveFrame()));
        return {
          documentScrollTop: window.scrollY,
          playerTop: player.getBoundingClientRect().top,
          viewerScrollTop: viewer.scrollTop,
        };
      });

      expect(geometry.documentScrollTop).toBeGreaterThan(0);
      expect(geometry.viewerScrollTop).toBe(0);
      expect(Math.abs(geometry.playerTop)).toBeLessThan(1);
    } finally {
      await browser.close();
    }
  }, 15_000);

  it('keeps the timecode column but drops the time-axis layout', () => {
    render(<MobileVideoShare capture={video} comments={vComments} onSeek={noop} onPost={noop} />);
    expect(screen.getByText('0:39')).toBeInTheDocument();
    expect(screen.queryByTestId('comment-columns')).toBeNull();
  });

  it('names what needs attention on the sheet', () => {
    render(<MobileVideoShare capture={video} comments={vComments} onSeek={noop} onPost={noop} />);
    expect(screen.getByText(/1 needs a reply/)).toBeInTheDocument();
  });

  it('renders every mobile viewer button at least 44px in both dimensions', async () => {
    const css = await readFile(resolve(process.cwd(), 'src/index.css'), 'utf8');
    const frames = [
      { startSec: 0, sampleSec: 0.5, dataUrl: null },
      { startSec: 39, sampleSec: 39.5, dataUrl: null },
    ];
    const markup = renderToStaticMarkup(<MobileVideoShare
      capture={video} comments={vComments} frames={frames} onSeek={noop} onPost={noop}
    />);
    const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const browser = await puppeteer.launch({
      headless: true,
      ...(existsSync(systemChrome) ? { executablePath: systemChrome } : {}),
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
      await page.setContent([
        `<style>${css}`,
        '*, *::before, *::after { box-sizing: border-box; }',
        'body { margin: 0; }',
        `</style>${markup}`,
      ].join('\n'));
      const buttons = await page.$$eval('.sr-mobile-viewer button', elements => elements.map(button => {
        const rect = button.getBoundingClientRect();
        return {
          name: button.getAttribute('aria-label') || button.textContent?.trim() || 'unnamed',
          width: rect.width,
          height: rect.height,
        };
      }));

      expect(buttons.length).toBeGreaterThan(0);
      for (const button of buttons) {
        expect(button.width, `${button.name} width`).toBeGreaterThanOrEqual(44);
        expect(button.height, `${button.name} height`).toBeGreaterThanOrEqual(44);
      }
    } finally {
      await browser.close();
    }
  }, 15_000);

  it('moves download into an overflow sheet, away from playback', async () => {
    render(<MobileVideoShare capture={video} comments={vComments} onSeek={noop} onPost={noop} />);
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });
});

describe('mobile image share (C4)', () => {
  it('draws no leaders at all', () => {
    render(<MobileImageShare capture={image} comments={iComments} onPost={noop} />);
    expect(screen.queryAllByTestId('leader')).toHaveLength(0);
  });

  it('pairs comment and pin by selection instead, and by number', async () => {
    render(<MobileImageShare capture={image} comments={iComments} onPost={noop} />);
    await userEvent.click(screen.getByTestId('note-1'));
    expect(screen.getByRole('button', { name: 'Pin 1' })).toHaveAttribute('data-halo', 'true');
    expect(screen.getByTestId('note-1').dataset.selected).toBe('true');
  });

  it('keeps pins at 22px with a 44px tap area', () => {
    render(<MobileImageShare capture={image} comments={iComments} onPost={noop} />);
    const pin = screen.getByRole('button', { name: 'Pin 1' });
    expect(pin.dataset.pinSize).toBe('22');
    expect(Number(pin.dataset.minTarget)).toBe(44);
  });
});
