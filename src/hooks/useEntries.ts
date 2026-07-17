import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Entry, Food } from '@/types'

export interface EntriesApi {
  entries: Entry[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  /** 保存时把食物营养按数量折算后做快照冗余存储 */
  addEntry: (food: Food, quantity: number, entryDate: string) => Promise<boolean>
  updateEntryQuantity: (entry: Entry, quantity: number) => Promise<boolean>
  deleteEntry: (id: string) => Promise<boolean>
}

export function useEntries(entryDate: string): EntriesApi {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('entries')
      .select('*')
      .eq('entry_date', entryDate)
      .order('created_at', { ascending: true })
    if (err) {
      setError(err.message)
    } else {
      setEntries((data ?? []) as Entry[])
    }
    setLoading(false)
  }, [entryDate])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addEntry = useCallback(
    async (food: Food, quantity: number, date: string) => {
      if (!supabase) return false
      const payload = {
        entry_date: date,
        food_id: food.id,
        food_name: food.name,
        unit: food.unit,
        quantity,
        kcal: food.kcal * quantity,
        protein: food.protein * quantity,
        fat: food.fat * quantity,
        carbs: food.carbs * quantity,
      }
      const { data, error: err } = await supabase
        .from('entries')
        .insert(payload)
        .select()
        .single()
      if (err) {
        setError(err.message)
        return false
      }
      if (date === entryDate) {
        setEntries((prev) => [...prev, data as Entry])
      }
      return true
    },
    [entryDate],
  )

  const updateEntryQuantity = useCallback(
    async (entry: Entry, quantity: number) => {
      if (!supabase) return false
      // 以快照中的每单位营养值重新折算
      const per = entry.quantity > 0 ? entry.quantity : 1
      const payload = {
        quantity,
        kcal: (entry.kcal / per) * quantity,
        protein: (entry.protein / per) * quantity,
        fat: (entry.fat / per) * quantity,
        carbs: (entry.carbs / per) * quantity,
      }
      const { data, error: err } = await supabase
        .from('entries')
        .update(payload)
        .eq('id', entry.id)
        .select()
        .single()
      if (err) {
        setError(err.message)
        return false
      }
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? (data as Entry) : e)),
      )
      return true
    },
    [],
  )

  const deleteEntry = useCallback(async (id: string) => {
    if (!supabase) return false
    const { error: err } = await supabase.from('entries').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return false
    }
    setEntries((prev) => prev.filter((e) => e.id !== id))
    return true
  }, [])

  return { entries, loading, error, refresh, addEntry, updateEntryQuantity, deleteEntry }
}
