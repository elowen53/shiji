import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import BottomSheet from '@/components/BottomSheet'
import type { Food, FoodInput } from '@/types'

interface FoodFormSheetProps {
  open: boolean
  /** 传入则为编辑，否则为新增 */
  food: Food | null
  onClose: () => void
  onSave: (input: FoodInput) => Promise<boolean>
  onDelete?: () => Promise<boolean>
}

const NUM_FIELDS: { key: 'protein' | 'fat' | 'carbs'; label: string; placeholder: string }[] = [
  { key: 'protein', label: '蛋白质（克）', placeholder: '0' },
  { key: 'fat', label: '脂肪（克）', placeholder: '0' },
  { key: 'carbs', label: '碳水（克）', placeholder: '0' },
]

/** 三大营养素 → 热量换算系数（千卡/克） */
const KCAL_PER_G = { protein: 4, fat: 9, carbs: 4 } as const

const parseNum = (s: string) => {
  const v = parseFloat(s)
  return Number.isFinite(v) && v >= 0 ? v : 0
}

/** 新增 / 编辑食物：名称与单位完全自定义，营养值为每单位含量 */
export default function FoodFormSheet({ open, food, onClose, onSave, onDelete }: FoodFormSheetProps) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [nums, setNums] = useState({ protein: '', fat: '', carbs: '' })
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const deleteTimer = useRef<number | null>(null)

  useEffect(() => {
    if (open) {
      setName(food?.name ?? '')
      setUnit(food?.unit ?? '')
      setNums({
        protein: food ? String(food.protein) : '',
        fat: food ? String(food.fat) : '',
        carbs: food ? String(food.carbs) : '',
      })
      setSaving(false)
      setConfirmingDelete(false)
    }
  }, [open, food])

  useEffect(() => {
    return () => {
      if (deleteTimer.current) window.clearTimeout(deleteTimer.current)
    }
  }, [])

  const valid = name.trim().length > 0 && unit.trim().length > 0

  /** 按蛋白质 4 / 脂肪 9 / 碳水 4 千卡每克自动折算热量 */
  const autoKcal =
    Math.round(
      (parseNum(nums.protein) * KCAL_PER_G.protein +
        parseNum(nums.fat) * KCAL_PER_G.fat +
        parseNum(nums.carbs) * KCAL_PER_G.carbs) * 10
    ) / 10

  const handleSave = async () => {
    if (!valid || saving) return
    setSaving(true)
    const ok = await onSave({
      name: name.trim(),
      unit: unit.trim(),
      kcal: autoKcal,
      protein: parseNum(nums.protein),
      fat: parseNum(nums.fat),
      carbs: parseNum(nums.carbs),
    })
    setSaving(false)
    if (ok) onClose()
  }

  const handleDelete = async () => {
    if (!onDelete) return
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      deleteTimer.current = window.setTimeout(() => setConfirmingDelete(false), 3000)
      return
    }
    if (deleteTimer.current) window.clearTimeout(deleteTimer.current)
    setConfirmingDelete(false)
    const ok = await onDelete()
    if (ok) onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-1">
        <div className="w-9" />
        <div className="text-[17px] font-semibold text-[#1C1C1E]">
          {food ? '编辑食物' : '新增食物'}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E5E5EA]"
          aria-label="关闭"
        >
          <X size={18} className="text-[#1C1C1E]" />
        </button>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="ios-card mb-4">
          <div className="ios-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="名称，如：鸡胸肉"
              className="w-full bg-transparent text-[16px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC]"
            />
          </div>
          <div className="ios-separator" />
          <div className="ios-row">
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="单位，如：100g / 1份 / 1碗"
              className="w-full bg-transparent text-[16px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC]"
            />
          </div>
        </div>

        <div className="mb-1 px-4 text-[13px] text-[#8E8E93]">每单位三大营养素</div>
        <div className="ios-card mb-6">
          {NUM_FIELDS.map(({ key, label, placeholder }, i) => (
            <div key={key}>
              {i > 0 && <div className="ios-separator" />}
              <div className="ios-row gap-3">
                <div className="flex-1 text-[16px] text-[#1C1C1E]">{label}</div>
                <input
                  value={nums[key]}
                  onChange={(e) =>
                    setNums((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  placeholder={placeholder}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  className="tnum w-28 bg-transparent text-right text-[16px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC]"
                />
              </div>
            </div>
          ))}
          <div className="ios-separator" />
          <div className="ios-row gap-3">
            <div className="flex-1 text-[16px] text-[#8E8E93]">热量（自动计算）</div>
            <div className="tnum text-right text-[16px] font-semibold text-[#007AFF]">
              {Math.round(autoKcal)} 千卡
            </div>
          </div>
        </div>
        <p className="-mt-4 mb-6 px-4 text-[12px] text-[#AEAEB2]">
          按 蛋白质×4 + 脂肪×9 + 碳水×4 千卡/克 自动折算
        </p>

        <button
          type="button"
          disabled={!valid || saving}
          onClick={handleSave}
          className="mb-3 flex h-[50px] w-full items-center justify-center rounded-2xl bg-[#007AFF] text-[17px] font-semibold text-white active:bg-[#0066D6] disabled:opacity-40"
        >
          {saving ? '保存中…' : '保存'}
        </button>

        {food && onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className={`flex h-[50px] w-full items-center justify-center rounded-2xl text-[17px] font-semibold transition-colors ${
              confirmingDelete
                ? 'bg-[#FF3B30] text-white'
                : 'bg-white text-[#FF3B30]'
            }`}
          >
            {confirmingDelete ? '再点一次确认删除' : '删除食物'}
          </button>
        )}
        {food && (
          <p className="mt-3 text-center text-[12px] text-[#AEAEB2]">
            删除食物不会影响已保存的历史记录
          </p>
        )}
      </div>
      <div className="safe-bottom-pad shrink-0" />
    </BottomSheet>
  )
}
