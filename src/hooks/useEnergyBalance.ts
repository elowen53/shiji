import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { todayKey } from '@/lib/date'
import { buildDailyBalances, type DailyBalance } from '@/lib/energy'
import { isMissingColumn } from '@/hooks/useMetrics'

export interface EnergyBalanceApi {
  /** 全部计入收支的日子（完整日 + 放纵日，均已结束），按日期升序 */
  balances: DailyBalance[]
  /** 有饮食记录的日子 → 当日蛋白质总量（g）；放纵日的记录不完整，不包含 */
  proteinByDate: Map<string, number>
  /** 全部放纵日（含今天），升序 */
  cheatDates: string[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

interface MetricRow {
  entry_date: string
  burn_kcal: number | null
  cheat_surplus_kcal?: number | null
}

/** Supabase 单次查询最多返回 1000 行，按页取全 */
const PAGE = 1000

class QueryError extends Error {
  readonly code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

async function fetchAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw new QueryError(error.message, error.code)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

/** 每日热量收支：汇总 entries 的摄入与 daily_metrics 的总消耗；顺带汇总每日蛋白质 */
export function useEnergyBalance(): EnergyBalanceApi {
  const [balances, setBalances] = useState<DailyBalance[]>([])
  const [proteinByDate, setProteinByDate] = useState<Map<string, number>>(() => new Map())
  const [cheatDates, setCheatDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const db = supabase
    if (!db) return
    setLoading(true)
    setError(null)
    try {
      const [entries, burns] = await Promise.all([
        fetchAll<{ entry_date: string; kcal: number; protein: number }>((from, to) =>
          db
            .from('entries')
            .select('entry_date, kcal, protein')
            .order('entry_date', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        ),
        fetchAll<MetricRow>((from, to) =>
          db
            .from('daily_metrics')
            .select('entry_date, burn_kcal, cheat_surplus_kcal')
            .or('burn_kcal.not.is.null,cheat_surplus_kcal.not.is.null')
            .order('entry_date', { ascending: true })
            .range(from, to),
        ).catch((err: unknown) => {
          // 旧库没有放纵日列：退回只取总消耗
          if (!(err instanceof QueryError) || !isMissingColumn(err.code)) throw err
          return fetchAll<MetricRow>((from, to) =>
            db
              .from('daily_metrics')
              .select('entry_date, burn_kcal')
              .not('burn_kcal', 'is', null)
              .order('entry_date', { ascending: true })
              .range(from, to),
          )
        }),
      ])
      const intake = new Map<string, number>()
      const protein = new Map<string, number>()
      for (const e of entries) {
        intake.set(e.entry_date, (intake.get(e.entry_date) ?? 0) + Number(e.kcal))
        protein.set(e.entry_date, (protein.get(e.entry_date) ?? 0) + Number(e.protein))
      }
      const burn = new Map<string, number>()
      const cheat = new Map<string, number>()
      for (const m of burns) {
        if (m.burn_kcal != null) burn.set(m.entry_date, Number(m.burn_kcal))
        if (m.cheat_surplus_kcal != null) {
          cheat.set(m.entry_date, Number(m.cheat_surplus_kcal))
          protein.delete(m.entry_date)
        }
      }
      setBalances(buildDailyBalances(intake, burn, todayKey(), cheat))
      setProteinByDate(protein)
      setCheatDates([...cheat.keys()])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { balances, proteinByDate, cheatDates, loading, error, refresh }
}
