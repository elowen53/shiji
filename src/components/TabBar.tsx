import { BookOpenText, TrendingUp, UtensilsCrossed } from 'lucide-react'
import { motion } from 'framer-motion'
import ProgressiveBlur from '@/components/motion/ProgressiveBlur'

export type TabKey = 'diary' | 'trends' | 'foods'

interface TabBarProps {
  active: TabKey
  onChange: (tab: TabKey) => void
}

const TABS: { key: TabKey; label: string; icon: typeof BookOpenText }[] = [
  { key: 'diary', label: '记录', icon: BookOpenText },
  { key: 'trends', label: '趋势', icon: TrendingUp },
  { key: 'foods', label: '食物库', icon: UtensilsCrossed },
]

/** 悬浮胶囊 Tab 栏：毛玻璃底 + 内容滚到下方时渐进模糊过渡（含安全区） */
export default function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav aria-label="主导航" className="pointer-events-none absolute inset-x-0 bottom-0 z-40">
      {/* 底部渐进模糊 + 淡出，让滚动内容自然没入 Tab 栏下方 */}
      <ProgressiveBlur direction="bottom" className="absolute inset-x-0 bottom-0 h-[120px]" />
      <div className="absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-b from-grouped/0 via-grouped/50 to-grouped/90" />
      <div className="tabbar-dock relative">
        <div className="tabbar-capsule pointer-events-auto flex h-[60px] px-1.5">
          {TABS.map(({ key, label, icon: Icon }) => {
            const selected = active === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key)}
                className="relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-transform duration-150 active:scale-95"
                style={{ minHeight: 44 }}
                aria-label={label}
                aria-current={selected ? 'page' : undefined}
              >
                {selected && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-x-1 top-1.5 bottom-1.5 rounded-[20px] bg-brand/10"
                    transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                  />
                )}
                {/* 选中时图标轻弹一下 */}
                <motion.span
                  className="relative"
                  animate={selected ? { scale: [1, 1.16, 1], y: [0, -1.5, 0] } : { scale: 1, y: 0 }}
                  transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Icon
                    size={21}
                    strokeWidth={selected ? 2.2 : 1.8}
                    className={selected ? 'text-brand' : 'text-ink-2'}
                  />
                </motion.span>
                <span
                  className={`relative text-[11px] font-medium ${
                    selected ? 'text-brand' : 'text-ink-2'
                  }`}
                >
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
