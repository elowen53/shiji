/** 日期工具：entry_date 统一用 YYYY-MM-DD 字符串，“今天”固定按北京时间计算 */

const BEIJING_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai',
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

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

/** 把一个时间点转换为对应的北京时间日期 */
export function toBeijingDateKey(d: Date): string {
  const parts = BEIJING_DATE_FORMATTER.formatToParts(d)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) throw new Error('无法获取北京时间')
  return `${year}-${month}-${day}`
}

export function todayKey(): string {
  return toBeijingDateKey(new Date())
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
