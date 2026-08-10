import { Lane } from './Lane';

export interface ZoomRegion {
  id: string;
  startMs: number;
  endMs: number;
  scale: number;
  source: 'auto' | 'manual';
}

export interface TimelineProject {
  durationMs: number;
  trim: { startMs: number; endMs: number };
  zoomRegions: ZoomRegion[];
  /** Auto-zoom candidates the user has not accepted. */
  suggestions: { id: string; atMs: number }[];
  /** Source ranges the output leaves out (P7 E3). Already normalised. */
  cuts?: { id: string; startMs: number; endMs: number }[];
  /** 0–1 amplitudes. Optional: the editor has no audio analysis yet, and an
   * empty lane is honest where a fabricated waveform would not be. */
  waveform?: number[];
  playheadMs: number;
}

export interface EditorTimelineProps {
  project: TimelineProject;
  selection: string | null;
  onSelect: (id: string | null) => void;
  onTrim: (edge: 'start' | 'end', ms: number) => void;
  /** Turns a suggestion into a real zoom region. Required, not optional: the
   * mark's tooltip says "click to accept", and a mark that says that while
   * doing nothing is worse than one that never offered. */
  onAcceptSuggestion: (id: string) => void;
  /** Absent while cuts cannot be removed; the chip then selects only. */
  onRemoveCut?: (id: string) => void;
}

/** Timecodes FLOOR, they do not round. At 14.56s you are still inside the
 * 14th second, and a trim handle that reads 0:15 while sitting at 14.56 makes
 * the number untrustworthy. */
const fmt = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** V1 — three lanes: clip, zoom, audio.
 *
 * This is the one surface in the product where solid cyan handles are correct,
 * and only on the trim points, because those genuinely drag. The preview above
 * keeps registration marks. */
export function EditorTimeline({
  project, selection, onSelect, onTrim, onAcceptSuggestion, onRemoveCut,
}: EditorTimelineProps) {
  const {
    durationMs, trim, zoomRegions, suggestions, cuts = [], waveform = [], playheadMs,
  } = project;
  const pct = (ms: number) => (durationMs === 0 ? 0 : (ms / durationMs) * 100);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: '10px 16px 14px',
      background: 'var(--sr-surface-carbon)',
      position: 'relative',
    }}>
      <Lane name="clip" height={56}>
        {/* Trimmed heads are dimmed to 60%, never removed — what you cut stays
            visible and recoverable. */}
        <span
          data-testid="trimmed-head"
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${pct(trim.startMs)}%`,
            background: 'var(--sr-surface-well)', opacity: 0.6,
          }}
        />
        <span
          data-testid="trimmed-head"
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: `${100 - pct(trim.endMs)}%`,
            background: 'var(--sr-surface-well)', opacity: 0.6,
          }}
        />

        {(['start', 'end'] as const).map(edge => {
          const ms = edge === 'start' ? trim.startMs : trim.endMs;
          return (
            <button
              key={edge}
              type="button"
              data-testid={`trim-handle-${edge}`}
              aria-label={`Trim ${edge} — ${fmt(ms)}`}
              onClick={() => onTrim(edge, ms)}
              style={{
                position: 'absolute', top: 0, bottom: 0,
                left: `${pct(ms)}%`, marginLeft: edge === 'start' ? 0 : -9,
                width: 9, padding: 0, border: 'none',
                background: 'var(--sr-cyan)', cursor: 'ew-resize',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              }}
            >
              {/* The timecode rides the handle, so the value is where the hand is. */}
              <span data-testid="trim-handle" style={{
                position: 'absolute', top: -16, whiteSpace: 'nowrap',
                fontFamily: 'var(--sr-font-mono)', fontSize: 9,
                color: 'var(--sr-cyan)',
              }}>{fmt(ms)}</span>
            </button>
          );
        })}
      </Lane>

      <Lane name="zoom" height={22}>
        {zoomRegions.map(region => (
          <button
            key={region.id}
            type="button"
            aria-label={`${region.source} ${region.scale}× zoom, ${fmt(region.startMs)} to ${fmt(region.endMs)}`}
            aria-pressed={selection === region.id}
            onClick={() => onSelect(region.id)}
            style={{
              position: 'absolute', top: 3, bottom: 3,
              left: `${pct(region.startMs)}%`,
              width: `${pct(region.endMs - region.startMs)}%`,
              border: `1px solid var(--sr-cyan)`,
              background: selection === region.id
                ? 'var(--sr-cyan)'
                : 'rgba(6,166,192,.24)',
              color: selection === region.id ? 'var(--sr-cyan-fg)' : 'var(--sr-cyan-tint)',
              fontSize: 8.5, padding: '0 5px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >{region.source === 'auto' ? 'auto ' : 'manual '}{region.scale}×</button>
        ))}

        {/* A suggestion is a mark, not a region: it has not been accepted, and
            drawing it as a region would imply it is already applied. */}
        {suggestions.map(suggestion => (
          <button
            key={suggestion.id}
            type="button"
            data-testid="zoom-suggestion"
            data-accepted="false"
            title={`Auto zoom suggestion at ${fmt(suggestion.atMs)} — click to accept`}
            aria-label={`Accept auto zoom suggestion at ${fmt(suggestion.atMs)}`}
            onClick={() => onAcceptSuggestion(suggestion.id)}
            style={{
              position: 'absolute', top: 8, bottom: 8,
              left: `${pct(suggestion.atMs)}%`, width: 6,
              padding: 0, border: 'none', cursor: 'pointer',
              background: 'var(--sr-border-dark-strong)',
            }}
          />
        ))}
      </Lane>

      {/* Cuts are neutral, not coral. Coral means live capture and
          needs-a-response; a cut is destructive but entirely ordinary, and
          spending coral on every one of them would drain the colour of the
          meaning the viewer's "needs a reply" marker depends on. */}
      <Lane name="cuts" height={22}>
        {cuts.map(cut => (
          <button
            key={cut.id}
            type="button"
            aria-label={`Cut from ${fmt(cut.startMs)} to ${fmt(cut.endMs)}`}
            aria-pressed={selection === cut.id}
            onClick={() => onSelect(cut.id)}
            onDoubleClick={() => onRemoveCut?.(cut.id)}
            title={onRemoveCut ? 'Double-click to restore this footage' : undefined}
            style={{
              position: 'absolute', top: 3, bottom: 3,
              left: `${pct(cut.startMs)}%`,
              width: `${pct(cut.endMs - cut.startMs)}%`,
              minWidth: 2,
              border: `1px solid var(--sr-border-dark-strong)`,
              background: selection === cut.id
                ? 'var(--sr-text-muted-on-dark)'
                : 'var(--sr-border-dark)',
              color: selection === cut.id
                ? 'var(--sr-surface-carbon)'
                : 'var(--sr-text-secondary-on-dark)',
              fontSize: 8.5, padding: '0 4px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >cut</button>
        ))}
      </Lane>

      <Lane name="audio" height={28} style={{ display: 'flex', gap: 1, padding: '0 1px', alignItems: 'flex-end' }}>
        {waveform.map((amplitude, i) => {
          const ms = (i / waveform.length) * durationMs;
          const kept = ms >= trim.startMs && ms <= trim.endMs;
          return (
            <span
              key={i}
              style={{
                flex: 1,
                height: `${Math.max(6, amplitude * 100)}%`,
                background: kept ? 'var(--sr-cyan)' : 'var(--sr-border-dark-strong)',
              }}
            />
          );
        })}
      </Lane>

      {/* The playhead crosses all three lanes: a moment is one vertical line. */}
      <span
        data-testid="playhead"
        aria-hidden="true"
        style={{
          position: 'absolute', top: 10, bottom: 14,
          left: `calc(16px + 74px + (100% - 16px - 74px - 16px) * ${pct(playheadMs) / 100})`,
          width: 1, background: 'var(--sr-text-primary-on-dark)',
        }}
      />
    </div>
  );
}
