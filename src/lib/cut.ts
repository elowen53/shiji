import { addDays } from './date.js'
import type { TrendPoint } from './trend.js'

/** 减脂期进度判断：变化速率、减脂节奏、体重 × 腰围信号、蛋白质达标 */

export interface RateOptions {
  /** 回归窗口：以最新一条记录为终点的日历天数 */
  windowDays: number
  /** 窗口内至少多少条记录才估算速率 */
  minPoints: number
  /** 窗口内首末记录至少相隔多少天才估算速率 */
  minSpanDays: number
}

/** 体重每天称，两周窗口足够；至少 4 次、跨满一周，避免两三个点决定斜率 */
export const WEIGHT_RATE: RateOptions = { windowDays: 14, minPoints: 4, minSpanDays: 7 }
/** 腰围量得少、变化慢，用四周窗口 */
export const WAIST_RATE: RateOptions = { windowDays: 28, minPoints: 3, minSpanDays: 14 }

export interface RateSummary {
  latest: TrendPoint
  /** 最近 7 个日历日（以最新记录为终点）的均值与记录数 */
  average: number
  averageCount: number
  windowDays: number
  /** 回归窗口内的记录数 */
  count: number
  /** 回归窗口内首末记录相隔的天数 */
  spanDays: number
  /** 每周变化（原单位 / 周）；记录不足时为 null */
  perWeek: number | null
  /** 每周变化率（%），以窗口内均值为基准 */
  percentPerWeek: number | null
}

const dayIndex = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}

const round2 = (v: number) => Math.round(v * 100) / 100
const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length

/**
 * 用窗口内全部记录做最小二乘回归，斜率 × 7 即每周变化。
 * 相比「最近 7 日均值 − 前 7 日均值」，漏称几天、两周称重次数不均时不会偏，
 * 单日的水分波动对结果的影响也更小。
 */
export function summarizeRate(points: TrendPoint[], options: RateOptions): RateSummary | null {
  const latest = points.at(-1)
  if (!latest) return null

  const recent = points.filter((p) => p.date >= addDays(latest.date, -6))
  const window = points.filter((p) => p.date >= addDays(latest.date, -(options.windowDays - 1)))
  const xs = window.map((p) => dayIndex(p.date))
  const ys = window.map((p) => p.value)
  const spanDays = xs[xs.length - 1] - xs[0]

  let perWeek: number | null = null
  let percentPerWeek: number | null = null
  if (window.length >= options.minPoints && spanDays >= options.minSpanDays) {
    const mx = mean(xs)
    const my = mean(ys)
    const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0)
    const sxy = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0)
    perWeek = round2((sxy / sxx) * 7)
    percentPerWeek = my === 0 ? null : round2((perWeek / my) * 100)
  }

  return {
    latest,
    average: round2(mean(recent.map((p) => p.value))),
    averageCount: recent.length,
    windowDays: options.windowDays,
    count: window.length,
    spanDays,
    perWeek,
    percentPerWeek,
  }
}

/** 减脂节奏：按每周体重变化率分档 */
export type CutPace = 'unknown' | 'rising' | 'flat' | 'slow' | 'ok' | 'fast'

/** 合适区间：每周 −0.5% ~ −1% 体重 */
export const PACE_OK_MIN = -1
export const PACE_OK_MAX = -0.5
/** 变化率高于此值视为没有在降 */
const PACE_FLAT = -0.25
const PACE_RISING = 0.1

export function assessCutPace(percentPerWeek: number | null): CutPace {
  if (percentPerWeek == null) return 'unknown'
  if (percentPerWeek > PACE_RISING) return 'rising'
  if (percentPerWeek > PACE_FLAT) return 'flat'
  if (percentPerWeek > PACE_OK_MAX) return 'slow'
  if (percentPerWeek >= PACE_OK_MIN) return 'ok'
  return 'fast'
}

/** 体重 × 腰围：减掉的是不是脂肪 */
export type CompositionSignal = 'unknown' | 'fat-loss' | 'weight-only' | 'recomp' | 'stalled'

/** 腰围每周变化小于 0.1 cm 视为没变（低于测量误差） */
const WAIST_FLAT = 0.1

export function assessComposition(
  weightPercentPerWeek: number | null,
  waistPerWeek: number | null,
): CompositionSignal {
  if (weightPercentPerWeek == null || waistPerWeek == null) return 'unknown'
  const weightDown = weightPercentPerWeek <= PACE_FLAT
  const waistDown = waistPerWeek <= -WAIST_FLAT
  if (weightDown) return waistDown ? 'fat-loss' : 'weight-only'
  return waistDown ? 'recomp' : 'stalled'
}

/** 放纵日之后体重里可能还带着水分的天数 */
export const CHEAT_WATER_DAYS = 3

/**
 * 最新一次称重是否还受放纵日影响：称重前 CHEAT_WATER_DAYS 天内有放纵日。
 * 晨起称重反映的是前一天及之前的饮食，所以称重当天的放纵日不算。
 */
export function hasRecentCheat(cheatDates: Iterable<string>, latestWeighDate: string): boolean {
  const from = addDays(latestWeighDate, -CHEAT_WATER_DAYS)
  for (const date of cheatDates) {
    if (date >= from && date < latestWeighDate) return true
  }
  return false
}

/** 摄入达到目标的 90% 记为达标 */
export const PROTEIN_HIT_RATIO = 0.9

export interface ProteinAdherence {
  /** 统计的日历天数（截至昨天） */
  windowDays: number
  /** 其中有饮食记录的天数 */
  loggedDays: number
  /** 达标天数；未设置目标或没有体重记录时为 null */
  hitDays: number | null
  /** 有记录日子的平均蛋白质（g） */
  avgProtein: number
  /** 平均每公斤体重摄入（g/kg）；没有体重记录时为 null */
  avgPerKg: number | null
}

/**
 * 最近 windowDays 个已结束日子的蛋白质达标情况。
 * 每天的目标 = 系数 × 当天或之前最近一次体重（当时还没称过重，就用最早的一次）。
 * 今天尚未结束、没有饮食记录的日子都不参与统计。
 */
export function summarizeProtein(
  proteinByDate: Map<string, number>,
  weights: TrendPoint[],
  gPerKg: number | null,
  today: string,
  windowDays: number,
): ProteinAdherence | null {
  let loggedDays = 0
  let hitDays = 0
  let proteinSum = 0
  let perKgSum = 0
  let i = 0
  for (let date = addDays(today, -windowDays); date < today; date = addDays(date, 1)) {
    while (i + 1 < weights.length && weights[i + 1].date <= date) i++
    const protein = proteinByDate.get(date)
    if (protein == null) continue
    loggedDays++
    proteinSum += protein
    const weight = weights[i]?.value
    if (!weight) continue
    perKgSum += protein / weight
    if (gPerKg != null && protein >= gPerKg * weight * PROTEIN_HIT_RATIO) hitDays++
  }
  if (loggedDays === 0) return null
  const hasWeight = weights.length > 0
  return {
    windowDays,
    loggedDays,
    hitDays: gPerKg != null && hasWeight ? hitDays : null,
    avgProtein: Math.round(proteinSum / loggedDays),
    avgPerKg: hasWeight ? round2(perKgSum / loggedDays) : null,
  }
}
