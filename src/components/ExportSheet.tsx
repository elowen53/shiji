import { useEffect, useState } from 'react'
import { FileSpreadsheet, FileText, X } from 'lucide-react'
import BottomSheet from '@/components/BottomSheet'
import { supabase } from '@/lib/supabase'
import { todayKey } from '@/lib/date'
import { useToast } from '@/lib/toast'
import {
  buildDailySummaryCsv,
  buildEntriesCsv,
  downloadCsv,
  summarizeDays,
} from '@/lib/exportCsv'
import type { DailyMetric, Entry } from '@/types'

interface ExportSheetProps {
  open: boolean
  onClose: () => void
}

/** 导出数据：每日汇总 / 饮食明细 两种 CSV（打开时一次性全量拉取） */
export default function ExportSheet({ open, onClose }: ExportSheetProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [metrics, setMetrics] = useState<DailyMetric[]>([])

  useEffect(() => {
    if (!open || !supabase) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase
        .from('entries')
        .select('*')
        .order('entry_date', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('daily_metrics').select('*').order('entry_date', { ascending: true }),
    ]).then(([e, m]) => {
      if (cancelled) return
      if (e.error || m.error) {
        toast('读取数据失败，请检查网络', 'error')
      } else {
        setEntries((e.data ?? []) as Entry[])
        setMetrics((m.data ?? []) as DailyMetric[])
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [open, toast])

  const summaryDays = summarizeDays(entries, metrics).length
  const detailCount = entries.length
  const date = todayKey()

  const exportSummary = () => {
    if (summaryDays === 0) return
    downloadCsv(`食记_每日汇总_${date}.csv`, buildDailySummaryCsv(entries, metrics))
    toast(`已导出每日汇总（共 ${summaryDays} 天）`, 'success')
    onClose()
  }

  const exportDetail = () => {
    if (detailCount === 0) return
    downloadCsv(`食记_饮食明细_${date}.csv`, buildEntriesCsv(entries))
    toast(`已导出饮食明细（共 ${detailCount} 条）`, 'success')
    onClose()
  }

  const options = [
    {
      key: 'summary',
      icon: FileSpreadsheet,
      title: '每日汇总 CSV',
      desc: '日期、摄入、三大营养素、体重、腰围、消耗、净摄入',
      count: summaryDays,
      countLabel: `共 ${summaryDays} 天`,
      onExport: exportSummary,
    },
    {
      key: 'detail',
      icon: FileText,
      title: '饮食明细 CSV',
      desc: '每一行一条饮食记录，含数量与折算营养',
      count: detailCount,
      countLabel: `共 ${detailCount} 条`,
      onExport: exportDetail,
    },
  ] as const

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="60%">
      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-1">
        <div className="w-9" />
        <div className="text-[17px] font-semibold text-ink">导出数据</div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-fill active:bg-fill-press"
          aria-label="关闭"
        >
          <X size={18} className="text-ink" />
        </button>
      </div>

      <div className="px-4 pb-4">
        <div className="ios-card">
          {options.map(({ key, icon: Icon, title, desc, count, countLabel, onExport }, i) => {
            const disabled = loading || count === 0
            return (
              <div key={key}>
                {i > 0 && <div className="ios-separator" />}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onExport}
                  className="ios-row w-full gap-3 py-3 text-left active:bg-grouped disabled:active:bg-surface"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand/10">
                    <Icon size={18} className="text-brand" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-[16px] ${disabled ? 'text-ink-3' : 'text-ink'}`}
                    >
                      {title}
                    </div>
                    <div className="mt-[1px] truncate text-[12px] text-ink-2">{desc}</div>
                  </div>
                  <div className="shrink-0 text-[13px] text-ink-2">
                    {loading ? '…' : count === 0 ? '暂无数据' : countLabel}
                  </div>
                </button>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-center text-[12px] text-ink-2">
          UTF-8 带 BOM，Excel 可直接打开；iOS 会存入「文件」App
        </p>
      </div>
      <div className="safe-bottom-pad shrink-0" />
    </BottomSheet>
  )
}
