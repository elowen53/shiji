import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const eggId = '10000000-0000-4000-8000-000000000001'
const otherId = '10000000-0000-4000-8000-000000000002'
const ownerId = '20000000-0000-4000-8000-000000000001'
const sessionId = '30000000-0000-4000-8000-000000000001'
const migration = await readFile(new URL('../supabase/migrations/20261107130531_merge_food_entries.sql', import.meta.url), 'utf8')

interface SavedEntry {
  id: string
  entry_date: string
  food_id: string | null
  food_name: string
  unit: string
  quantity: string
  kcal: string
  protein: string
  fat: string
  carbs: string
  created_at: Date
}

async function add(quantity: number, overrides: {
  date?: string; foodId?: string | null; name?: string; unit?: string; kcal?: number
} = {}) {
  const result = await db.query<SavedEntry>(
    'select * from public.add_food_entry($1::date, $2::uuid, $3, $4, $5, $6, $7, $8, $9)',
    [overrides.date ?? '2026-11-07', overrides.foodId === undefined ? eggId : overrides.foodId,
      overrides.name ?? '鸡蛋', overrides.unit ?? '1个', quantity,
      (overrides.kcal ?? 72) * quantity, 6.3 * quantity, 4.8 * quantity, 0.4 * quantity],
  )
  assert.equal(result.rows.length, 1)
  return result.rows[0]
}

const entries = async () => (await db.query<SavedEntry>('select * from public.entries order by created_at, id')).rows
const totals = (row: SavedEntry) => [row.quantity, row.kcal, row.protein, row.fat, row.carbs].map(Number)

before(async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role shiji_analysis_reader nologin;
    create schema auth;
    create table auth.users(id uuid primary key, email text);
    create table auth.sessions(id uuid primary key, user_id uuid);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid(), auth.jwt() to authenticated;
    insert into auth.users values('${ownerId}', 'owner@shiji.local');
    insert into auth.sessions values('${sessionId}', '${ownerId}');
  `)
  await db.exec(await readFile(new URL('../setup.sql', import.meta.url), 'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/20261011_private_access.sql', import.meta.url), 'utf8'))
  await db.exec(migration)
  await db.exec(migration) // Reapplying must preserve the RPC and grants.
  await db.query(`insert into public.foods(id, name, unit) values ($1, '鸡蛋', '1个'), ($2, '鸡蛋', '1个')`, [eggId, otherId])
})

beforeEach(async () => {
  await db.exec(`reset role; delete from public.entries;
    select set_config('request.jwt.claim.sub', '${ownerId}', false);
    select set_config('request.jwt.claims', '{"session_id":"${sessionId}"}', false);
    set role authenticated;
  `)
})

after(async () => { await db.close() })

test('2 eggs followed by 3 eggs persists one row with 5 eggs and summed nutrition', async () => {
  const first = await add(2)
  const saved = await add(3)
  assert.equal(saved.id, first.id)
  assert.deepEqual(saved.created_at, first.created_at)
  assert.deepEqual(totals(saved), [5, 360, 31.5, 24, 2])
  assert.deepEqual(await entries(), [saved])
})

test('different dates, food IDs and units remain independent', async () => {
  await add(2)
  await add(3, { date: '2026-11-08' })
  await add(3, { foodId: otherId })
  await add(3, { unit: '100g' })
  assert.equal((await entries()).length, 4)
})

test('temporary entries with no food ID remain independent even when names match', async () => {
  await add(2)
  await add(2, { foodId: null })
  await add(3, { foodId: null })
  assert.equal((await entries()).length, 3)
})

test('food library edits do not recalculate old snapshots; renaming still merges by ID', async () => {
  const first = await add(2)
  await db.query('update public.foods set name = $1, kcal = 999 where id = $2', ['新鸡蛋', eggId])
  const saved = await add(3, { name: '新鸡蛋', kcal: 80 })
  assert.equal(saved.id, first.id)
  assert.equal(saved.food_name, first.food_name)
  assert.deepEqual(totals(saved), [5, 384, 31.5, 24, 2])
})

test('adding consolidates preexisting duplicate rows without losing their snapshots', async () => {
  const first = await add(2)
  await db.query(`insert into public.entries(entry_date, food_id, food_name, unit, quantity, kcal, protein, fat, carbs)
    values ('2026-11-07', $1, '鸡蛋', '1个', 3, 240, 18, 15, 1.5)`, [eggId])
  const saved = await add(1)
  assert.equal(saved.id, first.id)
  assert.deepEqual(totals(saved), [6, 456, 36.9, 29.4, 2.7])
  assert.deepEqual(await entries(), [saved])
})

test('fractional portions use exact numeric addition', async () => {
  await add(0.1)
  const saved = await add(0.2)
  assert.equal(Number(saved.quantity), 0.3)
  assert.equal((await entries()).length, 1)
})

test('multiple queued additions each contribute to the saved total', async () => {
  await Promise.all(Array.from({ length: 20 }, () => add(1)))
  const rows = await entries()
  assert.equal(rows.length, 1)
  assert.deepEqual(totals(rows[0]), [20, 1440, 126, 96, 8])
})

test('invalid quantities fail without changing saved data', async () => {
  const first = await add(2)
  for (const quantity of [0, -1, NaN, Infinity]) {
    await assert.rejects(add(quantity), /Quantity must be positive and finite/)
  }
  assert.deepEqual(await entries(), [first])
})

test('failed writes roll back consolidation, including deletion of duplicate rows', async () => {
  await add(2)
  await db.query(`insert into public.entries(entry_date, food_id, food_name, unit, quantity)
    values ('2026-11-07', $1, '鸡蛋', '1个', 3)`, [eggId])
  const original = await entries()
  await assert.rejects(db.query(`select * from public.add_food_entry('2026-11-07', $1, '鸡蛋', '1个', 1, null, 1, 1, 1)`, [eggId]), /null value/)
  assert.deepEqual(await entries(), original)
})

test('anonymous and analysis roles cannot invoke the write RPC', async () => {
  for (const role of ['anon', 'shiji_analysis_reader']) {
    await db.exec(`reset role; set role ${role}`)
    await assert.rejects(add(2), /permission denied/)
  }
})

test('other accounts and revoked owner sessions cannot write through the RPC', async () => {
  await db.exec(`select set_config('request.jwt.claim.sub', '${otherId}', false)`)
  await assert.rejects(add(2), /Access denied/)
  await db.exec(`select set_config('request.jwt.claim.sub', '${ownerId}', false);
    select set_config('request.jwt.claims', '{"session_id":"00000000-0000-4000-8000-000000000000"}', false);`)
  await assert.rejects(add(2), /Access denied/)
})
