import type { HttpContext } from '@adonisjs/core/http'
import { SettingsService } from '#services/settings_service'
import { OllamaService } from '#services/ollama_service'

export default class SettingsController {
  async index({ response }: HttpContext) {
    const data = await SettingsService.getAll()
    return response.ok(data)
  }

  async update({ request, response }: HttpContext) {
    const { ollama_url, ollama_model } = request.only(['ollama_url', 'ollama_model'])
    if (ollama_url !== undefined) {
      if (ollama_url && typeof ollama_url === 'string') {
        try { new URL(ollama_url) } catch { return response.badRequest({ error: 'Invalid ollama_url' }) }
      }
      await SettingsService.set('ollama_url', ollama_url || null)
    }
    if (ollama_model !== undefined) {
      await SettingsService.set('ollama_model', ollama_model || null)
    }
    const data = await SettingsService.getAll()
    return response.ok(data)
  }

  async models({ request, response }: HttpContext) {
    const url = (request.qs().url as string) || (await SettingsService.getOllamaUrl())
    try { new URL(url) } catch { return response.badRequest({ error: 'Invalid url' }) }
    const models = await OllamaService.checkAvailableModels(url)
    if (!models) return response.status(502).send({ error: 'Cannot reach Ollama', url })
    return response.ok({ url, models })
  }
}
