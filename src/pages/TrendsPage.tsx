import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
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
import { useWeightTrend, type WeightPoint } from '@/hooks/useWeightTrend'
import { addDays, formatDisplay, todayKey } from '@/lib/date'
import { fmtMacro } from '@/lib/format'

type RangeKey = '30d' | '90d' | 'all'

const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '30d', label: '30天', days: 30 },
  { key: '90d', label: '90天', days: 90 },
  { key: 'all', label: '全部', days: null },
]

const ACCENT = '#007AFF'

/** X 轴标签："2026-07-17" → "7/17" */
const fmtX = (date: string) =>
  `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`

/** 悬浮提示：iOS 风格深色小胶囊 */
function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: WeightPoint }[]
}) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0]?.payload
  if (!p) return null
  return (
    <div className="tnum rounded-lg bg-[#1C1C1E]/90 px-2.5 py-1.5 text-[12px] font-medium text-white shadow-lg">
      {formatDisplay(p.date)} · {fmtMacro(p.weight)} kg
    </div>
  )
}

export default function TrendsPage() {
  const { points, loading, error, refresh } = useWeightTrend()
  const [range, setRange] = useState<RangeKey>('30d')

  const days = RANGES.find((r) => r.key === range)?.days ?? null

  /** 前端按区间过滤（切换分段不重复请求） */
  const filtered = useMemo(() => {
    if (days == null) return points
    const cutoff = addDays(todayKey(), -(days - 1))
    return points.filter((p) => p.date >= cutoff)
  }, [points, days])

  const latest = points.length > 0 ? points[points.length - 1] : undefined
  const prev = points.length > 1 ? points[points.length - 2] : undefined
  const delta =
    latest && prev ? Math.round((latest.weight - prev.weight) * 10) / 10 : null

  return (
    <div className="flex h-full flex-col">
      <header className="safe-top shrink-0 px-4 pb-2 pt-2">
        <h1 className="mt-1 text-[34px] font-bold leading-tight tracking-tight text-[#1C1C1E]">
          体重趋势
        </h1>
      </header>

      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[110px]">
        {loading ? (
          <>
            <div className="ios-card mb-4 animate-pulse px-4 py-4">
              <div className="mb-2 h-10 w-28 rounded bg-[#E5E5EA]" />
              <div className="h-3 w-20 rounded bg-[#E5E5EA]" />
            </div>
            <div className="ios-card animate-pulse px-4 py-4">
              <div className="h-[240px] rounded-xl bg-[#E5E5EA]" />
            </div>
          </>
        ) : error ? (
          <div className="ios-card px-4 py-10 text-center">
            <p className="mb-4 text-[15px] text-[#8E8E93]">加载失败:{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-full bg-[#007AFF] px-5 py-2 text-[15px] font-medium text-white active:bg-[#0066D6]"
            >
              重试
            </button>
          </div>
        ) : points.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="mb-4 text-[52px] leading-none">⚖️</div>
            <div className="mb-1 text-[17px] font-semibold text-[#1C1C1E]">
              还没有体重记录
            </div>
            <div className="text-[14px] text-[#8E8E93]">
              去「记录」页点今日指标，添加今天的体重
            </div>
          </div>
        ) : (
          <>
            {/* 最新体重 */}
            {latest && (
              <section className="ios-card mb-4 px-4 py-4">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="tnum text-[40px] font-bold leading-none tracking-tight text-[#1C1C1E]">
                      {fmtMacro(latest.weight)}
                      <span className="ml-1 text-[16px] font-normal text-[#8E8E93]">
                        kg
                      </span>
                    </div>
                    <div className="mt-1.5 text-[13px] text-[#8E8E93]">
                      {formatDisplay(latest.date)} 记录
                    </div>
                  </div>
                  {delta != null && delta !== 0 && (
                    <div
                      className="tnum mb-1 text-[14px] font-medium"
                      style={{ color: delta > 0 ? '#FF3B30' : '#34C759' }}
                    >
                      较上次 {delta > 0 ? '+' : ''}
                      {delta.toFixed(1)} kg
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 区间分段控件 */}
            <div className="mb-4 flex rounded-full bg-[#E5E5EA] p-[3px]">
              {RANGES.map((r) => {
                const selected = range === r.key
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRange(r.key)}
                    className="relative h-8 flex-1 rounded-full text-[13px] font-medium"
                    style={{ minHeight: 32 }}
                  >
                    {selected && (
                      <motion.span
                        layoutId="range-pill"
                        className="absolute inset-0 rounded-full bg-white shadow-sm"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      />
                    )}
                    <span
                      className={`relative z-10 ${
                        selected ? 'text-[#1C1C1E]' : 'text-[#8E8E93]'
                      }`}
                    >
                      {r.label}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* 折线图 */}
            <section className="ios-card px-2 py-4">
              {filtered.length === 0 ? (
                <div className="py-16 text-center text-[14px] text-[#8E8E93]">
                  该区间暂无体重记录
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart
                    data={filtered}
                    margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ACCENT} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke="rgba(60, 60, 67, 0.08)"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={fmtX}
                      tick={{ fontSize: 11, fill: '#8E8E93' }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={36}
                    />
                    <YAxis
                      domain={[
                        (dataMin: number) => Math.floor(dataMin - 1),
                        (dataMax: number) => Math.ceil(dataMax + 1),
                      ]}
                      tick={{ fontSize: 11, fill: '#8E8E93' }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                      tickFormatter={(v: number) => v.toFixed(1)}
                    />
                    <Tooltip
                      content={<TrendTooltip />}
                      cursor={{ stroke: 'rgba(60,60,67,0.2)', strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="weight"
                      stroke="none"
                      fill="url(#weightFill)"
                    />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke={ACCENT}
                      strokeWidth={2}
                      dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }}
                      activeDot={{ r: 4.5, fill: ACCENT, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
