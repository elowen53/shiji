import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { MacroTargets } from '@/types'

export interface MacroTargetsApi {
  /** 未保存过目标时为 null */
  targets: MacroTargets | null
  loading: boolean
  /** 保存成功返回 null，失败返回给用户看的错误文案 */
  save: (input: MacroTargets) => Promise<string | null>
}

/** PostgREST 找不到表（未执行新版 setup.sql）时的错误码 */
const isMissingTable = (code?: string) => code === 'PGRST205' || code === '42P01'

/** 三大营养素目标：macro_targets 单行表（id = 1） */
export function useMacroTargets(): MacroTargetsApi {
  const [targets, setTargets] = useState<MacroTargets | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    supabase
      .from('macro_targets')
      .select('protein_g_per_kg, fat_g_per_kg, carbs_g_per_kg')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error && data) setTargets(normalize(data as MacroTargets))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const save = useCallback(async (input: MacroTargets) => {
    if (!supabase) return '保存失败，请检查网络'
    const { data, error } = await supabase
      .from('macro_targets')
      .upsert({ id: 1, ...input, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .select('protein_g_per_kg, fat_g_per_kg, carbs_g_per_kg')
      .single()
    if (error) {
      return isMissingTable(error.code)
        ? '缺少目标表，请先执行 setup.sql'
        : '保存失败，请检查网络'
    }
    setTargets(normalize(data as MacroTargets))
    return null
  }, [])

  return { targets, loading, save }
}

/** numeric 列可能以字符串返回，统一转为 number */
function normalize(t: MacroTargets): MacroTargets {
  const n = (v: number | string | null) => (v == null ? null : Number(v))
  return {
    protein_g_per_kg: n(t.protein_g_per_kg),
    fat_g_per_kg: n(t.fat_g_per_kg),
    carbs_g_per_kg: n(t.carbs_g_per_kg),
  }
}
