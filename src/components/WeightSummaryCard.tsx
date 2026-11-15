import AnimatedNumber from '@/components/motion/AnimatedNumber'
import { formatDisplay } from '@/lib/date'
import type { CutPace, RateSummary } from '@/lib/cut'

interface WeightSummaryCardProps {
  summary: RateSummary
  pace: CutPace
}

function signed(value: number, digits: number): string {
  const body = Math.abs(value).toFixed(digits)
  if (Number(body) === 0) return body
  return `${value > 0 ? '+' : '−'}${body}`
}

const PACE: Record<Exclude<CutPace, 'unknown'>, { label: string; text: string; tone: string; pill: string }> = {
  rising: {
    label: '体重回升',
    text: '近两周体重在回升，目前没有形成热量缺口',
    tone: 'text-danger',
    pill: 'bg-danger/10 text-danger',
  },
  flat: {
    label: '基本持平',
    text: '近两周体重几乎没变：缺口不足，或被水分波动掩盖，可以再观察一周',
    tone: 'text-warn',
    pill: 'bg-warn/10 text-warn',
  },
  slow: {
    label: '偏慢',
    text: '低于每周 −0.5%，想快一点可以再收紧一些缺口',
    tone: 'text-warn',
    pill: 'bg-warn/10 text-warn',
  },
  ok: {
    label: '节奏合适',
    text: '处在每周 −0.5% ~ −1% 的合适区间，保持即可',
    tone: 'text-success',
    pill: 'bg-success/10 text-success',
  },
  fast: {
    label: '偏快',
    text: '超过每周 −1%，掉肌肉的风险升高，可以适当多吃一点',
    tone: 'text-warn',
    pill: 'bg-warn/10 text-warn',
  },
}

/** 7 日均重为主、最新一次称重为辅，并按每周变化率判断减脂节奏。 */
export default function WeightSummaryCard({ summary, pace }: WeightSummaryCardProps) {
  const info = pace === 'unknown' ? null : PACE[pace]
  const tone = info?.tone ?? 'text-ink'
  return (
    <section className="ios-card mb-4 overflow-hidden">
      <div className="px-5 py-5">
        <div className="mb-3 flex items-center justify-between text-[12px] text-ink-2">
          <span>7 日均重</span>
          {info ? (
            <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${info.pill}`}>{info.label}</span>
          ) : (
            <span className="text-[9px] tracking-[0.16em]" aria-hidden="true">BODY WEIGHT</span>
          )}
        </div>
        <div className="tnum editorial-title text-[48px] leading-none text-brand">
          <AnimatedNumber value={summary.average} preset="fixed1" />
          <span className="ml-1 text-[16px] font-normal text-ink-2">kg</span>
        </div>
        <div className="tnum mt-1.5 text-[13px] text-ink-2">
          最新 {summary.latest.value.toFixed(1)} kg · {formatDisplay(summary.latest.date)}
        </div>
      </div>

      <div className="h-px bg-brand/10" />
      <div className="grid grid-cols-3 px-2 py-3">
        <div className="px-2 text-center">
          <div className="text-[11px] text-ink-2">每周变化</div>
          <div className={`tnum mt-1 text-[17px] font-semibold ${tone}`}>
            {summary.perWeek == null ? '—' : signed(summary.perWeek, 2)}
            {summary.perWeek != null && <span className="ml-0.5 text-[11px] font-normal text-ink-2">kg</span>}
          </div>
        </div>
        <div className="border-x border-brand/10 px-2 text-center">
          <div className="text-[11px] text-ink-2">每周变化率</div>
          <div className={`tnum mt-1 text-[17px] font-semibold ${tone}`}>
            {summary.percentPerWeek == null ? '—' : `${signed(summary.percentPerWeek, 1)}%`}
          </div>
        </div>
        <div className="px-2 text-center">
          <div className="text-[11px] text-ink-2">近 {summary.windowDays} 天称重</div>
          <div className="tnum mt-1 text-[17px] font-semibold text-ink">
            {summary.count}
            <span className="ml-0.5 text-[11px] font-normal text-ink-2">次</span>
          </div>
        </div>
      </div>
      <div className="bg-grouped px-4 py-2.5 text-center text-[12px] leading-5 text-ink-2">
        {info
          ? info.text
          : `近 ${summary.windowDays} 天至少称重 4 次、首末相隔满 7 天，才能估算减脂节奏`}
      </div>
    </section>
  )
}
