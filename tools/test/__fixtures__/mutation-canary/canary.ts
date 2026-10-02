// @mutate
export function sign(n: number): -1 | 0 | 1 {
  if (n < 0) return -1
  if (n > 0) return 1
  return 0
}
