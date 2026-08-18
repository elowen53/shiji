import { addDays } from '@/lib/date'

/** 趋势图数据工具：体重 / 腰围等指标共用 */

export interface TrendPoint {
  /** YYYY-MM-DD */
  date: string
  value: number
}

export interface TrendChartPoint extends TrendPoint {
  /** 7 个日历日移动平均；null 表示窗口内尚未积累 3 条记录 */
  ma: number | null
}

export interface WeeklyTrendSummary {
  /** 最近 7 个日历日的平均值 */
  currentAverage: number
  /** 前一个 7 个日历日的平均值；无数据时为 null */
  previousAverage: number | null
  /** 最近 7 日均值 - 前 7 日均值 */
  change: number | null
  /** 每周变化百分比，以前 7 日均值为基准 */
  changePercent: number | null
  currentCount: number
  previousCount: number
}

function roundedAverage(points: TrendPoint[]): number {
  const value = points.reduce((sum, point) => sum + point.value, 0) / points.length
  return Math.round(value * 100) / 100
}

/** 7 日移动平均：按日历日取当前日期及之前 6 天；窗口内至少 3 条记录才绘制。 */
export function withMovingAverage(points: TrendPoint[]): TrendChartPoint[] {
  return points.map((point) => {
    const startDate = addDays(point.date, -6)
    const window = points.filter(
      (candidate) => candidate.date >= startDate && candidate.date <= point.date,
    )
    return {
      ...point,
      ma: window.length >= 3 ? roundedAverage(window) : null,
    }
  })
}

/**
 * 以最新一次称重日期为终点，比较最近 7 个日历日与之前 7 个日历日的均值。
 * 这样不会因为漏称一天而把更早的记录误算进“7 日”。
 */
export function getWeeklyTrendSummary(points: TrendPoint[]): WeeklyTrendSummary | null {
  const latest = points.at(-1)
  if (!latest) return null

  const currentStart = addDays(latest.date, -6)
  const previousStart = addDays(latest.date, -13)
  const previousEnd = addDays(latest.date, -7)
  const current = points.filter(
    (point) => point.date >= currentStart && point.date <= latest.date,
  )
  const previous = points.filter(
    (point) => point.date >= previousStart && point.date <= previousEnd,
  )

  const currentAverage = roundedAverage(current)
  if (previous.length === 0) {
    return {
      currentAverage,
      previousAverage: null,
      change: null,
      changePercent: null,
      currentCount: current.length,
      previousCount: 0,
    }
  }

  const previousAverage = roundedAverage(previous)
  const change = Math.round((currentAverage - previousAverage) * 100) / 100
  const changePercent =
    previousAverage === 0
      ? null
      : Math.round((change / previousAverage) * 10000) / 100

  return {
    currentAverage,
    previousAverage,
    change,
    changePercent,
    currentCount: current.length,
    previousCount: previous.length,
  }
}
