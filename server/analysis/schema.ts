import { createHash } from 'node:crypto'
import { z } from 'zod'
import { AnalysisError } from './errors.js'

export const MAX_RANGE_DAYS = 366
const DAY_MS = 86_400_000

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const time = Date.parse(`${value}T00:00:00Z`)
  return value >= '1900-01-01' && Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}, 'Expected a real date on or after 1900-01-01 (YYYY-MM-DD).')

export const rangeSchema = z.strictObject({ from: dateSchema, to: dateSchema })
export const summarySchema = rangeSchema.extend({ group_by: z.enum(['period', 'week', 'month']).default('period') })
export const entriesSchema = rangeSchema.extend({
  food_name: z.string().trim().min(1).max(100).optional(),
  limit: z.number().int().min(1).max(200).default(100),
  cursor: z.string().min(1).max(1024).optional(),
})
export const targetsSchema = z.strictObject({ as_of: dateSchema.optional() })
export const emptySchema = z.strictObject({})

export type DateRange = z.infer<typeof rangeSchema>
export type SummaryQuery = z.infer<typeof summarySchema>
export type EntriesQuery = z.infer<typeof entriesSchema>

export function addCalendarDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

export function calendarDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1
}

export function dateInTimezone(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find((item) => item.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function validateRange(range: DateRange, today: string): DateRange {
  if (range.from > range.to || calendarDays(range.from, range.to) > MAX_RANGE_DAYS || range.to > today) {
    throw new AnalysisError(400, 'INVALID_RANGE', `Use an inclusive range of 1–${MAX_RANGE_DAYS} days ending no later than ${today}.`)
  }
  return range
}

const cursorSchema = z.strictObject({ v: z.literal(1), date: dateSchema, id: z.uuid(), filter: z.string().length(64) })
export type EntryCursor = z.infer<typeof cursorSchema>
const filterHash = (query: EntriesQuery) => createHash('sha256')
  .update(JSON.stringify([query.from, query.to, query.food_name ?? null])).digest('hex')

export function encodeCursor(row: { entry_date: string; id: string }, query: EntriesQuery): string {
  return Buffer.from(JSON.stringify({ v: 1, date: row.entry_date, id: row.id, filter: filterHash(query) })).toString('base64url')
}

export function decodeCursor(query: EntriesQuery): EntryCursor | null {
  if (!query.cursor) return null
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(query.cursor)) throw new Error('encoding')
    const cursor = cursorSchema.parse(JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')))
    if (cursor.filter !== filterHash(query) || cursor.date < query.from || cursor.date > query.to) throw new Error('filter')
    return cursor
  } catch {
    throw new AnalysisError(400, 'INVALID_CURSOR', 'Cursor is invalid or belongs to a different query.')
  }
}
