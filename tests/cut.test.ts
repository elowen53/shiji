import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  WAIST_RATE,
  WEIGHT_RATE,
  assessComposition,
  assessCutPace,
  summarizeProtein,
  summarizeRate,
} from '../src/lib/cut'
import { addDays } from '../src/lib/date'

const series = (start: string, values: (number | null)[]) =>
  values.flatMap((value, i) => (value == null ? [] : [{ date: addDays(start, i), value }]))

test('每周变化按回归斜率估算，漏称不影响结果', () => {
  // 每天 −0.1 kg，中间漏称 5 天
  const values = Array.from({ length: 14 }, (_, i) => ([3, 4, 5, 9, 10].includes(i) ? null : 80 - i * 0.1))
  const rate = summarizeRate(series('2026-11-01', values), WEIGHT_RATE)!
  assert.equal(rate.perWeek, -0.7)
  assert.equal(rate.percentPerWeek, -0.88)
  assert.equal(rate.count, 9)
  assert.equal(rate.latest.date, '2026-11-14')
  // 最近 7 个日历日（11/8–11/14）里称了 5 次
  assert.equal(rate.averageCount, 5)
  assert.equal(rate.average, 78.98)
})

test('记录不足时不估算速率，但仍给出均值', () => {
  const few = summarizeRate(series('2026-11-01', [80, 79.8, 79.9]), WEIGHT_RATE)!
  assert.equal(few.perWeek, null)
  assert.equal(few.percentPerWeek, null)
  assert.equal(few.average, 79.9)
  // 4 次但只跨 3 天
  assert.equal(summarizeRate(series('2026-11-01', [80, 79, 78, 77]), WEIGHT_RATE)!.perWeek, null)
  assert.equal(summarizeRate([], WEIGHT_RATE), null)
})

test('只看窗口内的记录', () => {
  const old = series('2026-09-01', [90, 90, 90, 90])
  const recent = series('2026-11-01', Array.from({ length: 14 }, () => 80))
  assert.equal(summarizeRate([...old, ...recent], WEIGHT_RATE)!.perWeek, 0)
  // 腰围用四周窗口：每周量一次也能估算
  const waist = [0, 7, 14, 21].map((d, i) => ({ date: addDays('2026-11-01', d), value: 85 - i * 0.5 }))
  assert.equal(summarizeRate(waist, WAIST_RATE)!.perWeek, -0.5)
})

test('减脂节奏分档', () => {
  assert.equal(assessCutPace(null), 'unknown')
  assert.equal(assessCutPace(0.3), 'rising')
  assert.equal(assessCutPace(0), 'flat')
  assert.equal(assessCutPace(-0.3), 'slow')
  assert.equal(assessCutPace(-0.5), 'ok')
  assert.equal(assessCutPace(-1), 'ok')
  assert.equal(assessCutPace(-1.2), 'fast')
})

test('体重 × 腰围信号', () => {
  assert.equal(assessComposition(-0.7, -0.3), 'fat-loss')
  assert.equal(assessComposition(-0.7, 0), 'weight-only')
  assert.equal(assessComposition(0, -0.3), 'recomp')
  assert.equal(assessComposition(0.2, 0.2), 'stalled')
  assert.equal(assessComposition(null, -0.3), 'unknown')
  assert.equal(assessComposition(-0.7, null), 'unknown')
})

test('蛋白质达标：按当时体重算目标，排除今天和没记录的日子', () => {
  const today = '2026-11-15'
  const weights = [
    { date: '2026-11-01', value: 80 },
    { date: '2026-11-12', value: 70 },
  ]
  const protein = new Map([
    ['2026-11-08', 150], // 目标 160，≥ 90% → 达标
    ['2026-11-10', 140], // 目标 160，< 144 → 未达标
    ['2026-11-13', 130], // 体重已是 70，目标 140 → 达标
    ['2026-11-15', 999], // 今天不计
    ['2026-11-01', 999], // 窗口之外
  ])
  const week = summarizeProtein(protein, weights, 2, today, 7)!
  assert.deepEqual(week, { windowDays: 7, loggedDays: 3, hitDays: 2, avgProtein: 140, avgPerKg: 1.83 })

  assert.equal(summarizeProtein(protein, weights, null, today, 7)!.hitDays, null)
  const noWeight = summarizeProtein(protein, [], 2, today, 7)!
  assert.equal(noWeight.hitDays, null)
  assert.equal(noWeight.avgPerKg, null)
  assert.equal(summarizeProtein(new Map(), weights, 2, today, 7), null)
})
