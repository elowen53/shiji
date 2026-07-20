import type { DailyMetric, Entry } from '@/types'

/** RFC 4180 字段转义：含逗号 / 引号 / 换行时加双引号并双写内部引号 */
function esc(field: string): string {
  if (/[",\r\n]/.test(field)) {
    return '"' + field.replace(/"/g, '""') + '"'
  }
  return field
}

/** 数字输出：不带千分位，最多 digits 位小数并去尾零；空值为空字符串 */
function num(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return ''
  return v.toFixed(digits).replace(/\.?0+$/, '')
}

function toCsv(rows: string[][]): string {
  // UTF-8 BOM：否则 Excel 打开中文乱码
  return '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n')
}

export interface DailySummaryDay {
  date: string
  intakeKcal: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
  weightKg: number | null
  waistCm: number | null
  burnKcal: number | null
  netKcal: number | null
}

/** 按天聚合 entries，join daily_metrics；只保留有数据的日期，升序 */
export function summarizeDays(entries: Entry[], metrics: DailyMetric[]): DailySummaryDay[] {
  const intake = new Map<string, { kcal: number; protein: number; fat: number; carbs: number }>()
  for (const e of entries) {
    const agg = intake.get(e.entry_date) ?? { kcal: 0, protein: 0, fat: 0, carbs: 0 }
    agg.kcal += e.kcal
    agg.protein += e.protein
    agg.fat += e.fat
    agg.carbs += e.carbs
    intake.set(e.entry_date, agg)
  }
  const metricByDate = new Map(metrics.map((m) => [m.entry_date, m]))
  const dates = [...new Set([...intake.keys(), ...metricByDate.keys()])].sort()

  const days: DailySummaryDay[] = []
  for (const date of dates) {
    const agg = intake.get(date)
    const m = metricByDate.get(date)
    const hasMetric = m != null && (m.weight_kg != null || m.waist_cm != null || m.burn_kcal != null)
    if (!agg && !hasMetric) continue // 该日期无任何数据（如被清除过）
    const burn = m?.burn_kcal ?? null
    days.push({
      date,
      intakeKcal: agg ? agg.kcal : null,
      protein: agg ? agg.protein : null,
      fat: agg ? agg.fat : null,
      carbs: agg ? agg.carbs : null,
      weightKg: m?.weight_kg ?? null,
      waistCm: m?.waist_cm ?? null,
      burnKcal: burn,
      netKcal: agg != null && burn != null ? agg.kcal - burn : null,
    })
  }
  return days
}

/** 每日汇总 CSV：一行一天 */
export function buildDailySummaryCsv(entries: Entry[], metrics: DailyMetric[]): string {
  const header = [
    '日期',
    '摄入热量(千卡)',
    '蛋白质(g)',
    '脂肪(g)',
    '碳水(g)',
    '体重(kg)',
    '腰围(cm)',
    '总消耗(千卡)',
    '净摄入(千卡)',
  ]
  const rows = summarizeDays(entries, metrics).map((d) => [
    d.date,
    num(d.intakeKcal),
    num(d.protein),
    num(d.fat),
    num(d.carbs),
    num(d.weightKg),
    num(d.waistCm),
    num(d.burnKcal),
    num(d.netKcal),
  ])
  return toCsv([header, ...rows])
}

/** 饮食明细 CSV：一行一条记录（调用方需已按日期+创建时间升序传入） */
export function buildEntriesCsv(entries: Entry[]): string {
  const header = [
    '日期',
    '食物',
    '单位',
    '数量',
    '热量(千卡)',
    '蛋白质(g)',
    '脂肪(g)',
    '碳水(g)',
  ]
  const rows = entries.map((e) => [
    e.entry_date,
    e.food_name,
    e.unit,
    num(e.quantity, 2),
    num(e.kcal),
    num(e.protein),
    num(e.fat),
    num(e.carbs),
  ])
  return toCsv([header, ...rows])
}

/** 触发浏览器下载（iOS Safari 会存入「文件」App，属预期行为） */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
