import { fmtMacro } from '@/lib/format'

interface LatestStatCardProps {
  /** 最新记录值 */
  value: number
  /** 单位，如 "kg" / "cm" */
  unit: string
  /** 记录日期标签，如 "7月17日 记录" */
  dateLabel: string
  /** 与上一条记录的差值；null 或 0 时不显示 */
  delta: number | null
}

/** 趋势页大数字卡片：最新值 + 较上次增减（涨红 / 降绿） */
export default function LatestStatCard({ value, unit, dateLabel, delta }: LatestStatCardProps) {
  return (
    <section className="ios-card mb-4 px-4 py-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="tnum text-[40px] font-bold leading-none tracking-tight text-ink">
            {fmtMacro(value)}
            <span className="ml-1 text-[16px] font-normal text-ink-2">{unit}</span>
          </div>
          <div className="mt-1.5 text-[13px] text-ink-2">{dateLabel}</div>
        </div>
        {delta != null && delta !== 0 && (
          <div
            className={`tnum mb-1 text-[14px] font-medium ${
              delta > 0 ? 'text-danger' : 'text-success'
            }`}
          >
            较上次 {delta > 0 ? '+' : ''}
            {delta.toFixed(1)} {unit}
          </div>
        )}
      </div>
    </section>
  )
}
