import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingNavbar, LANDING_LINKS, SITE_LINKS } from '../LandingNavbar';

const nav = (links = SITE_LINKS) => render(
  <MemoryRouter><LandingNavbar links={links} /></MemoryRouter>,
);

describe('LandingNavbar', () => {
  it('reaches the blog from the landing page, not just the other marketing pages', () => {
    // The landing page passes LANDING_LINKS, which held only the three in-page
    // anchors — so `/` was the one marketing surface with no route to the blog.
    nav(LANDING_LINKS);
    expect(screen.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog');
  });

  it('keeps the blog on every other marketing page too', () => {
    nav(SITE_LINKS);
    expect(screen.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog');
  });

  it('keeps the landing page anchors as anchors, and Blog as a route', () => {
    // An in-page jump and a navigation are rendered differently — <a href="#..">
    // versus a NavLink — so a route smuggled into the anchor set would silently
    // stop working.
    expect(LANDING_LINKS.filter(l => l.to.startsWith('#')).map(l => l.label))
      .toEqual(['How it works', 'Compare', 'FAQ']);
    expect(LANDING_LINKS.at(-1)).toEqual({ label: 'Blog', to: '/blog' });
  });

  it('always offers the two things a visitor without an account can do', () => {
    nav();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /Add to Chrome/ }))
      .toHaveAttribute('target', '_blank');
  });
});
