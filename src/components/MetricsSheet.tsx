import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import BottomSheet from '@/components/BottomSheet'
import { formatDisplay } from '@/lib/date'
import { CHEAT_SURPLUS_LEVELS, DEFAULT_CHEAT_SURPLUS } from '@/lib/energy'
import type { DailyMetric, MetricInput } from '@/types'

interface MetricsSheetProps {
  open: boolean
  /** 当前选中日期（YYYY-MM-DD），查看哪天就编辑哪天 */
  entryDate: string
  metric: DailyMetric | null
  onClose: () => void
  onSave: (input: MetricInput) => Promise<boolean>
}

const CHEAT_LABELS: Record<number, string> = { 500: '小超', 1000: '明显', 1500: '大吃' }

const parseOrNull = (s: string): number | null => {
  const v = parseFloat(s)
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null
}

/** 每日指标录入：体重（kg）、腰围（cm）、总消耗（千卡）与放纵日标记，允许只填部分项 */
export default function MetricsSheet({ open, entryDate, metric, onClose, onSave }: MetricsSheetProps) {
  const [weight, setWeight] = useState('')
  const [waist, setWaist] = useState('')
  const [burn, setBurn] = useState('')
  /** 放纵日估算盈余；null 表示普通日 */
  const [cheat, setCheat] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setWeight(metric?.weight_kg != null ? String(metric.weight_kg) : '')
      setWaist(metric?.waist_cm != null ? String(metric.waist_cm) : '')
      setBurn(metric?.burn_kcal != null ? String(metric.burn_kcal) : '')
      setCheat(metric?.cheat_surplus_kcal != null ? Number(metric.cheat_surplus_kcal) : null)
      setSaving(false)
    }
  }, [open, metric])

  const hasAnyValue =
    weight.trim() !== '' || waist.trim() !== '' || burn.trim() !== '' || cheat != null
  const hasExisting =
    metric != null &&
    (metric.weight_kg != null ||
      metric.waist_cm != null ||
      metric.burn_kcal != null ||
      metric.cheat_surplus_kcal != null)

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    const ok = await onSave({
      weight_kg: parseOrNull(weight),
      waist_cm: parseOrNull(waist),
      burn_kcal: parseOrNull(burn),
      cheat_surplus_kcal: cheat,
    })
    setSaving(false)
    if (ok) onClose()
  }

  const handleClear = async () => {
    if (saving) return
    setSaving(true)
    const ok = await onSave({
      weight_kg: null,
      waist_cm: null,
      burn_kcal: null,
      cheat_surplus_kcal: null,
    })
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="82%">
      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-1">
        <div className="w-9" />
        <div className="text-[17px] font-semibold text-ink">
          {formatDisplay(entryDate)} 指标
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

      <div className="no-scrollbar min-h-0 overflow-y-auto px-4 pb-4">
        <div className="ios-card mb-4">
          <div className="ios-row gap-3">
            <div className="flex-1 text-[16px] text-ink">体重（kg）</div>
            <input
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="—"
              aria-label="体重（千克）"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.1}
              className="tnum w-28 bg-transparent text-right text-[16px] text-ink outline-none placeholder:text-ink-3"
            />
          </div>
          <div className="ios-separator" />
          <div className="ios-row gap-3">
            <div className="flex-1 text-[16px] text-ink">腰围（cm）</div>
            <input
              value={waist}
              onChange={(e) => setWaist(e.target.value)}
              placeholder="—"
              aria-label="腰围（厘米）"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.1}
              className="tnum w-28 bg-transparent text-right text-[16px] text-ink outline-none placeholder:text-ink-3"
            />
          </div>
          <div className="ios-separator" />
          <div className="ios-row gap-3">
            <div className="flex-1 text-[16px] text-ink">总消耗（千卡）</div>
            <input
              value={burn}
              onChange={(e) => setBurn(e.target.value)}
              placeholder="—"
              aria-label="总消耗（千卡）"
              type="number"
              inputMode="decimal"
              min={0}
              className="tnum w-28 bg-transparent text-right text-[16px] text-ink outline-none placeholder:text-ink-3"
            />
          </div>
        </div>

        <div className="ios-card mb-2">
          <div className="ios-row gap-3">
            <div className="flex-1 text-[16px] text-ink">放纵日</div>
            <button
              type="button"
              role="switch"
              aria-checked={cheat != null}
              aria-label="放纵日"
              onClick={() => setCheat(cheat == null ? DEFAULT_CHEAT_SURPLUS : null)}
              className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${
                cheat != null ? 'bg-brand' : 'bg-fill-press'
              }`}
            >
              <span
                className={`absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${
                  cheat != null ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
          {cheat != null && (
            <>
              <div className="ios-separator" />
              <div className="px-4 py-3">
                <div className="mb-2 text-[13px] text-ink-2">估算比总消耗多吃了</div>
                <div className="flex gap-2" role="radiogroup" aria-label="估算盈余">
                  {CHEAT_SURPLUS_LEVELS.map((level) => {
                    const selected = cheat === level
                    return (
                      <button
                        key={level}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setCheat(level)}
                        className={`tnum flex-1 rounded-xl py-2 text-center ${
                          selected ? 'bg-brand text-white' : 'bg-fill text-ink'
                        }`}
                      >
                        <div className="text-[15px] font-semibold">+{level.toLocaleString('en-US')}</div>
                        <div className={`text-[11px] ${selected ? 'text-white/80' : 'text-ink-2'}`}>
                          {CHEAT_LABELS[level]}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
        <p className="mb-6 px-1 text-[12px] leading-5 text-ink-2">
          聚餐、社交没法记录热量时打开。这天按估算盈余计入热量收支，已记的食物不参与计算，也不计入蛋白质达标。
        </p>

        <button
          type="button"
          disabled={!hasAnyValue || saving}
          onClick={handleSave}
          className="pressable mb-3 flex h-[52px] w-full items-center justify-center rounded-2xl bg-brand text-[17px] font-semibold text-white active:bg-brand-press disabled:opacity-40"
        >
          {saving ? '保存中…' : '保存'}
        </button>

        {hasExisting && (
          <button
            type="button"
            disabled={saving}
            onClick={handleClear}
            className="pressable flex h-[52px] w-full items-center justify-center rounded-2xl bg-surface text-[17px] font-semibold text-danger active:bg-grouped disabled:opacity-40"
          >
            清除当天指标
          </button>
        )}
        <p className="mt-3 text-center text-[12px] text-ink-2">
          可以只填部分项，留空的项不保存
        </p>
      </div>
      <div className="safe-bottom-pad shrink-0" />
    </BottomSheet>
  )
}
