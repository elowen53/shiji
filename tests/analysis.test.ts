import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { IncomingMessage } from 'node:http'
import { PGlite } from '@electric-sql/pglite'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { clientsSchema, hashToken } from '../server/analysis/auth.js'
import { loadConfig } from '../server/analysis/config.js'
import { createAnalysisHandler } from '../server/analysis/http.js'
import type { AuditEvent } from '../server/analysis/mcp.js'
import { createNodeAdapter } from '../server/analysis/node.js'
import { DAILY_SQL, ENTRIES_SQL, OVERVIEW_SQL, READER_CHECK_SQL, TARGETS_SQL, WEIGHT_SQL, entriesParameters } from '../server/analysis/repository.js'
import { AnalysisService } from '../server/analysis/service.js'
import { dateInTimezone, dateSchema, decodeCursor, entriesSchema, summarySchema, validateRange } from '../server/analysis/schema.js'
import type { DateRange, EntriesQuery, EntryCursor } from '../server/analysis/schema.js'
import type { AnalysisRepository, DailyRow, EntryRow, OverviewRow, TargetsRow } from '../server/analysis/types.js'

const db = new PGlite()
const clock = () => new Date('2026-10-14T00:30:00Z')
const token = 'a'.repeat(43)
const clients = clientsSchema.parse([{ id: 'codex', token_sha256: hashToken(token), expires_at: '2027-01-01T00:00:00Z' }])
const logs: AuditEvent[] = []

class FixtureRepository implements AnalysisRepository {
  async overview() { return (await db.query<OverviewRow>(OVERVIEW_SQL)).rows[0] }
  async daily(range: DateRange) { return (await db.query<DailyRow>(DAILY_SQL, [range.from, range.to])).rows }
  async entries(query: EntriesQuery, cursor: EntryCursor | null) {
    return (await db.query<EntryRow>(ENTRIES_SQL, entriesParameters(query, cursor))).rows
  }
  async targets(asOf: string) {
    return {
      current: (await db.query<TargetsRow>(TARGETS_SQL)).rows[0] ?? null,
      weight: (await db.query<{ entry_date: string; weight_kg: number }>(WEIGHT_SQL, [asOf])).rows[0] ?? null,
    }
  }
}
const service = new AnalysisService(new FixtureRepository(), 'Asia/Taipei', clock)
const app = createAnalysisHandler({ service, origin: 'http://127.0.0.1:3001', clients, clock, audit: (event) => logs.push(event) })
const migration = (name: string) => readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8')

before(async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key, email text);
    create table auth.sessions(id uuid primary key, user_id uuid);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid(), auth.jwt() to authenticated;
  `)
  await db.exec(await readFile(new URL('../setup.sql', import.meta.url), 'utf8'))
  await db.exec(await migration('20261011_private_access'))
  await db.exec(await migration('20261014_analysis_reader'))
  // Setup must be idempotent, and owner setup may run after reader provisioning.
  await db.exec(await migration('20261014_analysis_reader'))
  await db.exec(await migration('20261011_private_access'))
  await db.exec(`
    insert into public.foods(id,name,unit,kcal,protein,fat,carbs)
      values ('10000000-0000-4000-8000-000000000001','changed food','100g',999,99,99,99);
    insert into public.entries(id,entry_date,food_id,food_name,unit,quantity,kcal,protein,fat,carbs)
      select ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid, '2026-10-01',
        '10000000-0000-4000-8000-000000000001', 'snapshot food', 'portion', 2, 200, 20, 5, 10
      from generate_series(1,1005) i;
    insert into public.entries(entry_date,food_name,unit,quantity,kcal,protein,fat,carbs) values
      ('2026-10-02','literal 50%_food','portion',1,0,0,0,0),
      ('2026-10-03','other food','portion',1,1800,100,40,200),
      ('2026-10-14','partial today','portion',1,300,10,10,30);
    insert into public.daily_metrics(entry_date,weight_kg,waist_cm,burn_kcal) values
      ('2026-09-25',82,null,null),('2026-09-27',81,null,null),('2026-09-30',80,null,null),
      ('2026-10-01',79,90,2500),('2026-10-02',null,null,2000),
      ('2026-10-03',78,89,null),('2026-10-04',null,null,2100),
      ('2026-10-14',77,88,2200);
    insert into public.macro_targets(id,protein_g_per_kg,fat_g_per_kg,carbs_g_per_kg)
      values(1,2,null,3);
    insert into auth.users values('20000000-0000-4000-8000-000000000001','owner@shiji.local');
    insert into auth.sessions values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');
    set role shiji_analysis_reader;
  `)
})

after(async () => {
  await app.close()
  await db.close()
})

function request(resource: string, query = '', init: RequestInit = {}) {
  return app.fetch(new Request(`http://127.0.0.1:3001/api/analysis/v1/${resource}${query}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers },
  }))
}

async function rpcResponse(response: Response) {
  const text = await response.text()
  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    const data = text.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n')
    return JSON.parse(data)
  }
  return JSON.parse(text)
}

test('database role reads all four tables after migration reruns and has no write or elevated grants', async () => {
  assert.equal((await db.query<{ allowed: boolean }>(READER_CHECK_SQL)).rows[0].allowed, true)
  for (const table of ['foods', 'entries', 'daily_metrics', 'macro_targets']) {
    assert.ok((await db.query(`select * from public.${table}`)).rows.length > 0)
    for (const sql of [
      `delete from public.${table} where false`,
      `insert into public.${table} default values`,
      `update public.${table} set ${table === 'daily_metrics' ? 'entry_date = entry_date' : 'id = id'} where false`,
      `truncate public.${table}`,
    ]) {
      await assert.rejects(db.query(sql), (error: unknown) => (error as { code: string }).code === '42501')
    }
  }
  await assert.rejects(db.query('select * from auth.users'), /permission denied/)
  // PGlite's session_user is the test superuser; SET ROLE cannot simulate a new login.
  // The production guard additionally rejects memberships and privileged login identities.
  await db.exec('reset role')
  assert.equal((await db.query<{ allowed: boolean }>(READER_CHECK_SQL)).rows[0].allowed, false)
  await db.exec('grant insert on public.entries to shiji_analysis_reader; set role shiji_analysis_reader')
  assert.equal((await db.query<{ allowed: boolean }>(READER_CHECK_SQL)).rows[0].allowed, false)
  await db.exec('reset role; revoke insert on public.entries from shiji_analysis_reader; drop policy analysis_reader_select on public.entries; set role shiji_analysis_reader')
  assert.equal((await db.query<{ allowed: boolean }>(READER_CHECK_SQL)).rows[0].allowed, false)
  await db.exec('reset role')
  await db.exec(await migration('20261014_analysis_reader'))
  await db.exec('set role shiji_analysis_reader')
  assert.equal((await db.query<{ allowed: boolean }>(READER_CHECK_SQL)).rows[0].allowed, true)
})

test('anonymous and other authenticated users remain blocked; valid owner session still works', async () => {
  await db.exec('reset role; set role anon')
  await assert.rejects(db.query('select * from public.entries'), /permission denied/)
  await db.exec('reset role; set role authenticated')
  assert.equal((await db.query('select * from public.entries')).rows.length, 0)
  await db.exec(`
    select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', false);
    select set_config('request.jwt.claims', '{"session_id":"30000000-0000-4000-8000-000000000001"}', false);
  `)
  assert.equal((await db.query('select * from public.entries')).rows.length, 1008)
  await db.exec(`reset role; delete from auth.sessions; set role authenticated`)
  assert.equal((await db.query('select * from public.entries')).rows.length, 0)
  await db.exec('reset role; set role shiji_analysis_reader')
})

test('daily aggregation reads more than 1000 snapshots, preserves zeros and missing days, looks back for moving means', async () => {
  const result = await service.daily({ from: '2026-10-01', to: '2026-10-14' })
  assert.equal(result.data.length, 14)
  assert.equal(result.data[0].entry_count, 1005)
  assert.equal(result.data[0].kcal, 201000) // Saved totals, not 999 from the food library and not multiplied by quantity again.
  assert.equal(result.data[0].protein, 20100)
  assert.equal(result.data[0].weight_7d_mean_kg, 80.5)
  assert.equal(result.data[0].weight_7d_sample_days, 4)
  assert.equal(result.data[1].kcal, 0)
  assert.equal(result.data[1].balance_kcal, -2000)
  assert.equal(result.data[3].kcal, null)
  assert.equal(result.data[3].balance_kcal, null)
  assert.equal(result.data[4].entry_count, 0)
  assert.equal(result.data[4].weight_kg, null)
  assert.equal(result.data[13].is_ended, false)
  assert.equal(result.data[13].balance_kcal, null)
  assert.equal(result.coverage.ended_days_with_intake_and_burn, 2)
  assert.equal(result.coverage.days_with_food_entries, 4)
})

test('summaries use observed ended-day denominators and mark partial Monday/month groups', async () => {
  const result = await service.summary(summarySchema.parse({ from: '2026-10-01', to: '2026-10-14' }))
  const summary = result.data[0]
  assert.equal(summary.intake.sample_days, 3)
  assert.equal(summary.intake.mean_kcal, 67600)
  assert.equal(summary.burn.sample_days, 3)
  assert.equal(summary.balance.sample_days, 2)
  assert.equal(summary.balance.total_kcal, 196500)
  assert.equal(summary.weight.observed_change_kg, -1)
  assert.equal(summary.weight.sample_days, 2)
  const weekly = await service.summary(summarySchema.parse({ from: '2026-10-01', to: '2026-10-14', group_by: 'week' }))
  assert.deepEqual(weekly.data.map((row) => row.period_start), ['2026-09-28', '2026-10-05', '2026-10-12'])
  assert.deepEqual(weekly.data.map((row) => row.partial_period), [true, false, true])
  assert.equal(weekly.data[1].intake.mean_kcal, null)
  const monthly = await service.summary(summarySchema.parse({ from: '2026-09-25', to: '2026-10-14', group_by: 'month' }))
  assert.deepEqual(monthly.data.map((row) => row.period_start), ['2026-09-01', '2026-10-01'])
  assert.ok(monthly.data.every((row) => row.partial_period))
})

test('keyset pagination reads every entry once and binds cursors to dates and literal name filters', async () => {
  let cursor: string | undefined
  const ids: string[] = []
  do {
    const page = await service.entries(entriesSchema.parse({ from: '2026-10-01', to: '2026-10-03', limit: 200, cursor }))
    ids.push(...page.data.map((row) => row.id))
    cursor = page.pagination.next_cursor ?? undefined
  } while (cursor)
  assert.equal(ids.length, 1007)
  assert.equal(new Set(ids).size, 1007)
  const literal = await service.entries(entriesSchema.parse({ from: '2026-10-01', to: '2026-10-03', food_name: '%_' }))
  assert.equal(literal.data.length, 1)
  assert.equal(literal.data[0].food_name, 'literal 50%_food')
  const injection = await service.entries(entriesSchema.parse({ from: '2026-10-01', to: '2026-10-03', food_name: "' OR true --" }))
  assert.equal(injection.data.length, 0)
  const first = await service.entries(entriesSchema.parse({ from: '2026-10-01', to: '2026-10-03', limit: 1 }))
  assert.throws(() => decodeCursor(entriesSchema.parse({ from: '2026-10-02', to: '2026-10-03', cursor: first.pagination.next_cursor })), /different query/)
})

test('targets are labelled current-only and use dated weight without future leakage', async () => {
  const result = await service.targets('2026-09-29')
  assert.equal(result.data.settings_scope, 'current_only')
  assert.equal(result.data.weight_basis?.entry_date, '2026-09-27')
  assert.equal(result.data.weight_basis?.age_days, 2)
  assert.equal(result.data.current_settings_applied_to_weight.protein_g, 162)
  assert.equal(result.data.current_settings_applied_to_weight.fat_g, null)
  assert.equal((await service.targets('2020-01-01')).data.current_settings_applied_to_weight.protein_g, null)
})

test('strict date, bounded ranges, business timezone and HTTP numeric limits', async () => {
  assert.equal(dateSchema.safeParse('2026-02-29').success, false)
  assert.equal(dateSchema.safeParse('2024-02-29').success, true)
  assert.equal(dateInTimezone(new Date('2026-10-13T16:00:00Z'), 'Asia/Taipei'), '2026-10-14')
  assert.throws(() => validateRange({ from: '2026-10-14', to: '2026-10-13' }, '2026-10-14'))
  assert.throws(() => validateRange({ from: '2025-01-01', to: '2026-10-14' }, '2026-10-14'))
  assert.throws(() => validateRange({ from: '2026-10-14', to: '2026-10-15' }, '2026-10-14'))
  assert.equal((await request('entries', '?from=2026-10-01&to=2026-10-01&limit=2')).status, 200)
  for (const query of [
    '?from=2026-02-29&to=2026-10-01', '?from=2026-10-01&to=2026-10-01&limit=201',
    '?from=2026-10-01&to=2026-10-01&limit=1e2', '?from=2026-10-01&to=2026-10-01&sql=select',
    '?from=2026-10-01&from=2026-10-02&to=2026-10-01', '?from=2026-10-01&to=2026-10-01&cursor=bad',
  ]) assert.equal((await request('entries', query)).status, 400)
})

test('HTTP auth fails closed for missing/wrong/expired/revoked tokens; no caching or browser origins', async () => {
  for (const auth of ['', 'Bearer bad', `Bearer ${'b'.repeat(43)}`]) {
    const response = await request('overview', '', { headers: { Authorization: auth } })
    assert.equal(response.status, 401)
    assert.match(response.headers.get('www-authenticate')!, /Bearer/)
    assert.match(response.headers.get('cache-control')!, /no-store/)
  }
  clients[0].revoked = true
  assert.equal((await request('overview')).status, 401)
  clients[0].revoked = false
  const expiry = clients[0].expires_at
  clients[0].expires_at = clock().toISOString()
  assert.equal((await request('overview')).status, 401)
  clients[0].expires_at = expiry
  assert.equal((await request('overview', '', { headers: { Origin: 'https://evil.example' } })).status, 403)
  assert.equal((await request('overview', '', { method: 'DELETE' })).status, 405)
  assert.equal((await request('overview', '?token=secret')).status, 400)
  const response = await request('overview')
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control')!, /no-store/)
  assert.equal(response.headers.get('access-control-allow-origin'), null)
  assert.equal((await response.json()).data.entry_count, 1008)
})

test('server configuration rejects owner credentials, insecure origins and missing client hashes', () => {
  const env = {
    ANALYSIS_PUBLIC_ORIGIN: 'https://analysis.example',
    ANALYSIS_DATABASE_URL: 'postgresql://shiji_analysis_reader.ref:fake@pooler.example:6543/postgres',
    ANALYSIS_CLIENTS_JSON: JSON.stringify(clients),
  }
  assert.equal(loadConfig(env).timezone, 'Asia/Taipei')
  assert.throws(() => loadConfig({ ...env, ANALYSIS_DATABASE_URL: 'postgresql://postgres:fake@pooler.example/postgres' }), /configuration/)
  assert.throws(() => loadConfig({ ...env, ANALYSIS_PUBLIC_ORIGIN: 'http://public.example' }), /configuration/)
  assert.throws(() => loadConfig({ ...env, ANALYSIS_CLIENTS_JSON: '[]' }), /configuration/)
})

test('MCP client initializes, discovers five read-only tools and calls all of them over the actual Node adapter', async () => {
  const server = createServer((request: IncomingMessage & { body?: unknown }, response) => {
    // Exercise the pre-parsed req.body path used by Vercel as well as raw Node streams.
    if (request.headers['x-preparsed'] === 'true' && request.method === 'POST') {
      void (async () => {
        const chunks = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk))
        request.body = JSON.parse(Buffer.concat(chunks).toString())
        await adapter(request, response)
      })()
    } else void adapter(request, response)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const origin = `http://127.0.0.1:${address.port}`
  const networkApp = createAnalysisHandler({ service, origin, clients, clock, audit: (event) => logs.push(event) })
  const adapter = createNodeAdapter(networkApp)
  try {
    for (const preparsed of [false, true]) {
      const client = new Client({ name: 'integration-test', version: '1.0.0' })
      const transport = new StreamableHTTPClientTransport(new URL(`${origin}/api/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${token}`, ...(preparsed ? { 'X-Preparsed': 'true' } : {}) } },
      })
      try {
        await client.connect(transport)
        const list = await client.listTools()
        assert.equal(list.tools.length, 5)
        assert.ok(list.tools.every((tool) => tool.annotations?.readOnlyHint === true))
        for (const [name, args] of [
          ['get_data_overview', {}],
          ['get_daily_history', { from: '2026-10-01', to: '2026-10-03' }],
          ['list_food_entries', { from: '2026-10-01', to: '2026-10-03', limit: 2 }],
          ['get_period_summary', { from: '2026-10-01', to: '2026-10-03', group_by: 'week' }],
          ['get_current_targets', {}],
        ] as const) {
          const result = await client.callTool({ name, arguments: args })
          assert.notEqual(result.isError, true, name)
          assert.ok(result.structuredContent)
        }
        const invalid = await client.callTool({ name: 'get_daily_history', arguments: { from: '2026-10-01', to: '2026-10-15' } })
        assert.equal(invalid.isError, true)
        assert.match(JSON.stringify(invalid.content), /INVALID_RANGE/)
      } finally { await client.close() }
    }
    assert.equal((await fetch(`${origin}/api/mcp`, { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })).status, 401)
    assert.equal((await fetch(`${origin}/api/mcp`, { headers: { Authorization: `Bearer ${token}` } })).status, 405)
    const legacyHeaders = {
      Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25',
    }
    const legacyInit = await fetch(`${origin}/api/mcp`, {
      method: 'POST', headers: legacyHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
        protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'legacy-client', version: '1' },
      } }),
    })
    assert.equal(legacyInit.status, 200)
    assert.equal((await rpcResponse(legacyInit)).result.protocolVersion, '2025-11-25')
    const legacyCall = await fetch(`${origin}/api/mcp`, {
      method: 'POST', headers: legacyHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_data_overview', arguments: {} } }),
    })
    assert.equal(legacyCall.status, 200)
    assert.equal((await rpcResponse(legacyCall)).result.structuredContent.data.entry_count, 1008)
    assert.equal((await fetch(`${origin}/api/mcp`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: 'x'.repeat(65_537) })).status, 413)
  } finally {
    await networkApp.close()
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test('database errors are redacted and audit logs contain neither tokens nor food data', async () => {
  const brokenRepository = new FixtureRepository()
  brokenRepository.overview = async () => { throw new Error('postgres://private-password@secret-host') }
  const broken = new AnalysisService(brokenRepository, 'Asia/Taipei', clock)
  const brokenApp = createAnalysisHandler({ service: broken, origin: 'http://127.0.0.1:3001', clients, clock, audit: (event) => logs.push(event) })
  try {
    const response = await brokenApp.fetch(new Request('http://127.0.0.1:3001/api/analysis/v1/overview', { headers: { Authorization: `Bearer ${token}` } }))
    assert.equal(response.status, 503)
    assert.doesNotMatch(await response.text(), /private-password|secret-host/)
  } finally { await brokenApp.close() }
  const logText = JSON.stringify(logs)
  assert.doesNotMatch(logText, new RegExp(token))
  assert.doesNotMatch(logText, /snapshot food|private-password|secret-host/)
  assert.ok(logs.some((log) => log.event === 'analysis_tool' && log.client_id === 'codex'))
})
