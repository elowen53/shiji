import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDisplay } from '@/lib/date'
import { fmtKcal, fmtMacro } from '@/lib/format'
import { KCAL_PER_KG, type BalanceChartPoint, type BalanceSummary } from '@/lib/energy'

/** 图表用色：引用语义 token（SVG 属性支持 CSS var） */
const DEFICIT = 'rgb(var(--color-deficit))'
const SURPLUS = 'rgb(var(--color-surplus))'
const INK = 'rgb(var(--color-ink))'
const TICK_INK = 'rgb(var(--color-ink-2))'

const fmtX = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`

/** 带符号的千卡：-420 → "−420"，1250 → "+1,250" */
function signedKcal(v: number): string {
  const r = Math.round(v)
  if (r === 0) return '0'
  return `${r > 0 ? '+' : '−'}${Math.abs(r).toLocaleString('en-US')}`
}

/** 收支文字：负数为缺口，正数为盈余 */
function balanceLabel(v: number): string {
  const r = Math.round(v)
  if (r === 0) return '持平'
  return `${r < 0 ? '缺口' : '盈余'} ${Math.abs(r).toLocaleString('en-US')} 千卡`
}

/** 刻度：取 100 / 200 / 250 / 500 / 1000… 的整步长，并始终包含 0 */
function kcalTicks(data: BalanceChartPoint[]): number[] {
  const values = data.flatMap((p) => [p.balance ?? 0, p.ma ?? 0])
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const raw = (max - min) / 4 || 100
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((v) => v >= raw)!
  const ticks: number[] = []
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step; v += step) ticks.push(v)
  return ticks
}

function BalanceTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: BalanceChartPoint }[]
}) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="tnum rounded-lg bg-ink/90 px-3 py-2 text-[12px] font-medium leading-5 text-white shadow-lg">
      <div>{formatDisplay(p.date)}</div>
      {p.balance != null ? (
        <>
          <div>{balanceLabel(p.balance)}</div>
          <div className="text-white/70">
            摄入 {fmtKcal(p.intake!)} · 消耗 {fmtKcal(p.burn!)}
          </div>
        </>
      ) : (
        <div className="text-white/70">缺饮食或消耗记录</div>
      )}
      {p.ma != null && <div className="text-white/70">7 日均值 {signedKcal(p.ma)}</div>}
    </div>
  )
}

interface EnergyBalanceCardProps {
  data: BalanceChartPoint[]
  summary: BalanceSummary | null
}

/** 每日热量收支：以 0 为基线的发散柱（缺口向下、盈余向上）+ 7 日均值线 */
export default function EnergyBalanceCard({ data, summary }: EnergyBalanceCardProps) {
  if (!summary) {
    return (
      <section className="ios-card px-4 py-10 text-center">
        <div className="mb-1 text-[15px] font-semibold text-ink">该区间暂无完整的收支数据</div>
        <div className="text-[13px] text-ink-2">同一天既记录饮食、又在今日指标里填写总消耗，才能计算缺口</div>
      </section>
    )
  }

  const dense = data.length > 45
  const ticks = kcalTicks(data)
  return (
    <section className="ios-card px-2 py-4">
      <div className="mb-3 px-3">
        <div className="text-[12px] text-ink-2">平均每日</div>
        <div className="tnum mt-0.5 flex items-baseline gap-1.5">
          <span className="editorial-title text-[32px] leading-none text-ink">
            {Math.round(summary.avg) === 0 ? '持平' : Math.abs(Math.round(summary.avg)).toLocaleString('en-US')}
          </span>
          {Math.round(summary.avg) !== 0 && (
            <span className="text-[14px] text-ink-2">千卡{summary.avg < 0 ? '缺口' : '盈余'}</span>
          )}
        </div>
        <div className="tnum mt-1.5 text-[12px] text-ink-2">
          累计 {signedKcal(summary.total)} 千卡 ≈ {summary.total < 0 ? '−' : '+'}
          {fmtMacro(Math.abs(summary.total) / KCAL_PER_KG)} kg · 完整记录 {summary.days}/{summary.span} 天
        </div>
      </div>

      {/* 图例：颜色之外还有方向（基线上下）区分缺口与盈余 */}
      <div className="mb-1 flex items-center justify-end gap-3 px-3 text-[12px] text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-deficit" />缺口 ↓
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-surplus" />盈余 ↑
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[2px] w-4 rounded-full bg-ink" />7 日均值
        </span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} barCategoryGap={dense ? 1 : 2}>
          <CartesianGrid vertical={false} stroke="rgba(70, 88, 61, 0.1)" strokeDasharray="3 5" />
          <XAxis
            dataKey="date"
            tickFormatter={fmtX}
            tick={{ fontSize: 11, fill: TICK_INK }}
            axisLine={false}
            tickLine={false}
            minTickGap={36}
          />
          {/* 柱子必须从 0 起：全是缺口时也要把 0 纳入坐标范围 */}
          <YAxis
            domain={[ticks[0], ticks[ticks.length - 1]]}
            ticks={ticks}
            tick={{ fontSize: 11, fill: TICK_INK }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(v: number) => signedKcal(v)}
          />
          <Tooltip content={<BalanceTooltip />} cursor={{ fill: 'rgba(60,60,67,0.06)' }} />
          <ReferenceLine y={0} stroke={TICK_INK} strokeOpacity={0.5} />
          <Bar dataKey="balance" maxBarSize={14} radius={dense ? [1.5, 1.5, 0, 0] : [4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((p) => (
              <Cell key={p.date} fill={p.balance != null && p.balance > 0 ? SURPLUS : DEFICIT} />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="ma"
            stroke={INK}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: INK, strokeWidth: 0 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      <p className="mt-2 px-3 text-[11px] leading-4 text-ink-2">
        收支 = 当日摄入 − 总消耗。只统计已结束、且同时记录了饮食和总消耗的日子，缺记录的日子留空
      </p>
    </section>
  )
}
