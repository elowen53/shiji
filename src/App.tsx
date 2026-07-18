import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ConfigGate from '@/components/ConfigGate'
import TabBar, { type TabKey } from '@/components/TabBar'
import DiaryPage from '@/pages/DiaryPage'
import FoodsPage from '@/pages/FoodsPage'
import TrendsPage from '@/pages/TrendsPage'
import { useFoods } from '@/hooks/useFoods'
import { isSupabaseConfigured } from '@/lib/supabase'
import { ToastProvider } from '@/lib/toast'

export default function App() {
  if (!isSupabaseConfigured) {
    return <ConfigGate />
  }
  return <ConfiguredApp />
}

const TAB_ORDER: TabKey[] = ['diary', 'trends', 'foods']

function ConfiguredApp() {
  const [tab, setTab] = useState<TabKey>('diary')
  const dirRef = useRef(1)
  const foodsApi = useFoods()

  const handleTabChange = (next: TabKey) => {
    dirRef.current = TAB_ORDER.indexOf(next) >= TAB_ORDER.indexOf(tab) ? 1 : -1
    setTab(next)
  }

  return (
    <ToastProvider>
      <div className="app-shell">
        <div className="relative min-h-0 flex-1">
          <AnimatePresence mode="wait" initial={false} custom={dirRef.current}>
            <motion.div
              key={tab}
              className="h-full"
              initial={{ opacity: 0, x: 18 * dirRef.current }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 * dirRef.current }}
              transition={{ type: 'spring', stiffness: 460, damping: 40 }}
            >
              {tab === 'diary' ? (
                <DiaryPage foods={foodsApi.foods} />
              ) : tab === 'trends' ? (
                <TrendsPage />
              ) : (
                <FoodsPage foodsApi={foodsApi} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <TabBar active={tab} onChange={handleTabChange} />
      </div>
    </ToastProvider>
  )
}
