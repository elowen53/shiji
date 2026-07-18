import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** 内容最大高度（相对应用外壳） */
  maxHeight?: string
}

/**
 * iOS 风格底部弹出 Sheet：弹簧动画 + 下拉关闭。
 * 渲染在 app-shell 内（absolute 定位），桌面窄栏下也不会越界。
 */
export default function BottomSheet({
  open,
  onClose,
  children,
  maxHeight = '88%',
}: BottomSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="absolute inset-0 z-50 bg-black/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            className="absolute inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-[20px] bg-grouped"
            style={{ maxHeight }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 700) onClose()
            }}
          >
            <div className="flex shrink-0 justify-center pb-1 pt-2">
              <div className="h-[5px] w-9 rounded-full bg-fill-press" />
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
