import pg from 'pg'
import type { PoolClient } from 'pg'
import { AnalysisError } from './errors.js'
import type { DateRange, EntriesQuery, EntryCursor } from './schema.js'
import type { AnalysisRepository, DailyRow, EntryRow, OverviewRow, TargetsRow } from './types.js'

// Export fixed SQL so the integration tests execute the same queries on PostgreSQL.
export const READER_CHECK_SQL = `
  select current_user = 'shiji_analysis_reader'
    and not r.rolsuper and not r.rolbypassrls and not r.rolcreaterole
    and not r.rolcreatedb and not r.rolinherit and not r.rolreplication
    and current_setting('row_security') = 'on'
    and not exists (select 1 from pg_auth_members where member = r.oid)
    and not has_schema_privilege(current_user, 'public', 'CREATE')
    and not exists (
      select 1 from unnest(array['foods','entries','daily_metrics','macro_targets']) t(name)
      where not has_table_privilege(current_user, 'public.' || name, 'SELECT')
        or has_table_privilege(current_user, 'public.' || name, 'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES')
        or not exists (
          select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = name
            and p.policyname = 'analysis_reader_select' and p.cmd = 'SELECT'
            and p.roles @> array['shiji_analysis_reader']::name[]
        )
        or not exists (
          select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = name and c.relrowsecurity and c.relowner <> r.oid
        )
    ) as allowed
  from pg_roles r where r.rolname = current_user`

export const OVERVIEW_SQL = `
  select (select count(*)::int from public.foods) as food_count,
    (select count(*)::int from public.entries) as entry_count,
    (select count(*)::int from public.daily_metrics) as metric_count,
    (select count(distinct entry_date)::int from public.entries) as days_with_food_entries,
    (select count(*)::int from public.daily_metrics where weight_kg is not null) as days_with_weight,
    (select count(*)::int from public.daily_metrics where burn_kcal is not null) as days_with_burn,
    (select min(entry_date)::text from public.entries) as first_entry_date,
    (select max(entry_date)::text from public.entries) as last_entry_date,
    (select min(entry_date)::text from public.daily_metrics) as first_metric_date,
    (select max(entry_date)::text from public.daily_metrics) as last_metric_date`

export const DAILY_SQL = `
  with intake as (
    select entry_date, count(*)::int as entry_count,
      sum(kcal)::float8 as kcal, sum(protein)::float8 as protein,
      sum(fat)::float8 as fat, sum(carbs)::float8 as carbs
    from public.entries where entry_date between $1::date and $2::date group by entry_date
  ), metrics as (
    select entry_date, weight_kg::float8, waist_cm::float8, burn_kcal::float8
    from public.daily_metrics where entry_date between $1::date and $2::date
  )
  select coalesce(i.entry_date, m.entry_date)::text as entry_date,
    coalesce(i.entry_count, 0)::int as entry_count,
    i.kcal, i.protein, i.fat, i.carbs, m.weight_kg, m.waist_cm, m.burn_kcal
  from intake i full outer join metrics m using (entry_date)
  order by coalesce(i.entry_date, m.entry_date)`

export const ENTRIES_SQL = `
  select id::text, entry_date::text, food_id::text, food_name, unit,
    quantity::float8, kcal::float8, protein::float8, fat::float8, carbs::float8,
    to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at
  from public.entries
  where entry_date between $1::date and $2::date
    and ($3::text is null or food_name ilike $3 escape '\\')
    and ($4::date is null or (entry_date, id) > ($4::date, $5::uuid))
  order by entry_date, id limit $6::int`

export const TARGETS_SQL = `
  select protein_g_per_kg::float8, fat_g_per_kg::float8, carbs_g_per_kg::float8,
    to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as updated_at
  from public.macro_targets where id = 1`
export const WEIGHT_SQL = `
  select entry_date::text, weight_kg::float8 from public.daily_metrics
  where entry_date <= $1::date and weight_kg > 0 order by entry_date desc limit 1`

export function entriesParameters(query: EntriesQuery, cursor: EntryCursor | null): unknown[] {
  // A name is a literal substring, not a SQL LIKE pattern.
  const name = query.food_name ? `%${query.food_name.replace(/[\\%_]/g, '\\$&')}%` : null
  return [query.from, query.to, name, cursor?.date ?? null, cursor?.id ?? null, query.limit + 1]
}

export class PostgresAnalysisRepository implements AnalysisRepository {
  readonly pool: pg.Pool

  constructor(connectionString: string, ca?: string) {
    // Remove URL SSL overrides so certificate verification cannot be disabled by a URL option.
    const url = new URL(connectionString)
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl']) url.searchParams.delete(key)
    this.pool = new pg.Pool({
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: true, ...(ca ? { ca: ca.replace(/\\n/g, '\n') } : {}) },
      max: 2, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000,
      query_timeout: 10_000, application_name: 'shiji-analysis', allowExitOnIdle: true,
    })
    // Do not log connection errors: they may include database identifiers.
    this.pool.on('error', () => console.error(JSON.stringify({ event: 'analysis_pool_error' })))
  }

  private async read<T>(query: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    let broken = false
    try {
      await client.query('begin isolation level repeatable read read only')
      await client.query("set local statement_timeout = '5s'")
      await client.query("set local datestyle = 'ISO, YMD'")
      const check = await client.query<{ allowed: boolean }>(READER_CHECK_SQL)
      if (check.rows[0]?.allowed !== true) {
        throw new AnalysisError(503, 'UNSAFE_DATABASE_ROLE', 'Analysis database read-only permissions are not configured correctly.')
      }
      const result = await query(client)
      await client.query('commit')
      return result
    } catch (error) {
      try { await client.query('rollback') } catch { broken = true }
      throw error
    } finally {
      client.release(broken)
    }
  }

  overview(): Promise<OverviewRow> {
    return this.read(async (client) => (await client.query<OverviewRow>(OVERVIEW_SQL)).rows[0])
  }

  daily(range: DateRange): Promise<DailyRow[]> {
    return this.read(async (client) => (await client.query<DailyRow>(DAILY_SQL, [range.from, range.to])).rows)
  }

  entries(query: EntriesQuery, cursor: EntryCursor | null): Promise<EntryRow[]> {
    return this.read(async (client) => (await client.query<EntryRow>(ENTRIES_SQL, entriesParameters(query, cursor))).rows)
  }

  targets(asOf: string) {
    return this.read(async (client) => ({
      current: (await client.query<TargetsRow>(TARGETS_SQL)).rows[0] ?? null,
      weight: (await client.query<{ entry_date: string; weight_kg: number }>(WEIGHT_SQL, [asOf])).rows[0] ?? null,
    }))
  }
}
