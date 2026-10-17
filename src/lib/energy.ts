import { addDays } from './date.js'
import type { TrendChartPoint } from './trend.js'

/** 热量收支工具：每日缺口 / 盈余，以及与体重变化的对照 */

/** 1 kg 体重约等于 7700 千卡（常用近似） */
export const KCAL_PER_KG = 7700

/** 一个「完整日」：当天既有饮食记录又有总消耗，且已经过去 */
export interface DailyBalance {
  date: string
  intake: number
  burn: number
  /** 摄入 − 消耗；负数为缺口，正数为盈余 */
  balance: number
}

/** 柱状图数据：按日历日连续，缺数据的日子 balance 为 null（留空而不是当作 0） */
export interface BalanceChartPoint {
  date: string
  balance: number | null
  intake: number | null
  burn: number | null
  /** 7 个日历日内完整日的平均收支；窗口内不足 3 个完整日为 null */
  ma: number | null
}

export interface BalanceSummary {
  /** 区间内完整日数 */
  days: number
  /** 区间日历天数（从区间起点或首个完整日到最后一个完整日） */
  span: number
  avg: number
  total: number
}

export interface ExpectedActualPoint {
  /** 称重日 */
  date: string
  /** 按热量推算的体重变化（kg），与实际值做同样的 7 日平滑 */
  expected: number
  /** 7 日均重 − 起点 7 日均重（kg） */
  actual: number
}

export interface ExpectedActualResult {
  points: ExpectedActualPoint[]
  /** 最后一次称重时的预期 / 实际变化（kg） */
  expected: number
  actual: number
  /** 起点到最后一次称重的天数 */
  span: number
  /** 这段时间内完整日占比（0–1） */
  coverage: number
}

const daysBetween = (from: string, to: string) => {
  let n = 0
  for (let d = from; d < to; d = addDays(d, 1)) n++
  return n
}

/**
 * 合并每日摄入与消耗，只保留两者都有、且早于 today 的日子。
 * 当天尚未结束，摄入不完整，不参与统计。
 */
export function buildDailyBalances(
  intakeByDate: Map<string, number>,
  burnByDate: Map<string, number>,
  today: string,
): DailyBalance[] {
  const out: DailyBalance[] = []
  for (const [date, burn] of burnByDate) {
    const intake = intakeByDate.get(date)
    if (intake == null || date >= today) continue
    out.push({ date, intake, burn, balance: intake - burn })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** 按日历日展开为图表数据，附 7 日平均（窗口内完整日 ≥ 3 才计算） */
export function toBalanceChart(balances: DailyBalance[]): BalanceChartPoint[] {
  if (balances.length === 0) return []
  const byDate = new Map(balances.map((b) => [b.date, b]))
  const last = balances[balances.length - 1].date
  const out: BalanceChartPoint[] = []
  for (let d = balances[0].date; d <= last; d = addDays(d, 1)) {
    const b = byDate.get(d)
    const start = addDays(d, -6)
    const window = balances.filter((x) => x.date >= start && x.date <= d)
    out.push({
      date: d,
      balance: b?.balance ?? null,
      intake: b?.intake ?? null,
      burn: b?.burn ?? null,
      ma:
        window.length >= 3
          ? Math.round(window.reduce((s, x) => s + x.balance, 0) / window.length)
          : null,
    })
  }
  return out
}

export function summarizeBalances(balances: DailyBalance[]): BalanceSummary | null {
  if (balances.length === 0) return null
  const total = balances.reduce((s, b) => s + b.balance, 0)
  return {
    days: balances.length,
    span: daysBetween(balances[0].date, balances[balances.length - 1].date) + 1,
    avg: total / balances.length,
    total,
  }
}

/**
 * 预期 vs 实际体重变化，只在有 7 日均重的称重日取点。
 *
 * 某天早上的体重反映的是前一天及之前的收支，所以称重日 d 的「预期体重」= 截至 d 前一天的累计收支 ÷ 7700。
 * 7 日均重是滞后的平均值（窗口内点数不同，滞后也不同），因此预期值也按同一窗口、同一批称重日取平均，
 * 两条线才可比：若体重完全按 7700 规则变化，两者会重合。
 * 缺记录的日子不计入累计（会让预期偏小，用 coverage 提示）。
 */
export function buildExpectedVsActual(
  balances: DailyBalance[],
  weights: TrendChartPoint[],
  cutoff: string | null,
): ExpectedActualResult | null {
  const smoothed = weights.filter((w) => w.ma != null && (cutoff == null || w.date >= cutoff))
  if (smoothed.length < 2) return null

  // 每个称重日之前的累计收支（kg），balances 已按日期升序
  const predicted = new Map<string, number>()
  let cum = 0
  let i = 0
  for (const w of weights) {
    while (i < balances.length && balances[i].date < w.date) cum += balances[i++].balance
    predicted.set(w.date, cum / KCAL_PER_KG)
  }
  /** 与 withMovingAverage 相同的窗口：当天及之前 6 个日历日内的称重日 */
  const smoothPredicted = (date: string) => {
    const start = addDays(date, -6)
    const window = weights.filter((w) => w.date >= start && w.date <= date)
    return window.reduce((s, w) => s + predicted.get(w.date)!, 0) / window.length
  }

  const base = smoothed[0]
  const last = smoothed[smoothed.length - 1]
  const baseExpected = smoothPredicted(base.date)
  const round = (v: number) => Math.round(v * 100) / 100
  const points: ExpectedActualPoint[] = smoothed.map((w) => ({
    date: w.date,
    expected: round(smoothPredicted(w.date) - baseExpected),
    actual: round(w.ma! - base.ma!),
  }))

  const span = daysBetween(base.date, last.date)
  const covered = balances.filter((b) => b.date >= base.date && b.date < last.date).length
  const end = points[points.length - 1]
  return {
    points,
    expected: end.expected,
    actual: end.actual,
    span,
    coverage: span > 0 ? covered / span : 0,
  }
}
