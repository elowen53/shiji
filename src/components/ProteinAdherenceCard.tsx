import { PROTEIN_HIT_RATIO, type ProteinAdherence } from '@/lib/cut'

interface ProteinAdherenceCardProps {
  week: ProteinAdherence | null
  month: ProteinAdherence | null
}

function Column({ label, data, divider }: { label: string; data: ProteinAdherence | null; divider?: boolean }) {
  const hit = data?.hitDays
  const tone =
    data == null || hit == null
      ? 'text-ink'
      : hit / data.loggedDays >= 0.8
        ? 'text-success'
        : hit / data.loggedDays >= 0.5
          ? 'text-warn'
          : 'text-danger'
  return (
    <div className={`px-3 text-center ${divider ? 'border-l border-brand/10' : ''}`}>
      <div className="text-[11px] text-ink-2">{label}</div>
      {data == null ? (
        <div className="mt-1 text-[17px] font-semibold text-ink">—</div>
      ) : hit != null ? (
        <div className={`tnum mt-1 text-[17px] font-semibold ${tone}`}>
          {hit}/{data.loggedDays}
          <span className="ml-0.5 text-[11px] font-normal text-ink-2">天达标</span>
        </div>
      ) : (
        <div className="tnum mt-1 text-[17px] font-semibold text-ink">
          {data.avgPerKg != null ? data.avgPerKg.toFixed(1) : data.avgProtein}
          <span className="ml-0.5 text-[11px] font-normal text-ink-2">{data.avgPerKg != null ? 'g/kg' : 'g'}</span>
        </div>
      )}
      <div className="tnum mt-1 text-[11px] text-ink-2">
        {data == null
          ? '没有饮食记录'
          : hit != null && data.avgPerKg != null
            ? `平均 ${data.avgPerKg.toFixed(1)} g/kg`
            : `平均 ${data.avgProtein} g · 记录 ${data.loggedDays} 天`}
      </div>
    </div>
  )
}

/** 蛋白质达标：减脂期保肌肉的关键，按近 7 天 / 30 天统计。 */
export default function ProteinAdherenceCard({ week, month }: ProteinAdherenceCardProps) {
  if (!week && !month) return null
  const hasTarget = (week ?? month)!.hitDays != null
  return (
    <section className="ios-card mb-4 overflow-hidden">
      <div className="px-5 pt-4 text-[12px] text-ink-2">蛋白质</div>
      <div className="grid grid-cols-2 px-2 py-3">
        <Column label="近 7 天" data={week} />
        <Column label="近 30 天" data={month} divider />
      </div>
      <div className="bg-grouped px-4 py-2.5 text-center text-[12px] leading-5 text-ink-2">
        {hasTarget
          ? `达到目标的 ${Math.round(PROTEIN_HIT_RATIO * 100)}% 记为达标，不含今天与未记录的日子`
          : '在「记录」页设置蛋白质目标并记录体重后，可统计达标天数'}
      </div>
    </section>
  )
}
