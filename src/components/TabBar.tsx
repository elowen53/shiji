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
    <nav aria-label="主导航" className="hairline-t absolute inset-x-0 bottom-0 z-40 bg-grouped/95 backdrop-blur-xl">
      <div className="safe-bottom-pad">
        <div className="flex h-[68px] px-4">
          {TABS.map(({ key, label, icon: Icon }) => {
            const selected = active === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key)}
                className="relative flex flex-1 flex-col items-center justify-center gap-1 active:opacity-60"
                style={{ minHeight: 44 }}
                aria-label={label}
                aria-current={selected ? 'page' : undefined}
              >
                {selected && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-x-3 top-2 bottom-2 rounded-2xl bg-brand/10"
                    transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                  />
                )}
                <Icon
                  size={21}
                  strokeWidth={selected ? 2.2 : 1.8}
                  className={`relative ${selected ? 'text-brand' : 'text-ink-2'}`}
                />
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
