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

/** 按三大营养素折算热量（与表单逻辑一致） */
const kcalFromMacros = (protein: number, fat: number, carbs: number) =>
  Math.round(
    (protein * KCAL_PER_G.protein + fat * KCAL_PER_G.fat + carbs * KCAL_PER_G.carbs) * 10,
  ) / 10

/** 新增 / 编辑食物：名称与单位完全自定义，营养值为每单位含量 */
export default function FoodFormSheet({ open, food, onClose, onSave, onDelete }: FoodFormSheetProps) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [nums, setNums] = useState({ protein: '', fat: '', carbs: '' })
  const [manualKcal, setManualKcal] = useState('')
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
      // 存储热量与三大营养素折算值不一致（误差 >0.5）→ 视为手动覆盖过，回填手动值
      if (food) {
        const auto = kcalFromMacros(food.protein, food.fat, food.carbs)
        setManualKcal(Math.abs(food.kcal - auto) > 0.5 ? String(food.kcal) : '')
      } else {
        setManualKcal('')
      }
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
  const autoKcal = kcalFromMacros(parseNum(nums.protein), parseNum(nums.fat), parseNum(nums.carbs))

  /** 手动热量：填写正数则覆盖自动值 */
  const manualKcalValue = (() => {
    const v = parseFloat(manualKcal)
    return Number.isFinite(v) && v > 0 ? Math.round(v * 10) / 10 : null
  })()

  const handleSave = async () => {
    if (!valid || saving) return
    setSaving(true)
    const ok = await onSave({
      name: name.trim(),
      unit: unit.trim(),
      kcal: manualKcalValue ?? autoKcal,
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
        <div className="text-[17px] font-semibold text-ink">
          {food ? '编辑食物' : '新增食物'}
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

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="ios-card mb-4">
          <div className="ios-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="名称，如：鸡胸肉"
              aria-label="食物名称"
              className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-3"
            />
          </div>
          <div className="ios-separator" />
          <div className="ios-row">
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="单位，如：100g / 1份 / 1碗"
              aria-label="单位"
              className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-3"
            />
          </div>
        </div>

        <div className="mb-1 px-4 text-[13px] text-ink-2">每单位三大营养素</div>
        <div className="ios-card mb-6">
          {NUM_FIELDS.map(({ key, label, placeholder }, i) => (
            <div key={key}>
              {i > 0 && <div className="ios-separator" />}
              <div className="ios-row gap-3">
                <div className="flex-1 text-[16px] text-ink">{label}</div>
                <input
                  value={nums[key]}
                  onChange={(e) =>
                    setNums((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  placeholder={placeholder}
                  aria-label={label}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  className="tnum w-28 bg-transparent text-right text-[16px] text-ink outline-none placeholder:text-ink-3"
                />
              </div>
            </div>
          ))}
          <div className="ios-separator" />
          <div className="ios-row gap-3">
            <div className="flex-1 text-[16px] text-ink-2">热量（自动计算）</div>
            <div className="tnum text-right text-[16px] font-semibold text-brand">
              {Math.round(autoKcal)} 千卡
            </div>
          </div>
          <div className="ios-separator" />
          <div className="ios-row gap-3">
            <div className="flex-1 text-[16px] text-ink">手动热量（可选）</div>
            <input
              value={manualKcal}
              onChange={(e) => setManualKcal(e.target.value)}
              placeholder={String(Math.round(autoKcal))}
              aria-label="手动热量（可选，千卡）"
              type="number"
              inputMode="decimal"
              min={0}
              className="tnum w-28 bg-transparent text-right text-[16px] text-ink outline-none placeholder:text-ink-3"
            />
          </div>
        </div>
        <p className="-mt-4 mb-6 px-4 text-[12px] text-ink-2">
          按 蛋白质×4 + 脂肪×9 + 碳水×4 千卡/克 自动折算；填写手动热量则优先使用。
          包装食品标签能量单位为 kJ，÷4.184 即千卡
        </p>

        <button
          type="button"
          disabled={!valid || saving}
          onClick={handleSave}
          className="mb-3 flex h-[52px] w-full items-center justify-center rounded-2xl bg-brand text-[17px] font-semibold text-white active:bg-brand-press disabled:opacity-40"
        >
          {saving ? '保存中…' : '保存'}
        </button>

        {food && onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className={`flex h-[52px] w-full items-center justify-center rounded-2xl text-[17px] font-semibold transition-colors ${
              confirmingDelete
                ? 'bg-danger text-white'
                : 'bg-surface text-danger'
            }`}
          >
            {confirmingDelete ? '再点一次确认删除' : '删除食物'}
          </button>
        )}
        {food && (
          <p className="mt-3 text-center text-[12px] text-ink-2">
            删除食物不会影响已保存的历史记录
          </p>
        )}
      </div>
      <div className="safe-bottom-pad shrink-0" />
    </BottomSheet>
  )
}
