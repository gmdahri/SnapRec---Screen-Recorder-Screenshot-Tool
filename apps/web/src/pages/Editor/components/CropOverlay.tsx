import { useEffect } from 'react';
import { CaptureFrame } from '@snaprec/design-system';

export interface CropRect { x: number; y: number; w: number; h: number }

export interface CropOverlayProps {
  rect: CropRect;
  onChange: (rect: CropRect) => void;
  onApply: () => void;
  onCancel: () => void;
  onReset: () => void;
}

/** I2 — the most technical moment in the image editor.
 *
 * One of exactly two surfaces where solid handles are correct, because the
 * crop box genuinely drags. Values ride the frame so the number is where the
 * hand is, and the mode has an exit that is not only Escape. */
export function CropOverlay({ rect, onChange, onApply, onCancel, onReset }: CropOverlayProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Keyboard is first-class here: a crop you can only set by dragging is
      // unreachable, and pixel-exact framing by mouse is miserable.
      const step = e.shiftKey ? 10 : 1;

      switch (e.key) {
        case 'ArrowRight': e.preventDefault(); onChange({ ...rect, x: rect.x + step }); break;
        case 'ArrowLeft': e.preventDefault(); onChange({ ...rect, x: rect.x - step }); break;
        case 'ArrowDown': e.preventDefault(); onChange({ ...rect, y: rect.y + step }); break;
        case 'ArrowUp': e.preventDefault(); onChange({ ...rect, y: rect.y - step }); break;
        case 'Enter': e.preventDefault(); onApply(); break;
        case 'Escape': e.preventDefault(); onCancel(); break;
        default: break;
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [rect, onChange, onApply, onCancel]);

  return (
    <div style={{ position: 'relative' }}>
      <CaptureFrame
        treatment="editable"
        style={{
          position: 'absolute',
          left: rect.x, top: rect.y, width: rect.w, height: rect.h,
          boxShadow: '0 0 0 9999px var(--sr-scrim-dark)',
        }}
      >
        <span
          data-testid="crop-dimensions"
          style={{
            position: 'absolute', left: 0, top: -20,
            fontFamily: 'var(--sr-font-mono)', fontSize: 10,
            color: 'var(--sr-cyan)', whiteSpace: 'nowrap',
          }}
        >{rect.w} × {rect.h}</span>
      </CaptureFrame>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'center', gap: 10, padding: 12,
      }}>
        <span style={{
          fontFamily: 'var(--sr-font-mono)', fontSize: 10,
          color: 'var(--sr-text-faint-on-dark)',
        }}>arrows nudge · shift-arrows by 10 · ⏎ applies · esc cancels</span>

        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
          <button type="button" onClick={onReset} style={secondary}>Reset to full image</button>
          <button type="button" onClick={onCancel} style={secondary}>Cancel</button>
          <button type="button" onClick={onApply} style={primary}>Apply crop</button>
        </span>
      </div>
    </div>
  );
}

const secondary = {
  height: 'var(--sr-h-xs)', padding: '0 11px',
  border: '1px solid var(--sr-border-dark)', background: 'transparent',
  color: 'var(--sr-text-primary-on-dark)', fontSize: 12, cursor: 'pointer',
  borderRadius: 'var(--sr-radius-control)',
} as const;

const primary = {
  height: 'var(--sr-h-xs)', padding: '0 12px', border: 'none',
  background: 'var(--sr-cyan)', color: 'var(--sr-cyan-fg)',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
  borderRadius: 'var(--sr-radius-control)',
} as const;
