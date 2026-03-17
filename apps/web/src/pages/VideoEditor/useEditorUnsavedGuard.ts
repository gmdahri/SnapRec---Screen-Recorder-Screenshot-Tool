import { useEffect, useRef } from 'react';

function isInternalHref(href: string): boolean {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:'))
    return false;
  if (href.startsWith('http://') || href.startsWith('https://')) {
    try {
      const u = new URL(href);
      return u.origin === window.location.origin;
    } catch {
      return false;
    }
  }
  return href.startsWith('/');
}

function pathnameOfHref(href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    try {
      return new URL(href).pathname;
    } catch {
      return '';
    }
  }
  return href.split('?')[0].split('#')[0] || '';
}

function toAbsoluteHref(href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  const path = href.startsWith('/') ? href : `/${href}`;
  return `${window.location.origin}${path}`;
}

/**
 * beforeunload = browser tab close (native prompt only).
 * Internal links → requestUnsavedLeave(href) so app can show a custom modal.
 */
export function useEditorUnsavedGuard(
  enabled: boolean,
  requestUnsavedLeave: (absoluteHref: string) => void,
) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const requestRef = useRef(requestUnsavedLeave);
  requestRef.current = requestUnsavedLeave;

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!enabledRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      if (!enabledRef.current) return;
      const t = e.target;
      if (!t || !(t instanceof Element)) return;
      const a = t.closest('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      if (a.target && a.target !== '_self') return;
      const href = a.getAttribute('href');
      if (!href || !isInternalHref(href)) return;
      const nextPath = pathnameOfHref(
        href.startsWith('http') ? href : `${window.location.origin}${href.startsWith('/') ? href : `/${href}`}`,
      );
      if (nextPath === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      requestRef.current(toAbsoluteHref(href));
    };
    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, []);
}
