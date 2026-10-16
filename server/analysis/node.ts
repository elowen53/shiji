import { toNodeHandler } from '@modelcontextprotocol/node'
import type { IncomingMessage, ServerResponse } from 'node:http'

export function createNodeAdapter(handler: { fetch(request: Request): Promise<Response> }) {
  const nodeHandler = toNodeHandler(handler, { maxRequestBodySize: 65_536 })
  return (request: IncomingMessage & { body?: unknown; query?: Record<string, string | string[]> }, response: ServerResponse) => {
    // Vercel injects [resource] into both req.query and req.url. It is routing
    // metadata, not a user query field; only remove the exact path-bound value.
    if (request.url && request.query) {
      const url = new URL(request.url, 'http://localhost')
      const resource = url.pathname.match(/^\/api\/analysis\/v1\/(overview|daily|entries|summary|targets)$/)?.[1]
      if (resource && request.query.resource === resource && url.searchParams.getAll('resource').length === 1 &&
        url.searchParams.get('resource') === resource) {
        url.searchParams.delete('resource')
        request.url = `${url.pathname}${url.search}`
      }
    }
    return nodeHandler(request, response, request.body)
  }
}
