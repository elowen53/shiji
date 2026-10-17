import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import analysisNodeHandler from '../server/analysis/runtime.js'

if (existsSync('.env.analysis.local')) process.loadEnvFile('.env.analysis.local')
const port = Number(process.env.ANALYSIS_PORT ?? 3001)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid ANALYSIS_PORT')
process.env.ANALYSIS_PUBLIC_ORIGIN ??= `http://127.0.0.1:${port}`

const server = createServer((request, response) => {
  void analysisNodeHandler(request, response).catch(() => {
    if (!response.headersSent) response.writeHead(500, { 'Cache-Control': 'no-store' })
    response.end()
  })
})
server.requestTimeout = 30_000
server.headersTimeout = 10_000
server.listen(port, '127.0.0.1', () => console.info(`Analysis service: http://127.0.0.1:${port}/api/mcp`))
