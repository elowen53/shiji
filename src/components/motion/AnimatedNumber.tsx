import NumberFlow from '@number-flow/react'

/** 数字格式预设，与 lib/format 的静态格式保持一致 */
const FORMATS = {
  /** 热量：取整、千分位 */
  kcal: { maximumFractionDigits: 0 },
  /** 一位小数：体重、腰围 */
  fixed1: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
} satisfies Record<string, Intl.NumberFormatOptions>

type Preset = keyof typeof FORMATS | 'gram'

interface AnimatedNumberProps {
  value: number
  /** gram：≥ 10 取整，不足 10 保留 1 位（同 fmtGram） */
  preset?: Preset
  className?: string
  suffix?: string
}

/**
 * 数字滚动过渡（NumberFlow，来自 designeer.xyz 组件库）。
 * 数值变化时逐位滚动；系统开启「减少动态效果」时自动直接切换。
 */
export default function AnimatedNumber({ value, preset = 'kcal', className, suffix }: AnimatedNumberProps) {
  const format =
    preset === 'gram'
      ? { maximumFractionDigits: Math.abs(value) >= 10 ? 0 : 1 }
      : FORMATS[preset]
  return (
    <NumberFlow
      value={value}
      locales="en-US"
      format={format}
      suffix={suffix}
      className={className}
      willChange
      transformTiming={{ duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
      spinTiming={{ duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
    />
  )
}
