import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { todayKey } from '@/lib/date'
import { buildDailyBalances, type DailyBalance } from '@/lib/energy'

export interface EnergyBalanceApi {
  /** 全部完整日（既有饮食又有消耗、且已结束），按日期升序 */
  balances: DailyBalance[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/** Supabase 单次查询最多返回 1000 行，按页取全 */
const PAGE = 1000

async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

/** 每日热量收支：汇总 entries 的摄入与 daily_metrics 的总消耗 */
export function useEnergyBalance(): EnergyBalanceApi {
  const [balances, setBalances] = useState<DailyBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const db = supabase
    if (!db) return
    setLoading(true)
    setError(null)
    try {
      const [entries, burns] = await Promise.all([
        fetchAll<{ entry_date: string; kcal: number }>((from, to) =>
          db
            .from('entries')
            .select('entry_date, kcal')
            .order('entry_date', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        ),
        fetchAll<{ entry_date: string; burn_kcal: number }>((from, to) =>
          db
            .from('daily_metrics')
            .select('entry_date, burn_kcal')
            .not('burn_kcal', 'is', null)
            .order('entry_date', { ascending: true })
            .range(from, to),
        ),
      ])
      const intake = new Map<string, number>()
      for (const e of entries) {
        intake.set(e.entry_date, (intake.get(e.entry_date) ?? 0) + Number(e.kcal))
      }
      const burn = new Map(burns.map((m) => [m.entry_date, Number(m.burn_kcal)]))
      setBalances(buildDailyBalances(intake, burn, todayKey()))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { balances, loading, error, refresh }
}
