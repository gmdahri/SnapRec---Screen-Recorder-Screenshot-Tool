import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectList, type ProjectItem } from '../Projects';

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
