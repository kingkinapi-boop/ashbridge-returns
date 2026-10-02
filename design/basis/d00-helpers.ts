// Test helpers for D00 (spec job). No product code: contrast maths, class scan, planted-fault pages.
export function channel(v: number): number {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
export function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16))
  return 0.2126 * channel(r as number) + 0.7152 * channel(g as number) + 0.0722 * channel(b as number)
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((hi as number) + 0.05) / ((lo as number) + 0.05)
}
export function classesIn(html: string): Set<string> {
  const out = new Set<string>()
  for (const m of html.matchAll(/\sclass\s*=\s*"([^"]*)"/g)) {
    for (const c of (m[1] as string).split(/\s+/)) if (c !== '') out.add(c)
  }
  return out
}
export function unlistedClasses(html: string, listedApp: Set<string>): string[] {
  return [...classesIn(html)].filter((c) => !c.startsWith('govuk-') && !c.startsWith('moj-') && !listedApp.has(c))
}
export function listedAppClasses(partsMd: string): Set<string> {
  return new Set([...partsMd.matchAll(/`(app-[a-z0-9_-]+)`/g)].map((m) => m[1] as string))
}
export const BAD_PAGE =
  '<!doctype html><html lang="en"><head><title>Bad (Test)</title></head><body><main><img src="x.png"><div class="foo app-unlisted"></div></main></body></html>'
