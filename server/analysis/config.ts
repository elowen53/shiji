import { z } from 'zod'
import { clientsSchema } from './auth.js'
import { AnalysisError } from './errors.js'

const configSchema = z.object({
  ANALYSIS_PUBLIC_ORIGIN: z.url(),
  ANALYSIS_DATABASE_URL: z.string().min(1),
  ANALYSIS_DATABASE_CA: z.string().optional(),
  ANALYSIS_TIMEZONE: z.string().default('Asia/Taipei'),
  ANALYSIS_CLIENTS_JSON: z.string().min(1),
})

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  try {
    const value = configSchema.parse(env)
    const origin = new URL(value.ANALYSIS_PUBLIC_ORIGIN)
    const database = new URL(value.ANALYSIS_DATABASE_URL)
    if (origin.origin !== value.ANALYSIS_PUBLIC_ORIGIN || origin.username || origin.password ||
      (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname))) ||
      !['postgres:', 'postgresql:'].includes(database.protocol) || !database.password ||
      !/^shiji_analysis_reader(?:\.[a-z0-9]+)?$/.test(decodeURIComponent(database.username))) {
      throw new Error('configuration')
    }
    new Intl.DateTimeFormat('en-US', { timeZone: value.ANALYSIS_TIMEZONE }).format()
    return {
      origin: origin.origin,
      databaseUrl: value.ANALYSIS_DATABASE_URL,
      databaseCa: value.ANALYSIS_DATABASE_CA,
      timezone: value.ANALYSIS_TIMEZONE,
      clients: clientsSchema.parse(JSON.parse(value.ANALYSIS_CLIENTS_JSON)),
    }
  } catch {
    throw new AnalysisError(503, 'NOT_CONFIGURED', 'Analysis service configuration is missing or invalid.')
  }
}
