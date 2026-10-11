import { useState } from 'react'
import { X } from 'lucide-react'
import BottomSheet from '@/components/BottomSheet'
import { fmtKcal, fmtMacro } from '@/lib/format'
import { kcalFromMacros } from '@/lib/nutrition'
import type { MacroTargets } from '@/types'

interface MacroTargetsSheetProps {
  open: boolean
  /** 已保存的目标；null 表示从未设置 */
  targets: MacroTargets | null
  /** 截至当前查看日期的最近体重，用于预览每日克数 */
  latestWeight: number | null
  onClose: () => void
  onSave: (input: MacroTargets) => Promise<boolean>
}

type FieldKey = keyof MacroTargets

const FIELDS: { key: FieldKey; label: string; hint: string }[] = [
  { key: 'protein_g_per_kg', label: '蛋白质', hint: '常见 1.6 – 2.2' },
  { key: 'fat_g_per_kg', label: '脂肪', hint: '常见 0.6 – 1.0' },
  { key: 'carbs_g_per_kg', label: '碳水', hint: '常见 2 – 5' },
]

/** 空值或 0 视为不设置该项目标 */
const parseFactor = (s: string): number | null => {
  const v = parseFloat(s)
  const rounded = Math.round(v * 100) / 100
  return Number.isFinite(rounded) && rounded > 0 ? rounded : null
}

/** 三大营养素目标：按「克 / 公斤体重」设置，每日目标随最近体重自动换算 */
export default function MacroTargetsSheet({
  open,
  targets,
  latestWeight,
  onClose,
  onSave,
}: MacroTargetsSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="82%">
      <MacroTargetsForm
        key={JSON.stringify(targets)}
        targets={targets}
        latestWeight={latestWeight}
        onClose={onClose}
        onSave={onSave}
      />
    </BottomSheet>
  )
}

function MacroTargetsForm({ targets, latestWeight, onClose, onSave }: Omit<MacroTargetsSheetProps, 'open'>) {
  // 表单随 Sheet 打开挂载，每次都以最新保存值初始化。
  const [values, setValues] = useState<Record<FieldKey, string>>(() => {
    const str = (v: number | null | undefined) => (v != null ? String(v) : '')
    return {
      protein_g_per_kg: targets ? str(targets.protein_g_per_kg) : '2',
      fat_g_per_kg: str(targets?.fat_g_per_kg),
      carbs_g_per_kg: str(targets?.carbs_g_per_kg),
    }
  })
  const [saving, setSaving] = useState(false)

  const factors = {
    protein_g_per_kg: parseFactor(values.protein_g_per_kg),
    fat_g_per_kg: parseFactor(values.fat_g_per_kg),
    carbs_g_per_kg: parseFactor(values.carbs_g_per_kg),
  }
  const grams = (f: number | null) => (f != null && latestWeight != null ? f * latestWeight : null)
  const allSet = Object.values(factors).every((f) => f != null)
  const totalKcal =
    allSet && latestWeight != null
      ? kcalFromMacros(
          grams(factors.protein_g_per_kg)!,
          grams(factors.fat_g_per_kg)!,
          grams(factors.carbs_g_per_kg)!,
        )
      : null

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    const ok = await onSave(factors)
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <>
      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-1">
        <div className="w-9" />
        <div className="text-[17px] font-semibold text-ink">每日营养目标</div>
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
        <div className="mb-1 px-4 text-[13px] text-ink-2">
          {latestWeight != null
            ? `每公斤体重克数 · 按最近体重 ${fmtMacro(latestWeight)} kg 换算`
            : '每公斤体重克数 · 记录体重后自动换算为每日克数'}
        </div>
        <div className="ios-card mb-2">
          {FIELDS.map(({ key, label, hint }, i) => {
            const g = grams(factors[key])
            return (
              <div key={key}>
                {i > 0 && <div className="ios-separator" />}
                <div className="ios-row gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] text-ink">{label}</div>
                    <div className="tnum mt-[1px] text-[12px] text-ink-2">
                      {g != null ? `每日 ${fmtMacro(g)} g` : hint}
                    </div>
                  </div>
                  <input
                    value={values[key]}
                    onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder="不设置"
                    aria-label={`${label}（克每公斤体重）`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.1}
                    className="tnum w-24 bg-transparent text-right text-[16px] text-ink outline-none placeholder:text-ink-3"
                  />
                  <span className="shrink-0 text-[14px] text-ink-2">g/kg</span>
                </div>
              </div>
            )
          })}
        </div>
        <p className="mb-6 px-4 text-[12px] text-ink-2">
          {totalKcal != null
            ? `三项合计约 ${fmtKcal(totalKcal)} 千卡/天。`
            : ''}
          留空表示不设置该项目标；体重变化后目标自动跟随。
        </p>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="flex h-[52px] w-full items-center justify-center rounded-2xl bg-brand text-[17px] font-semibold text-white active:bg-brand-press disabled:opacity-40"
        >
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
      <div className="safe-bottom-pad shrink-0" />
    </>
  )
}
