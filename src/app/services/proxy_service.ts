import { inject } from '@adonisjs/core'
import { Logger } from '@adonisjs/core/logger'
import { Config } from '@adonisjs/core/config'
import * as net from 'node:net'
import * as http from 'node:http'

@inject()
export class ProxyService {
  private server?: net.Server
  private knownHosts = new Set<string>(['prowlarr.servarr.com'])

  constructor(
    private logger: Logger,
    private config: Config
  ) {
    this.knownHosts.add('prowlarr.servarr.com')
  }

  public start(port: number, apiKey?: string) {
    this.server = net.createServer((socket) => {
      this.logger.info(`New connection from ${socket.remoteAddress}:${socket.remotePort}`)
      this.handleConnection(socket, apiKey)
    })

    this.server.listen(port, '0.0.0.0', () => {
      this.logger.info(`Proxy server listening on port ${port}`)
    })

    this.server.on('error', (error) => {
      if (error) this.logger.error(`Proxy server error:` + JSON.stringify(error))
    })
    this.server.on('close', (...args) => {
      if (args.length) this.logger.error(`Proxy closed:`, ...args)
    })
  }

  private handleConnection(socket: net.Socket, apiKey?: string) {
    let buffer = Buffer.alloc(0)
    let requestLine = ''

    this.logger.debug(`Iniciando processamento de nova conexão`)

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data])
      this.logger.debug(`Recebidos ${data.length} bytes de dados`)

      if (!requestLine) {
        const index = buffer.indexOf('\r\n')
        if (index !== -1) {
          requestLine = buffer.subarray(0, index).toString()
          this.logger.info(`Linha de requisição recebida: ${requestLine}`)
          this.processRequest(socket, buffer, apiKey)
        }
      }
    })

    socket.on('error', (err) => {
      this.logger.error('Erro na conexão socket:', err)
    })

    socket.on('close', () => {
      this.logger.debug('Conexão socket fechada')
    })

    socket.on('timeout', () => {
      this.logger.warn('Timeout na conexão socket')
      socket.end()
    })

    socket.setTimeout(30000) // 30 segundos timeout
  }

  private processRequest(socket: net.Socket, buffer: Buffer, apiKey?: string) {
    const requestStr = buffer.toString()
    const lines = requestStr.split('\r\n')
    const requestLine = lines[0]

    this.logger.debug(`Processando requisição: ${requestLine}`)

    if (apiKey) {
      const headers = this.parseHeaders(lines.slice(1))
      this.logger.debug(`Verificando autenticação. API Key configurada: ${!!apiKey}`)
      if (!this.validateApiKey(headers, apiKey)) {
        this.logger.warn('Falha na autenticação do proxy')
        socket.write(
          'HTTP/1.1 407 Proxy Authentication Required\r\n' +
          'Proxy-Authenticate: Basic realm="Proxy"\r\n\r\n'
        )
        socket.end()
        return
      }
      this.logger.info('Autenticação do proxy bem-sucedida')
    } else {
      this.logger.debug('Nenhuma autenticação configurada para o proxy')
    }

    if (requestLine.startsWith('CONNECT ')) {
      this.logger.info('Processando requisição CONNECT')
      this.handleConnect(socket, requestLine)
    } else {
      this.logger.info('Processando requisição HTTP')
      this.handleHttp(socket, requestStr, buffer)
    }
  }

  private validateApiKey(headers: Map<string, string>, apiKey: string): boolean {
    const auth = headers.get('proxy-authorization')
    this.logger.debug(`Header Proxy-Authorization presente: ${!!auth}`)
    if (!auth || !auth.startsWith('Basic ')) {
      this.logger.debug('Header de autenticação ausente ou inválido')
      return false
    }

    const encoded = auth.slice(6)
    const decoded = Buffer.from(encoded, 'base64').toString()
    const password = decoded.split(':')[1]
    const isValid = password === apiKey

    this.logger.debug(`Validação da API key: ${isValid ? 'sucesso' : 'falha'}`)
    return isValid
  }

  private handleConnect(socket: net.Socket, requestLine: string) {
    const parts = requestLine.split(' ')
    const target = parts[1].split(':')
    const host = target[0]
    const port = Number.parseInt(target[1])

    this.logger.info(`CONNECT solicitado para ${host}:${port}`)

    if (!this.knownHosts.has(host)) {
      this.logger.warn(`IMPORTANT! Indexer ${host} needs to be set to http:// instead of https://`)
    }

    this.logger.debug(`Tentando conectar ao target ${host}:${port}`)
    const targetSocket = net.createConnection(port, host, () => {
      this.logger.info(`Conexão estabelecida com ${host}:${port}, iniciando túnel`)
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      this.relayTraffic(socket, targetSocket)
    })

    targetSocket.on('error', (err) => {
      this.logger.error(`Falha ao conectar ao target ${host}:${port}:`, err)
      socket.end()
    })

    targetSocket.on('close', () => {
      this.logger.debug(`Conexão com target ${host}:${port} fechada`)
    })
  }

  private handleHttp(socket: net.Socket, requestStr: string, buffer: Buffer) {
    try {
      const lines = requestStr.split('\r\n')
      const requestLine = lines[0]
      const parts = requestLine.split(' ')
      const method = parts[0]
      const url = parts[1]

      this.logger.info(`Requisição HTTP: ${method} ${url}`)

      const headers = this.parseHeaders(lines.slice(1))
      const userAgent = headers.get('user-agent') || ''
      this.logger.debug(`User-Agent: ${userAgent}`)

      const uri = new URL(url)
      const host = uri.hostname
      this.logger.debug(`Host extraído da URL: ${host}`)
      this.logger.info(`URL original recebida: ${url}`)
      this.logger.info(`Host: ${host}, Pathname: ${uri.pathname}, Search: ${uri.search}`)

      // Add to known hosts
      this.knownHosts.add(host)

      // Modify URL to point to local API
      const localPort = this.config.get('application.port', 5005)
      const apiKey = this.config.get('application.apiKey', '_')
      this.logger.info(
        `Configuração - Porta local: ${localPort}, API Key: ${apiKey ? 'definida' : 'não definida'}`
      )

      // Build the correct URL for the AdonisJS route /_/:domain/*
      const modifiedUrl = `http://localhost:${localPort}/_/${host}${uri.pathname}${uri.search}`

      this.logger.info(`URL modificada para:`)
      this.logger.info(`${modifiedUrl}`)
      this.logger.info(`Rota esperada: /_/${host}${uri.pathname}${uri.search}`)

      const options: http.RequestOptions = {
        method,
        headers: {
          'User-Agent': userAgent,
          ...Object.fromEntries(headers),
        },
      }

      // ========== LOCAL SERVER REQUEST DEBUGGING ==========
      this.logger.info('🏠 LOCAL SERVER REQUEST - FORWARDING TO ADONIS:')
      this.logger.info(`   Original URL: ${url}`)
      this.logger.info(`   Modified URL: ${modifiedUrl}`)
      this.logger.info(`   Method: ${method}`)
      this.logger.info(`   Route: /_/${host}${uri.pathname}${uri.search}`)
      this.logger.info('='.repeat(55))
      // ====================================================

      this.logger.debug(`Enviando requisição para o servidor local`)
      const req = http.request(modifiedUrl, options, (res) => {
        this.logger.info(
          `Resposta recebida do servidor local: ${res.statusCode} ${res.statusMessage}`
        )
        socket.write(`HTTP/1.1 ${res.statusCode} ${res.statusMessage}\r\n`)
        for (const [key, value] of Object.entries(res.headers)) {
          if (Array.isArray(value)) {
            value.forEach((v) => socket.write(`${key}: ${v}\r\n`))
          } else {
            socket.write(`${key}: ${value}\r\n`)
          }
        }
        socket.write('\r\n')

        let responseData = Buffer.alloc(0)
        let responseSize = 0
        res.on('data', (chunk) => {
          responseSize += chunk.length
          responseData = Buffer.concat([responseData, chunk])
          socket.write(chunk)
        })

        res.on('end', () => {
          // Log do conteúdo da resposta (limitado para não sobrecarregar logs)
          const contentType = res.headers['content-type'] || ''
          const isTextResponse =
            contentType.includes('text') ||
            contentType.includes('json') ||
            contentType.includes('xml') ||
            contentType.includes('rss')

          if (isTextResponse && responseData.length > 0) {
            const contentPreview = responseData
              .subarray(0, Math.min(1000, responseData.length))
              .toString()
            const truncated = responseData.length > 1000 ? ' [TRUNCATED]' : ''
            this.logger.info(
              `Conteúdo da resposta HTTP (${responseData.length} bytes, tipo: ${contentType}):`
            )
            this.logger.info(`${contentPreview}${truncated}`)
          } else if (responseData.length > 0) {
            this.logger.debug(
              `Resposta binária recebida (${responseData.length} bytes, tipo: ${contentType})`
            )
          } else {
            this.logger.debug('Resposta vazia recebida')
          }

          this.logger.info(
            `Resposta completa enviada ao cliente. Tamanho: ${responseData.length} bytes`
          )
          socket.end()
        })
      })

      req.on('error', (err) => {
        this.logger.error('Erro na requisição proxy:', err)
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n')
        socket.end()
      })

      // Send request body if any
      const bodyStart = buffer.indexOf('\r\n\r\n') + 4
      if (bodyStart < buffer.length) {
        const body = buffer.subarray(bodyStart)
        this.logger.debug(`Enviando corpo da requisição: ${body.length} bytes`)
        req.write(body)
      }
      req.end()
      this.logger.debug('Requisição enviada ao servidor local')
    } catch (err) {
      this.logger.error('Erro no processamento HTTP do proxy:', err)
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n')
      socket.end()
    }
  }

  private parseHeaders(headerLines: string[]): Map<string, string> {
    const headers = new Map<string, string>()
    this.logger.debug(`Parseando ${headerLines.length} linhas de headers`)
    for (const line of headerLines) {
      if (line.trim() === '') break
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim().toLowerCase()
        const value = line.slice(colonIndex + 1).trim()
        headers.set(key, value)
      }
    }
    this.logger.debug(`Headers parseados: ${headers.size} headers encontrados`)
    return headers
  }

  public async stop() {
    if (this.server) {
      this.logger.info('Stopping proxy server')
      this.server.close((error: any) => {
        if (error && error?.code !== 'ERR_SERVER_NOT_RUNNING') {
          this.logger.error('Error stopping proxy server:' + JSON.stringify(error))
        } else {
          this.logger.info('Proxy server stopped successfully')
        }
      })
      this.server = undefined
    } else {
      this.logger.warn('Proxy server is not running')
    }
  }

  private relayTraffic(socket1: net.Socket, socket2: net.Socket) {
    this.logger.debug('Iniciando relay de tráfego entre sockets')
    socket1.pipe(socket2)
    socket2.pipe(socket1)
  }
}
