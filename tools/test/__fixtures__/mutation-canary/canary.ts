// @mutate
export function clampCents(n: number, max: number): number {
  if (n < 0) return 0
  if (n > max) return max
  return n
}
