import { formatDisplay } from '@/lib/date'
import { fmtMacro } from '@/lib/format'
import type { CompositionSignal, RateSummary } from '@/lib/cut'

interface WaistSummaryCardProps {
  summary: RateSummary
  signal: CompositionSignal
}

const SIGNAL: Record<Exclude<CompositionSignal, 'unknown'>, string> = {
  'fat-loss': '体重和腰围同步下降，减掉的主要是脂肪',
  'weight-only': '体重在降但腰围没跟着降，可能是水分或肌肉，留意蛋白质和力量训练',
  recomp: '体重没怎么变但腰围在降，身体成分在改善，别只盯着体重',
  stalled: '体重和腰围都没有下降，缺口可能不够',
}

function signed(value: number): string {
  const body = Math.abs(value).toFixed(1)
  if (Number(body) === 0) return body
  return `${value > 0 ? '+' : '−'}${body}`
}

/** 腰围：最新值 + 近四周的每周变化，并与体重变化对照判断减掉的是不是脂肪。 */
export default function WaistSummaryCard({ summary, signal }: WaistSummaryCardProps) {
  const { perWeek } = summary
  const rounded = perWeek == null ? null : Math.round(perWeek * 10) / 10
  const tone = !rounded ? 'text-ink' : rounded < 0 ? 'text-success' : 'text-danger'
  const note =
    perWeek == null
      ? `近 ${summary.windowDays} 天至少测量 3 次、首末相隔满 14 天，才能看出腰围趋势`
      : signal === 'unknown'
        ? '体重记录还不够，暂时无法和腰围对照'
        : SIGNAL[signal]
  return (
    <section className="ios-card mb-4 overflow-hidden">
      <div className="flex items-end justify-between px-5 py-4">
        <div>
          <div className="mb-3 text-[12px] text-ink-2">最新腰围</div>
          <div className="tnum editorial-title text-[42px] leading-none text-brand">
            {fmtMacro(summary.latest.value)}
            <span className="ml-1 text-[16px] font-normal text-ink-2">cm</span>
          </div>
          <div className="mt-1.5 text-[13px] text-ink-2">{formatDisplay(summary.latest.date)} 记录</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-ink-2">每周变化</div>
          <div className={`tnum mt-1 text-[17px] font-semibold ${tone}`}>
            {perWeek == null ? '—' : signed(perWeek)}
            {perWeek != null && <span className="ml-0.5 text-[11px] font-normal text-ink-2">cm</span>}
          </div>
          <div className="tnum mt-1 text-[11px] text-ink-2">
            近 {summary.windowDays} 天测量 {summary.count} 次
          </div>
        </div>
      </div>
      <div className="bg-grouped px-4 py-2.5 text-center text-[12px] leading-5 text-ink-2">{note}</div>
    </section>
  )
}
