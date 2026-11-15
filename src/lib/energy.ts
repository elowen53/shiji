import { addDays } from './date.js'
import type { TrendChartPoint } from './trend.js'

/** 热量收支工具：每日缺口 / 盈余，以及与体重变化的对照 */

/** 1 kg 体重约等于 7700 千卡（常用近似） */
export const KCAL_PER_KG = 7700

/** 放纵日的估算盈余档位（千卡，相对当天总消耗）；默认取中档 */
export const CHEAT_SURPLUS_LEVELS = [500, 1000, 1500] as const
export const DEFAULT_CHEAT_SURPLUS = 1000

/**
 * 计入收支的一天：已经过去，且要么既有饮食记录又有总消耗（完整日），
 * 要么被标记为放纵日（没法记录热量，收支直接取估算盈余）。
 */
export interface DailyBalance {
  date: string
  /** 放纵日的摄入未知，为 null */
  intake: number | null
  /** 放纵日可以没有总消耗记录 */
  burn: number | null
  /** 摄入 − 消耗；负数为缺口，正数为盈余 */
  balance: number
  /** true：放纵日，balance 是估算盈余而不是记录值 */
  estimated: boolean
}

/** 柱状图数据：按日历日连续，缺数据的日子 balance 为 null（留空而不是当作 0） */
export interface BalanceChartPoint {
  date: string
  balance: number | null
  intake: number | null
  burn: number | null
  /** 放纵日：balance 为估算盈余 */
  estimated: boolean
  /** 7 个日历日内已计入日子的平均收支；窗口内不足 3 天为 null */
  ma: number | null
}

export interface BalanceSummary {
  /** 区间内计入的天数（完整日 + 放纵日） */
  days: number
  /** 区间日历天数（从区间起点或首个完整日到最后一个完整日） */
  span: number
  avg: number
  total: number
  /** 其中放纵日的天数与估算盈余合计 */
  estimatedDays: number
  estimatedTotal: number
  /**
   * 放纵日的估算盈余大约抵掉了多少个记录日的缺口；
   * 没有放纵日、或记录日平均没有缺口时为 null
   */
  offsetDays: number | null
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
  /** 这段时间内计入收支的日子占比（0–1） */
  coverage: number
  /** 这段时间内的放纵日天数（其收支为估算值） */
  estimatedDays: number
}

const daysBetween = (from: string, to: string) => {
  let n = 0
  for (let d = from; d < to; d = addDays(d, 1)) n++
  return n
}

/**
 * 合并每日摄入与消耗，只保留两者都有、且早于 today 的日子。
 * 当天尚未结束，摄入不完整，不参与统计。
 *
 * 放纵日（cheatByDate：日期 → 估算盈余）不看当天记了什么：聚餐没法记，零星记下的几条只会
 * 算出一个假缺口。收支直接取估算盈余（等价于「摄入 = 总消耗 + 盈余」），所以不要求有总消耗。
 */
export function buildDailyBalances(
  intakeByDate: Map<string, number>,
  burnByDate: Map<string, number>,
  today: string,
  cheatByDate: Map<string, number> = new Map(),
): DailyBalance[] {
  const out: DailyBalance[] = []
  for (const [date, surplus] of cheatByDate) {
    if (date >= today) continue
    out.push({ date, intake: null, burn: burnByDate.get(date) ?? null, balance: surplus, estimated: true })
  }
  for (const [date, burn] of burnByDate) {
    const intake = intakeByDate.get(date)
    if (intake == null || date >= today || cheatByDate.has(date)) continue
    out.push({ date, intake, burn, balance: intake - burn, estimated: false })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** 按日历日展开为图表数据，附 7 日平均（窗口内计入的日子 ≥ 3 才计算） */
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
      estimated: b?.estimated ?? false,
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
  const estimated = balances.filter((b) => b.estimated)
  const estimatedTotal = estimated.reduce((s, b) => s + b.balance, 0)
  const tracked = balances.length - estimated.length
  const trackedAvg = tracked > 0 ? (total - estimatedTotal) / tracked : 0
  return {
    days: balances.length,
    span: daysBetween(balances[0].date, balances[balances.length - 1].date) + 1,
    avg: total / balances.length,
    total,
    estimatedDays: estimated.length,
    estimatedTotal,
    offsetDays: estimated.length > 0 && trackedAvg < 0 ? estimatedTotal / -trackedAvg : null,
  }
}

/**
 * 预期 vs 实际体重变化，只在有 7 日均重的称重日取点。
 *
 * 某天早上的体重反映的是前一天及之前的收支，所以称重日 d 的「预期体重」= 截至 d 前一天的累计收支 ÷ 7700。
 * 7 日均重是滞后的平均值（窗口内点数不同，滞后也不同），因此预期值也按同一窗口、同一批称重日取平均，
 * 两条线才可比：若体重完全按 7700 规则变化，两者会重合。
 * 缺记录的日子不计入累计（会让预期偏小，用 coverage 提示）；放纵日按估算盈余计入。
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
  const inSpan = balances.filter((b) => b.date >= base.date && b.date < last.date)
  const covered = inSpan.length
  const end = points[points.length - 1]
  return {
    points,
    expected: end.expected,
    actual: end.actual,
    span,
    coverage: span > 0 ? covered / span : 0,
    estimatedDays: inSpan.filter((b) => b.estimated).length,
  }
}
