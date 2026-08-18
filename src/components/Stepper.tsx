import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'

interface StepperProps {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  /** 食物单位，如 "100g" / "250ml" / "1份"；重量 / 体积类单位会显示按克（毫升）快捷输入 */
  unit?: string
}

interface DecimalInputProps {
  value: number
  normalize: (value: number) => number
  onChange: (value: number) => void
  ariaLabel: string
  className: string
}

/**
 * 数字输入时保留文本草稿，允许用户暂时输入空值或 "3."。
 * 只有完整的数字才会向外更新，失焦后再恢复为规范化的数值。
 */
function DecimalInput({ value, normalize, onChange, ariaLabel, className }: DecimalInputProps) {
  // null 表示未编辑，此时直接跟随外部 value；字符串则保留用户正在输入的中间状态。
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    const currentDraft = draft ?? String(value)
    const parsed = Number(currentDraft)

    if (currentDraft !== '' && Number.isFinite(parsed)) {
      onChange(normalize(parsed))
    }

    setDraft(null)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={draft ?? String(value)}
      onFocus={() => setDraft(String(value))}
      onBlur={commit}
      onChange={(e) => {
        const nextDraft = e.target.value
        if (!/^\d*(?:\.\d*)?$/.test(nextDraft)) return

        setDraft(nextDraft)
        if (nextDraft === '' || nextDraft.endsWith('.')) return

        const parsed = Number(nextDraft)
        if (Number.isFinite(parsed)) onChange(normalize(parsed))
      }}
      className={className}
    />
  )
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
        <DecimalInput
          value={value}
          normalize={clamp}
          onChange={onChange}
          ariaLabel="数量"
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
          <DecimalInput
            value={Math.round(value * measure.amount * 10) / 10}
            normalize={(grams) => Math.round(clamp(grams / measure.amount) * measure.amount * 10) / 10}
            onChange={(grams) => onChange(clamp(grams / measure.amount))}
            ariaLabel={`按${measure.label}输入`}
            className="tnum h-8 w-20 rounded-lg bg-fill px-2 text-center text-[14px] font-medium text-ink outline-none"
          />
          <span>{measure.label}</span>
        </div>
      )}
    </div>
  )
}
