import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import type { Entry } from '@/types'
import { fmtKcal, fmtMacro, fmtQty } from '@/lib/format'

interface EntryRowProps {
  entry: Entry
  onDelete: (entry: Entry) => void
  onTap: (entry: Entry) => void
}

/** 记录条目：iOS 风格左滑露出删除按钮；轻点弹出操作 */
export default function EntryRow({ entry, onDelete, onTap }: EntryRowProps) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
      transition={{ type: 'spring', stiffness: 420, damping: 38 }}
      className="relative"
    >
      {/* 左滑露出的删除按钮 */}
      <button
        type="button"
        aria-label="删除"
        onClick={() => onDelete(entry)}
        className="absolute inset-y-0 right-0 flex w-[84px] items-center justify-center bg-[#FF3B30] text-white"
      >
        <Trash2 size={20} />
      </button>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.5, right: 0.02 }}
        dragMomentum={false}
        animate={{ x: open ? -84 : 0 }}
        transition={{ type: 'spring', stiffness: 480, damping: 42 }}
        onDragEnd={(_, info) => setOpen(info.offset.x < -48)}
        onTap={() => (open ? setOpen(false) : onTap(entry))}
        className="ios-row relative gap-3"
        style={{ touchAction: 'pan-y' }}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-medium text-[#1C1C1E]">
            {entry.food_name}
          </div>
          <div className="tnum mt-[1px] text-[13px] text-[#8E8E93]">
            {fmtQty(entry.quantity)} × {entry.unit}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="tnum text-[16px] font-semibold text-[#1C1C1E]">
            {fmtKcal(entry.kcal)}
            <span className="ml-[2px] text-[12px] font-normal text-[#8E8E93]">千卡</span>
          </div>
          <div className="tnum mt-[1px] text-[12px] text-[#8E8E93]">
            蛋 {fmtMacro(entry.protein)} · 脂 {fmtMacro(entry.fat)} · 碳{' '}
            {fmtMacro(entry.carbs)}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
