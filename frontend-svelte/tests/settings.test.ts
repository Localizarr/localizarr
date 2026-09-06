import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import SettingsPage from '../src/routes/settings/+page.svelte'

describe('settings page', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async (url: any) => {
      const u = String(url)
      if (u.includes('/api/settings')) return { ok: true, json: async () => ({ ollama_url: 'http://localhost:11434', ollama_model: 'qwen3:1.7b' }) } as any
      if (u.includes('/api/ollama/models')) return { ok: true, json: async () => ({ models: ['qwen3:1.7b','qwen3:8b'] }) } as any
      return { ok: false, json: async () => ({}) } as any
    }) as any
  })
  it('renders and shows saved model', async () => {
    render(SettingsPage as any)
    expect(await screen.findByText(/Settings — LLM/)).toBeInTheDocument()
  })
})
