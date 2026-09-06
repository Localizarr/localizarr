import { render, screen } from '@testing-library/svelte';
import Home from '../src/routes/+page.svelte';
import { describe, it, expect } from 'vitest';

describe('Home Page', () => {
  it('renders welcome heading', () => {
    render(Home, { name: 'Localizarr' });
    expect(screen.getByText('Welcome to Localizarr!')).toBeInTheDocument();
  });
  it('has link to logs', () => {
    render(Home);
    expect(screen.getByText('Go to Logs')).toBeInTheDocument();
  });
});
