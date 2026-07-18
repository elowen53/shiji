import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'

type ToastKind = 'error' | 'success' | 'info'

interface ToastItem {
  id: number
  text: string
  kind: ToastKind
}

interface ToastContextValue {
  toast: (text: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const toast = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = ++idRef.current
    setItems((prev) => [...prev.slice(-1), { id, text, kind }])
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 2600)
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none absolute inset-x-0 z-[90] flex justify-center"
        style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 480, damping: 32 }}
              className={`max-w-[82%] rounded-full px-4 py-2 text-[14px] font-medium text-white shadow-lg ${
                t.kind === 'error'
                  ? 'bg-danger'
                  : t.kind === 'success'
                    ? 'bg-success'
                    : 'bg-ink/90'
              }`}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
