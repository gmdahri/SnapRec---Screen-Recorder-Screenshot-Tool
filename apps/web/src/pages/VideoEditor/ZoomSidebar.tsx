export interface ZoomSelection {
  id: string;
  startMs: number;
  endMs: number;
  scale: number;
  source: 'auto' | 'manual';
  /** Normalised pivot, 0–1. */
  focus: { x: number; y: number };
  /** For automatic regions, the click that produced it. */
  originMs?: number;
}

export interface ZoomSidebarProps {
  region: ZoomSelection | null;
  onChange: (patch: Partial<ZoomSelection>) => void;
  onRemove: () => void;
}

const fmt = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** V2 — progressive complexity.
 *
 * Returns null when nothing is selected: the panel does not exist rather than
 * sitting there empty. An always-present sidebar showing "no selection" trains
 * people to ignore that whole column. */
export function ZoomSidebar({ region, onChange, onRemove }: ZoomSidebarProps) {
  if (!region) return null;

  return (
    <aside style={{
      width: 260, flex: 'none', padding: 16,
      background: 'var(--sr-surface-panel-dark)',
      color: 'var(--sr-text-primary-on-dark)',
      display: 'flex', flexDirection: 'column', gap: 14,
      borderLeft: '1px solid var(--sr-border-dark-soft)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Zoom region</h2>
        <span style={{
          fontFamily: 'var(--sr-font-mono)', fontSize: 10,
          color: 'var(--sr-text-faint-on-dark)',
        }}>{fmt(region.startMs)} – {fmt(region.endMs)}</span>
      </div>

      <label style={field}>
        <span style={labelText}>Scale</span>
        <input
          type="range"
          min={1.1}
          max={3}
          step={0.1}
          value={region.scale}
          aria-label="Zoom scale"
          aria-valuenow={region.scale}
          aria-valuetext={`${region.scale}×`}
          onChange={e => onChange({ scale: Number(e.target.value) })}
        />
        <span style={{ fontFamily: 'var(--sr-font-mono)', fontSize: 11 }}>{region.scale}×</span>
      </label>

      {/* Two named fields, not a draggable-only target: a pivot you can only
          set by dragging is unreachable by keyboard and unrepeatable by hand. */}
      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...field, flex: 1 }}>
          <span style={labelText}>Focus horizontal</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={region.focus.x}
            aria-label="Focus horizontal"
            onChange={e => onChange({ focus: { ...region.focus, x: Number(e.target.value) } })}
            style={numberInput}
          />
        </label>

        <label style={{ ...field, flex: 1 }}>
          <span style={labelText}>Focus vertical</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={region.focus.y}
            aria-label="Focus vertical"
            onChange={e => onChange({ focus: { ...region.focus, y: Number(e.target.value) } })}
            style={numberInput}
          />
        </label>
      </div>

      {/* Provenance, so an automatic region can be judged rather than just
          accepted or deleted. */}
      {region.source === 'auto' && (
        <p style={{
          margin: 0, fontSize: 11.5, lineHeight: 1.5,
          color: 'var(--sr-text-faint-on-dark)',
        }}>
          This region was placed automatically
          {region.originMs != null ? ` from a click at ${fmt(region.originMs)}` : ''}.
          Keep it or remove it — the recording is unchanged either way.
        </p>
      )}

      <button type="button" onClick={onRemove} style={{
        height: 'var(--sr-h-xs)', border: '1px solid var(--sr-border-dark)',
        background: 'transparent', color: 'var(--sr-text-primary-on-dark)',
        fontSize: 12.5, cursor: 'pointer', borderRadius: 'var(--sr-radius-control)',
      }}>Remove this zoom</button>
    </aside>
  );
}

const field = {
  display: 'flex', flexDirection: 'column', gap: 5,
} as const;

const labelText = {
  fontFamily: 'var(--sr-font-mono)', fontSize: 9.5,
  letterSpacing: '.1em', color: 'var(--sr-text-faint-on-dark)',
} as const;

const numberInput = {
  height: 'var(--sr-h-xs)', padding: '0 8px',
  border: '1px solid var(--sr-border-dark)',
  background: 'var(--sr-surface-carbon)',
  color: 'var(--sr-text-primary-on-dark)',
  fontFamily: 'var(--sr-font-mono)', fontSize: 11,
  borderRadius: 'var(--sr-radius-control)',
} as const;

export interface ZoomEntryProps {
  onAdd: () => void;
  /** Unaccepted auto-zoom marks on the timeline. */
  suggestionCount: number;
}

/** The way into the zoom tool.
 *
 * ZoomSidebar returns null with nothing selected, which is right for a
 * properties panel and wrong for a whole tool: it left Zoom as a dead end
 * with no control anywhere that created a region. A tool needs one primary
 * action; the properties still stay hidden until there is something to edit. */
export function ZoomEntry({ onAdd, suggestionCount }: ZoomEntryProps) {
  return (
    <aside style={{
      width: 260, flex: 'none', padding: 16,
      background: 'var(--sr-surface-panel-dark)',
      color: 'var(--sr-text-primary-on-dark)',
      display: 'flex', flexDirection: 'column', gap: 12,
      borderLeft: '1px solid var(--sr-border-dark-soft)',
    }}>
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Zoom</h2>

      <p style={{
        margin: 0, fontSize: 11.5, lineHeight: 1.5,
        color: 'var(--sr-text-muted-on-dark)',
      }}>
        Add a region to punch in on part of the frame. Select one on the
        timeline to change its scale and focus.
      </p>

      <button type="button" onClick={onAdd} style={{
        height: 'var(--sr-h-sm)', border: 'none', cursor: 'pointer',
        background: 'var(--sr-cyan)', color: 'var(--sr-cyan-fg)',
        fontSize: 12.5, fontWeight: 600,
        borderRadius: 'var(--sr-radius-control)',
      }}>Add zoom at playhead</button>

      {suggestionCount > 0 && (
        <p style={{
          margin: 0, fontSize: 11.5, lineHeight: 1.5,
          color: 'var(--sr-text-faint-on-dark)',
        }}>
          {suggestionCount} suggestion{suggestionCount === 1 ? '' : 's'} from
          {' '}your clicks are marked on the zoom lane. Click one to accept it.
        </p>
      )}
    </aside>
  );
}
