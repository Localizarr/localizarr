import axios, { AxiosResponse } from 'axios'

export class ProxyRequestService {
  private cache = new Map<string, { response: AxiosResponse; expires: number }>()
  private userAgent = 'UmlautAdaptarr/1.0'

  async proxyRequest(targetUri: string): Promise<AxiosResponse> {
    // Check cache
    const cached = this.cache.get(targetUri)
    if (cached && cached.expires > Date.now()) {
      return cached.response
    }

    const response = await axios.get(targetUri, {
      headers: {
        'User-Agent': this.userAgent,
      },
      validateStatus: () => true,
    })

    // Cache for 12 minutes
    this.cache.set(targetUri, { response, expires: Date.now() + 12 * 60 * 1000 })

    return response
  }
}
