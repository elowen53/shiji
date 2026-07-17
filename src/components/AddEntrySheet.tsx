import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, Search, X } from 'lucide-react'
import BottomSheet from '@/components/BottomSheet'
import Stepper from '@/components/Stepper'
import type { Food } from '@/types'
import { fmtKcal, fmtMacro } from '@/lib/format'

interface AddEntrySheetProps {
  open: boolean
  foods: Food[]
  onClose: () => void
  onSave: (food: Food, quantity: number) => Promise<boolean>
}

/** 添加记录：第一步搜索选择食物，第二步输入数量并实时预览折算营养 */
export default function AddEntrySheet({ open, foods, onClose, onSave }: AddEntrySheetProps) {
  const [step, setStep] = useState<'pick' | 'quantity'>('pick')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return foods
    return foods.filter((f) => f.name.toLowerCase().includes(q))
  }, [foods, query])

  const reset = () => {
    setStep('pick')
    setQuery('')
    setSelected(null)
    setQuantity(1)
    setSaving(false)
  }

  const handleClose = () => {
    onClose()
    // 等退出动画结束后重置状态
    window.setTimeout(reset, 300)
  }

  const handleSave = async () => {
    if (!selected || saving) return
    setSaving(true)
    const ok = await onSave(selected, quantity)
    if (ok) handleClose()
    else setSaving(false)
  }

  return (
    <BottomSheet open={open} onClose={handleClose}>
      {/* 标题栏 */}
      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-1">
        {step === 'quantity' ? (
          <button
            type="button"
            onClick={() => setStep('pick')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E5E5EA]"
            aria-label="返回"
          >
            <ChevronLeft size={20} className="text-[#1C1C1E]" />
          </button>
        ) : (
          <div className="w-9" />
        )}
        <div className="text-[17px] font-semibold text-[#1C1C1E]">
          {step === 'pick' ? '添加记录' : selected?.name}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E5E5EA]"
          aria-label="关闭"
        >
          <X size={18} className="text-[#1C1C1E]" />
        </button>
      </div>

      <div className="relative min-h-[420px] flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {step === 'pick' ? (
            <motion.div
              key="pick"
              className="flex h-full flex-col px-4"
              initial={{ opacity: 0, x: -28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -28 }}
              transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            >
              {/* 搜索框 */}
              <div className="mb-3 flex h-10 items-center gap-2 rounded-xl bg-[#E5E5EA] px-3">
                <Search size={17} className="shrink-0 text-[#8E8E93]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索食物"
                  className="w-full bg-transparent text-[16px] text-[#1C1C1E] outline-none placeholder:text-[#8E8E93]"
                />
              </div>

              <div className="ios-card no-scrollbar max-h-[340px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="px-4 py-10 text-center text-[15px] text-[#8E8E93]">
                    {foods.length === 0
                      ? '食物库还是空的，先去「食物库」添加吧'
                      : '没有匹配的食物'}
                  </div>
                ) : (
                  filtered.map((f, i) => (
                    <div key={f.id}>
                      {i > 0 && <div className="ios-separator" />}
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(f)
                          setQuantity(1)
                          setStep('quantity')
                        }}
                        className="ios-row w-full gap-3 text-left active:bg-[#F2F2F7]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[16px] text-[#1C1C1E]">{f.name}</div>
                          <div className="tnum mt-[1px] text-[13px] text-[#8E8E93]">
                            每{f.unit}
                          </div>
                        </div>
                        <div className="tnum shrink-0 text-[15px] text-[#8E8E93]">
                          {fmtKcal(f.kcal)} 千卡
                        </div>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="quantity"
              className="flex h-full flex-col px-4"
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 28 }}
              transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            >
              {selected && (
                <>
                  <div className="mb-4 text-center text-[14px] text-[#8E8E93]">
                    数量（单位：{selected.unit}）
                  </div>
                  <div className="mb-5 flex justify-center">
                    <Stepper value={quantity} onChange={setQuantity} step={0.5} min={0.5} />
                  </div>

                  {/* 实时折算预览 */}
                  <div className="ios-card mb-5 px-4 py-4">
                    <div className="mb-3 text-center">
                      <span className="tnum text-[34px] font-bold leading-none text-[#1C1C1E]">
                        {fmtKcal(selected.kcal * quantity)}
                      </span>
                      <span className="ml-1 text-[15px] text-[#8E8E93]">千卡</span>
                    </div>
                    <div className="flex">
                      {(
                        [
                          ['蛋白质', selected.protein * quantity],
                          ['脂肪', selected.fat * quantity],
                          ['碳水', selected.carbs * quantity],
                        ] as const
                      ).map(([label, v]) => (
                        <div key={label} className="flex-1 text-center">
                          <div className="tnum text-[17px] font-semibold text-[#1C1C1E]">
                            {fmtMacro(v)}
                            <span className="text-[12px] font-normal text-[#8E8E93]">g</span>
                          </div>
                          <div className="text-[12px] text-[#8E8E93]">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSave}
                    className="flex h-[50px] w-full items-center justify-center rounded-2xl bg-[#007AFF] text-[17px] font-semibold text-white active:bg-[#0066D6] disabled:opacity-60"
                  >
                    {saving ? '保存中…' : '保存'}
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="safe-bottom-pad shrink-0" />
    </BottomSheet>
  )
}
