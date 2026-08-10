import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AppShell, SEO } from '../components';
import { useExtensionStatus } from '../hooks/useExtensionStatus';
import { SECTIONS, type SettingField, type SettingSection } from './Settings/sections';

function initialsOf(name: string | undefined, email: string | undefined): string {
  const source = name?.trim() || email?.split('@')[0] || 'You';
  const parts = source.split(/[\s.]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2)).toUpperCase();
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { status } = useExtensionStatus();
  const [active, setActive] = useState(SECTIONS[0].title);

  const extensionAbsent = status !== 'connected';
  const section = SECTIONS.find(s => s.title === active) ?? SECTIONS[0];

  return (
    <AppShell
      title="Settings"
      meta={user?.email ?? ''}
      user={{
        initials: initialsOf(user?.user_metadata?.full_name, user?.email),
        name: user?.user_metadata?.full_name || user?.email || 'Your account',
      }}
      onSearch={q => navigate(`/library?q=${encodeURIComponent(q)}`)}
    >
      <SEO title="Settings — SnapRec" description="Capture defaults, sharing and account." noIndex />

      <div style={{ display: 'flex', gap: 26, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <nav aria-label="Settings sections" style={{
          display: 'flex', flexDirection: 'column', gap: 1,
          minWidth: 200, flex: '0 0 auto',
        }}>
          {SECTIONS.map(s => (
            <button
              key={s.title}
              type="button"
              aria-current={s.title === active ? 'true' : undefined}
              onClick={() => setActive(s.title)}
              style={{
                textAlign: 'left',
                height: 'var(--sr-h-row)',
                padding: '0 12px',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                background: s.title === active ? 'var(--sr-surface-paper)' : 'transparent',
                color: s.destructive
                  ? 'var(--sr-coral-hover)'
                  : 'var(--sr-text-primary-on-light)',
                boxShadow: s.title === active ? 'inset 2px 0 0 var(--sr-cyan)' : undefined,
              }}
            >{s.title}</button>
          ))}
        </nav>

        <SectionPanel
          section={section}
          extensionAbsent={extensionAbsent}
          onSignOut={() => signOut()}
        />
      </div>
    </AppShell>
  );
}

function SectionPanel({
  section, extensionAbsent, onSignOut,
}: {
  section: SettingSection;
  extensionAbsent: boolean;
  onSignOut: () => void;
}) {
  // Extension-owned settings cannot be written without the extension. They
  // render disabled with the reason rather than silently doing nothing.
  const disabledReason = section.note && extensionAbsent
    ? 'Install the SnapRec extension to change this'
    : undefined;

  return (
    <section style={{
      flex: 1, minWidth: 280,
      background: 'var(--sr-surface-paper)',
      border: '1px solid var(--sr-border-light-soft)',
      padding: 18,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{section.title}</h2>
        {section.note && (
          <span style={{
            fontFamily: 'var(--sr-font-mono)', fontSize: 10,
            color: 'var(--sr-text-faint-on-light)',
          }}>{section.note}</span>
        )}
      </div>

      {disabledReason && (
        <p style={{
          margin: '0 0 10px', fontSize: 12, lineHeight: 1.5,
          color: 'var(--sr-text-muted-on-light)',
        }}>{disabledReason}.</p>
      )}

      {section.fields.map(field => (
        <Field
          key={field.key}
          field={field}
          disabledReason={disabledReason}
          destructive={section.destructive}
          onAction={field.key === 'deleteAccount' ? onSignOut : undefined}
        />
      ))}
    </section>
  );
}

function Field({
  field, disabledReason, destructive, onAction,
}: {
  field: SettingField;
  disabledReason?: string;
  destructive?: boolean;
  onAction?: () => void;
}) {
  const [value, setValue] = useState(field.defaultValue);
  const disabled = Boolean(disabledReason);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '10px 0',
      borderBottom: '1px solid var(--sr-border-light-soft)',
    }}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 13 }}>{field.label}</span>
        {field.help && (
          <span style={{
            fontSize: 11.5, lineHeight: 1.5,
            color: 'var(--sr-text-muted-on-light)',
          }}>{field.help}</span>
        )}
      </span>

      {field.kind === 'switch' && (
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(value)}
          aria-label={field.label}
          aria-disabled={disabled || undefined}
          title={disabledReason}
          onClick={disabled ? undefined : () => setValue(v => !v)}
          style={{
            width: 30, height: 17, flex: 'none', position: 'relative', border: 'none',
            padding: 0, cursor: disabled ? 'not-allowed' : 'pointer',
            background: value ? 'var(--sr-cyan)' : 'var(--sr-border-light)',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <span style={{
            position: 'absolute', top: 2, left: value ? 15 : 2,
            width: 13, height: 13,
            background: value ? 'var(--sr-cyan-fg)' : '#fff',
            transition: 'left var(--sr-dur-fast) var(--sr-ease)',
          }} />
        </button>
      )}

      {field.kind === 'choice' && field.options && (
        <span style={{ display: 'inline-flex', border: '1px solid var(--sr-border-light)', flex: 'none' }}>
          {field.options.map(option => (
            <button
              key={option}
              type="button"
              aria-pressed={value === option}
              aria-disabled={disabled || undefined}
              title={disabledReason}
              onClick={disabled ? undefined : () => setValue(option)}
              style={{
                height: 'var(--sr-h-xs)', padding: '0 10px', border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--sr-font-mono)', fontSize: 10.5,
                background: value === option ? 'var(--sr-cyan)' : 'transparent',
                color: value === option ? 'var(--sr-cyan-fg)' : 'var(--sr-text-muted-on-light)',
                opacity: disabled ? 0.5 : 1,
              }}
            >{option}</button>
          ))}
        </span>
      )}

      {(field.kind === 'select' || field.kind === 'text') && (
        <input
          type="text"
          aria-label={field.label}
          defaultValue={String(field.defaultValue ?? '')}
          disabled={disabled}
          title={disabledReason}
          style={{
            height: 'var(--sr-h-2xs)', width: 180, flex: 'none', padding: '0 10px',
            border: '1px solid var(--sr-border-light)', background: '#fff',
            fontSize: 12.5, borderRadius: 'var(--sr-radius-control)',
          }}
        />
      )}

      {field.kind === 'action' && (
        <button
          type="button"
          onClick={onAction}
          style={{
            height: 'var(--sr-h-2xs)', padding: '0 13px', flex: 'none',
            border: `1px solid ${destructive ? 'var(--sr-coral-text)' : 'var(--sr-border-light)'}`,
            background: 'transparent',
            color: destructive ? 'var(--sr-coral-hover)' : 'var(--sr-text-primary-on-light)',
            fontSize: 12.5, cursor: 'pointer', borderRadius: 'var(--sr-radius-control)',
          }}
        >{destructive ? 'Delete' : 'Connect'}</button>
      )}
    </div>
  );
}
