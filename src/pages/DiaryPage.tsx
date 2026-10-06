import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, Scale, Utensils } from 'lucide-react'
import BrandMasthead from '@/components/BrandMasthead'
import AddEntrySheet from '@/components/AddEntrySheet'
import BottomSheet from '@/components/BottomSheet'
import EntryRow from '@/components/EntryRow'
import MetricsSheet from '@/components/MetricsSheet'
import QuantitySheet from '@/components/QuantitySheet'
import { useEntries } from '@/hooks/useEntries'
import { useMetrics } from '@/hooks/useMetrics'
import { useToast } from '@/lib/toast'
import { addDays, formatDisplay, isToday, todayKey, weekdayLabel } from '@/lib/date'
import { fmtKcal, fmtMacro } from '@/lib/format'
import type { DayTotals, Entry, Food, MetricInput } from '@/types'

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
    prevDayCount,
    copyFromPrevDay,
  } = useEntries(dateKey)
  const { metric, latestWeight, save: saveMetric } = useMetrics(dateKey)

  const [addOpen, setAddOpen] = useState(false)
  const [actionEntry, setActionEntry] = useState<Entry | null>(null)
  const [editEntry, setEditEntry] = useState<Entry | null>(null)
  const [metricsOpen, setMetricsOpen] = useState(false)
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

  /** 蛋白质 g/kg：当日蛋白质总量 ÷ 最近体重；无体重数据为 null */
  const proteinPerKg =
    latestWeight != null && latestWeight > 0 ? totals.protein / latestWeight : null
  /** 蛋白质目标：所选日期最近一次有效体重 × 2 g/kg，避免历史日期引用未来体重。 */
  const proteinGoal =
    latestWeight != null && latestWeight > 0 ? latestWeight * 2 : null
  const proteinCompletion =
    proteinGoal != null ? Math.round((totals.protein / proteinGoal) * 100) : null

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

  const handleAdd = async (food: Food, quantity: number) => {
    const ok = await addEntry(food, quantity, dateKey)
    if (ok) toast('已保存', 'success')
    else toast('保存失败，请检查网络', 'error')
    return ok
  }

  const handleDelete = async (entry: Entry) => {
    setActionEntry(null)
    const ok = await deleteEntry(entry.id)
    toast(ok ? '已删除' : '删除失败，请检查网络', ok ? 'success' : 'error')
  }

  const handleUpdateQuantity = async (entry: Entry, quantity: number) => {
    const ok = await updateEntryQuantity(entry, quantity)
    toast(ok ? '已更新' : '保存失败，请检查网络', ok ? 'success' : 'error')
    return ok
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
      {/* 顶部：日期切换 + 大标题 */}
      <header className="page-header">
        <BrandMasthead />
        <div className="flex items-center justify-between gap-3">
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
            <button type="button" aria-label="后一天" onClick={() => setDateKey((k) => addDays(k, 1))} className="icon-button">
              <ChevronRight size={20} strokeWidth={1.7} />
            </button>
          </div>
        </div>
      </header>

      {/* 内容区 */}
      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto page-content pb-[160px]">
        {/* 当日汇总卡片 */}
        <section className="nutrition-card mb-4">
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-medium text-brand">{isToday(dateKey) ? '今日总热量' : '当日总热量'}</span>
              <span className="text-[9px] tracking-[0.16em] text-brand/70" aria-hidden="true">DAILY INTAKE</span>
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="tnum calorie-number">{fmtKcal(totals.kcal)}</span>
              <span className="text-[13px] text-ink-2">千卡</span>
            </div>
            {metric?.burn_kcal != null && (
              <div className="tnum mt-1.5 text-[13px] text-ink-2">
                消耗 {fmtKcal(metric.burn_kcal)} 千卡 · 净摄入{' '}
                {fmtKcal(totals.kcal - metric.burn_kcal)} 千卡
              </div>
            )}
          </div>
          <div className="macro-grid">
            {(
              [
                [
                  '蛋白质',
                  totals.protein,
                  'text-brand',
                  proteinPerKg != null ? `${proteinPerKg.toFixed(1)} g/kg` : '',
                ],
                ['脂肪', totals.fat, 'text-warn', ''],
                ['碳水', totals.carbs, 'text-success', ''],
              ] as const
            ).map(([label, v, colorClass, sub]) => (
              <div key={label} className="flex-1 text-center">
                <div className={`tnum text-[22px] font-medium ${colorClass}`}>
                  {fmtMacro(v)}
                  <span className="text-[12px] font-normal text-ink-2"> g</span>
                </div>
                <div className="mt-[1px] text-[12px] text-ink-2">{label}</div>
                {proteinPerKg != null && (
                  <div className="tnum mt-[1px] h-4 text-[12px] leading-4 text-ink-2">{sub}</div>
                )}
              </div>
            ))}
          </div>
          {proteinGoal != null && proteinCompletion != null ? (
            <div className="mt-3 px-1">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="font-medium text-ink">蛋白质目标</span>
                <span className="tnum text-ink-2">
                  {fmtMacro(totals.protein)} / {fmtMacro(proteinGoal)} g · {proteinCompletion}%
                </span>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand/10"
                role="progressbar"
                aria-label="蛋白质目标完成度"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, Math.max(0, proteinCompletion))}
              >
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, proteinCompletion))}%` }}
                />
              </div>
              <div className="tnum mt-1.5 text-[11px] text-ink-2">
                按最近体重 {fmtMacro(latestWeight!)} kg × 2 g/kg 计算
              </div>
            </div>
          ) : (
            <div className="mt-3 px-1 text-[12px] text-ink-2">
              记录体重后生成蛋白质目标（2 g/kg）
            </div>
          )}
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
            <div className="text-[14px] text-ink-2">点右下角 ＋ 添加第一笔</div>
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
                    onTap={(en) => setActionEntry(en)}
                  />
                </div>
              ))}
            </AnimatePresence>
          </div>
        )}
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

      {/* 条目操作 Action Sheet */}
      <BottomSheet open={actionEntry !== null} onClose={() => setActionEntry(null)} maxHeight="60%">
        <div className="px-4 pb-3 pt-1">
          <div className="mb-2 truncate px-2 text-center text-[14px] text-ink-2">
            {actionEntry?.food_name}
          </div>
          <div className="ios-card mb-3">
            <button
              type="button"
              className="ios-row w-full justify-center text-[17px] text-brand active:bg-grouped"
              onClick={() => {
                const en = actionEntry
                setActionEntry(null)
                if (en) setEditEntry(en)
              }}
            >
              修改数量
            </button>
            <div className="ios-separator" />
            <button
              type="button"
              className="ios-row w-full justify-center text-[17px] text-danger active:bg-grouped"
              onClick={() => {
                if (actionEntry) void handleDelete(actionEntry)
              }}
            >
              删除
            </button>
          </div>
          <button
            type="button"
            className="ios-card flex h-[52px] w-full items-center justify-center text-[17px] font-semibold text-brand active:bg-grouped"
            onClick={() => setActionEntry(null)}
          >
            取消
          </button>
        </div>
        <div className="safe-bottom-pad shrink-0" />
      </BottomSheet>

      <QuantitySheet
        entry={editEntry}
        onClose={() => setEditEntry(null)}
        onSave={handleUpdateQuantity}
      />

      <MetricsSheet
        open={metricsOpen}
        entryDate={dateKey}
        metric={metric}
        onClose={() => setMetricsOpen(false)}
        onSave={handleSaveMetric}
      />
    </div>
  )
}
