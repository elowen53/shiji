import { toNodeHandler } from '@modelcontextprotocol/node'
import type { IncomingMessage, ServerResponse } from 'node:http'

export function createNodeAdapter(handler: { fetch(request: Request): Promise<Response> }) {
  const nodeHandler = toNodeHandler(handler, { maxRequestBodySize: 65_536 })
  return (request: IncomingMessage & { body?: unknown }, response: ServerResponse) =>
    nodeHandler(request, response, request.body)
}
