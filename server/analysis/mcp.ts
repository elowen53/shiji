import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { emptySchema, entriesSchema, rangeSchema, summarySchema, targetsSchema } from './schema.js'
import { publicError } from './errors.js'
import { DATA_NOTES, VEGETABLE_LOGGING_NOTE } from './service.js'
import type { AnalysisService } from './service.js'

export type AuditEvent = {
  event: 'analysis_request' | 'analysis_tool'
  request_id: string
  client_id?: string
  operation: string
  status: number
  duration_ms: number
  error_code?: string
}
export type AuditLogger = (event: AuditEvent) => void

export function createAnalysisMcp(service: AnalysisService, audit: AuditLogger) {
  return createMcpHandler(({ authInfo }) => {
    const server = new McpServer({ name: 'shiji-analysis', version: '1.0.0' }, {
      instructions: `Read-only personal nutrition history. Start with get_data_overview, then use bounded date ranges. ${DATA_NOTES.join(' ')}`,
    })
    const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    const run = async (operation: string, action: () => Promise<object>) => {
      const started = Date.now()
      const event = {
        event: 'analysis_tool' as const,
        request_id: String(authInfo?.extra?.request_id ?? 'unknown'),
        client_id: authInfo?.clientId,
        operation,
      }
      try {
        const data = await action()
        audit({ ...event, status: 200, duration_ms: Date.now() - started })
        return { content: [{ type: 'text' as const, text: JSON.stringify(data) }], structuredContent: data }
      } catch (error) {
        const safe = publicError(error)
        audit({ ...event, status: safe.status, duration_ms: Date.now() - started, error_code: safe.code })
        return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ error: { code: safe.code, message: safe.message } }) }] }
      }
    }
    server.registerTool('get_data_overview', {
      description: 'Get available history dates, record counts, units, query limits and data caveats. Call this before analysis.',
      inputSchema: emptySchema, annotations,
    }, () => run('get_data_overview', () => service.overview()))
    server.registerTool('get_daily_history', {
      description: 'Daily saved nutrition totals, weight, waist and burn for an inclusive YYYY-MM-DD range (maximum 366 days, no future dates). Missing days stay null. Includes 7-day weight means (at least 3 measurements).',
      inputSchema: rangeSchema, annotations,
    }, (query) => run('get_daily_history', () => service.daily(query)))
    server.registerTool('list_food_entries', {
      description: `Read saved food-entry snapshots with literal food_name substring filtering. Follow next_cursor until null; keep the same dates/filter. Nutrition already includes quantity. Maximum 200 entries per page and 366 days per query. ${VEGETABLE_LOGGING_NOTE}`,
      inputSchema: entriesSchema, annotations,
    }, (query) => run('list_food_entries', () => service.entries(query)))
    server.registerTool('get_period_summary', {
      description: 'Summarize a bounded date range by period, Monday-based week or month. Statistics exclude today and report their sample days. Weight change is the last minus first observed weight, not a causal estimate.',
      inputSchema: summarySchema, annotations,
    }, (query) => run('get_period_summary', () => service.summary(query)))
    server.registerTool('get_current_targets', {
      description: 'Get CURRENT g/kg nutrition settings and apply them to the latest positive weight on/before as_of (defaults to today). Historical targets are unavailable; as_of only selects the weight basis.',
      inputSchema: targetsSchema, annotations,
    }, (query) => run('get_current_targets', () => service.targets(query.as_of)))
    return server
  }, { responseMode: 'json', maxRequestBodySize: 65_536 })
}
