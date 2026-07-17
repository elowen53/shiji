import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import AddEntrySheet from '@/components/AddEntrySheet'
import BottomSheet from '@/components/BottomSheet'
import EntryRow from '@/components/EntryRow'
import QuantitySheet from '@/components/QuantitySheet'
import { useEntries } from '@/hooks/useEntries'
import { useToast } from '@/lib/toast'
import { addDays, formatDisplay, isToday, todayKey, weekdayLabel } from '@/lib/date'
import { fmtKcal, fmtMacro } from '@/lib/format'
import type { DayTotals, Entry, Food } from '@/types'

interface DiaryPageProps {
  foods: Food[]
}

export default function DiaryPage({ foods }: DiaryPageProps) {
  const { toast } = useToast()
  const [dateKey, setDateKey] = useState(todayKey())
  const { entries, loading, error, refresh, addEntry, updateEntryQuantity, deleteEntry } =
    useEntries(dateKey)

  const [addOpen, setAddOpen] = useState(false)
  const [actionEntry, setActionEntry] = useState<Entry | null>(null)
  const [editEntry, setEditEntry] = useState<Entry | null>(null)

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

  return (
    <div className="flex h-full flex-col">
      {/* 顶部：日期切换 + 大标题 */}
      <header className="safe-top shrink-0 px-4 pb-2 pt-2">
        <div className="flex h-11 items-center justify-between">
          <button
            type="button"
            aria-label="前一天"
            onClick={() => setDateKey((k) => addDays(k, -1))}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#007AFF] active:bg-[#007AFF]/10"
          >
            <ChevronLeft size={26} strokeWidth={2.2} />
          </button>
          <div className="text-center">
            <div className="text-[13px] font-medium text-[#8E8E93]">{weekdayLabel(dateKey)}</div>
          </div>
          <button
            type="button"
            aria-label="后一天"
            onClick={() => setDateKey((k) => addDays(k, 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#007AFF] active:bg-[#007AFF]/10"
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
              className="text-[34px] font-bold leading-tight tracking-tight text-[#1C1C1E]"
            >
              {formatDisplay(dateKey)}
            </motion.h1>
          </AnimatePresence>
          {!isToday(dateKey) && (
            <button
              type="button"
              onClick={() => setDateKey(todayKey())}
              className="mb-1 rounded-full bg-[#007AFF]/10 px-3.5 py-1.5 text-[14px] font-medium text-[#007AFF] active:bg-[#007AFF]/20"
            >
              今天
            </button>
          )}
        </div>
      </header>

      {/* 内容区 */}
      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[150px]">
        {/* 当日汇总卡片 */}
        <section className="ios-card mb-5 px-4 py-4">
          <div className="mb-3 text-center">
            <div className="tnum text-[44px] font-bold leading-none tracking-tight text-[#1C1C1E]">
              {fmtKcal(totals.kcal)}
            </div>
            <div className="mt-1 text-[13px] text-[#8E8E93]">今日总热量（千卡）</div>
          </div>
          <div className="flex rounded-xl bg-[#F2F2F7] py-3">
            {(
              [
                ['蛋白质', totals.protein, '#007AFF'],
                ['脂肪', totals.fat, '#FF9500'],
                ['碳水', totals.carbs, '#34C759'],
              ] as const
            ).map(([label, v, color]) => (
              <div key={label} className="flex-1 text-center">
                <div className="tnum text-[18px] font-semibold" style={{ color }}>
                  {fmtMacro(v)}
                  <span className="text-[12px] font-normal text-[#8E8E93]"> g</span>
                </div>
                <div className="mt-[1px] text-[12px] text-[#8E8E93]">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 记录列表 */}
        {loading ? (
          <div className="ios-card">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                {i > 0 && <div className="ios-separator" />}
                <div className="ios-row animate-pulse gap-3">
                  <div className="flex-1">
                    <div className="mb-2 h-4 w-24 rounded bg-[#E5E5EA]" />
                    <div className="h-3 w-16 rounded bg-[#E5E5EA]" />
                  </div>
                  <div className="h-4 w-14 rounded bg-[#E5E5EA]" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="ios-card px-4 py-10 text-center">
            <p className="mb-4 text-[15px] text-[#8E8E93]">加载失败：{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-full bg-[#007AFF] px-5 py-2 text-[15px] font-medium text-white active:bg-[#0066D6]"
            >
              重试
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <div className="mb-4 text-[52px] leading-none">🍚</div>
            <div className="mb-1 text-[17px] font-semibold text-[#1C1C1E]">
              {isToday(dateKey) ? '今天还没有记录' : '这一天没有记录'}
            </div>
            <div className="text-[14px] text-[#8E8E93]">点右下角 ＋ 添加第一笔</div>
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
        className="absolute right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#007AFF] text-white shadow-lg shadow-[#007AFF]/30"
        style={{ bottom: 'calc(52px + env(safe-area-inset-bottom) + 18px)' }}
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
          <div className="mb-2 truncate px-2 text-center text-[14px] text-[#8E8E93]">
            {actionEntry?.food_name}
          </div>
          <div className="ios-card mb-3">
            <button
              type="button"
              className="ios-row w-full justify-center text-[17px] text-[#007AFF] active:bg-[#F2F2F7]"
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
              className="ios-row w-full justify-center text-[17px] text-[#FF3B30] active:bg-[#F2F2F7]"
              onClick={() => {
                if (actionEntry) void handleDelete(actionEntry)
              }}
            >
              删除
            </button>
          </div>
          <button
            type="button"
            className="ios-card flex h-[50px] w-full items-center justify-center text-[17px] font-semibold text-[#007AFF] active:bg-[#F2F2F7]"
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
    </div>
  )
}
