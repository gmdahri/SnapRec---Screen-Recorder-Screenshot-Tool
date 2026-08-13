import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import puppeteer from 'puppeteer';
import { VideoViewer, type ViewerCapture } from '../VideoViewer';
import type { ShareComment } from '../anchors';

const capture: ViewerCapture = {
  id: 'c1',
  title: 'Follow-up for Brightline demo',
  owner: 'Maya Ortiz',
  createdAt: '2026-08-09T10:00:00Z',
  durationMs: 182_000,
  dimensions: '1920×1080',
  description: 'Walkthrough of the two changes Brightline asked for.',
  status: 'shared',
  views: 38,
  allowDownload: true,
  canEdit: true,
};

const comments: ShareComment[] = [
  { id: '1', author: 'Dana Kwon', body: 'The split rule is right', createdAt: '2026-08-09T12:00:00Z',
    index: 1, anchor: { kind: 'timecode', ms: 41_000 }, needsReply: true, resolved: false },
  { id: '2', author: 'Maya Ortiz', body: 'Rounds to the primary payee.', createdAt: '2026-08-09T12:05:00Z',
    index: 2, anchor: { kind: 'timecode', ms: 41_000 }, needsReply: false, resolved: true },
];

const noop = () => {};
const base = {
  capture, comments, currentMs: 0,
  onBack: noop, onSeek: noop, onPost: noop, onCopyLink: noop,
};

async function viewerFixtureCss(): Promise<string> {
  const [css, tokens, uiFont, monoFont] = await Promise.all([
    readFile(resolve(process.cwd(), 'src/index.css'), 'utf8'),
    readFile(resolve(process.cwd(), '../../packages/design-system/src/tokens.css'), 'utf8'),
    readFile(resolve(
      process.cwd(),
      '../../node_modules/@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2',
    )),
    readFile(resolve(
      process.cwd(),
      '../../node_modules/@fontsource-variable/azeret-mono/files/azeret-mono-latin-wght-normal.woff2',
    )),
  ]);

  // page.setContent does not run Vite/Tailwind. Supply the production tokens,
  // self-hosted fonts, and the box-sizing reset this geometry depends on so
  // wrapping and border dimensions match the shipped surface.
  return `
    @font-face {
      font-family: 'Schibsted Grotesk Variable';
      src: url(data:font/woff2;base64,${uiFont.toString('base64')}) format('woff2');
      font-weight: 400 800;
    }
    @font-face {
      font-family: 'Azeret Mono Variable';
      src: url(data:font/woff2;base64,${monoFont.toString('base64')}) format('woff2');
      font-weight: 400 800;
    }
    ${tokens}
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body { font-family: var(--sr-font-ui); }
    ${css}
  `;
}

describe('viewer top bar', () => {
  it('names the capture and its sharing state', () => {
    render(<VideoViewer {...base} />);
    const bar = screen.getByTestId('viewer-topbar');
    expect(within(bar).getByText(capture.title)).toBeInTheDocument();
    expect(within(bar).getByText('shared')).toBeInTheDocument();
  });

  it('offers back, download, edit and copy link', async () => {
    const onBack = vi.fn(); const onDownload = vi.fn();
    const onEdit = vi.fn(); const onCopyLink = vi.fn();
    const user = userEvent.setup();
    render(<VideoViewer {...base} onBack={onBack} onDownload={onDownload}
      onEdit={onEdit} onCopyLink={onCopyLink} />);

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Download' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onDownload).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onCopyLink).toHaveBeenCalledOnce();
  });

  /** A viewer who cannot edit must not be shown a control that will 403. */
  it('hides Edit when the viewer does not own the capture', () => {
    render(<VideoViewer {...base} capture={{ ...capture, canEdit: false }} />);
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('hides Download when downloading is not allowed', () => {
    render(<VideoViewer {...base} capture={{ ...capture, allowDownload: false }} />);
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });

  /** This is a public page, so the ask reaches recipients rather than the owner.
   * It stays outlined and sits leftmost in the right-hand group, so it never
   * comes between the viewer and Copy link or Download. */
  it('offers a Patreon link without competing with the primary actions', () => {
    render(<VideoViewer {...base} />);
    const bar = screen.getByTestId('viewer-topbar');
    const link = within(bar).getByRole('link', { name: /Support us on Patreon/i });
    expect(link).toHaveAttribute('href', 'https://www.patreon.com/cw/SnapRec');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');

    // Copy link stays the only filled control in the bar.
    expect(link).not.toHaveStyle({ background: 'var(--sr-cyan)' });
  });

  it('keeps the support link for a viewer who can neither edit nor download', () => {
    render(
      <VideoViewer {...base}
        capture={{ ...capture, canEdit: false, allowDownload: false }} />,
    );
    expect(screen.getByRole('link', { name: /Support us on Patreon/i })).toBeInTheDocument();
  });
});

describe('metadata block', () => {
  it('states owner, date, duration and dimensions', () => {
    render(<VideoViewer {...base} />);
    const meta = screen.getByTestId('viewer-meta');
    expect(meta).toHaveTextContent('Maya Ortiz');
    expect(meta).toHaveTextContent('3:02');
    expect(meta).toHaveTextContent('1920×1080');
  });

  /** The 0:00 bug, guarded at the new surface too. */
  it('omits a duration it does not know instead of claiming 0:00', () => {
    render(<VideoViewer {...base} capture={{ ...capture, durationMs: 0 }} />);
    expect(screen.getByTestId('viewer-meta')).not.toHaveTextContent('0:00');
  });

  it('omits dimensions that were never captured', () => {
    render(<VideoViewer {...base} capture={{ ...capture, dimensions: undefined }} />);
    expect(screen.getByTestId('viewer-meta')).not.toHaveTextContent('×');
  });

  it('drops the description block when there is no description', () => {
    render(<VideoViewer {...base} capture={{ ...capture, description: undefined }} />);
    expect(screen.queryByTestId('viewer-description')).toBeNull();
  });
});

describe('stat tiles', () => {
  it('counts views and comments', () => {
    render(<VideoViewer {...base} />);
    const tiles = screen.getByTestId('viewer-stats');
    expect(within(tiles).getByText('38')).toBeInTheDocument();
    expect(within(tiles).getByText('2')).toBeInTheDocument();
  });

  /** "0%" reads as "nobody watched"; the truth is "we did not measure". */
  it('shows no watched tile until a signed-in viewer has watched', () => {
    render(<VideoViewer {...base} />);
    expect(screen.getByTestId('viewer-stats')).not.toHaveTextContent(/watched/i);
  });

  it('shows the coverage once there is some', () => {
    render(<VideoViewer {...base} capture={{ ...capture, watchedPercent: 87 }} />);
    const tiles = screen.getByTestId('viewer-stats');
    expect(tiles).toHaveTextContent('WATCHED');
    expect(within(tiles).getByText('87%')).toBeInTheDocument();
  });

  it('shows a genuine zero, which is different from unmeasured', () => {
    render(<VideoViewer {...base} capture={{ ...capture, watchedPercent: 0 }} />);
    expect(within(screen.getByTestId('viewer-stats')).getByText('0%')).toBeInTheDocument();
  });

  /** Guests are never individually tracked, so on a widely shared link this
   * figure describes a minority of the audience. It must not imply otherwise. */
  it('says the figure covers signed-in viewers only', () => {
    render(<VideoViewer {...base} capture={{ ...capture, watchedPercent: 87 }} />);
    expect(screen.getByTitle(/signed-in viewers only/i)).toBeInTheDocument();
  });
});

describe('the side rail', () => {
  it('opens on comments and lists them with their timecodes', () => {
    render(<VideoViewer {...base} />);
    const rail = screen.getByTestId('viewer-rail');
    expect(within(rail).getByText('Dana Kwon')).toBeInTheDocument();
    expect(within(rail).getAllByText('0:41')).toHaveLength(2);
  });

  it('seeks when a comment is clicked', async () => {
    const onSeek = vi.fn();
    const user = userEvent.setup();
    render(<VideoViewer {...base} onSeek={onSeek} />);
    await user.click(screen.getByRole('button', { name: /Dana Kwon/ }));
    expect(onSeek).toHaveBeenCalledWith(41_000);
  });

  it('marks a resolved comment as resolved', () => {
    render(<VideoViewer {...base} />);
    expect(screen.getByText('resolved')).toBeInTheDocument();
  });

  it('says so plainly when there are no comments', () => {
    render(<VideoViewer {...base} comments={[]} />);
    expect(screen.getByTestId('viewer-rail')).toHaveTextContent(/No comments yet/i);
  });

  it('shows Transcript as an unavailable tab', () => {
    render(<VideoViewer {...base} />);
    const transcript = screen.getByRole('tab', { name: 'Transcript —' });
    expect(transcript).toHaveTextContent('Transcript —');
    expect(transcript).toHaveAttribute('aria-disabled', 'true');
    expect(transcript).toBeDisabled();
  });

  it('keeps the supported tabs alongside the unavailable transcript', () => {
    render(<VideoViewer {...base} />);
    expect(screen.getAllByRole('tab').map(t => t.textContent))
      .toEqual(['Comments 2', 'Transcript —', 'Details']);
  });

  it('associates each available tab with its named panel', async () => {
    render(<VideoViewer {...base} />);
    const commentsTab = screen.getByRole('tab', { name: 'Comments 2' });
    const transcriptTab = screen.getByRole('tab', { name: 'Transcript —' });
    const detailsTab = screen.getByRole('tab', { name: 'Details' });

    expect(commentsTab).toHaveAttribute('id', 'viewer-comments-tab');
    expect(commentsTab).toHaveAttribute('aria-controls', 'viewer-comments-panel');
    expect(screen.getByRole('tabpanel', { name: 'Comments 2' }))
      .toHaveAttribute('id', 'viewer-comments-panel');
    expect(transcriptTab).toHaveAttribute('id', 'viewer-transcript-tab');
    expect(transcriptTab).not.toHaveAttribute('aria-controls');

    await userEvent.click(detailsTab);
    expect(detailsTab).toHaveAttribute('id', 'viewer-details-tab');
    expect(detailsTab).toHaveAttribute('aria-controls', 'viewer-details-panel');
    expect(screen.getByRole('tabpanel', { name: 'Details' }))
      .toHaveAttribute('id', 'viewer-details-panel');
  });

  it('shows details of the capture on the details tab', async () => {
    const user = userEvent.setup();
    render(<VideoViewer {...base} />);
    await user.click(screen.getByRole('tab', { name: /Details/ }));
    const rail = screen.getByTestId('viewer-rail');
    expect(rail).toHaveTextContent('1920×1080');
    expect(rail).toHaveTextContent('Maya Ortiz');
  });

  it('tells the composer which moment a comment will pin to', () => {
    render(<VideoViewer {...base} currentMs={72_000} />);
    expect(screen.getByTestId('viewer-rail')).toHaveTextContent('1:12');
  });
});

describe('desktop rail geometry', () => {
  it('keeps a 2000-character description and Chapters reachable on one page scroller, with none nested', async () => {
    const css = await viewerFixtureCss();
    const longThread = Array.from({ length: 30 }, (_, index): ShareComment => ({
      ...comments[0],
      id: `long-${index}`,
      body: `Comment ${index} needs enough room to make the rail overflow.`,
      index,
    }));
    const frames = [0, 24, 41, 72, 104, 138, 156, 174].map((startSec) => ({
      startSec,
      sampleSec: startSec + 0.5,
      dataUrl: null,
    }));
    const expandedCapture: ViewerCapture = {
      ...capture,
      watchedPercent: 87,
      description: 'Detailed review note for the customer hand-off and final confirmation state. '
        .repeat(40)
        .slice(0, 2000),
    };
    const markup = renderToStaticMarkup(
      <VideoViewer
        {...base}
        capture={expandedCapture}
        comments={longThread}
        frames={frames}
        player={<video data-testid="geometry-media" />}
      />,
    );
    const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const browser = await puppeteer.launch({
      headless: true,
      ...(existsSync(systemChrome) ? { executablePath: systemChrome } : {}),
    });

    try {
      const page = await browser.newPage();
      await page.setContent(`<style>${css}</style>${markup}`);
      await page.evaluate(() => document.fonts.ready);

      for (const viewport of [
        { width: 1440, height: 1024 },
        { width: 1440, height: 700 },
        { width: 1366, height: 768 },
        { width: 1180, height: 850 },
        { width: 1024, height: 768 },
      ]) {
        await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
        await page.evaluate(() => {
          const pageEl = document.querySelector<HTMLElement>('.sr-viewer-page');
          if (pageEl) pageEl.scrollTop = 0;
        });

        const geometry = await page.evaluate(() => {
          const root = document.body.lastElementChild as HTMLElement | null;
          const stage = document.querySelector<HTMLElement>('.sr-viewer-stage');
          const frame = stage?.firstElementChild as HTMLElement | null;
          const media = document.querySelector<HTMLElement>('[data-testid="geometry-media"]');
          const rail = document.querySelector<HTMLElement>('.sr-viewer-rail');
          const content = document.querySelector<HTMLElement>('.sr-viewer-content-column');
          const metadata = document.querySelector<HTMLElement>('.sr-viewer-metadata-row');
          const metadataTitle = metadata?.querySelector<HTMLElement>('h1');
          const chapters = document.querySelector<HTMLElement>('.sr-viewer-chapters');
          const chapterTrack = document.querySelector<HTMLElement>('.sr-viewer-chapter-grid');
          const pageEl = document.querySelector<HTMLElement>('.sr-viewer-page');
          const composer = rail?.lastElementChild as HTMLElement | null;
          const scrollArea = Array.from(rail?.children ?? []).find((child) => (
            getComputedStyle(child).overflowY === 'auto'
          )) as HTMLElement | undefined;

          if (!root || !stage || !frame || !media || !rail || !content || !metadata
            || !metadataTitle || !chapters || !chapterTrack || !composer || !scrollArea
            || !pageEl) {
            throw new Error('Viewer geometry fixture did not render the expected regions');
          }

          const rootRect = root.getBoundingClientRect();
          const stageRect = stage.getBoundingClientRect();
          const frameRect = frame.getBoundingClientRect();
          const railRect = rail.getBoundingClientRect();
          const contentRect = content.getBoundingClientRect();
          const metadataTitleRect = metadataTitle.getBoundingClientRect();
          const composerRect = composer.getBoundingClientRect();
          const chapterTops = Array.from(chapterTrack.children).map((chapter) => (
            (chapter as HTMLElement).getBoundingClientRect().top
          ));
          return {
            documentScrollHeight: document.documentElement.scrollHeight,
            viewportHeight: window.innerHeight,
            rootBottom: rootRect.bottom,
            stageTop: stageRect.top,
            stageHeight: stageRect.height,
            frameHeight: frameRect.height,
            frameWidth: frameRect.width,
            frameRatio: frameRect.width / frameRect.height,
            stageWidth: stageRect.width,
            mediaObjectFit: getComputedStyle(media).objectFit,
            railHeight: railRect.height,
            railTop: railRect.top,
            railBottom: railRect.bottom,
            composerBottom: composerRect.bottom,
            contentTop: contentRect.top,
            contentBottom: contentRect.bottom,
            contentOverflowY: getComputedStyle(content).overflowY,
            pageScrollHeight: pageEl.scrollHeight,
            pageClientHeight: pageEl.clientHeight,
            pageOverflowY: getComputedStyle(pageEl).overflowY,
            metadataTitleTop: metadataTitleRect.top,
            metadataTitleBottom: metadataTitleRect.bottom,
            chapterRowCount: new Set(chapterTops.map(top => Math.round(top))).size,
            chapterScrollWidth: chapterTrack.scrollWidth,
            chapterClientWidth: chapterTrack.clientWidth,
            railScrollHeight: scrollArea.scrollHeight,
            railClientHeight: scrollArea.clientHeight,
          };
        });

        expect(geometry.documentScrollHeight).toBeLessThanOrEqual(geometry.viewportHeight);
        expect(geometry.rootBottom).toBeLessThanOrEqual(geometry.viewportHeight);
        expect(geometry.stageHeight).toBeGreaterThan(0);
        expect(geometry.contentTop).toBeGreaterThan(0);
        /* One scroller, at the page edge. The description and Chapters used to
           sit in a fixed-height remainder with its own `overflow-y: auto`,
           which drew a second scrollbar around them inside a page that already
           had one. */
        expect(geometry.contentOverflowY).toBe('visible');
        expect(geometry.pageOverflowY).toBe('auto');
        expect(geometry.pageScrollHeight).toBeGreaterThan(geometry.pageClientHeight);
        expect(geometry.metadataTitleTop).toBeGreaterThanOrEqual(geometry.contentTop);
        expect(Math.abs(geometry.stageHeight - geometry.frameHeight)).toBeLessThan(1);
        expect(Math.abs(geometry.stageWidth - geometry.frameWidth)).toBeLessThan(1);
        expect(Math.abs(geometry.frameRatio - (16 / 9))).toBeLessThan(0.01);
        expect(geometry.mediaObjectFit).toBe('contain');
        /* The rail runs the height of the whole left column — level with the top
           of the player, down to the bottom edge of Chapters. It used to stop
           where the video stopped, which left the paper beside the title, the
           stats and Chapters empty. */
        expect(Math.abs(geometry.railTop - geometry.stageTop)).toBeLessThan(1);
        expect(Math.abs(geometry.railBottom - geometry.contentBottom)).toBeLessThan(1);
        expect(geometry.railHeight).toBeGreaterThan(geometry.stageHeight);
        // The composer's content edge sits inside the rail's 1px outer border.
        expect(Math.abs(geometry.railBottom - geometry.composerBottom)).toBeLessThanOrEqual(1);
        expect(geometry.chapterRowCount).toBe(1);
        expect(geometry.chapterScrollWidth).toBeGreaterThan(geometry.chapterClientWidth);
        expect(geometry.railScrollHeight).toBeGreaterThan(geometry.railClientHeight);

        const scrolledGeometry = await page.evaluate(() => {
          const pageEl = document.querySelector<HTMLElement>('.sr-viewer-page');
          const chapters = document.querySelector<HTMLElement>('.sr-viewer-chapters');
          if (!pageEl || !chapters) throw new Error('Scrollable viewer content did not render');
          pageEl.scrollTop = pageEl.scrollHeight;
          const chaptersRect = chapters.getBoundingClientRect();
          return {
            scrollTop: pageEl.scrollTop,
            viewportHeight: window.innerHeight,
            chaptersTop: chaptersRect.top,
            chaptersBottom: chaptersRect.bottom,
          };
        });

        // Scrolling the page — the only scroller — brings Chapters into view.
        expect(scrolledGeometry.scrollTop).toBeGreaterThan(0);
        expect(scrolledGeometry.chaptersTop).toBeGreaterThanOrEqual(0);
        expect(scrolledGeometry.chaptersBottom)
          .toBeLessThanOrEqual(scrolledGeometry.viewportHeight + 1);
      }

      await page.setViewport({ width: 1023, height: 900, deviceScaleFactor: 1 });
      const stackedGeometry = await page.evaluate(() => {
        const root = document.body.lastElementChild as HTMLElement | null;
        const stage = document.querySelector<HTMLElement>('.sr-viewer-stage');
        const rail = document.querySelector<HTMLElement>('.sr-viewer-rail');
        if (!root || !stage || !rail) {
          throw new Error('Stacked viewer regions did not render');
        }
        return {
          documentScrollHeight: document.documentElement.scrollHeight,
          viewportHeight: window.innerHeight,
          rootOverflow: getComputedStyle(root).overflow,
          stageHeight: stage.getBoundingClientRect().height,
          railHeight: rail.getBoundingClientRect().height,
          railOverflow: getComputedStyle(rail).overflow,
        };
      });

      expect(stackedGeometry.railHeight).toBeGreaterThan(stackedGeometry.stageHeight);
      expect(stackedGeometry.railOverflow).toBe('visible');
      expect(stackedGeometry.documentScrollHeight).toBeGreaterThan(stackedGeometry.viewportHeight);
      expect(stackedGeometry.rootOverflow).not.toBe('hidden');
    } finally {
      await browser.close();
    }
  }, 15_000);

  it('preserves a 16:9 desktop stage when Chapters are absent', async () => {
    const css = await viewerFixtureCss();
    const longThread = Array.from({ length: 30 }, (_, index): ShareComment => ({
      ...comments[0],
      id: `no-frames-${index}`,
      index,
    }));
    const markup = renderToStaticMarkup(
      <VideoViewer
        {...base}
        comments={longThread}
        player={<video data-testid="geometry-media" />}
      />,
    );
    const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const browser = await puppeteer.launch({
      headless: true,
      ...(existsSync(systemChrome) ? { executablePath: systemChrome } : {}),
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
      await page.setContent(`<style>${css}</style>${markup}`);
      await page.evaluate(() => document.fonts.ready);
      const geometry = await page.evaluate(() => {
        const stage = document.querySelector<HTMLElement>('.sr-viewer-stage');
        const frame = stage?.firstElementChild as HTMLElement | null;
        const rail = document.querySelector<HTMLElement>('.sr-viewer-rail');
        const scrollArea = Array.from(rail?.children ?? []).find((child) => (
          getComputedStyle(child).overflowY === 'auto'
        )) as HTMLElement | undefined;
        if (!stage || !frame || !rail || !scrollArea) {
          throw new Error('Zero-frame viewer regions did not render');
        }
        const content = document.querySelector<HTMLElement>('.sr-viewer-content-column');
        if (!content) throw new Error('Zero-frame viewer content did not render');
        const stageRect = stage.getBoundingClientRect();
        const frameRect = frame.getBoundingClientRect();
        const railRect = rail.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        return {
          frameRatio: frameRect.width / frameRect.height,
          stageTop: stageRect.top,
          stageHeight: stageRect.height,
          frameHeight: frameRect.height,
          railTop: railRect.top,
          railBottom: railRect.bottom,
          railHeight: railRect.height,
          contentBottom: contentRect.bottom,
          railScrollHeight: scrollArea.scrollHeight,
          railClientHeight: scrollArea.clientHeight,
        };
      });

      expect(Math.abs(geometry.frameRatio - (16 / 9))).toBeLessThan(0.01);
      expect(Math.abs(geometry.stageHeight - geometry.frameHeight)).toBeLessThan(1);
      // Spans the left column even with no Chapters to sit beside.
      expect(Math.abs(geometry.railTop - geometry.stageTop)).toBeLessThan(1);
      expect(Math.abs(geometry.railBottom - geometry.contentBottom)).toBeLessThan(1);
      expect(geometry.railHeight).toBeGreaterThan(geometry.stageHeight);
      expect(geometry.railScrollHeight).toBeGreaterThan(geometry.railClientHeight);
    } finally {
      await browser.close();
    }
  }, 15_000);

  it('covers a short tablet viewport without locking natural scrolling', async () => {
    const css = await viewerFixtureCss();
    const markup = renderToStaticMarkup(
      <VideoViewer
        {...base}
        capture={{ ...capture, description: undefined }}
        comments={[]}
      />,
    );
    const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const browser = await puppeteer.launch({
      headless: true,
      ...(existsSync(systemChrome) ? { executablePath: systemChrome } : {}),
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 768, height: 1200, deviceScaleFactor: 1 });
      await page.setContent(`<style>${css}</style>${markup}`);
      await page.evaluate(() => document.fonts.ready);
      const geometry = await page.evaluate(() => {
        const root = document.body.lastElementChild as HTMLElement | null;
        if (!root) throw new Error('Viewer root did not render');
        return {
          viewportHeight: window.innerHeight,
          rootHeight: root.getBoundingClientRect().height,
          rootOverflow: getComputedStyle(root).overflow,
        };
      });

      expect(geometry.rootHeight).toBeGreaterThanOrEqual(geometry.viewportHeight);
      expect(geometry.rootOverflow).not.toBe('hidden');
    } finally {
      await browser.close();
    }
  }, 15_000);
});

describe('the composer is actually wired to the playhead', () => {
  /** Passing the wrong prop name still renders, and every other test still
   * passes — the comment just posts with no anchor. Only tsc caught it the
   * first time, so the behaviour is pinned here too. */
  it('posts a comment anchored to the current moment', async () => {
    const onPost = vi.fn();
    const user = userEvent.setup();
    render(<VideoViewer {...base} currentMs={72_000} onPost={onPost} />);

    await user.type(screen.getByLabelText('Write a comment'), 'Looks right');
    await user.click(screen.getByRole('button', { name: 'Post comment' }));

    expect(onPost).toHaveBeenCalledWith(expect.objectContaining({ timecodeMs: 72_000 }));
  });
});

describe('settling a comment from the rail', () => {
  const canResolve = () => true;

  it('offers resolve on an open comment and reopen on a settled one', () => {
    render(<VideoViewer {...base} onResolve={() => {}} canResolve={canResolve} />);
    expect(screen.getByRole('button', { name: 'Resolve comment from Dana Kwon' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reopen comment from Maya Ortiz' })).toBeInTheDocument();
  });

  it('reports the change', async () => {
    const onResolve = vi.fn();
    const user = userEvent.setup();
    render(<VideoViewer {...base} onResolve={onResolve} canResolve={canResolve} />);
    await user.click(screen.getByRole('button', { name: 'Resolve comment from Dana Kwon' }));
    expect(onResolve).toHaveBeenCalledWith('1', true);
  });

  /** Guests and other viewers get no control at all, rather than one the
   * server will reject. */
  it('offers nothing to someone who may not settle', () => {
    render(<VideoViewer {...base} onResolve={() => {}} canResolve={() => false} />);
    expect(screen.queryByRole('button', { name: /Resolve comment/ })).toBeNull();
  });

  it('offers nothing when no handler was supplied', () => {
    render(<VideoViewer {...base} canResolve={canResolve} />);
    expect(screen.queryByRole('button', { name: /Resolve comment/ })).toBeNull();
  });

  it('puts open questions before settled ones', () => {
    render(<VideoViewer {...base} />);
    const authors = screen.getAllByRole('button', { name: /^Comment from/ })
      .map(b => b.getAttribute('aria-label'));
    expect(authors[0]).toContain('Dana Kwon');
  });

  it('can hide the settled ones', async () => {
    const user = userEvent.setup();
    render(<VideoViewer {...base} />);
    expect(screen.getByText('Maya Ortiz')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /show resolved/i }));
    expect(screen.queryByText('Maya Ortiz')).toBeNull();
    expect(screen.getByText('Dana Kwon')).toBeInTheDocument();
  });

  it('does not offer the filter when nothing is settled', () => {
    render(<VideoViewer {...base} comments={[base.comments[0]]} />);
    expect(screen.queryByRole('checkbox', { name: /show resolved/i })).toBeNull();
  });
});

describe('a comment stranded by a publish (E6)', () => {
  const past = { ...comments[0], id: '9', anchor: { kind: 'timecode' as const, ms: 400_000 } };

  /** Publishing a shorter cut can leave a comment pointing past the end. It is
   * not deleted — what someone wrote is still real. */
  it('says the footage was removed rather than deleting the comment', () => {
    render(<VideoViewer {...base} comments={[past]} />);
    expect(screen.getByText('Dana Kwon')).toBeInTheDocument();
    expect(screen.getByTestId('stale-anchor')).toBeInTheDocument();
  });

  it('leaves comments inside the video unmarked', () => {
    render(<VideoViewer {...base} />);
    expect(screen.queryByTestId('stale-anchor')).toBeNull();
  });

  /** Without a known length every comment would be marked stale. */
  it('claims nothing when the length is unknown', () => {
    render(<VideoViewer {...base} comments={[past]}
      capture={{ ...capture, durationMs: 0 }} />);
    expect(screen.queryByTestId('stale-anchor')).toBeNull();
  });
});

describe('editing the description', () => {
  it('offers to add one when there is none and the viewer may edit', async () => {
    const onDescriptionChange = vi.fn();
    const user = userEvent.setup();
    render(<VideoViewer {...base} capture={{ ...capture, description: undefined }}
      onDescriptionChange={onDescriptionChange} />);

    await user.click(screen.getByRole('button', { name: 'Add description' }));
    await user.type(screen.getByLabelText('Description'), 'What this covers');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onDescriptionChange).toHaveBeenCalledWith('What this covers');
  });

  it('edits an existing one in place', async () => {
    const onDescriptionChange = vi.fn();
    const user = userEvent.setup();
    render(<VideoViewer {...base} onDescriptionChange={onDescriptionChange} />);
    await user.click(screen.getByRole('button', { name: 'Edit description' }));
    expect(screen.getByLabelText('Description')).toHaveValue(capture.description);
  });

  /** An empty string is how a description is removed. */
  it('allows clearing it', async () => {
    const onDescriptionChange = vi.fn();
    const user = userEvent.setup();
    render(<VideoViewer {...base} onDescriptionChange={onDescriptionChange} />);
    await user.click(screen.getByRole('button', { name: 'Edit description' }));
    await user.clear(screen.getByLabelText('Description'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onDescriptionChange).toHaveBeenCalledWith('');
  });

  it('abandons the edit on cancel', async () => {
    const onDescriptionChange = vi.fn();
    const user = userEvent.setup();
    render(<VideoViewer {...base} onDescriptionChange={onDescriptionChange} />);
    await user.click(screen.getByRole('button', { name: 'Edit description' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDescriptionChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('viewer-description')).toBeInTheDocument();
  });

  /** A viewer who cannot edit must not be shown the affordance. */
  it('offers nothing to someone who may not edit', () => {
    render(<VideoViewer {...base} />);
    expect(screen.queryByRole('button', { name: /description/i })).toBeNull();
  });

  it('shows nothing at all when there is no description and no permission', () => {
    render(<VideoViewer {...base} capture={{ ...capture, description: undefined }} />);
    expect(screen.queryByTestId('viewer-description')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add description' })).toBeNull();
  });
});

describe('the auto-generated filmstrip', () => {
  const frames = [
    { startSec: 0, sampleSec: 0.5, dataUrl: 'data:image/jpeg;base64,AAA' },
    { startSec: 41, sampleSec: 41.5, dataUrl: 'data:image/jpeg;base64,BBB' },
    { startSec: 138, sampleSec: 138.5, dataUrl: null },
  ];

  it('shows a frame per section with its timecode', () => {
    render(<VideoViewer {...base} frames={frames} />);
    const strip = screen.getByTestId('viewer-frames');
    expect(strip).toHaveTextContent('CHAPTERS');
    expect(strip).not.toHaveTextContent('FRAMES');
    expect(within(strip).getAllByRole('button')).toHaveLength(3);
    expect(within(strip).getByText('2:18')).toBeInTheDocument();
  });

  /** The whole point: jump to any part of the video. */
  it('seeks to that point when a frame is clicked', async () => {
    const onSeek = vi.fn();
    const user = userEvent.setup();
    render(<VideoViewer {...base} frames={frames} onSeek={onSeek} />);
    await user.click(screen.getByRole('button', { name: 'Jump to 0:41' }));
    expect(onSeek).toHaveBeenCalledWith(41_000);
  });

  it('marks the section the playhead is inside', () => {
    render(<VideoViewer {...base} frames={frames} currentMs={60_000} />);
    expect(screen.getByRole('button', { name: 'Jump to 0:41' }))
      .toHaveAttribute('aria-current', 'true');
  });

  it('stays on the first section before the second begins', () => {
    render(<VideoViewer {...base} frames={frames} currentMs={10_000} />);
    expect(screen.getByRole('button', { name: 'Jump to 0:00' }))
      .toHaveAttribute('aria-current', 'true');
  });

  /** Timecodes navigate on their own, so a frame without a picture is still
   * useful rather than a hole in the strip. */
  it('still offers a frame whose picture could not be drawn', () => {
    render(<VideoViewer {...base} frames={frames} />);
    expect(screen.getByRole('button', { name: 'Jump to 2:18' })).toBeInTheDocument();
  });

  it('says when it is still working', () => {
    render(<VideoViewer {...base} frames={frames} framesGenerating />);
    expect(screen.getByTestId('viewer-frames')).toHaveTextContent(/generating/);
  });

  /** A tainted canvas makes pictures impossible, not slow — say so instead of
   * showing a spinner that never resolves. */
  it('says when previews are impossible for this file', () => {
    render(<VideoViewer {...base} frames={frames} framesBlocked />);
    expect(screen.getByTestId('viewer-frames')).toHaveTextContent(/previews unavailable/);
  });

  it('shows no strip at all before any frames are placed', () => {
    render(<VideoViewer {...base} />);
    expect(screen.queryByTestId('viewer-frames')).toBeNull();
  });
});
