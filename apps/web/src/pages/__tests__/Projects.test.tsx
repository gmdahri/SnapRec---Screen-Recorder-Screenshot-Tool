import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Projects, { ProjectList, type ProjectItem } from '../Projects';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'sb-owner', email: 'owner@example.com' }, loading: false }),
}));

vi.mock('../../hooks/useRecordings', () => ({
  fetchWithAuth: vi.fn().mockResolvedValue([]),
  uploadFile: vi.fn(),
}));

const projects: ProjectItem[] = [
  { id: '1', title: 'Follow-up for Brightline demo', status: 'draftEdit', detail: 'edited 40m ago' },
  { id: '2', title: 'Onboarding tour v3', status: 'exporting', progress: 52,
    detail: 'exporting 1080p · frame 1284 of 2460', extra: 'about 1m left · safe to close' },
  { id: '3', title: 'Q3 pricing explainer', status: 'exportFailed',
    detail: 'export failed at frame 812 · your edit is saved' },
];

describe('Projects', () => {
  it('gives each project the action its state defines', () => {
    render(<ProjectList projects={projects} onAction={() => {}} onOpen={() => {}} />);
    expect(screen.getByRole('button', { name: 'Continue editing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop export' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try export again' })).toBeInTheDocument();
  });

  it('says an export survives closing the tab', () => {
    render(<ProjectList projects={projects} onAction={() => {}} onOpen={() => {}} />);
    expect(screen.getByText(/safe to close/)).toBeInTheDocument();
  });

  it('says the edit survived a failed export', () => {
    render(<ProjectList projects={projects} onAction={() => {}} onOpen={() => {}} />);
    expect(screen.getByText(/your edit is saved/)).toBeInTheDocument();
  });

  it('names frames rather than a bare percentage while exporting', () => {
    render(<ProjectList projects={projects} onAction={() => {}} onOpen={() => {}} />);
    expect(screen.getByText(/frame 1284 of 2460/)).toBeInTheDocument();
  });

  it('draws the state rule for work in progress', () => {
    render(<ProjectList projects={projects} onAction={() => {}} onOpen={() => {}} />);
    expect(screen.getAllByTestId('state-rule-bottom').length).toBeGreaterThan(0);
  });

  it('reports which project an action was for', async () => {
    const onAction = vi.fn();
    render(<ProjectList projects={projects} onAction={onAction} onOpen={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Stop export' }));
    expect(onAction).toHaveBeenCalledWith('2', 'Stop export');
  });

  it('renders nothing but the empty note when there are no projects', () => {
    render(<ProjectList projects={[]} onAction={() => {}} onOpen={() => {}} />);
    expect(screen.getByText(/No projects yet/)).toBeInTheDocument();
  });
});

/** The page consumes `useVideoEditor`, which throws unless a
 * `VideoEditorProvider` sits above it. The suite above renders only
 * `ProjectList`, the presentational child, so the container's missing provider
 * reached the browser untested. This renders what the /projects route renders. */
describe('the Projects route element', () => {
  /** HelmetProvider and the router are what App.tsx already puts above every
   * route, so this is the real tree minus the route table. Anything else the
   * page needs, it has to bring itself. */
  const renderRoute = () => render(
    <HelmetProvider><MemoryRouter><Projects /></MemoryRouter></HelmetProvider>,
  );

  it('mounts without needing a provider supplied by the route', () => {
    expect(renderRoute).not.toThrow();
  });

  it('renders its own heading once mounted', async () => {
    renderRoute();
    expect(await screen.findByText('Recently edited')).toBeInTheDocument();
  });
});
