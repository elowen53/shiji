import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { loadConfig } from '../server/analysis/config.js'
import { PostgresAnalysisRepository } from '../server/analysis/repository.js'

if (existsSync('.env.analysis.local')) process.loadEnvFile('.env.analysis.local')
const config = loadConfig()
const repository = new PostgresAnalysisRepository(config.databaseUrl, config.databaseCa)
try {
  await repository.overview() // Validates actual login identity, grants and RLS before reading.
  const client = await repository.pool.connect()
  try {
    for (const table of ['foods', 'entries', 'daily_metrics', 'macro_targets']) {
      for (const sql of [`delete from public.${table} where false`, `update public.${table} set entry_date = entry_date where false`]) {
        // UPDATE uses a real column only on dated tables; DELETE tests all four tables.
        if (sql.startsWith('update') && !['entries', 'daily_metrics'].includes(table)) continue
        await client.query('begin read write')
        let denied = false
        try { await client.query(sql) } catch (error) {
          denied = (error as { code?: string }).code === '42501'
        } finally { await client.query('rollback') }
        assert.ok(denied, `Database must deny writes to ${table}, even inside a read-write transaction`)
      }
    }
  } finally { client.release() }
  console.info('PASS: dedicated role can read and database grants reject business-table writes (zero rows modified).')
} finally {
  await repository.pool.end()
}
