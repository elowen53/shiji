/** 数字展示格式化 */

/** 真正的减号（U+2212），比连字符 "-" 更宽、与 "+" 等宽对齐 */
const MINUS = '−'

/** 热量：取整，≥ 1000 加千分位 */
export function fmtKcal(n: number): string {
  const r = Math.round(n)
  return `${r < 0 ? MINUS : ''}${Math.abs(r).toLocaleString('en-US')}`
}

/** 营养素：最多 1 位小数，去掉多余的 .0 */
export function fmtMacro(n: number): string {
  const r = Math.round(n * 10) / 10
  const s = Number.isInteger(r) ? String(Math.abs(r)) : Math.abs(r).toFixed(1)
  return `${r < 0 ? MINUS : ''}${s}`
}

/** 汇总克数：≥ 10 g 取整（小数位只是噪音），不足 10 g 保留 1 位 */
export function fmtGram(n: number): string {
  return Math.abs(n) >= 10 ? fmtKcal(n) : fmtMacro(n)
}

/** 带符号：+1.2 / −0.4 / 0；format 决定数值部分 */
export function fmtSigned(n: number, format: (v: number) => string = fmtMacro): string {
  const body = format(Math.abs(n))
  if (body === '0') return '0'
  return `${n > 0 ? '+' : MINUS}${body}`
}

/** 数量：最多 2 位小数，去尾零 */
export function fmtQty(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** 从单位中解析出每单位克数 / 毫升数，如 "100g" → { amount: 100, label: 'g' } */
export function parseMeasureUnit(unit?: string): { amount: number; label: 'g' | 'ml' } | null {
  const m = unit?.trim().match(/^(\d+(?:\.\d+)?)\s*(g|克|ml|毫升)$/i)
  if (!m) return null
  const amount = parseFloat(m[1])
  if (!Number.isFinite(amount) || amount <= 0) return null
  return { amount, label: /^(g|克)$/i.test(m[2]) ? 'g' : 'ml' }
}

/** 记录份量：重量 / 体积单位直接换算（1.5 × 100g → 150g），其余 1 份省略倍数（1 × 1碗 → 1碗） */
export function fmtAmount(quantity: number, unit: string): string {
  const measure = parseMeasureUnit(unit)
  if (measure) return `${fmtQty(quantity * measure.amount)}${measure.label}`
  return quantity === 1 ? unit : `${fmtQty(quantity)} × ${unit}`
}
