import { loadConfig } from './config.js'
import { publicError } from './errors.js'
import { createAnalysisHandler } from './http.js'
import { PostgresAnalysisRepository } from './repository.js'
import { AnalysisService } from './service.js'
import { createNodeAdapter } from './node.js'

let runtime: ReturnType<typeof createAnalysisHandler> | undefined

const nodeHandler = createNodeAdapter({
  async fetch(request) {
    try {
      if (!runtime) {
        const config = loadConfig()
        const repository = new PostgresAnalysisRepository(config.databaseUrl, config.databaseCa)
        runtime = createAnalysisHandler({
          service: new AnalysisService(repository, config.timezone), origin: config.origin, clients: config.clients,
        })
      }
      return await runtime.fetch(request)
    } catch (error) {
      const safe = publicError(error)
      return Response.json({ error: { code: safe.code, message: safe.message } }, {
        status: safe.status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
      })
    }
  },
})

export default nodeHandler
