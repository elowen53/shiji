import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Food, FoodInput } from '@/types'

export interface FoodsApi {
  foods: Food[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  addFood: (input: FoodInput) => Promise<boolean>
  updateFood: (id: string, input: FoodInput) => Promise<boolean>
  deleteFood: (id: string) => Promise<boolean>
}

export function useFoods(): FoodsApi {
  const [foods, setFoods] = useState<Food[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('foods')
      .select('*')
      .order('created_at', { ascending: true })
    if (err) {
      setError(err.message)
    } else {
      setFoods((data ?? []) as Food[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addFood = useCallback(async (input: FoodInput) => {
    if (!supabase) return false
    const { data, error: err } = await supabase
      .from('foods')
      .insert(input)
      .select()
      .single()
    if (err) {
      setError(err.message)
      return false
    }
    setFoods((prev) => [...prev, data as Food])
    return true
  }, [])

  const updateFood = useCallback(async (id: string, input: FoodInput) => {
    if (!supabase) return false
    const { data, error: err } = await supabase
      .from('foods')
      .update(input)
      .eq('id', id)
      .select()
      .single()
    if (err) {
      setError(err.message)
      return false
    }
    setFoods((prev) => prev.map((f) => (f.id === id ? (data as Food) : f)))
    return true
  }, [])

  const deleteFood = useCallback(async (id: string) => {
    if (!supabase) return false
    const { error: err } = await supabase.from('foods').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return false
    }
    setFoods((prev) => prev.filter((f) => f.id !== id))
    return true
  }, [])

  return { foods, loading, error, refresh, addFood, updateFood, deleteFood }
}
