import type { CSSProperties, ReactNode } from 'react';
import { outputDurationSec, type Cut } from './cuts';
import { clampFades } from './fades';
import { estimateSize } from './outputEstimate';

/** P7 E1.3 / E5 — the editor's right panel: TRIM, CLEAN UP, OUTPUT.
 *
 * Remove silences is real (E5.1): it reads the peaks the AUDIO lane already
 * decoded, so the mockup's "6 gaps over 1.2s" is a measurement rather than
 * decoration. It is an action, not a switch, because it proposes cuts you can
 * then see on the timeline, move, remove and undo — an invisible filter would
 * give nothing to review.
 *
 * The other two remain unbuilt and say what each is waiting on: the extension
 * sends no cursor data, and the export path cannot apply gain. They are drawn
 * off and disabled rather than as switches that flip and change nothing, per
 * the plate rule that a disabled action must always say when it becomes
 * available. */

export interface PropertiesPanelProps {
  trimStartSec: number;
  trimEndSec: number;
  durationSec: number;
  onTrimStartChange: (sec: number) => void;
  onTrimEndChange: (sec: number) => void;
  /** P7 E4. Cuts shorten the output; fades do not. */
  cuts?: Cut[];
  fadeInSec?: number;
  fadeOutSec?: number;
  onFadeInChange?: (sec: number) => void;
  onFadeOutChange?: (sec: number) => void;
  /** Frame height, for the size heuristic. 0 when unknown. */
  heightPx?: number;
  /** P7 E5.1 — gaps found in the audio, and the action that turns them into
   * cuts. Absent while the audio has not been decoded. */
  silenceSummary?: string | null;
  onRemoveSilences?: () => void;
  /** P7 E5.2 — measured level, and whether the export should correct it. */
  loudnessSummary?: string | null;
  normalizeAudio?: boolean;
  onNormalizeChange?: (on: boolean) => void;
  /** Format of what an export actually produces today. */
  outputFormat: string;
}

const clock = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

const groupLabel: CSSProperties = {
  fontFamily: 'var(--sr-font-mono)', fontSize: 10, letterSpacing: '.12em',
  color: 'var(--sr-text-faint-on-dark)', display: 'block', marginBottom: 10,
};

const rowLabel: CSSProperties = {
  fontSize: 12.5, color: 'var(--sr-text-primary-on-dark)',
};

const value: CSSProperties = {
  fontFamily: 'var(--sr-font-mono)', fontSize: 11,
  color: 'var(--sr-text-primary-on-dark)',
};

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section style={{
      padding: '14px 14px 16px',
      borderBottom: '1px solid var(--sr-border-dark-soft)',
    }}>
      <span style={groupLabel}>{label}</span>
      {children}
    </section>
  );
}

function Slider({
  label, seconds, max, onChange, disabled,
}: {
  label: string; seconds: number; max: number;
  onChange: (n: number) => void; disabled?: boolean;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={rowLabel}>{label}</span>
        <span style={value}>{clock(seconds)}</span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={0}
        max={Math.max(max, 0.1)}
        step={0.1}
        value={seconds}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--sr-cyan)' }}
      />
    </div>
  );
}

/** Fades are sub-second, so they read as seconds with one decimal rather than
 * as a timecode — "0:00" would be the same label for 0.3s and 0.9s. */
function SecondsSlider({
  label, seconds, max, onChange,
}: { label: string; seconds: number; max: number; onChange: (n: number) => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={rowLabel}>{label}</span>
        <span style={value}>{seconds.toFixed(1)}s</span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={0}
        max={max}
        step={0.1}
        value={seconds}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--sr-cyan)' }}
      />
    </div>
  );
}

function CleanUpToggle({ name, detail }: { name: string; detail: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
      marginBottom: 6, background: 'var(--sr-surface-panel-dark-alt)',
      opacity: 0.65,
    }}>
      <button
        type="button"
        role="switch"
        aria-checked={false}
        aria-label={name}
        disabled
        title={detail}
        style={{
          width: 26, height: 15, flex: 'none', border: 'none', padding: 0,
          background: 'var(--sr-border-dark)', cursor: 'not-allowed', position: 'relative',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: 2, width: 11, height: 11,
          background: 'var(--sr-text-faint-on-dark)',
        }} />
      </button>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ ...rowLabel, display: 'block', color: 'var(--sr-text-secondary-on-dark)' }}>{name}</span>
        <span style={{
          display: 'block', fontFamily: 'var(--sr-font-mono)', fontSize: 9.5,
          color: 'var(--sr-text-faint-on-dark)',
        }}>{detail}</span>
      </span>
    </div>
  );
}

export function PropertiesPanel({
  trimStartSec, trimEndSec, durationSec,
  onTrimStartChange, onTrimEndChange, outputFormat,
  cuts = [], fadeInSec = 0, fadeOutSec = 0,
  onFadeInChange, onFadeOutChange, heightPx = 0,
  silenceSummary, onRemoveSilences,
  loudnessSummary, normalizeAudio = false, onNormalizeChange,
}: PropertiesPanelProps) {
  const known = durationSec > 0;
  const keptSec = Math.max(0, trimEndSec - trimStartSec);
  // The output is the trim less whatever the cuts remove from inside it.
  const outputSec = outputDurationSec(trimStartSec, trimEndSec, cuts);
  const cutSec = Math.max(0, keptSec - outputSec);
  const size = estimateSize(outputSec, heightPx);
  // Shown as applied, not as typed: a fade longer than the footage is scaled
  // down, and the panel must not claim a duration the export will not use.
  const applied = clampFades({ inSec: fadeInSec, outSec: fadeOutSec }, keptSec);

  return (
    <aside
      data-testid="properties-panel"
      style={{
        width: 280, flex: 'none', overflowY: 'auto',
        background: 'var(--sr-surface-carbon)',
        borderLeft: '1px solid var(--sr-border-dark-soft)',
      }}
    >
      <Group label="TRIM">
        <Slider label="Start" seconds={trimStartSec} max={durationSec}
          onChange={onTrimStartChange} disabled={!known} />
        <Slider label="End" seconds={trimEndSec} max={durationSec}
          onChange={onTrimEndChange} disabled={!known} />
        {known && onFadeInChange && onFadeOutChange && (
          <>
            <SecondsSlider label="Fade in" seconds={applied.inSec} max={Math.max(keptSec / 2, 0.1)}
              onChange={onFadeInChange} />
            <SecondsSlider label="Fade out" seconds={applied.outSec} max={Math.max(keptSec / 2, 0.1)}
              onChange={onFadeOutChange} />
            {(applied.inSec !== fadeInSec || applied.outSec !== fadeOutSec) && (
              <p style={{
                margin: '0 0 8px', fontFamily: 'var(--sr-font-mono)', fontSize: 9.5,
                color: 'var(--sr-text-faint-on-dark)',
              }}>Shortened to fit the clip.</p>
            )}
          </>
        )}

        {!known && (
          <p style={{
            margin: 0, fontFamily: 'var(--sr-font-mono)', fontSize: 9.5,
            color: 'var(--sr-text-faint-on-dark)',
          }}>Trimming unlocks once the clip reports its length.</p>
        )}
      </Group>

      <Group label="CLEAN UP">
        {/* E5.1 — real now: the count comes from the same peaks the AUDIO lane
            draws. It is an action rather than a switch because it proposes
            cuts you can then see, move and undo, instead of applying an
            invisible filter. */}
        {onRemoveSilences && silenceSummary ? (
          <button
            type="button"
            onClick={onRemoveSilences}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', marginBottom: 6, cursor: 'pointer',
              background: 'var(--sr-surface-panel-dark)',
              border: '1px solid var(--sr-border-dark)', textAlign: 'left',
              borderRadius: 'var(--sr-radius-control)',
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ ...rowLabel, display: 'block' }}>Remove silences</span>
              <span style={{
                display: 'block', fontFamily: 'var(--sr-font-mono)', fontSize: 9.5,
                color: 'var(--sr-cyan)',
              }}>{silenceSummary}</span>
            </span>
          </button>
        ) : (
          <CleanUpToggle
            name="Remove silences"
            detail={onRemoveSilences ? 'no gaps long enough to remove' : 'waiting for the audio to load'}
          />
        )}
        <CleanUpToggle name="Blur cursor trail" detail="extension does not send cursor data yet" />
        {onNormalizeChange && loudnessSummary ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
            marginBottom: 6, background: 'var(--sr-surface-panel-dark)',
          }}>
            <button
              type="button"
              role="switch"
              aria-checked={normalizeAudio}
              aria-label="Normalize audio"
              onClick={() => onNormalizeChange(!normalizeAudio)}
              style={{
                width: 26, height: 15, flex: 'none', border: 'none', padding: 0,
                position: 'relative', cursor: 'pointer',
                background: normalizeAudio ? 'var(--sr-cyan)' : 'var(--sr-border-dark)',
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: normalizeAudio ? 13 : 2,
                width: 11, height: 11,
                background: normalizeAudio ? 'var(--sr-cyan-fg)' : 'var(--sr-text-muted-on-dark)',
              }} />
            </button>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ ...rowLabel, display: 'block' }}>Normalize audio</span>
              <span style={{
                display: 'block', fontFamily: 'var(--sr-font-mono)', fontSize: 9.5,
                color: normalizeAudio ? 'var(--sr-cyan)' : 'var(--sr-text-faint-on-dark)',
              }}>{loudnessSummary}</span>
            </span>
          </div>
        ) : (
          <CleanUpToggle
            name="Normalize audio"
            detail={onNormalizeChange ? 'no audio to measure' : 'waiting for the audio to load'}
          />
        )}
      </Group>

      <Group label="OUTPUT">
        <Row label="Length" value={known ? clock(outputSec) : 'unknown'} />
        {cutSec > 0 && <Row label="Removed by cuts" value={clock(cutSec)} />}
        <Row label="Estimated size" value={size ? size.label : 'unknown'} />
        <Row label="Format" value={outputFormat} />
      </Group>
    </aside>
  );
}

function Row({ label, value: v }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0',
    }}>
      <span style={{ ...rowLabel, color: 'var(--sr-text-muted-on-dark)' }}>{label}</span>
      <span style={value}>{v}</span>
    </div>
  );
}
