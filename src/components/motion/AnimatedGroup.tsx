import { Children, type ReactNode } from 'react'
import { motion, type Variants } from 'framer-motion'

/**
 * 子元素依次淡入上浮（改编自 Motion Primitives 的 AnimatedGroup，designeer.xyz 组件库）。
 * 只保留本应用用到的 blur-slide 预设，位移与模糊都很克制。
 */
const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
}

const item: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 },
  },
}

interface AnimatedGroupProps {
  children: ReactNode
  className?: string
  /** 为 true 时直接显示（例如切换日期时已由外层负责过渡） */
  skip?: boolean
}

export default function AnimatedGroup({ children, className, skip = false }: AnimatedGroupProps) {
  return (
    <motion.div initial={skip ? false : 'hidden'} animate="visible" variants={container} className={className}>
      {Children.map(children, (child, i) =>
        child == null || child === false ? null : (
          <motion.div key={i} variants={item}>
            {child}
          </motion.div>
        ),
      )}
    </motion.div>
  )
}
