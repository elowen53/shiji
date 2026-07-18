import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface WeightPoint {
  /** YYYY-MM-DD */
  date: string
  weight: number
}

export interface WeightTrendApi {
  /** 全部非空体重记录，按日期升序；区间过滤在前端做 */
  points: WeightPoint[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useWeightTrend(): WeightTrendApi {
  const [points, setPoints] = useState<WeightPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('daily_metrics')
      .select('entry_date, weight_kg')
      .not('weight_kg', 'is', null)
      .order('entry_date', { ascending: true })
    if (err) {
      setError(err.message)
    } else {
      setPoints(
        ((data ?? []) as { entry_date: string; weight_kg: number | null }[])
          .filter((r) => r.weight_kg != null)
          .map((r) => ({ date: r.entry_date, weight: Number(r.weight_kg) })),
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { points, loading, error, refresh }
}
