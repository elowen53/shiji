import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'

type ToastKind = 'error' | 'success' | 'info'

/** 可选的行内操作，如「撤销」 */
interface ToastAction {
  label: string
  onPress: () => void
}

interface ToastItem {
  id: number
  text: string
  kind: ToastKind
  action?: ToastAction
}

interface ToastContextValue {
  toast: (text: string, kind?: ToastKind, action?: ToastAction) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (text: string, kind: ToastKind = 'info', action?: ToastAction) => {
      const id = ++idRef.current
      setItems((prev) => [...prev.slice(-1), { id, text, kind, action }])
      // 带操作的提示多留一会儿，给用户反应时间
      window.setTimeout(() => dismiss(id), action ? 5000 : 2600)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* 普通提示在顶部；带操作（如撤销）的提示在底部，靠近拇指，也不遮挡标题 */}
      <ToastStack
        items={items.filter((t) => !t.action)}
        onDismiss={dismiss}
        style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
        from={-24}
      />
      <ToastStack
        items={items.filter((t) => t.action)}
        onDismiss={dismiss}
        style={{ bottom: 'calc(68px + env(safe-area-inset-bottom) + 88px)' }}
        from={24}
      />
    </ToastContext.Provider>
  )
}

function ToastStack({
  items,
  onDismiss,
  style,
  from,
}: {
  items: ToastItem[]
  onDismiss: (id: number) => void
  style: CSSProperties
  /** 入场位移方向：顶部从上方滑入，底部从下方滑入 */
  from: number
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 z-[90] flex justify-center" style={style}>
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: from, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: from * 0.66, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 480, damping: 32 }}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`flex max-w-[82%] items-center gap-3 rounded-full py-2 pl-4 text-[14px] font-medium text-white shadow-lg ${
              t.action ? 'pointer-events-auto pr-1.5' : 'pr-4'
            } ${
              t.kind === 'error' ? 'bg-danger' : t.kind === 'success' ? 'bg-success' : 'bg-ink/90'
            }`}
          >
            <span className="min-w-0">{t.text}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  onDismiss(t.id)
                  t.action!.onPress()
                }}
                className="-my-1 shrink-0 rounded-full bg-white/20 px-3 py-1.5 text-[13px] font-semibold text-white active:bg-white/30"
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
