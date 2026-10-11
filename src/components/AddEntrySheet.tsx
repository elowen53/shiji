import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, PencilLine, Search, X } from 'lucide-react'
import BottomSheet from '@/components/BottomSheet'
import Stepper from '@/components/Stepper'
import type { EntrySource, Food } from '@/types'
import { fmtKcal, fmtMacro } from '@/lib/format'
import { kcalFromMacros, parseManualKcal, parseNum } from '@/lib/nutrition'

interface AddEntrySheetProps {
  open: boolean
  foods: Food[]
  onClose: () => void
  onSave: (food: EntrySource, quantity: number) => Promise<boolean>
}

const MACRO_FIELDS: { key: 'protein' | 'fat' | 'carbs'; label: string }[] = [
  { key: 'protein', label: '蛋白质（克）' },
  { key: 'fat', label: '脂肪（克）' },
  { key: 'carbs', label: '碳水（克）' },
]

const EMPTY_CUSTOM = { name: '', unit: '', protein: '', fat: '', carbs: '', kcal: '' }

/**
 * 添加记录：第一步搜索选择食物，第二步输入数量并实时预览折算营养。
 * 也可走「临时记录」：直接填写本次所吃的营养，只记入当天，不进入食物库。
 */
export default function AddEntrySheet({ open, foods, onClose, onSave }: AddEntrySheetProps) {
  const [step, setStep] = useState<'pick' | 'quantity' | 'custom'>('pick')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [saving, setSaving] = useState(false)
  const [custom, setCustom] = useState(EMPTY_CUSTOM)

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
    setCustom(EMPTY_CUSTOM)
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

  const customAutoKcal = kcalFromMacros(
    parseNum(custom.protein),
    parseNum(custom.fat),
    parseNum(custom.carbs),
  )
  const customKcal = parseManualKcal(custom.kcal) ?? customAutoKcal
  const customValid = custom.name.trim().length > 0

  const openCustom = () => {
    setCustom({ ...EMPTY_CUSTOM, name: query.trim() })
    setStep('custom')
  }

  /** 临时食物：数量记为 1，营养值即本次所吃总量 */
  const handleSaveCustom = async () => {
    if (!customValid || saving) return
    setSaving(true)
    const ok = await onSave(
      {
        name: custom.name.trim(),
        unit: custom.unit.trim() || '1份',
        kcal: customKcal,
        protein: parseNum(custom.protein),
        fat: parseNum(custom.fat),
        carbs: parseNum(custom.carbs),
      },
      1,
    )
    if (ok) handleClose()
    else setSaving(false)
  }

  return (
    <BottomSheet open={open} onClose={handleClose}>
      {/* 标题栏 */}
      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-1">
        {step !== 'pick' ? (
          <button
            type="button"
            onClick={() => setStep('pick')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-fill"
            aria-label="返回"
          >
            <ChevronLeft size={20} className="text-ink" />
          </button>
        ) : (
          <div className="w-9" />
        )}
        <div className="text-[17px] font-semibold text-ink">
          {step === 'pick' ? '添加记录' : step === 'custom' ? '临时记录' : selected?.name}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-fill"
          aria-label="关闭"
        >
          <X size={18} className="text-ink" />
        </button>
      </div>

      <div className="relative min-h-0 h-[440px] flex-auto overflow-y-auto no-scrollbar">
        <AnimatePresence mode="wait" initial={false}>
          {step === 'pick' ? (
            <motion.div
              key="pick"
              className="flex min-h-full flex-col px-4 pb-4"
              initial={{ opacity: 0, x: -28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -28 }}
              transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            >
              {/* 搜索框 */}
              <div className="search-field mb-3 shrink-0">
                <Search size={17} className="shrink-0 text-ink-2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索食物"
                  aria-label="搜索食物"
                  className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-2"
                />
              </div>

              <button
                type="button"
                onClick={openCustom}
                className="ios-card ios-row mb-3 w-full shrink-0 gap-3 text-left active:bg-grouped"
              >
                <PencilLine size={18} className="shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] text-ink">
                    {query.trim() ? `临时记录「${query.trim()}」` : '临时记录'}
                  </div>
                  <div className="mt-[1px] text-[13px] text-ink-2">
                    外食、偶尔吃一次的食物，只记入当天，不存入食物库
                  </div>
                </div>
              </button>

              <div className="ios-card shrink-0">
                {filtered.length === 0 ? (
                  <div className="px-4 py-10 text-center text-[15px] text-ink-2">
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
                        className="ios-row w-full gap-3 text-left active:bg-grouped"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[16px] text-ink">{f.name}</div>
                          <div className="tnum mt-[1px] text-[13px] text-ink-2">
                            每{f.unit}
                          </div>
                        </div>
                        <div className="tnum shrink-0 text-[15px] text-ink-2">
                          {fmtKcal(f.kcal)} 千卡
                        </div>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          ) : step === 'custom' ? (
            <motion.div
              key="custom"
              className="flex min-h-full flex-col px-4 pb-4"
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 28 }}
              transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            >
              <div className="ios-card mb-4">
                <div className="ios-row">
                  <input
                    value={custom.name}
                    onChange={(e) => setCustom((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="名称，如：餐厅牛肉面"
                    aria-label="食物名称"
                    className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-3"
                  />
                </div>
                <div className="ios-separator" />
                <div className="ios-row">
                  <input
                    value={custom.unit}
                    onChange={(e) => setCustom((prev) => ({ ...prev, unit: e.target.value }))}
                    placeholder="份量描述（可选），如：1碗 / 1份，默认 1份"
                    aria-label="份量描述"
                    className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-3"
                  />
                </div>
              </div>

              <div className="mb-1 px-4 text-[13px] text-ink-2">本次所吃的营养（估算即可）</div>
              <div className="ios-card mb-2">
                {MACRO_FIELDS.map(({ key, label }, i) => (
                  <div key={key}>
                    {i > 0 && <div className="ios-separator" />}
                    <div className="ios-row gap-3">
                      <div className="flex-1 text-[16px] text-ink">{label}</div>
                      <input
                        value={custom[key]}
                        onChange={(e) => setCustom((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder="0"
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
                  <div className="flex-1 text-[16px] text-ink">热量（千卡）</div>
                  <input
                    value={custom.kcal}
                    onChange={(e) => setCustom((prev) => ({ ...prev, kcal: e.target.value }))}
                    placeholder={String(Math.round(customAutoKcal))}
                    aria-label="热量（千卡）"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    className="tnum w-28 bg-transparent text-right text-[16px] text-ink outline-none placeholder:text-ink-3"
                  />
                </div>
              </div>
              <p className="mb-5 px-4 text-[12px] text-ink-2">
                热量留空则按 蛋白质×4 + 脂肪×9 + 碳水×4 自动折算；只知道热量时可只填热量
              </p>

              <button
                type="button"
                disabled={!customValid || saving}
                onClick={handleSaveCustom}
                className="flex h-[52px] w-full items-center justify-center rounded-2xl bg-brand text-[17px] font-semibold text-white active:bg-brand-press disabled:opacity-40"
              >
                {saving ? '保存中…' : `保存 · ${fmtKcal(customKcal)} 千卡`}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="quantity"
              className="flex min-h-full flex-col px-4 pb-4"
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 28 }}
              transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            >
              {selected && (
                <>
                  <div className="mb-4 text-center text-[14px] text-ink-2">
                    数量（单位：{selected.unit}）
                  </div>
                  <div className="mb-5 flex justify-center">
                    <Stepper value={quantity} onChange={setQuantity} min={0.1} unit={selected.unit} />
                  </div>

                  {/* 实时折算预览 */}
                  <div className="ios-card mb-5 px-4 py-4">
                    <div className="mb-3 text-center">
                      <span className="tnum text-[34px] font-bold leading-none text-ink">
                        {fmtKcal(selected.kcal * quantity)}
                      </span>
                      <span className="ml-1 text-[15px] text-ink-2">千卡</span>
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
