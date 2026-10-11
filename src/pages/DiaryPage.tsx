import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, Scale, Utensils } from 'lucide-react'
import BrandMasthead from '@/components/BrandMasthead'
import AddEntrySheet from '@/components/AddEntrySheet'
import EntryRow from '@/components/EntryRow'
import MacroTargetsSheet from '@/components/MacroTargetsSheet'
import MetricsSheet from '@/components/MetricsSheet'
import QuantitySheet from '@/components/QuantitySheet'
import { useEntries } from '@/hooks/useEntries'
import { useMacroTargets } from '@/hooks/useMacroTargets'
import { useMetrics } from '@/hooks/useMetrics'
import { useToast } from '@/lib/toast'
import { addDays, formatDisplay, isToday, todayKey, weekdayLabel } from '@/lib/date'
import { fmtGram, fmtKcal, fmtMacro } from '@/lib/format'
import { kcalFromMacros } from '@/lib/nutrition'
import type { DayTotals, Entry, EntrySource, Food, MacroTargets, MetricInput } from '@/types'

interface DiaryPageProps {
  foods: Food[]
}

export default function DiaryPage({ foods }: DiaryPageProps) {
  const { toast } = useToast()
  const [dateKey, setDateKey] = useState(todayKey())

  useEffect(() => {
    let lastBeijingToday = todayKey()

    const syncAfterResume = () => {
      if (document.visibilityState === 'hidden') return

      const currentBeijingToday = todayKey()
      if (currentBeijingToday !== lastBeijingToday) {
        lastBeijingToday = currentBeijingToday
        setDateKey(currentBeijingToday)
      }
    }

    document.addEventListener('visibilitychange', syncAfterResume)
    window.addEventListener('pageshow', syncAfterResume)
    return () => {
      document.removeEventListener('visibilitychange', syncAfterResume)
      window.removeEventListener('pageshow', syncAfterResume)
    }
  }, [])

  const {
    entries,
    loading,
    error,
    refresh,
    addEntry,
    updateEntryQuantity,
    deleteEntry,
    restoreEntry,
    prevDayCount,
    copyFromPrevDay,
  } = useEntries(dateKey)
  const { metric, latestWeight, save: saveMetric } = useMetrics(dateKey)
  const { targets, save: saveTargets } = useMacroTargets()

  const [addOpen, setAddOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<Entry | null>(null)
  const [metricsOpen, setMetricsOpen] = useState(false)
  const [targetsOpen, setTargetsOpen] = useState(false)
  const [copying, setCopying] = useState(false)

  const totals: DayTotals = useMemo(
    () =>
      entries.reduce<DayTotals>(
        (acc, e) => ({
          kcal: acc.kcal + e.kcal,
          protein: acc.protein + e.protein,
          fat: acc.fat + e.fat,
          carbs: acc.carbs + e.carbs,
        }),
        { kcal: 0, protein: 0, fat: 0, carbs: 0 },
      ),
    [entries],
  )

  const hasWeight = latestWeight != null && latestWeight > 0
  /** 当日摄入 g/kg：营养素总量 ÷ 所选日期最近一次有效体重（避免历史日期引用未来体重）；无体重为 null */
  const perKg = (grams: number) => (hasWeight ? grams / latestWeight! : null)

  /** 三大营养素：当日摄入与目标（目标 = g/kg 系数 × 最近体重，未设置或无体重为 null） */
  const macros = (
    [
      ['蛋白质', totals.protein, targets?.protein_g_per_kg, 'text-brand', 'bg-brand'],
      ['脂肪', totals.fat, targets?.fat_g_per_kg, 'text-warn', 'bg-warn'],
      ['碳水', totals.carbs, targets?.carbs_g_per_kg, 'text-success', 'bg-success'],
    ] as const
  ).map(([label, value, factor, textClass, barClass]) => {
    const goal = hasWeight && factor != null ? factor * latestWeight! : null
    return {
      label,
      value,
      factor: factor ?? null,
      goal,
      completion: goal != null ? Math.round((value / goal) * 100) : null,
      textClass,
      barClass,
    }
  })
  const hasAnyTarget = macros.some((m) => m.factor != null)
  /** 热量目标：三项营养素目标都设置时按 4 / 9 / 4 千卡每克折算 */
  const kcalGoal = macros.every((m) => m.goal != null)
    ? kcalFromMacros(macros[0].goal!, macros[1].goal!, macros[2].goal!)
    : null
  const kcalPct = kcalGoal ? Math.round((totals.kcal / kcalGoal) * 100) : null
  const canGoForward = dateKey < todayKey()

  const handleCopyPrevDay = async () => {
    if (copying) return
    setCopying(true)
    const ok = await copyFromPrevDay()
    setCopying(false)
    toast(
      ok ? `已复制 ${prevDayCount} 条记录` : '复制失败，请检查网络',
      ok ? 'success' : 'error',
    )
  }

  const handleAdd = async (food: EntrySource, quantity: number) => {
    const ok = await addEntry(food, quantity, dateKey)
    if (ok) toast('已保存', 'success')
    else toast('保存失败，请检查网络', 'error')
    return ok
  }

  /** 删除不再二次确认，改为提示里提供「撤销」 */
  const handleDelete = async (entry: Entry) => {
    setEditEntry(null)
    const ok = await deleteEntry(entry.id)
    if (!ok) {
      toast('删除失败，请检查网络', 'error')
      return
    }
    toast(`已删除「${entry.food_name}」`, 'info', {
      label: '撤销',
      onPress: () =>
        void restoreEntry(entry).then((restored) =>
          toast(restored ? '已恢复' : '恢复失败，请检查网络', restored ? 'success' : 'error'),
        ),
    })
  }

  const handleUpdateQuantity = async (entry: Entry, quantity: number) => {
    const ok = await updateEntryQuantity(entry, quantity)
    toast(ok ? '已更新' : '保存失败，请检查网络', ok ? 'success' : 'error')
    return ok
  }

  const handleSaveTargets = async (input: MacroTargets) => {
    const err = await saveTargets(input)
    toast(err ?? '目标已更新', err ? 'error' : 'success')
    return err == null
  }

  const handleSaveMetric = async (input: MetricInput) => {
    const ok = await saveMetric(input)
    const cleared =
      input.weight_kg == null && input.waist_cm == null && input.burn_kcal == null
    toast(
      ok ? (cleared ? '已清除' : '已保存') : '保存失败，请检查网络',
      ok ? 'success' : 'error',
    )
    return ok
  }

  return (
    <div className="flex h-full flex-col">
      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-[160px]">
        <div className="page-header -mb-2.5 pb-0">
          <BrandMasthead />
        </div>
        {/* 日期栏：滚动时吸顶，品牌栏随内容滚走 */}
        <div className="page-sticky flex items-center justify-between gap-3">
          <div>
            <div className="mb-1 text-[12px] tracking-wide text-ink-2">
              {weekdayLabel(dateKey)} · {isToday(dateKey) ? '今日饮食' : '饮食记录'}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.h1
                key={dateKey}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16 }}
                className="editorial-title whitespace-nowrap text-[clamp(24px,8vw,34px)] leading-tight text-ink"
              >
                {formatDisplay(dateKey)}
              </motion.h1>
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-1.5">
            {!isToday(dateKey) && (
              <button type="button" onClick={() => setDateKey(todayKey())}
                className="h-11 rounded-full px-2 text-[13px] font-medium text-brand active:bg-brand/10">
                今天
              </button>
            )}
            <button type="button" aria-label="前一天" onClick={() => setDateKey((k) => addDays(k, -1))} className="icon-button">
              <ChevronLeft size={20} strokeWidth={1.7} />
            </button>
            <button
              type="button"
              aria-label="后一天"
              disabled={!canGoForward}
              onClick={() => setDateKey((k) => addDays(k, 1))}
              className="icon-button disabled:opacity-35"
            >
              <ChevronRight size={20} strokeWidth={1.7} />
            </button>
          </div>
        </div>

        <div className="page-content">
          {/* 当日汇总：热量（含目标进度）+ 三大营养素（各自带目标进度） */}
          <section className="nutrition-card mb-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[13px] font-medium text-brand">{isToday(dateKey) ? '今日摄入' : '当日摄入'}</span>
              <button
                type="button"
                onClick={() => setTargetsOpen(true)}
                className="-my-2 -mr-2 h-9 rounded-full px-2.5 text-[12px] font-medium text-brand active:bg-brand/10"
              >
                {hasAnyTarget ? '调整目标' : '设置目标'}
              </button>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="tnum calorie-number">{fmtKcal(totals.kcal)}</span>
              <span className="tnum text-[14px] text-ink-2">
                {kcalGoal != null ? `/ ${fmtKcal(kcalGoal)} 千卡` : '千卡'}
              </span>
            </div>
            {kcalGoal != null && (
              <ProgressBar pct={kcalPct!} barClass="bg-brand" label="热量目标完成度" className="mt-3 h-2" />
            )}
            {(kcalGoal != null || metric?.burn_kcal != null) && (
              <div className="tnum mt-2 flex items-center justify-between gap-3 text-[12px] text-ink-2">
                <span>
                  {kcalGoal == null
                    ? ''
                    : totals.kcal <= kcalGoal
                      ? `还可摄入 ${fmtKcal(kcalGoal - totals.kcal)} 千卡`
                      : `已超出 ${fmtKcal(totals.kcal - kcalGoal)} 千卡`}
                </span>
                {metric?.burn_kcal != null && (
                  <span>
                    消耗 {fmtKcal(metric.burn_kcal)} · 净 {fmtKcal(totals.kcal - metric.burn_kcal)}
                  </span>
                )}
              </div>
            )}

            <div className="macro-grid mt-4">
              {macros.map(({ label, value, factor, goal, completion, barClass }) => {
                const kg = perKg(value)
                return (
                  <div key={label}>
                    <div className="flex items-center gap-1.5 text-[12px] text-ink-2">
                      <span className={`h-2 w-2 rounded-full ${barClass}`} aria-hidden="true" />
                      {label}
                    </div>
                    <div className="tnum mt-1 whitespace-nowrap text-[20px] font-medium leading-7 text-ink">
                      {fmtGram(value)}
                      <span className="text-[12px] font-normal text-ink-2">
                        {goal != null ? ` / ${fmtGram(goal)} g` : ' g'}
                      </span>
                    </div>
                    {goal != null ? (
                      <ProgressBar pct={completion!} barClass={barClass} label={`${label}目标完成度`} className="mt-1.5 h-1.5" />
                    ) : (
                      <div className="mt-1.5 h-1.5 rounded-full bg-brand/5" aria-hidden="true" />
                    )}
                    <div className="tnum mt-1.5 text-[11px] text-ink-2">
                      {kg != null
                        ? `${kg.toFixed(1)}${factor != null ? ` / ${fmtMacro(factor)}` : ''} g/kg`
                        : goal != null
                          ? `${completion}%`
                          : '—'}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="tnum mt-3 text-[11px] text-ink-2">
              {hasWeight
                ? hasAnyTarget
                  ? `目标按最近体重 ${fmtMacro(latestWeight!)} kg × g/kg 系数换算`
                  : '设置 g/kg 目标后，按体重自动换算每日克数'
                : '记录体重后，可按 g/kg 生成每日目标'}
            </div>
          </section>

          {/* 今日指标：体重 + 腰围 + 总消耗，点按录入 */}
          <button
            type="button"
            onClick={() => setMetricsOpen(true)}
            className="ios-card block w-full px-4 py-3 text-left active:bg-grouped"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10">
                <Scale size={18} className="text-success" />
              </div>
              <div className="min-w-0 flex-1 text-[14px] font-medium text-ink">今日指标</div>
              <ChevronRight size={16} className="shrink-0 text-ink-3" />
            </div>
            <div className="mt-3 flex">
              {(
                [
                  ['体重', metric?.weight_kg, 'kg'],
                  ['腰围', metric?.waist_cm, 'cm'],
                  ['消耗', metric?.burn_kcal, '千卡'],
                ] as const
              ).map(([label, v, unit]) => (
                <div key={label} className="flex-1">
                  <div className="text-[12px] text-ink-2">{label}</div>
                  <div className="tnum mt-1 text-[20px] font-medium text-ink">
                    {v != null ? (
                      <>
                        {unit === '千卡' ? fmtKcal(v) : fmtMacro(v)}
                        <span className="text-[12px] font-normal text-ink-2"> {unit}</span>
                      </>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </button>

          <div className="section-heading">
            <h2>饮食记录</h2>
            <span className="tnum text-[11px] font-normal tracking-normal text-ink-2">{entries.length} 条记录</span>
          </div>
          {/* 记录列表 */}
          {loading ? (
            <div className="ios-card">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  {i > 0 && <div className="ios-separator" />}
                  <div className="ios-row animate-pulse gap-3">
                    <div className="flex-1">
                      <div className="mb-2 h-4 w-24 rounded bg-fill" />
                      <div className="h-3 w-16 rounded bg-fill" />
                    </div>
                    <div className="h-4 w-14 rounded bg-fill" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="ios-card px-4 py-10 text-center">
              <p className="mb-4 text-[15px] text-ink-2">加载失败：{error}</p>
              <button
                type="button"
                onClick={() => void refresh()}
                className="rounded-full bg-brand px-5 py-2 text-[15px] font-medium text-white active:bg-brand-press"
              >
                重试
              </button>
            </div>
          ) : entries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-symbol"><Utensils size={25} strokeWidth={1.3} /></div>
              <div className="mb-1 text-[17px] font-semibold text-ink">
                {isToday(dateKey) ? '今天还没有记录' : '这一天没有记录'}
              </div>
              <div className="text-[14px] text-ink-2">点右下角「记一笔」添加第一笔</div>
              {prevDayCount > 0 && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={copying}
                  onClick={() => void handleCopyPrevDay()}
                  className="mt-6 inline-flex h-[52px] items-center justify-center rounded-2xl bg-brand px-6 text-[16px] font-semibold text-white active:bg-brand-press disabled:opacity-60"
                >
                  {copying ? '复制中…' : `复制昨天的记录（${prevDayCount} 条）`}
                </motion.button>
              )}
            </div>
          ) : (
            <div className="ios-card">
              <AnimatePresence initial={false}>
                {entries.map((e, i) => (
                  <div key={e.id}>
                    {i > 0 && <div className="ios-separator" />}
                    <EntryRow
                      entry={e}
                      onDelete={(en) => void handleDelete(en)}
                      onTap={(en) => setEditEntry(en)}
                    />
                  </div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* 添加按钮 */}
      <motion.button
        type="button"
        aria-label="添加记录"
        onClick={() => setAddOpen(true)}
        whileTap={{ scale: 0.88 }}
        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        className="absolute right-5 z-30 flex h-14 items-center justify-center gap-2 rounded-full bg-brand px-5 text-white shadow-lg shadow-brand/20"
        style={{ bottom: 'calc(68px + env(safe-area-inset-bottom) + 16px)' }}
      >
        <Plus size={21} strokeWidth={1.8} />
        <span className="text-[14px] font-medium">记一笔</span>
      </motion.button>

      <AddEntrySheet
        open={addOpen}
        foods={foods}
        onClose={() => setAddOpen(false)}
        onSave={handleAdd}
      />

      <QuantitySheet
        entry={editEntry}
        onClose={() => setEditEntry(null)}
        onSave={handleUpdateQuantity}
        onDelete={(en) => void handleDelete(en)}
      />

      <MetricsSheet
        open={metricsOpen}
        entryDate={dateKey}
        metric={metric}
        onClose={() => setMetricsOpen(false)}
        onSave={handleSaveMetric}
      />

      <MacroTargetsSheet
        open={targetsOpen}
        targets={targets}
        latestWeight={hasWeight ? latestWeight : null}
        onClose={() => setTargetsOpen(false)}
        onSave={handleSaveTargets}
      />
    </div>
  )
}

/** 细进度条：超过 100% 时填满（数值文字另行展示） */
function ProgressBar({
  pct,
  barClass,
  label,
  className,
}: {
  pct: number
  barClass: string
  label: string
  className: string
}) {
  const width = Math.min(100, Math.max(0, pct))
  return (
    <div
      className={`overflow-hidden rounded-full bg-brand/10 ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={width}
    >
      <div
        className={`h-full rounded-full ${barClass} transition-[width] duration-300`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
