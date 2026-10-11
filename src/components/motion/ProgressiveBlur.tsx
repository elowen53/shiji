/**
 * 渐进模糊：越靠近边缘越模糊（改编自 Motion Primitives 的 ProgressiveBlur，designeer.xyz 组件库）。
 * 多层 backdrop-filter 叠加，每层用渐变遮罩限定作用区间。
 */
const ANGLES = { top: 0, bottom: 180 } as const

interface ProgressiveBlurProps {
  /** 模糊最强的一侧 */
  direction?: keyof typeof ANGLES
  layers?: number
  intensity?: number
  className?: string
}

export default function ProgressiveBlur({
  direction = 'bottom',
  layers = 6,
  intensity = 0.6,
  className,
}: ProgressiveBlurProps) {
  const segment = 1 / (layers + 1)
  return (
    <div className={`pointer-events-none ${className ?? ''}`} aria-hidden="true">
      {Array.from({ length: layers }).map((_, i) => {
        const stops = [i, i + 1, i + 2, i + 3]
          .map((n, k) => `rgba(0,0,0,${k === 1 || k === 2 ? 1 : 0}) ${n * segment * 100}%`)
          .join(', ')
        const mask = `linear-gradient(${ANGLES[direction]}deg, ${stops})`
        const blur = `blur(${(i + 1) * intensity}px)`
        return (
          <div
            key={i}
            className="absolute inset-0"
            style={{ maskImage: mask, WebkitMaskImage: mask, backdropFilter: blur, WebkitBackdropFilter: blur }}
          />
        )
      })}
    </div>
  )
}
