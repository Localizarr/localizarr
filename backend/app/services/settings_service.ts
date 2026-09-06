import Setting from '#models/setting'
import { ollama as ollamaConfig } from '#config/app'

export class SettingsService {
  private static cache: Map<string, string> | null = null
  private static cacheAt: number | null = null
  private static CACHE_TTL_MS = 30_000

  private static async loadAll(): Promise<Map<string, string>> {
    const now = Date.now()
    if (this.cache && this.cacheAt && now - this.cacheAt < this.CACHE_TTL_MS) return this.cache
    try {
      const rows = await Setting.all()
      const m = new Map<string, string>()
      for (const r of rows) if (r.value != null) m.set(r.key, r.value)
      this.cache = m
      this.cacheAt = now
      return m
    } catch {
      // DB not ready (test env)
      return new Map()
    }
  }

  static async get(key: string, fallback: string): Promise<string> {
    const m = await this.loadAll()
    return m.get(key) ?? fallback
  }

  static async getOllamaUrl(): Promise<string> {
    const fallback = ollamaConfig.url
    return this.get('ollama_url', fallback)
  }

  static async getOllamaModel(): Promise<string> {
    const fallback = ollamaConfig.model
    return this.get('ollama_model', fallback)
  }

  static async set(key: string, value: string | null): Promise<void> {
    let row = await Setting.query().where('key', key).first()
    if (row) { row.value = value; await row.save() }
    else { await Setting.create({ key, value }) }
    this.cache = null
    this.cacheAt = null
  }

  static async getAll(): Promise<Record<string, string | null>> {
    const m = await this.loadAll()
    return {
      ollama_url: m.get('ollama_url') ?? ollamaConfig.url,
      ollama_model: m.get('ollama_model') ?? ollamaConfig.model,
    }
  }

  static clearCache() { this.cache = null; this.cacheAt = null }

  static async listModels(url: string): Promise<string[] | null> {
    const modelsUrl = new URL('/api/tags', url).toString()
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch(modelsUrl, { method: 'GET', signal: controller.signal } as any)
      if (!res.ok) return null
      const data = (await res.json()) as any
      if (!data.models || !Array.isArray(data.models)) return null
      return data.models.map((m: any) => m.name ?? m)
    } catch { return null } finally { clearTimeout(t) }
  }
}
