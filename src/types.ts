/** 食物库中的食物：营养值为「每单位」含量 */
export interface Food {
  id: string
  name: string
  /** 单位名称，完全自定义，如 "100g" / "1份" / "1碗" */
  unit: string
  kcal: number
  protein: number
  fat: number
  carbs: number
  created_at?: string
}

/** 每日记录条目：营养值为按数量折算后的快照，删除食物不影响历史 */
export interface Entry {
  id: string
  /** 本地时区 YYYY-MM-DD */
  entry_date: string
  food_id: string | null
  food_name: string
  unit: string
  quantity: number
  kcal: number
  protein: number
  fat: number
  carbs: number
  created_at?: string
}

/** 新增食物时的表单值 */
export interface FoodInput {
  name: string
  unit: string
  kcal: number
  protein: number
  fat: number
  carbs: number
}

export interface DayTotals {
  kcal: number
  protein: number
  fat: number
  carbs: number
}

/** 每日指标：一天一行，体重、腰围与总消耗均可空 */
export interface DailyMetric {
  entry_date: string
  weight_kg: number | null
  waist_cm: number | null
  burn_kcal: number | null
  updated_at?: string
}

/** 保存每日指标时的输入（未填的字段传 null） */
export interface MetricInput {
  weight_kg: number | null
  waist_cm: number | null
  burn_kcal: number | null
}
