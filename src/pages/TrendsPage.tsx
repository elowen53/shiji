import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Share } from 'lucide-react'
import ExportSheet from '@/components/ExportSheet'
import LatestStatCard from '@/components/LatestStatCard'
import TrendChartCard from '@/components/TrendChartCard'
import { useMetricTrend } from '@/hooks/useMetricTrend'
import { addDays, formatDisplay, todayKey } from '@/lib/date'
import { withMovingAverage, type TrendPoint } from '@/lib/trend'

type RangeKey = '30d' | '90d' | 'all'

const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '30d', label: '30天', days: 30 },
  { key: '90d', label: '90天', days: 90 },
  { key: 'all', label: '全部', days: null },
]

/** 最新值与较上次差值 */
function latestDelta(points: TrendPoint[]): { value: number; date: string; delta: number | null } | null {
  const latest = points.length > 0 ? points[points.length - 1] : undefined
  const prev = points.length > 1 ? points[points.length - 2] : undefined
  if (!latest) return null
  return {
    value: latest.value,
    date: latest.date,
    delta: prev ? Math.round((latest.value - prev.value) * 10) / 10 : null,
  }
}

export default function TrendsPage() {
  const weight = useMetricTrend('weight_kg')
  const waist = useMetricTrend('waist_cm')
  const [range, setRange] = useState<RangeKey>('30d')
  const [exportOpen, setExportOpen] = useState(false)

  const days = RANGES.find((r) => r.key === range)?.days ?? null

  /** 前端按区间过滤（切换分段不重复请求；均线先在全量序列上计算） */
  const filterByRange = (points: TrendPoint[]) => {
    const withMA = withMovingAverage(points)
    if (days == null) return withMA
    const cutoff = addDays(todayKey(), -(days - 1))
    return withMA.filter((p) => p.date >= cutoff)
  }

  const weightData = useMemo(() => filterByRange(weight.points), [weight.points, days])
  const waistData = useMemo(() => filterByRange(waist.points), [waist.points, days])

  const weightStat = latestDelta(weight.points)
  const waistStat = latestDelta(waist.points)

  const loading = weight.loading || waist.loading
  const error = weight.error ?? waist.error
  const bothEmpty = weight.points.length === 0 && waist.points.length === 0

  const retry = () => {
    void weight.refresh()
    void waist.refresh()
  }

  return (
    <div className="flex h-full flex-col">
      <header className="safe-top shrink-0 px-4 pb-2 pt-2">
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-[34px] font-bold leading-tight tracking-tight text-ink">
            趋势
          </h1>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-fill active:bg-fill-press"
            aria-label="导出数据"
          >
            <Share size={18} className="text-ink" />
          </button>
        </div>
      </header>

      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[112px]">
        {loading ? (
          <>
            <div className="ios-card mb-4 animate-pulse px-4 py-4">
              <div className="mb-2 h-10 w-28 rounded bg-fill" />
              <div className="h-3 w-20 rounded bg-fill" />
            </div>
            <div className="ios-card mb-4 animate-pulse px-4 py-4">
              <div className="h-[240px] rounded-xl bg-fill" />
            </div>
            <div className="ios-card animate-pulse px-4 py-4">
              <div className="h-[240px] rounded-xl bg-fill" />
            </div>
          </>
        ) : error ? (
          <div className="ios-card px-4 py-10 text-center">
            <p className="mb-4 text-[15px] text-ink-2">加载失败：{error}</p>
            <button
              type="button"
              onClick={retry}
              className="rounded-full bg-brand px-5 py-2 text-[15px] font-medium text-white active:bg-brand-press"
            >
              重试
            </button>
          </div>
        ) : bothEmpty ? (
          <div className="px-4 py-16 text-center">
            <div className="mb-4 text-[52px] leading-none">⚖️</div>
            <div className="mb-1 text-[17px] font-semibold text-ink">还没有指标记录</div>
            <div className="text-[14px] text-ink-2">
              去「记录」页点今日指标，添加体重或腰围
            </div>
          </div>
        ) : (
          <>
            {/* 最新值大卡（体重 / 腰围） */}
            {weightStat && (
              <LatestStatCard
                value={weightStat.value}
                unit="kg"
                dateLabel={`${formatDisplay(weightStat.date)} 记录`}
                delta={weightStat.delta}
              />
            )}
            {waistStat && (
              <LatestStatCard
                value={waistStat.value}
                unit="cm"
                dateLabel={`${formatDisplay(waistStat.date)} 记录`}
                delta={waistStat.delta}
              />
            )}

            {/* 区间分段控件：联动两张图 */}
            <div className="mb-4 flex rounded-full bg-fill p-[3px]">
              {RANGES.map((r) => {
                const selected = range === r.key
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRange(r.key)}
                    className="relative h-8 flex-1 rounded-full text-[13px] font-medium active:opacity-70"
                    style={{ minHeight: 32 }}
                    aria-pressed={selected}
                  >
                    {selected && (
                      <motion.span
                        layoutId="range-pill"
                        className="absolute inset-0 rounded-full bg-surface shadow-sm"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      />
                    )}
                    <span
                      className={`relative z-10 ${
                        selected ? 'text-ink' : 'text-ink-2'
                      }`}
                    >
                      {r.label}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* 体重趋势 */}
            {weight.points.length > 0 ? (
              <div className="mb-4">
                <div className="mb-1.5 px-1 text-[13px] font-medium text-ink-2">体重</div>
                <TrendChartCard
                  data={weightData}
                  unit="kg"
                  emptyText="该区间暂无体重记录"
                />
              </div>
            ) : (
              <EmptyMetricCard
                emoji="⚖️"
                text="还没有体重记录"
                hint="去「记录」页点今日指标，添加体重"
              />
            )}

            {/* 腰围趋势 */}
            {waist.points.length > 0 ? (
              <div>
                <div className="mb-1.5 px-1 text-[13px] font-medium text-ink-2">腰围</div>
                <TrendChartCard
                  data={waistData}
                  unit="cm"
                  emptyText="该区间暂无腰围记录"
                />
              </div>
            ) : (
              <EmptyMetricCard
                emoji="📏"
                text="还没有腰围记录"
                hint="去「记录」页点今日指标，添加腰围"
              />
            )}
          </>
        )}
      </main>

      <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  )
}

/** 单指标空态卡：不影响其他指标卡显示 */
function EmptyMetricCard({ emoji, text, hint }: { emoji: string; text: string; hint: string }) {
  return (
    <div className="ios-card mb-4 px-4 py-8 text-center">
      <div className="mb-2 text-[32px] leading-none">{emoji}</div>
      <div className="mb-1 text-[15px] font-semibold text-ink">{text}</div>
      <div className="text-[13px] text-ink-2">{hint}</div>
    </div>
  )
}
