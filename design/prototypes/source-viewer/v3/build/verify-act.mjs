// Actions the verify script repeats: put the prototype in a state by clicking, as a person would (no storage tricks).
import { sleep } from './verify-lib.mjs'
import { lists, sources } from './data.mjs'

export const TABS = {
  prep: { tab: 'workbench', as: 'anita' }, cpa: { tab: 'review', as: 'dev' }, verify: { tab: 'documents', as: 'anita' },
  risks: { tab: 'exceptions', as: 'dev' }, ops: { tab: 'ops', as: 'sam' }, changed: { tab: 'workbench', as: 'anita', state: 'void' },
}
export const urlOf = (list, id, pos) => {
  const t = TABS[list]
  return `${t.tab}.html?${t.state ? 'state=' + t.state + '&' : ''}as=${t.as}${id ? '&item=' + id : ''}${pos ? '&src=' + pos : ''}`
}
// the flat steps of an item as the URL names them: "3" for the third source, "2.1" for the first source of source 2
export function positions(it) {
  const own = it.src || []
  const ids = own.length ? own : (it.cand || []).map((c) => c.id)
  const r = []
  ids.forEach((id, i) => { r.push(String(i + 1)); const s = sources[id]; if (own.length && s && s.children) s.children.forEach((c, j) => r.push(`${i + 1}.${j + 1}`)) })
  return r.length ? r : ['1']
}
export const allItems = () => Object.keys(TABS).flatMap((list) => lists[list].map((it) => ({ list, it })))

const REASON = 'Overridden by the preparer: the second monitor is claimed as class 50 instead. Anita Rao decided.'
const WHY = 'The client confirmed the terms in writing, so I accept the risk and keep the flag for the filing note.'

export async function citeAll(page) {
  for (let i = 0; i < 14; i++) {
    if (!(await page.locator('#sv-cite').count())) break
    if (await page.locator('#sv-src-0').count()) await page.click('#sv-src-0'); else await page.fill('#sv-reason', REASON)
    await page.click('button[data-primary]'); await sleep(300)
  }
}
export async function tickAll(page) {
  for (let i = 0; i < 90; i++) {
    if (await page.locator('#sv-done-review:not([hidden])').count()) break
    const b = page.locator('.app-viewer__foot--tick button[data-primary]')
    if (!(await b.count())) { await page.keyboard.press('m'); await sleep(150); continue }
    await b.click(); await sleep(120)
  }
}
export async function acceptAll(page) {
  for (let i = 0; i < 10; i++) {
    if (await page.locator('#sv-done-documents:not([hidden])').count()) break
    const b = page.locator('.app-viewer__foot button[data-primary]')
    if (!(await b.count())) break
    await b.click(); await sleep(250)
  }
}
export async function judgeAll(page) {
  for (let i = 0; i < 8; i++) {
    if (await page.locator('#sv-done-exceptions:not([hidden])').count()) break
    if (!(await page.locator('#sv-judge-why').count())) break
    await page.fill('#sv-judge-why', WHY)
    await page.click('.app-viewer__foot button[data-primary]'); await sleep(250)
  }
}
export async function opsAll(page) {
  for (let i = 0; i < 10; i++) {
    if (await page.locator('#sv-done-ops:not([hidden])').count()) break
    const b = page.locator('.app-viewer__foot button[data-primary]')
    if (!(await b.count())) break
    await b.first().click(); await sleep(250)
  }
}
