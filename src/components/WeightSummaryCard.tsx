import type { WeeklyTrendSummary } from '@/lib/trend'

interface WeightSummaryCardProps {
  value: number
  dateLabel: string
  weekly: WeeklyTrendSummary
}

function signed(value: number, digits = 1): string {
  if (value === 0) return value.toFixed(digits)
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`
}

function changeColor(value: number | null): string {
  if (value == null || value === 0) return 'text-ink'
  return value < 0 ? 'text-success' : 'text-danger'
}

/** 体重最新值 + 两个连续 7 日窗口的均值变化。 */
export default function WeightSummaryCard({
  value,
  dateLabel,
  weekly,
}: WeightSummaryCardProps) {
  return (
    <section className="ios-card mb-4 overflow-hidden">
      <div className="px-5 py-5">
        <div className="mb-3 flex items-center justify-between text-[12px] text-ink-2">
          <span>最新体重</span><span className="text-[9px] tracking-[0.16em]" aria-hidden="true">BODY WEIGHT</span>
        </div>
        <div className="tnum editorial-title text-[48px] leading-none text-brand">
          {value.toFixed(1)}
          <span className="ml-1 text-[16px] font-normal text-ink-2">kg</span>
        </div>
        <div className="mt-1.5 text-[13px] text-ink-2">{dateLabel}</div>
      </div>

      <div className="h-px bg-brand/10" />
      <div className="grid grid-cols-3 px-2 py-3">
        <div className="px-2 text-center">
          <div className="text-[11px] text-ink-2">7日平均</div>
          <div className="tnum mt-1 text-[17px] font-semibold text-ink">
            {weekly.currentAverage.toFixed(1)}
            <span className="ml-0.5 text-[11px] font-normal text-ink-2">kg</span>
          </div>
        </div>
        <div className="border-x border-brand/10 px-2 text-center">
          <div className="text-[11px] text-ink-2">每周变化</div>
          <div className={`tnum mt-1 text-[17px] font-semibold ${changeColor(weekly.change)}`}>
            {weekly.change == null ? '—' : signed(weekly.change)}
            {weekly.change != null && (
              <span className="ml-0.5 text-[11px] font-normal text-ink-2">kg</span>
            )}
          </div>
        </div>
        <div className="px-2 text-center">
          <div className="text-[11px] text-ink-2">每周变化率</div>
          <div
            className={`tnum mt-1 text-[17px] font-semibold ${changeColor(weekly.changePercent)}`}
          >
            {weekly.changePercent == null ? '—' : `${signed(weekly.changePercent)}%`}
          </div>
        </div>
      </div>
      <div className="bg-grouped px-4 py-2 text-center text-[11px] text-ink-2">
        最近7日 {weekly.currentCount} 次称重 · 前7日 {weekly.previousCount} 次称重
      </div>
    </section>
  )
}
