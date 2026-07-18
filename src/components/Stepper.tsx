import { Minus, Plus } from 'lucide-react'

interface StepperProps {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
}

/** 数量步进器：− / ＋ 按钮 + 中间直接输入（支持 0.5 步进） */
export default function Stepper({ value, onChange, step = 0.5, min = 0.5 }: StepperProps) {
  const clamp = (v: number) => Math.round(Math.max(min, Math.min(999, v)) * 100) / 100

  return (
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
        step={step}
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
  )
}
