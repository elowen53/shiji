import { Minus, Plus } from 'lucide-react'

interface StepperProps {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  /** 食物单位，如 "100g" / "250ml" / "1份"；重量 / 体积类单位会显示按克（毫升）快捷输入 */
  unit?: string
}

/** 从单位中解析出每单位克数 / 毫升数，如 "100g" → { amount: 100, label: 'g' } */
function parseMeasureUnit(unit?: string): { amount: number; label: string } | null {
  const m = unit?.trim().match(/^(\d+(?:\.\d+)?)\s*(g|克|ml|毫升)$/i)
  if (!m) return null
  const amount = parseFloat(m[1])
  if (!Number.isFinite(amount) || amount <= 0) return null
  const label = /^(g|克)$/i.test(m[2]) ? 'g' : 'ml'
  return { amount, label }
}

/** 数量步进器：− / ＋ 按钮 + 中间直接输入（最小 0.1，精确到 0.01；重量 / 体积单位支持按克换算） */
export default function Stepper({ value, onChange, step = 0.5, min = 0.1, unit }: StepperProps) {
  const clamp = (v: number) => Math.round(Math.max(min, Math.min(999, v)) * 100) / 100
  const measure = parseMeasureUnit(unit)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="减少"
          onClick={() => onChange(clamp(value - step))}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-fill text-ink active:bg-fill-press"
        >
          <Minus size={20} strokeWidth={2.4} />
        </button>
        <input
          type="number"
          inputMode="decimal"
          step={0.1}
          min={min}
          aria-label="数量"
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (Number.isFinite(v)) onChange(clamp(v))
          }}
          className="tnum h-12 w-24 rounded-xl bg-fill text-center text-[20px] font-semibold text-ink outline-none"
        />
        <button
          type="button"
          aria-label="增加"
          onClick={() => onChange(clamp(value + step))}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white active:bg-brand-press"
        >
          <Plus size={20} strokeWidth={2.4} />
        </button>
      </div>

      {measure && (
        <div className="flex items-center gap-2 text-[13px] text-ink-2">
          <span>按{measure.label}输入</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            aria-label={`按${measure.label}输入`}
            value={Math.round(value * measure.amount * 10) / 10}
            onChange={(e) => {
              const grams = parseFloat(e.target.value)
              if (Number.isFinite(grams)) onChange(clamp(grams / measure.amount))
            }}
            className="tnum h-8 w-20 rounded-lg bg-fill px-2 text-center text-[14px] font-medium text-ink outline-none"
          />
          <span>{measure.label}</span>
        </div>
      )}
    </div>
  )
}
