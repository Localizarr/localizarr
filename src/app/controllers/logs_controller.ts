import type { HttpContext } from '@adonisjs/core/http'
import ExecutionLog from '#models/execution_log'

export default class LogsController {
  async index({ inertia, request }: HttpContext) {
    const page = request.input('page', 1)
    const limit = 20

    const logs = await ExecutionLog.query().orderBy('createdAt', 'desc').paginate(page, limit)

    const serializedLogs = logs.serialize()
    console.log(`[LogsController] Page: ${page}, Limit: ${limit}`)
    console.log(`[LogsController] Fetched ${serializedLogs.data.length} logs`)
    if (serializedLogs.data.length > 0) {
      console.log(`[LogsController] First log ID: ${serializedLogs.data[0].id}`)
    }

    return inertia.render('logs', { logs: serializedLogs })
  }
}
