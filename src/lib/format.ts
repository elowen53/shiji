/** 数字展示格式化 */

/** 热量：取整 */
export function fmtKcal(n: number): string {
  return String(Math.round(n))
}

/** 营养素：最多 1 位小数，去掉多余的 .0 */
export function fmtMacro(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

/** 数量：最多 2 位小数，去尾零 */
export function fmtQty(n: number): string {
  const r = Math.round(n * 100) / 100
  return Number.isInteger(r) ? String(r) : String(r)
}
