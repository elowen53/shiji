import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DailyMetric, MetricInput } from '@/types'

export interface MetricsApi {
  /** 当天指标；null 表示当天还没有记录 */
  metric: DailyMetric | null
  loading: boolean
  /** 截至当前查看日期（含）最近一条非空体重；查不到为 null */
  latestWeight: number | null
  /** upsert 当天记录（on_conflict: entry_date）；全部传 null 即清除。成功返回 null，失败返回错误文案 */
  save: (input: MetricInput) => Promise<string | null>
}

/** 数据库还没有 cheat_surplus_kcal 列（未执行放纵日迁移）时 PostgREST / PostgreSQL 的错误码 */
export const isMissingColumn = (code?: string) => code === 'PGRST204' || code === '42703'

export function useMetrics(entryDate: string): MetricsApi {
  const [metric, setMetric] = useState<DailyMetric | null>(null)
  const [loading, setLoading] = useState(true)
  const [latestWeight, setLatestWeight] = useState<number | null>(null)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    setLoading(true)
    supabase
      .from('daily_metrics')
      .select('*')
      .eq('entry_date', entryDate)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error) setMetric((data ?? null) as DailyMetric | null)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [entryDate])

  // 蛋白质 g/kg 用：截至查看日期的最近一条体重
  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    supabase
      .from('daily_metrics')
      .select('weight_kg')
      .not('weight_kg', 'is', null)
      .lte('entry_date', entryDate)
      .order('entry_date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error) {
          const w = (data as { weight_kg: number | null } | null)?.weight_kg
          setLatestWeight(w != null && w > 0 ? Number(w) : null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [entryDate])

  const save = useCallback(
    async (input: MetricInput) => {
      const db = supabase
      if (!db) return '保存失败，请检查网络'
      const base = {
        entry_date: entryDate,
        weight_kg: input.weight_kg,
        waist_cm: input.waist_cm,
        burn_kcal: input.burn_kcal,
        updated_at: new Date().toISOString(),
      }
      const upsert = (row: typeof base & { cheat_surplus_kcal?: number | null }) =>
        db.from('daily_metrics').upsert(row, { onConflict: 'entry_date' }).select().single()
      let { data, error } = await upsert({ ...base, cheat_surplus_kcal: input.cheat_surplus_kcal })
      if (error && isMissingColumn(error.code)) {
        // 旧库没有放纵日列：普通指标照常保存，只有真的要标记放纵日时才报错
        if (input.cheat_surplus_kcal != null) return '标记放纵日前，请先执行放纵日数据库迁移'
        ;({ data, error } = await upsert(base))
      }
      if (error) return '保存失败，请检查网络'
      setMetric(data as DailyMetric)
      // 体重保存或清空后重新取截至当天的最近体重，让营养目标立即跟随。
      const { data: latest, error: weightError } = await db
        .from('daily_metrics')
        .select('weight_kg')
        .not('weight_kg', 'is', null)
        .lte('entry_date', entryDate)
        .order('entry_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!weightError) {
        const w = latest?.weight_kg
        setLatestWeight(w != null && Number(w) > 0 ? Number(w) : null)
      }
      return null
    },
    [entryDate],
  )

  return { metric, loading, latestWeight, save }
}
