/** 趋势图数据工具：体重 / 腰围等指标共用 */

export interface TrendPoint {
  /** YYYY-MM-DD */
  date: string
  value: number
}

export interface TrendChartPoint extends TrendPoint {
  /** 7 日移动平均；null 表示尚未积累 3 条记录 */
  ma: number | null
}

/** 7 日移动平均：每个点取该点及之前最多 7 条均值；第 3 条记录起才绘制 */
export function withMovingAverage(points: TrendPoint[]): TrendChartPoint[] {
  return points.map((p, i) => {
    if (i < 2) return { ...p, ma: null }
    const start = Math.max(0, i - 6)
    const slice = points.slice(start, i + 1)
    const ma = slice.reduce((s, x) => s + x.value, 0) / slice.length
    return { ...p, ma: Math.round(ma * 100) / 100 }
  })
}
