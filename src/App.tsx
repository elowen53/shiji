import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ConfigGate from '@/components/ConfigGate'
import TabBar, { type TabKey } from '@/components/TabBar'
import DiaryPage from '@/pages/DiaryPage'
import FoodsPage from '@/pages/FoodsPage'
import { useFoods } from '@/hooks/useFoods'
import { isSupabaseConfigured } from '@/lib/supabase'
import { ToastProvider } from '@/lib/toast'

export default function App() {
  if (!isSupabaseConfigured) {
    return <ConfigGate />
  }
  return <ConfiguredApp />
}

function ConfiguredApp() {
  const [tab, setTab] = useState<TabKey>('diary')
  const foodsApi = useFoods()

  return (
    <ToastProvider>
      <div className="app-shell">
        <div className="relative min-h-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              className="h-full"
              initial={{ opacity: 0, x: tab === 'diary' ? -18 : 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: tab === 'diary' ? -18 : 18 }}
              transition={{ type: 'spring', stiffness: 460, damping: 40 }}
            >
              {tab === 'diary' ? (
                <DiaryPage foods={foodsApi.foods} />
              ) : (
                <FoodsPage foodsApi={foodsApi} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <TabBar active={tab} onChange={setTab} />
      </div>
    </ToastProvider>
  )
}
