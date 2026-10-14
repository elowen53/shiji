import { randomUUID } from 'node:crypto'
import { ZodError } from 'zod'
import { authenticate } from './auth.js'
import type { AnalysisClient } from './auth.js'
import { AnalysisError, publicError } from './errors.js'
import { createAnalysisMcp } from './mcp.js'
import type { AuditLogger } from './mcp.js'
import { emptySchema, entriesSchema, rangeSchema, summarySchema, targetsSchema } from './schema.js'
import type { AnalysisService } from './service.js'

interface HandlerOptions {
  service: AnalysisService
  origin: string
  clients: AnalysisClient[]
  clock?: () => Date
  audit?: AuditLogger
}

function queryObject(url: URL) {
  const values: Record<string, unknown> = {}
  for (const [key, value] of url.searchParams) {
    if (Object.hasOwn(values, key)) throw new AnalysisError(400, 'INVALID_QUERY', 'Duplicate query parameters are not allowed.')
    Object.defineProperty(values, key, { value, enumerable: true, writable: true })
  }
  if (typeof values.limit === 'string') values.limit = /^\d+$/.test(values.limit) ? Number(values.limit) : NaN
  return values
}

export function createAnalysisHandler(options: HandlerOptions) {
  const audit = options.audit ?? ((event) => console.info(JSON.stringify(event)))
  const clock = options.clock ?? (() => new Date())
  const origin = new URL(options.origin)
  const mcp = createAnalysisMcp(options.service, audit)
  return {
    close: () => mcp.close(),
    async fetch(request: Request): Promise<Response> {
      const started = Date.now()
      const requestId = randomUUID()
      let clientId: string | undefined
      let operation = 'unknown'
      let response: Response
      let errorCode: string | undefined
      try {
        const url = new URL(request.url)
        if (url.host !== origin.host || (request.headers.has('origin') && request.headers.get('origin') !== origin.origin)) {
          throw new AnalysisError(403, 'FORBIDDEN_ORIGIN', 'Request host or origin is not allowed.')
        }
        const client = authenticate(request.headers.get('authorization'), options.clients, clock())
        clientId = client.id
        if (url.pathname === '/api/mcp') {
          operation = 'mcp'
          if (request.method !== 'POST') throw new AnalysisError(405, 'METHOD_NOT_ALLOWED', 'Use POST for this stateless MCP endpoint.')
          if (url.search) throw new AnalysisError(400, 'INVALID_QUERY', 'MCP endpoint does not accept query parameters.')
          response = await mcp.fetch(request, { authInfo: {
            token: '', clientId, scopes: ['analysis:read'], extra: { request_id: requestId },
          } })
        } else {
          const resource = url.pathname.match(/^\/api\/analysis\/v1\/(overview|daily|entries|summary|targets)$/)?.[1]
          if (!resource) throw new AnalysisError(404, 'NOT_FOUND', 'Unknown analysis endpoint.')
          operation = resource
          if (request.method !== 'GET') throw new AnalysisError(405, 'METHOD_NOT_ALLOWED', 'Analysis HTTP endpoints are read-only; use GET.')
          const query = queryObject(url)
          let result: object
          switch (resource) {
            case 'overview': emptySchema.parse(query); result = await options.service.overview(); break
            case 'daily': result = await options.service.daily(rangeSchema.parse(query)); break
            case 'entries': result = await options.service.entries(entriesSchema.parse(query)); break
            case 'summary': result = await options.service.summary(summarySchema.parse(query)); break
            default: result = await options.service.targets(targetsSchema.parse(query).as_of)
          }
          response = Response.json(result)
        }
      } catch (error) {
        const safe = error instanceof ZodError
          ? new AnalysisError(400, 'INVALID_QUERY', 'Invalid parameters. Check dates, query fields, limits and enum values.')
          : publicError(error)
        errorCode = safe.code
        response = Response.json({ error: { code: safe.code, message: safe.message }, request_id: requestId }, { status: safe.status })
        if (safe.status === 401) response.headers.set('WWW-Authenticate', 'Bearer realm="shiji-analysis"')
        if (safe.status === 405) response.headers.set('Allow', operation === 'mcp' ? 'POST' : 'GET')
      }
      response.headers.set('Cache-Control', 'private, no-store')
      response.headers.set('X-Content-Type-Options', 'nosniff')
      response.headers.set('X-Request-Id', requestId)
      audit({ event: 'analysis_request', request_id: requestId, client_id: clientId, operation, status: response.status,
        duration_ms: Date.now() - started, ...(errorCode ? { error_code: errorCode } : {}) })
      return response
    },
  }
}
