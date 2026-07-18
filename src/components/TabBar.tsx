import { BookOpenText, TrendingUp, UtensilsCrossed } from 'lucide-react'
import { motion } from 'framer-motion'

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

/** iOS 风格毛玻璃底部 Tab 栏（含安全区 padding） */
export default function TabBar({ active, onChange }: TabBarProps) {
  return (
    <div className="hairline-t absolute inset-x-0 bottom-0 z-40 bg-surface/80 backdrop-blur-xl">
      <div className="safe-bottom-pad">
        <div className="flex h-[52px]">
          {TABS.map(({ key, label, icon: Icon }) => {
            const selected = active === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key)}
                className="relative flex flex-1 flex-col items-center justify-center gap-[2px] active:opacity-60"
                style={{ minHeight: 44 }}
                aria-label={label}
                aria-current={selected ? 'page' : undefined}
              >
                {selected && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-x-8 top-[5px] bottom-[5px] rounded-full bg-brand/10"
                    transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                  />
                )}
                <Icon
                  size={23}
                  strokeWidth={selected ? 2.2 : 1.8}
                  className={selected ? 'text-brand' : 'text-ink-2'}
                />
                <span
                  className={`text-[10px] font-medium ${
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
    </div>
  )
}
