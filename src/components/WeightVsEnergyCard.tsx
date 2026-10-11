import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDisplay } from '@/lib/date'
import { fmtKcal, fmtMacro } from '@/lib/format'
import { KCAL_PER_KG, type ExpectedActualPoint, type ExpectedActualResult } from '@/lib/energy'

const ACTUAL = 'rgb(var(--color-brand))'
const EXPECTED = 'rgb(var(--color-ink-2))'
const TICK_INK = 'rgb(var(--color-ink-2))'

const fmtX = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`

/** 带符号的 kg：-1.24 → "−1.2" */
const signedKg = (v: number) => {
  const r = Math.round(v * 10) / 10
  if (r === 0) return '0'
  return `${r > 0 ? '+' : '−'}${fmtMacro(Math.abs(r))}`
}

/** 刻度：按数据范围选 0.25 / 0.5 / 1 kg 步长，并始终包含 0 */
function kgTicks(points: ExpectedActualPoint[]): number[] {
  const values = points.flatMap((p) => [p.expected, p.actual])
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const step = max - min <= 1.5 ? 0.25 : max - min <= 4 ? 0.5 : 1
  const lo = Math.floor(min / step) * step - (min % step === 0 ? step : 0)
  const hi = Math.ceil(max / step) * step + (max % step === 0 ? step : 0)
  const ticks: number[] = []
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks
}

const fmtTick = (v: number) => (v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v)}`)

/** 可信度足够时才给出解读：至少 14 天、完整记录 ≥ 70% */
const MIN_SPAN = 14
const MIN_COVERAGE = 0.7

function insight(r: ExpectedActualResult): string {
  if (r.span < MIN_SPAN) {
    return `目前只有 ${r.span} 天，短期体重受水分、饮食钠含量影响较大，记录满 ${MIN_SPAN} 天后对比更可靠`
  }
  if (r.coverage < MIN_COVERAGE) {
    return `完整记录只占 ${Math.round(r.coverage * 100)}%，缺记录的日子没有计入预期，预期变化会偏小，仅供参考`
  }
  const gap = r.actual - r.expected
  if (Math.abs(gap) < 0.3) return '实际变化与预期基本吻合，记录的摄入和消耗比较可信'
  const perDay = fmtKcal((Math.abs(gap) * KCAL_PER_KG) / r.span)
  return gap > 0
    ? `实际比预期重 ${fmtMacro(Math.abs(gap))} kg，相当于每天约 ${perDay} 千卡没被算进去：常见原因是手表高估了消耗，或有饮食漏记`
    : `实际比预期轻 ${fmtMacro(Math.abs(gap))} kg，相当于每天约 ${perDay} 千卡：可能是消耗被低估、份量记多了，或近期水分下降`
}

function CompareTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: ExpectedActualPoint }[]
}) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="tnum rounded-lg bg-ink/90 px-3 py-2 text-[12px] font-medium leading-5 text-white shadow-lg">
      <div>{formatDisplay(p.date)}</div>
      <div>预期 {signedKg(p.expected)} kg</div>
      <div>实际 {signedKg(p.actual)} kg</div>
    </div>
  )
}

interface WeightVsEnergyCardProps {
  result: ExpectedActualResult | null
}

/** 体重 × 热量收支：按热量推算的预期体重变化 vs 7 日均重的实际变化（同一 kg 轴） */
export default function WeightVsEnergyCard({ result }: WeightVsEnergyCardProps) {
  if (!result) {
    return (
      <section className="ios-card px-4 py-10 text-center">
        <div className="mb-1 text-[15px] font-semibold text-ink">体重记录还不够</div>
        <div className="text-[13px] text-ink-2">
          需要在区间内形成至少两个 7 日均重（每周称重 3 次以上），才能与热量收支对照
        </div>
      </section>
    )
  }

  const ticks = kgTicks(result.points)
  return (
    <section className="ios-card px-2 py-4">
      <div className="mb-3 grid grid-cols-3 px-1">
        {(
          [
            ['按热量预期', `${signedKg(result.expected)}`, 'kg'],
            ['实际（7 日均重）', `${signedKg(result.actual)}`, 'kg'],
            ['对照天数', String(result.span), '天'],
          ] as const
        ).map(([label, value, unit], i) => (
          <div key={label} className={`px-2 text-center ${i === 1 ? 'border-x border-brand/10' : ''}`}>
            <div className="text-[11px] text-ink-2">{label}</div>
            <div className="tnum mt-1 text-[18px] font-semibold text-ink">
              {value}
              <span className="ml-0.5 text-[11px] font-normal text-ink-2">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-1 flex items-center justify-end gap-4 px-3 text-[12px] text-ink-2">
        <span className="flex items-center gap-1.5">
          <svg width="16" height="4" aria-hidden="true">
            <line x1="0" y1="2" x2="16" y2="2" stroke={EXPECTED} strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          按热量预期
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full bg-brand" />实际
        </span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={result.points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(70, 88, 61, 0.1)" strokeDasharray="3 5" />
          <XAxis
            dataKey="date"
            tickFormatter={fmtX}
            tick={{ fontSize: 11, fill: TICK_INK }}
            axisLine={false}
            tickLine={false}
            minTickGap={36}
          />
          <YAxis
            domain={[ticks[0], ticks[ticks.length - 1]]}
            ticks={ticks}
            tick={{ fontSize: 11, fill: TICK_INK }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={fmtTick}
          />
          <Tooltip content={<CompareTooltip />} cursor={{ stroke: 'rgba(60,60,67,0.2)', strokeWidth: 1 }} />
          <ReferenceLine y={0} stroke={TICK_INK} strokeOpacity={0.5} />
          <Line
            type="monotone"
            dataKey="expected"
            stroke={EXPECTED}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4, fill: EXPECTED, strokeWidth: 0 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke={ACTUAL}
            strokeWidth={2.5}
            dot={{ r: 2.5, fill: ACTUAL, strokeWidth: 0 }}
            activeDot={{ r: 4.5, fill: ACTUAL, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="mx-3 mt-2 rounded-xl bg-grouped px-3 py-2 text-[12px] leading-5 text-ink">{insight(result)}</p>
      <p className="mt-2 px-3 text-[11px] leading-4 text-ink-2">
        预期 = 累计收支 ÷ {KCAL_PER_KG.toLocaleString('en-US')} 千卡/kg，实际 = 7 日均重，两者都按 7 日平均、从起点算变化。两者长期的差距比单日波动更有参考价值
      </p>
    </section>
  )
}
