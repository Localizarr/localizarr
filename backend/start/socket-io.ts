import { createServer } from 'node:http'
import { Server as SocketIOServer } from 'socket.io'

let httpServer: ReturnType<typeof createServer> | undefined
let ioInstance: SocketIOServer | undefined

export async function initSocketIO(app: any) {
  if (!httpServer) {
    httpServer = createServer(app.handle.bind(app))
    ioInstance = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    })
    ioInstance.on('connection', (socket) => {
      console.log('[Socket.IO] Cliente conectado:', socket.id)
    })
  }
  return { io: ioInstance, httpServer }
}

export function getHttpServer() {
  return httpServer
}

export function getIO() {
  return ioInstance
}

export const io = {
  emit: (event: string, data: any) => {
    if (ioInstance) {
      ioInstance.emit(event, data)
    }
  }
}
