import { ApplicationService } from '@adonisjs/core/types'
import { ProxyService } from '#services/proxy_service'

export default class ProxyProvider {
  constructor(protected app: ApplicationService) { }

  async register() {
    this.app.container.singleton(ProxyService, async () => {
      return new ProxyService(
        await this.app.container.make('logger'),
        await this.app.container.make('config')
      )
    })
  }

  async boot() {
    const proxyService = await this.app.container.make(ProxyService)
    const config = await this.app.container.make('config')

    const proxyPort = Number(config.get('application.proxyPort', 5006))
    const apiKey = config.get('application.apiKey') as string | undefined

    proxyService.start(proxyPort, apiKey)
  }

  async shutdown() {
    const proxyService = await this.app.container.make(ProxyService)
    await proxyService.stop()
  }
}
