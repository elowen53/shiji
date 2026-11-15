import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  WAIST_RATE,
  WEIGHT_RATE,
  assessComposition,
  assessCutPace,
  hasRecentCheat,
  summarizeProtein,
  summarizeRate,
} from '../src/lib/cut'
import { addDays } from '../src/lib/date'
import { buildDailyBalances, buildExpectedVsActual, summarizeBalances, toBalanceChart } from '../src/lib/energy'
import { withMovingAverage } from '../src/lib/trend'

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

test('放纵日按估算盈余计入收支，不看当天记了什么', () => {
  const intake = new Map([
    ['2026-11-01', 1800],
    ['2026-11-02', 1700],
    ['2026-11-03', 300], // 放纵日只记了早餐
    ['2026-11-05', 1900],
    ['2026-11-06', 500], // 今天
  ])
  const burn = new Map([
    ['2026-11-01', 2300],
    ['2026-11-02', 2200],
    ['2026-11-03', 2400],
    ['2026-11-05', 2400],
    ['2026-11-06', 2000],
  ])
  const cheat = new Map([
    ['2026-11-03', 1000],
    ['2026-11-04', 1500], // 什么都没记，也没有总消耗
    ['2026-11-06', 1000], // 今天还没结束
  ])
  const balances = buildDailyBalances(intake, burn, '2026-11-06', cheat)
  assert.deepEqual(
    balances.map((b) => [b.date, b.balance, b.estimated]),
    [
      ['2026-11-01', -500, false],
      ['2026-11-02', -500, false],
      ['2026-11-03', 1000, true],
      ['2026-11-04', 1500, true],
      ['2026-11-05', -500, false],
    ],
  )
  assert.equal(balances[2].intake, null)
  assert.equal(balances[2].burn, 2400)
  assert.equal(balances[3].burn, null)
  // 不传放纵日时行为不变
  assert.equal(buildDailyBalances(intake, burn, '2026-11-06').length, 4)

  const summary = summarizeBalances(balances)!
  assert.equal(summary.days, 5)
  assert.equal(summary.total, 1000)
  assert.equal(summary.estimatedDays, 2)
  assert.equal(summary.estimatedTotal, 2500)
  // 记录日平均缺口 500 → 2500 千卡盈余抵掉 5 天
  assert.equal(summary.offsetDays, 5)
  assert.equal(summarizeBalances(balances.filter((b) => !b.estimated))!.offsetDays, null)

  const chart = toBalanceChart(balances)
  assert.deepEqual(chart.map((p) => p.estimated), [false, false, true, true, false])
  assert.equal(chart[4].ma, 200)
})

test('预期体重变化包含放纵日的估算盈余', () => {
  const weights = withMovingAverage(series('2026-11-01', Array.from({ length: 10 }, () => 80)))
  const days = (cheat: Map<string, number>) =>
    buildDailyBalances(
      new Map(weights.map((w) => [w.date, 1730])),
      new Map(weights.map((w) => [w.date, 2500])),
      '2026-11-20',
      cheat,
    )
  const plain = buildExpectedVsActual(days(new Map()), weights, null)!
  const withCheat = buildExpectedVsActual(days(new Map([['2026-11-08', 1540]])), weights, null)!
  assert.equal(plain.estimatedDays, 0)
  assert.equal(withCheat.estimatedDays, 1)
  // 把 −770 的一天换成 +1540：累计少掉 2310 千卡的缺口 = 0.3 kg，再按 7 日窗口平滑
  assert.ok(withCheat.expected > plain.expected)
  assert.equal(withCheat.coverage, plain.coverage)
})

test('最新称重前 3 天内的放纵日才提示水分', () => {
  assert.equal(hasRecentCheat(['2026-11-12'], '2026-11-14'), true)
  assert.equal(hasRecentCheat(['2026-11-11'], '2026-11-14'), true)
  assert.equal(hasRecentCheat(['2026-11-10'], '2026-11-14'), false)
  // 称重当天才开始的放纵日还没反映到体重上
  assert.equal(hasRecentCheat(['2026-11-14'], '2026-11-14'), false)
  assert.equal(hasRecentCheat([], '2026-11-14'), false)
})

test('蛋白质达标不统计被排除的日子', () => {
  const protein = new Map([['2026-11-13', 150]])
  const weights = [{ date: '2026-11-01', value: 80 }]
  assert.equal(summarizeProtein(protein, weights, 2, '2026-11-15', 7)!.loggedDays, 1)
  assert.equal(summarizeProtein(new Map(), weights, 2, '2026-11-15', 7), null)
})
