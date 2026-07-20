import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DailyMetric, MetricInput } from '@/types'

export interface MetricsApi {
  /** 当天指标；null 表示当天还没有记录 */
  metric: DailyMetric | null
  loading: boolean
  /** 截至当前查看日期（含）最近一条非空体重；查不到为 null */
  latestWeight: number | null
  /** upsert 当天记录（on_conflict: entry_date）；两个值都传 null 即清除 */
  save: (input: MetricInput) => Promise<boolean>
}

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
      if (!supabase) return false
      const { data, error } = await supabase
        .from('daily_metrics')
        .upsert(
          {
            entry_date: entryDate,
            weight_kg: input.weight_kg,
            waist_cm: input.waist_cm,
            burn_kcal: input.burn_kcal,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'entry_date' },
        )
        .select()
        .single()
      if (error) return false
      setMetric(data as DailyMetric)
      return true
    },
    [entryDate],
  )

  return { metric, loading, latestWeight, save }
}
