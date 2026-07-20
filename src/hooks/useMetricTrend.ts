import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { TrendPoint } from '@/lib/trend'

/** daily_metrics 中可做趋势的数值字段 */
export type MetricTrendField = 'weight_kg' | 'waist_cm'

export interface MetricTrendApi {
  /** 全部非空记录，按日期升序；区间过滤在前端做 */
  points: TrendPoint[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/** 通用指标趋势查询：daily_metrics 中 field 非空的记录 */
export function useMetricTrend(field: MetricTrendField): MetricTrendApi {
  const [points, setPoints] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('daily_metrics')
      .select(`entry_date, ${field}`)
      .not(field, 'is', null)
      .order('entry_date', { ascending: true })
    if (err) {
      setError(err.message)
    } else {
      setPoints(
        ((data ?? []) as Record<string, string | number | null>[])
          .filter((r) => r[field] != null)
          .map((r) => ({ date: String(r.entry_date), value: Number(r[field]) })),
      )
    }
    setLoading(false)
  }, [field])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { points, loading, error, refresh }
}
