import type { DateRange, EntriesQuery, EntryCursor } from './schema.js'

export interface DailyRow {
  entry_date: string
  entry_count: number
  kcal: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
  weight_kg: number | null
  waist_cm: number | null
  burn_kcal: number | null
}

export interface EntryRow {
  id: string
  entry_date: string
  food_id: string | null
  food_name: string
  unit: string
  quantity: number
  kcal: number
  protein: number
  fat: number
  carbs: number
  created_at: string
}

export interface TargetsRow {
  protein_g_per_kg: number | null
  fat_g_per_kg: number | null
  carbs_g_per_kg: number | null
  updated_at: string
}

export interface OverviewRow {
  food_count: number
  entry_count: number
  metric_count: number
  days_with_food_entries: number
  days_with_weight: number
  days_with_burn: number
  first_entry_date: string | null
  last_entry_date: string | null
  first_metric_date: string | null
  last_metric_date: string | null
}

export interface AnalysisRepository {
  overview(): Promise<OverviewRow>
  daily(range: DateRange): Promise<DailyRow[]>
  entries(query: EntriesQuery, cursor: EntryCursor | null): Promise<EntryRow[]>
  targets(asOf: string): Promise<{
    current: TargetsRow | null
    weight: { entry_date: string; weight_kg: number } | null
  }>
}
