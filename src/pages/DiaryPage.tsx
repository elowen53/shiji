import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, Scale } from 'lucide-react'
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
  const { entries, loading, error, refresh, addEntry, updateEntryQuantity, deleteEntry } =
    useEntries(dateKey)
  const { metric, save: saveMetric } = useMetrics(dateKey)

  const [addOpen, setAddOpen] = useState(false)
  const [actionEntry, setActionEntry] = useState<Entry | null>(null)
  const [editEntry, setEditEntry] = useState<Entry | null>(null)
  const [metricsOpen, setMetricsOpen] = useState(false)

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
    const cleared = input.weight_kg == null && input.burn_kcal == null
    toast(
      ok ? (cleared ? '已清除' : '已保存') : '保存失败，请检查网络',
      ok ? 'success' : 'error',
    )
    return ok
  }

  return (
    <div className="flex h-full flex-col">
      {/* 顶部：日期切换 + 大标题 */}
      <header className="safe-top shrink-0 px-4 pb-2 pt-2">
        <div className="flex h-11 items-center justify-between">
          <button
            type="button"
            aria-label="前一天"
            onClick={() => setDateKey((k) => addDays(k, -1))}
            className="flex h-11 w-11 items-center justify-center rounded-full text-brand active:bg-brand/10"
          >
            <ChevronLeft size={26} strokeWidth={2.2} />
          </button>
          <div className="text-center">
            <div className="text-[13px] font-medium text-ink-2">{weekdayLabel(dateKey)}</div>
          </div>
          <button
            type="button"
            aria-label="后一天"
            onClick={() => setDateKey((k) => addDays(k, 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full text-brand active:bg-brand/10"
          >
            <ChevronRight size={26} strokeWidth={2.2} />
          </button>
        </div>
        <div className="mt-1 flex items-end justify-between">
          <AnimatePresence mode="wait" initial={false}>
            <motion.h1
              key={dateKey}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="text-[34px] font-bold leading-tight tracking-tight text-ink"
            >
              {formatDisplay(dateKey)}
            </motion.h1>
          </AnimatePresence>
          {!isToday(dateKey) && (
            <button
              type="button"
              onClick={() => setDateKey(todayKey())}
              className="mb-1 rounded-full bg-brand/10 px-3.5 py-1.5 text-[14px] font-medium text-brand active:bg-brand/20"
            >
              今天
            </button>
          )}
        </div>
      </header>

      {/* 内容区 */}
      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[152px]">
        {/* 当日汇总卡片 */}
        <section className="ios-card mb-5 px-4 py-4">
          <div className="mb-3 text-center">
            <div className="tnum text-[44px] font-bold leading-none tracking-tight text-ink">
              {fmtKcal(totals.kcal)}
            </div>
            <div className="mt-1 text-[13px] text-ink-2">今日总热量（千卡）</div>
            {metric?.burn_kcal != null && (
              <div className="tnum mt-1.5 text-[13px] text-ink-2">
                消耗 {fmtKcal(metric.burn_kcal)} 千卡 · 净摄入{' '}
                {fmtKcal(totals.kcal - metric.burn_kcal)} 千卡
              </div>
            )}
          </div>
          <div className="flex rounded-xl bg-grouped py-3">
            {(
              [
                ['蛋白质', totals.protein, 'text-brand'],
                ['脂肪', totals.fat, 'text-warn'],
                ['碳水', totals.carbs, 'text-success'],
              ] as const
            ).map(([label, v, colorClass]) => (
              <div key={label} className="flex-1 text-center">
                <div className={`tnum text-[18px] font-semibold ${colorClass}`}>
                  {fmtMacro(v)}
                  <span className="text-[12px] font-normal text-ink-2"> g</span>
                </div>
                <div className="mt-[1px] text-[12px] text-ink-2">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 今日指标：体重 + 总消耗，点按录入 */}
        <button
          type="button"
          onClick={() => setMetricsOpen(true)}
          className="ios-card mb-5 flex w-full items-center gap-3 px-4 py-3 text-left active:bg-grouped"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-success/15">
            <Scale size={18} className="text-success" />
          </div>
          <div className="min-w-0 flex-1 text-[15px] font-medium text-ink">今日指标</div>
          <div className="tnum shrink-0 text-[15px] text-ink">
            <span className="mr-1 text-[12px] font-normal text-ink-2">体重</span>
            {metric?.weight_kg != null ? (
              <>
                {fmtMacro(metric.weight_kg)}
                <span className="text-[12px] font-normal text-ink-2"> kg</span>
              </>
            ) : (
              <span className="text-ink-3">—</span>
            )}
          </div>
          <div className="tnum shrink-0 text-[15px] text-ink">
            <span className="mr-1 text-[12px] font-normal text-ink-2">消耗</span>
            {metric?.burn_kcal != null ? (
              <>
                {fmtKcal(metric.burn_kcal)}
                <span className="text-[12px] font-normal text-ink-2"> 千卡</span>
              </>
            ) : (
              <span className="text-ink-3">—</span>
            )}
          </div>
          <ChevronRight size={16} className="shrink-0 text-ink-3" />
        </button>

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
          <div className="px-4 py-14 text-center">
            <div className="mb-4 text-[52px] leading-none">🍚</div>
            <div className="mb-1 text-[17px] font-semibold text-ink">
              {isToday(dateKey) ? '今天还没有记录' : '这一天没有记录'}
            </div>
            <div className="text-[14px] text-ink-2">点右下角 ＋ 添加第一笔</div>
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
        className="absolute right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/30"
        style={{ bottom: 'calc(52px + env(safe-area-inset-bottom) + 16px)' }}
      >
        <Plus size={28} strokeWidth={2.4} />
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
