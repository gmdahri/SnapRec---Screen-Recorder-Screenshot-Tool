import { CAPTURE_STATES, type CaptureStatus, type RuleTreatment } from '../status';

/** The 2px left rule and 3px bottom rule. This is the single visual carrier of
 * the status model — every surface that shows a capture draws it identically.
 *
 * It is decorative: StatusBadge carries the word for assistive tech, because
 * status must never rest on hue alone. */
export interface StateRuleProps {
  status: CaptureStatus;
  /** 0–100. Overrides the state's default width for determinate work. */
  progress?: number;
  edge?: 'left' | 'bottom' | 'both';
}

const COLOR: Record<RuleTreatment, string> = {
  none: 'transparent',
  'cyan-partial': 'var(--sr-cyan)',
  'cyan-full': 'var(--sr-cyan)',
  'coral-full': 'var(--sr-coral-text)',
  'grey-dashed': 'transparent',
};

export function StateRule({ status, progress, edge = 'bottom' }: StateRuleProps) {
  const def = CAPTURE_STATES[status];
  if (def.rule === 'none' || def.ruleWidth === '0%') return null;

  const width = progress != null ? `${progress}%` : def.ruleWidth;
  const dashed = def.rule === 'grey-dashed';

  return (
    <>
      {(edge === 'left' || edge === 'both') && (
        <span
          data-testid="state-rule-left"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            background: dashed ? 'var(--sr-text-faint-on-light)' : COLOR[def.rule],
          }}
        />
      )}

      {(edge === 'bottom' || edge === 'both') && (
        <span
          data-testid="state-rule-bottom"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            height: 3,
            width,
            background: COLOR[def.rule],
            backgroundImage: dashed
              ? 'repeating-linear-gradient(90deg, var(--sr-text-faint-on-light) 0 6px, transparent 6px 12px)'
              : undefined,
            transition: 'width var(--sr-dur-slow) var(--sr-ease)',
          }}
        />
      )}
    </>
  );
}
