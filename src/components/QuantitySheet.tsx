import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import BottomSheet from '@/components/BottomSheet'
import Stepper from '@/components/Stepper'
import type { Entry } from '@/types'
import { fmtKcal, fmtMacro } from '@/lib/format'

interface QuantitySheetProps {
  entry: Entry | null
  onClose: () => void
  onSave: (entry: Entry, quantity: number) => Promise<boolean>
}

/** 修改已有记录的数量：以条目快照中的每单位营养值实时折算 */
export default function QuantitySheet({ entry, onClose, onSave }: QuantitySheetProps) {
  const [quantity, setQuantity] = useState(1)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (entry) {
      setQuantity(entry.quantity)
      setSaving(false)
    }
  }, [entry])

  const per = entry && entry.quantity > 0 ? entry.quantity : 1
  const scale = entry ? quantity / per : 0

  const handleSave = async () => {
    if (!entry || saving) return
    setSaving(true)
    const ok = await onSave(entry, quantity)
    if (ok) onClose()
    else setSaving(false)
  }

  return (
    <BottomSheet open={entry !== null} onClose={onClose} maxHeight="70%">
      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-1">
        <div className="w-9" />
        <div className="max-w-[60%] truncate text-[17px] font-semibold text-ink">
          {entry?.food_name ?? ''}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-fill"
          aria-label="关闭"
        >
          <X size={18} className="text-ink" />
        </button>
      </div>

      {entry && (
        <div className="px-4 pb-4">
          <div className="mb-4 text-center text-[14px] text-ink-2">
            数量（单位：{entry.unit}）
          </div>
          <div className="mb-5 flex justify-center">
            <Stepper value={quantity} onChange={setQuantity} step={0.5} min={0.5} />
          </div>

          <div className="ios-card mb-5 px-4 py-4">
            <div className="mb-3 text-center">
              <span className="tnum text-[34px] font-bold leading-none text-ink">
                {fmtKcal(entry.kcal * scale)}
              </span>
              <span className="ml-1 text-[15px] text-ink-2">千卡</span>
            </div>
            <div className="flex">
              {(
                [
                  ['蛋白质', entry.protein * scale],
                  ['脂肪', entry.fat * scale],
                  ['碳水', entry.carbs * scale],
                ] as const
              ).map(([label, v]) => (
                <div key={label} className="flex-1 text-center">
                  <div className="tnum text-[17px] font-semibold text-ink">
                    {fmtMacro(v)}
                    <span className="text-[12px] font-normal text-ink-2">g</span>
                  </div>
                  <div className="text-[12px] text-ink-2">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex h-[52px] w-full items-center justify-center rounded-2xl bg-brand text-[17px] font-semibold text-white active:bg-brand-press disabled:opacity-60"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      )}
      <div className="safe-bottom-pad shrink-0" />
    </BottomSheet>
  )
}
