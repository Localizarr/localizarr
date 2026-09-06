import { render } from '@testing-library/svelte';
import Logs from '../src/routes/logs/+page.svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Logs Page', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(['Log 1', 'Log 2']) })
    ) as any;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders logs from API', async () => {
    const { getByText } = render(Logs, { props: { logsData: ['Log 1', 'Log 2'] } });
    expect(getByText('Log 1')).toBeInTheDocument();
    expect(getByText('Log 2')).toBeInTheDocument();
  });
  it('has link to home', async () => {
    const { findByText } = render(Logs);
    expect(await findByText('Back to Home')).toBeInTheDocument();
  });
});
