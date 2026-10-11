/** 三大营养素 → 热量换算系数（千卡/克） */
export const KCAL_PER_G = { protein: 4, fat: 9, carbs: 4 } as const

/** 解析非负数输入，非法值记为 0 */
export const parseNum = (s: string) => {
  const v = parseFloat(s)
  return Number.isFinite(v) && v >= 0 ? v : 0
}

/** 按三大营养素折算热量，保留 1 位小数 */
export const kcalFromMacros = (protein: number, fat: number, carbs: number) =>
  Math.round(
    (protein * KCAL_PER_G.protein + fat * KCAL_PER_G.fat + carbs * KCAL_PER_G.carbs) * 10,
  ) / 10

/** 手动热量：填写正数则返回（保留 1 位小数），否则 null 表示使用自动折算值 */
export const parseManualKcal = (s: string) => {
  const v = parseFloat(s)
  return Number.isFinite(v) && v > 0 ? Math.round(v * 10) / 10 : null
}
