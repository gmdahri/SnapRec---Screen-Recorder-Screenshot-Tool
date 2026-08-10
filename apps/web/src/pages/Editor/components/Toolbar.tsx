import { Icon } from '@iconify/react';
import { createRegistry, tooltipFor } from '../../../lib/shortcuts';
import { IMAGE_BINDINGS, TOOLS, UNIMPLEMENTED, type ToolKey } from '../tools';

const registry = createRegistry(IMAGE_BINDINGS);

export interface ToolbarProps {
  active: ToolKey;
  onSelect: (tool: ToolKey) => void;
  isApple: boolean;
}

/** A 38px vertical rail on carbon — the image editor is a Technical
 * workspace, so it gets explicit dark tokens rather than a dark variant.
 *
 * Every control here is icon-only, so every one carries a tooltip naming its
 * shortcut. A toolbar of unlabelled glyphs is a memory test. */
export function Toolbar({ active, onSelect, isApple }: ToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Tools"
      aria-orientation="vertical"
      style={{
        width: 38, flex: 'none',
        display: 'flex', flexDirection: 'column',
        background: 'var(--sr-surface-carbon)',
        borderRight: '1px solid var(--sr-border-dark-soft)',
      }}
    >
      {TOOLS.map(tool => {
        const on = tool.key === active;
        // Not yet on the canvas. Marked rather than hidden, and rather than
        // rendered as a button that quietly does nothing.
        const unavailable = UNIMPLEMENTED.has(tool.key);

        return (
          <button
            key={tool.key}
            type="button"
            aria-label={tool.label}
            aria-pressed={on}
            aria-disabled={unavailable || undefined}
            title={unavailable
              ? `${tool.label} — not available yet`
              : tooltipFor(tool.label, registry.find(tool.label), isApple)}
            onClick={unavailable ? undefined : () => onSelect(tool.key)}
            style={{
              width: 38, height: 38, border: 'none',
              cursor: unavailable ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: on ? 'var(--sr-cyan)' : 'transparent',
              color: on
                ? 'var(--sr-cyan-fg)'
                : unavailable
                  ? 'var(--sr-text-faint-on-dark)'
                  : 'var(--sr-text-secondary-on-dark)',
              opacity: unavailable ? 0.5 : 1,
            }}
          >
            <Icon icon={tool.icon} width={16} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
