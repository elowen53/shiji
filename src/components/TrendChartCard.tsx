import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDisplay } from '@/lib/date'
import { fmtMacro } from '@/lib/format'
import type { TrendChartPoint } from '@/lib/trend'

/** 图表用色：引用语义 token（SVG 属性支持 CSS var） */
const ACCENT = 'rgb(var(--color-brand))'
const TICK_INK = 'rgb(var(--color-ink-2))'

/** X 轴标签："2026-07-17" → "7/17" */
const fmtX = (date: string) =>
  `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`

/** 悬浮提示：iOS 风格深色小胶囊，单日值与 7 日均线同显 */
function TrendTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean
  payload?: { payload: TrendChartPoint }[]
  unit?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0]?.payload
  if (!p) return null
  return (
    <div className="tnum rounded-lg bg-ink/90 px-3 py-2 text-[12px] font-medium text-white shadow-lg">
      {formatDisplay(p.date)} · {fmtMacro(p.value)} {unit}
      {p.ma != null && (
        <span className="text-white/70"> · 均值 {fmtMacro(p.ma)}</span>
      )}
    </div>
  )
}

interface TrendChartCardProps {
  /** 已按区间过滤、含均线的数据点 */
  data: TrendChartPoint[]
  /** 展示单位，如 "kg" / "cm" */
  unit: string
  /** 区间内无数据时的提示 */
  emptyText: string
}

/** 指标趋势卡：极简图例 + 单日细线淡点 + 7 日均线加粗（Apple 健康风格） */
export default function TrendChartCard({ data, unit, emptyText }: TrendChartCardProps) {
  return (
    <section className="ios-card px-2 py-4">
      {data.length === 0 ? (
        <div className="py-16 text-center text-[14px] text-ink-2">{emptyText}</div>
      ) : (
        <>
          {/* 极简图例 */}
          <div className="mb-1 flex items-center justify-end gap-4 px-3">
            <span className="flex items-center gap-1.5 text-[12px] text-ink-2">
              <span className="h-[3px] w-4 rounded-full bg-brand/40" />
              单日
            </span>
            <span className="flex items-center gap-1.5 text-[12px] text-ink-2">
              <span className="h-[3px] w-4 rounded-full bg-brand" />7 日均值
            </span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`metricFill-${unit}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(60, 60, 67, 0.08)" />
              <XAxis
                dataKey="date"
                tickFormatter={fmtX}
                tick={{ fontSize: 11, fill: TICK_INK }}
                axisLine={false}
                tickLine={false}
                minTickGap={36}
              />
              <YAxis
                domain={[
                  (dataMin: number) => Math.floor(dataMin - 1),
                  (dataMax: number) => Math.ceil(dataMax + 1),
                ]}
                tick={{ fontSize: 11, fill: TICK_INK }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <Tooltip
                content={<TrendTooltip unit={unit} />}
                cursor={{ stroke: 'rgba(60,60,67,0.2)', strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="none"
                fill={`url(#metricFill-${unit})`}
              />
              {/* 单日值：细线淡色小点 */}
              <Line
                type="monotone"
                dataKey="value"
                stroke={ACCENT}
                strokeOpacity={0.35}
                strokeWidth={1.5}
                dot={{ r: 2, fill: ACCENT, fillOpacity: 0.45, strokeWidth: 0 }}
                activeDot={{ r: 4, fill: ACCENT, strokeWidth: 0 }}
              />
              {/* 7 日移动平均：加粗主色 */}
              <Line
                type="monotone"
                dataKey="ma"
                stroke={ACCENT}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4.5, fill: ACCENT, strokeWidth: 0 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </section>
  )
}
