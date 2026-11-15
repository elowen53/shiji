import { addDays } from './date.js'

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
