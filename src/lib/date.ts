/** 本地时区日期工具：entry_date 统一用 YYYY-MM-DD 字符串 */

export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function todayKey(): string {
  return toDateKey(new Date())
}

export function addDays(key: string, delta: number): string {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + delta)
  return toDateKey(d)
}

/** "2025-01-08" → "1月8日" */
export function formatDisplay(key: string): string {
  const d = parseDateKey(key)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function weekdayLabel(key: string): string {
  return WEEKDAYS[parseDateKey(key).getDay()] ?? ''
}

export function isToday(key: string): boolean {
  return key === todayKey()
}
