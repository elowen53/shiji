import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DailyMetric, MetricInput } from '@/types'

export interface MetricsApi {
  /** 当天指标；null 表示当天还没有记录 */
  metric: DailyMetric | null
  loading: boolean
  /** upsert 当天记录（on_conflict: entry_date）；两个值都传 null 即清除 */
  save: (input: MetricInput) => Promise<boolean>
}

export function useMetrics(entryDate: string): MetricsApi {
  const [metric, setMetric] = useState<DailyMetric | null>(null)
  const [loading, setLoading] = useState(true)

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

  const save = useCallback(
    async (input: MetricInput) => {
      if (!supabase) return false
      const { data, error } = await supabase
        .from('daily_metrics')
        .upsert(
          {
            entry_date: entryDate,
            weight_kg: input.weight_kg,
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

  return { metric, loading, save }
}
