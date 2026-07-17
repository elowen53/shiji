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
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E5E5EA] text-[#1C1C1E] active:bg-[#D1D1D6]"
      >
        <Minus size={20} strokeWidth={2.4} />
      </button>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (Number.isFinite(v)) onChange(clamp(v))
        }}
        className="tnum h-12 w-24 rounded-xl bg-[#E5E5EA] text-center text-[22px] font-semibold text-[#1C1C1E] outline-none"
      />
      <button
        type="button"
        aria-label="增加"
        onClick={() => onChange(clamp(value + step))}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#007AFF] text-white active:bg-[#0066D6]"
      >
        <Plus size={20} strokeWidth={2.4} />
      </button>
    </div>
  )
}
