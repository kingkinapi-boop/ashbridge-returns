// Task scripts with loads, clicks, keys and fields counted; the second window; the URL and the tabs as routes; done, next and Undo; search.
import { sleep, SIZES, measure } from './verify-lib.mjs'
import { urlOf, citeAll, tickAll, acceptAll, judgeAll, opsAll } from './verify-act.mjs'
import { sources, lists, story, client } from './data.mjs'

export const sections = {}
const REASON = 'Overridden by the preparer: the second monitor is claimed as class 50 instead. Anita Rao decided.'
const WHY = 'The client confirmed the terms in writing, so I accept the risk and keep the flag for the filing note.'
const FOCUSED_SOURCE = /^sv-(box|card)-pane$/

const fid = (page) => page.evaluate(() => document.activeElement ? document.activeElement.id : '')
const titleOf = (page) => page.evaluate(() => (document.getElementById('sv-title-pane') || {}).textContent || '')
const live = (page) => page.evaluate(() => (document.getElementById('sv-live') || {}).textContent || '')
// polls the live region for a sentence (it is cleared and refilled a moment after an action)
const liveHas = async (page, re, ms = 2500) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (re.test(await live(page))) return true; await new Promise((r) => setTimeout(r, 100)) } return false }
const rowStatus =(page, id) => page.locator(`[data-item="${id}"] [data-status]`).first().innerText()

// run one task on a page that already has the counters; returns loads, clicks, keys, fields, ms
async function run(T, page, fn) {
  await page.evaluate(() => { window.__loadMarker = 1 })
  await T.resetCounters(page)
  const t0 = Date.now()
  await fn()
  const ms = Date.now() - t0
  const r = await T.reading(page)
  const loads = await page.evaluate(() => (window.__loadMarker === 1 ? 0 : 1))
  return { loads, ...r, ms }
}
async function fresh(T, w, h, url) {
  const [c, page] = await T.newPage(w, h)
  await T.counters(page)
  await T.go(page, url)
  return [c, page]
}
function record(T, name, role, r, want, extra = '') {
  T.out.tasks.push({ task: name, role, loads: r.loads, clicks: r.clicks, keys: r.keys, fields: r.fields, ms: r.ms })
  const ok = r.loads === want.loads && r.clicks === want.clicks && r.keys === want.keys && r.fields === want.fields
  T.ck(`task "${name}": ${r.loads} loads, ${r.clicks} clicks, ${r.keys} keys, ${r.fields} fields (wanted ${want.loads} / ${want.clicks} / ${want.keys} / ${want.fields})${extra ? ', ' + extra : ''}`, ok, JSON.stringify(r))
}

// ---------------------------------------------------------------- the task scripts of the brief, counted
sections.tasks = async (T) => {
  const { ck } = T
  for (const [w, h] of SIZES) {
    const tag = `@${w}x${h}`
    // CPA: check a number against its source (open, tick, next number)
    { const [c, page] = await fresh(T, w, h, urlOf('cpa'))
      let r = await run(T, page, async () => { await page.click('[data-item="f5"] [data-open]'); await T.settle(page, 250) })
      const m = await page.evaluate(measure)
      record(T, `CPA checks a number: open the source ${tag}`, 'CPA', r, { loads: 0, clicks: 1, keys: 0, fields: 0 })
      ck(`the masked slip: the box is whole or its left edge in view, focus in the box, SIN on file in words, no digits ${tag}`, (m.boxWhole || m.boxLeftInView) && (await fid(page)) === 'sv-box-pane' && /SIN on file/.test(await page.locator('.app-viewer__card').innerText()) && !/\d{9}/.test(await page.locator('.app-viewer__card').innerText()), JSON.stringify({ whole: m.boxWhole, left: m.boxLeftInView, focus: await fid(page) }))
      r = await run(T, page, async () => { await page.click('.app-viewer__foot--tick button[data-primary]'); await sleep(200) })
      record(T, `CPA checks a number: tick this source and go on ${tag}`, 'CPA', r, { loads: 0, clicks: 1, keys: 0, fields: 0 })
      r = await run(T, page, async () => { await page.keyboard.press('m'); await sleep(200) })
      record(T, `CPA checks a number: next number ${tag}`, 'CPA', r, { loads: 0, clicks: 0, keys: 1, fields: 0 })
      ck(`next number (m) shows the next figure with focus in its source ${tag}`, /Home office/.test(await titleOf(page)) && FOCUSED_SOURCE.test(await fid(page)), `${await titleOf(page)} | ${await fid(page)}`)
      await c.close() }

    // CPA: step through all sources of one figure (TB-9): 12 keys through 13 steps, each saying "Source n of N"
    { const [c, page] = await fresh(T, w, h, urlOf('cpa'))
      const said = []
      const r = await run(T, page, async () => {
        await page.click('[data-item="f1"] [data-open]'); await T.settle(page, 250)
        for (let i = 0; i < 12; i++) { await page.keyboard.press(']'); await sleep(140); said.push(await page.evaluate(() => document.querySelector('.app-viewer__meta').textContent.slice(0, 40))) }
      })
      record(T, `CPA steps through all 13 steps of one figure: open once, then 12 keys ${tag}`, 'CPA', r, { loads: 0, clicks: 1, keys: 12, fields: 0 })
      ck(`every step says "Source n of 6" in words (the entry's own sources say "entry source n of 7") ${tag}`, said.every((t) => /^Source \d of 6/.test(t)) && /entry source 7 of 7/.test(said[7]) && /^Source 6 of 6/.test(said[11]), said.join(' | '))
      await c.close() }

    // CPA: three sources ticked with three clicks and no key (the tick is a button; it says "your place, not a review mark")
    { const [c, page] = await fresh(T, w, h, urlOf('cpa'))
      await page.click('[data-item="f2"] [data-open]'); await T.settle(page, 250)
      const r = await run(T, page, async () => { for (let i = 0; i < 3; i++) { await page.click('.app-viewer__foot--tick button[data-primary]'); await sleep(200) } })
      record(T, `CPA ticks the 3 sources of one figure: 3 clicks, no key ${tag}`, 'CPA', r, { loads: 0, clicks: 3, keys: 0, fields: 0 })
      ck(`the figure shows "All sources ticked", the count is 1 of 9, and the note says "your place, not a review mark" ${tag}`, /All sources ticked/.test(await rowStatus(page, 'f2')) && (await page.locator('#sv-ticked').innerText()) === '1' && /Your place, not a review mark/.test(await page.locator('.app-foot-note').first().innerText()), `${await rowStatus(page, 'f2')} | ${await page.locator('#sv-ticked').innerText()}`)
      await c.close() }

    // CPA: open a QBO line with no id: 0 loads, 1 click, 0 fields, the composite-key flag visible at once (TB-13)
    { const [c, page] = await fresh(T, w, h, urlOf('cpa'))
      const r = await run(T, page, async () => { await page.click('[data-item="f3"] [data-open]'); await T.settle(page, 250) })
      record(T, `open a QBO line with no id (TB-13) ${tag}`, 'CPA', r, { loads: 0, clicks: 1, keys: 0, fields: 0 })
      const noid = await page.evaluate(() => { const e = document.querySelector('.app-noid'); if (!e) return null; const b = e.getBoundingClientRect(); return { text: e.textContent.replace(/\s+/g, ' ').trim(), whole: b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth } })
      ck(`the "no QBO id" note, the flag for a person and the composite key are in view at once, in words ${tag}`, !!noid && noid.whole && /Flagged for a person/.test(noid.text) && /No QBO id: matched by date, type, number, account and amount/.test(noid.text) && /Composite key: 2025-04-24/.test(noid.text), JSON.stringify(noid))
      await c.close() }

    // Preparer: cite an orphan, two clicks after opening it, then the next one with focus in its source
    { const [c, page] = await fresh(T, w, h, urlOf('prep'))
      await page.click('[data-item="c2"] [data-open]'); await T.settle(page, 250)
      const r = await run(T, page, async () => { await page.click('#sv-src-0'); await page.click('button[data-primary]'); await sleep(350) })
      record(T, `Preparer cites an orphan: choose the candidate, Record ${tag}`, 'Preparer', r, { loads: 0, clicks: 2, keys: 0, fields: 0 })
      const msg = await page.locator('#sv-recorded').innerText()
      ck(`the row says Cited, the count falls to 6 of 8, a message names what was recorded and the next figure, focus is in the next figure's source ${tag}`, /Cited/.test(await rowStatus(page, 'c2')) && (await page.locator('#sv-left-cite').textContent()) === '6' && /^Recorded\. 6 left\. Next: Dividend other than eligible\.$/.test(msg) && (await liveHas(page, /Source cited for Taxes payable \(HST\) recorded as source 1 of 1\. Next to cite: Dividend other than eligible\./)) && /Dividend other than eligible/.test(await titleOf(page)) && FOCUSED_SOURCE.test(await fid(page)), `${msg} | ${await titleOf(page)} | ${await fid(page)}`)
      await c.close() }
    // Preparer: write the reason for an override (the reason only, no candidate): one field
    { const [c, page] = await fresh(T, w, h, urlOf('prep'))
      await page.click('[data-item="c5"] [data-open]'); await T.settle(page, 250)
      const r = await run(T, page, async () => { await page.click('#sv-reason'); await page.fill('#sv-reason', REASON); await page.click('button[data-primary]'); await sleep(350) })
      record(T, `Preparer writes the reason for an override: click in the box, type, Record ${tag}`, 'Preparer', r, { loads: 0, clicks: 2, keys: 0, fields: 1 })
      ck(`the override row says Cited, and the reason is kept as a source with its author ${tag}`, /Cited/.test(await rowStatus(page, 'c5')) && /Conferences and meetings/.test(await titleOf(page)), await rowStatus(page, 'c5'))
      await c.close() }
    // Preparer: verify an extracted value: one click after opening
    { const [c, page] = await fresh(T, w, h, urlOf('verify'))
      await page.click('[data-item="v1"] [data-open]'); await T.settle(page, 350)
      const r = await run(T, page, async () => { await page.click('button[data-primary]'); await sleep(350) })
      record(T, `Preparer verifies an extracted value: Accept ${tag}`, 'Preparer', r, { loads: 0, clicks: 1, keys: 0, fields: 0 })
      ck(`the row says Accepted, 5 of 6 left, and the next value is shown with focus in its box ${tag}`, /Accepted/.test(await rowStatus(page, 'v1')) && (await page.locator('#sv-left-verify').innerText()) === '5' && /Withdrawal on 20 Dec/.test(await titleOf(page)) && FOCUSED_SOURCE.test(await fid(page)), `${await titleOf(page)} | ${await fid(page)}`)
      await c.close() }
    // CPA: judge an accepted risk with its source open: 2 clicks and 1 field after opening
    { const [c, page] = await fresh(T, w, h, urlOf('risks'))
      await page.click('[data-item="x2"] [data-open]'); await T.settle(page, 350)
      const r = await run(T, page, async () => { await page.click('#sv-judge-why'); await page.fill('#sv-judge-why', WHY); await page.click('.app-viewer__foot button[data-primary]'); await sleep(350) })
      record(T, `CPA judges an accepted risk, source open: click in the reason, type, Accept the risk ${tag}`, 'CPA', r, { loads: 0, clicks: 2, keys: 0, fields: 1 })
      ck(`the row says "Judged: accepted", the next unjudged risk is shown with focus in its source ${tag}`, /Judged: accepted/.test(await rowStatus(page, 'x2')) && /No interest on the shareholder loan/.test(await titleOf(page)) && FOCUSED_SOURCE.test(await fid(page)), `${await titleOf(page)} | ${await fid(page)}`)
      await c.close() }
    // Any: see that the books changed after approval: 0 loads, 1 click, the two dates and both values in view
    { const [c, page] = await fresh(T, w, h, 'workbench.html?state=void&as=anita')
      const r = await run(T, page, async () => { await page.click('[data-item="g2"] [data-open]'); await T.settle(page, 250) })
      record(T, `see that the books changed after approval ${tag}`, 'Any', r, { loads: 0, clicks: 1, keys: 0, fields: 0 })
      const card = await page.evaluate(() => { const e = document.querySelector('.app-viewer__card'); const b = e.getBoundingClientRect(); return { text: e.textContent.replace(/\s+/g, ' '), whole: b.bottom <= innerHeight } })
      ck(`both dates (snapshot ${story.snapshot}, read again ${story.reread}), both fingerprints and both values (12,000.00 then 12,500.00) are in the card, and it says nothing is left to decide ${tag}`, card.text.includes(story.snapshot) && card.text.includes(story.reread) && card.text.includes('a41f9c07') && card.text.includes('7be20d41') && card.text.includes('12,000.00') && card.text.includes('12,500.00') && /Nothing to decide on this screen/.test(card.text) && /Books changed after approval/.test(card.text), card.text.slice(0, 220))
      ck(`the void alert shows at the top and there is no decision button in the void state ${tag}`, (await page.locator('.moj-alert--warning').isVisible()) && (await page.locator('[data-primary]').count()) === 0, '')
      await c.close() }
    // Ops: complete and chase
    { const [c, page] = await fresh(T, w, h, urlOf('ops'))
      await page.click('[data-item="o2"] [data-open]'); await T.settle(page, 250)
      let r = await run(T, page, async () => { await page.click('button[data-primary]'); await sleep(300) })
      record(T, `Ops completes a CRA capture: Complete ${tag}`, 'Ops', r, { loads: 0, clicks: 1, keys: 0, fields: 0 })
      ck(`the row says Complete, 5 of 6 left, focus is on the next item's button and its source shows ${tag}`, /Complete/.test(await rowStatus(page, 'o2')) && (await page.locator('#sv-left-ops').innerText()) === '5' && /CRA T2 Auto-fill capture/.test(await titleOf(page)) && (await page.evaluate(() => document.activeElement.closest('[data-item]') && document.activeElement.closest('[data-item]').getAttribute('data-item'))) === 'o3', `${await titleOf(page)} | ${await fid(page)}`)
      await page.click('[data-item="o5"] [data-open]'); await T.settle(page, 250)
      const card = await page.locator('.app-viewer__card').innerText()
      const slotText = await page.locator('.app-viewer__foot').innerText()
      ck(`an item with nothing attached says "Not checked: no evidence", offers Chase and no Complete ${tag}`, /Not checked: no evidence/.test(card) && (await page.getByRole('button', { name: /^Chase/ }).count()) === 1 && (await page.getByRole('button', { name: /^Complete/ }).count()) === 0, card.slice(0, 120))
      ck(`before Chase is pressed the slot says it writes a dated staff note and sends nothing to the client ${tag}`, /Chase writes a dated staff note\. It sends nothing to the client\./.test(slotText), slotText.replace(/\s+/g, ' '))
      r = await run(T, page, async () => { await page.getByRole('button', { name: /^Chase/ }).click(); await sleep(300) })
      record(T, `Ops chases an item with nothing attached: Chase ${tag}`, 'Ops', r, { loads: 0, clicks: 1, keys: 0, fields: 0 })
      ck(`Chase writes a dated staff note: the row says "Chased on 8 Jun 2026" and the item is no longer left ${tag}`, /Chased on 8 Jun 2026/.test(await rowStatus(page, 'o5')) && (await page.locator('#sv-left-ops').innerText()) === '4', await rowStatus(page, 'o5'))
      await c.close() }
  }

  // second window turned on once: 0 loads, 1 click, 0 fields, remembered
  { const ctx = await T.newCtx(1366, 650); const page = await ctx.newPage()
    await T.counters(page); await T.go(page, urlOf('cpa'))
    let pop = null
    const r = await run(T, page, async () => { [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null), page.check('#sv-win-pref')]); await sleep(500) })
    record(T, 'turn the second window on once (Every time): remembered', 'Any', r, { loads: 0, clicks: 1, keys: 0, fields: 0 })
    ck('turning it on opens the window now (a click is the user gesture), and the state is in words', !!pop && /open, following/.test(await page.locator('#sv-win-status').innerText()), '')
    await ctx.close() }
}

// ---------------------------------------------------------------- the second window
sections.window = async (T) => {
  const { ck } = T
  const waitText = (page, sel, re, ms = 3000) => page.waitForFunction(([s, r]) => new RegExp(r).test((document.querySelector(s) || {}).textContent || ''), [sel, re.source], { timeout: ms }).then(() => true).catch(() => false)
  const openWin = async (ctx, page) => { const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null), page.click('#sv-open-window')]); if (pop) { await pop.waitForSelector('#sv-follow', { timeout: 3000 }).catch(() => {}); await sleep(300) } return pop }

  for (const [w, h] of SIZES) {
    const tag = `@${w}x${h}`
    const ctx = await T.newCtx(w, h); const page = await ctx.newPage()
    await T.go(page, urlOf('cpa'))
    ck(`before anything is asked, the window is off, in words, with the choice unticked ${tag}`, /Second window: off\./.test(await page.locator('#sv-win-status').innerText()) && !(await page.locator('#sv-win-pref').isChecked()), await page.locator('#sv-win-status').innerText())
    const pop = await openWin(ctx, page)
    ck(`the second window opens from 1 click ${tag}`, !!pop, '')
    if (!pop) { await ctx.close(); continue }
    await pop.setViewportSize({ width: w, height: h })
    ck(`both say open and following ${tag}`, (await waitText(page, '#sv-win-status', /open, following/)) && (await waitText(pop, '#sv-win-msg', /Following the work page/)), await page.locator('#sv-win-status').innerText())
    ck(`while it follows, the list takes the width (the pane hides) ${tag}`, await page.evaluate((w2) => document.getElementById('app-split').classList.contains('app-split--no-pane') && document.querySelector('.app-split__work').getBoundingClientRect().width > w2 * 0.9, w), '')
    // selection and tab changes follow; the decision moves into the work column; focus is not lost into the hidden pane
    await page.click('[data-item="f1"] [data-open]'); await sleep(500)
    const t1 = await pop.locator('#sv-title-window').innerText()
    ck(`the window follows a selection and shows the same viewer ${tag}`, /Due from shareholder, 13,212/.test(t1) && (await pop.locator('.app-viewer__meta').innerText()).startsWith('Source 1 of 6'), t1)
    const slot = await page.evaluate(() => { const s = document.getElementById('sv-winslot'); const p = s && s.querySelector('[data-primary]'); const b = p && p.getBoundingClientRect(); return { shown: !!s && !s.hidden, primary: !!p, inView: !!b && b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth, focus: document.activeElement && document.activeElement !== document.body && document.activeElement.getClientRects().length > 0, text: s ? s.textContent.replace(/\s+/g, ' ').slice(0, 80) : '' } })
    ck(`while the window shows the source, the decision (tick) sits in the work column, in view, and focus stays on a visible control ${tag}`, slot.shown && slot.primary && slot.inView && slot.focus, JSON.stringify(slot))
    await page.keyboard.press(']'); await sleep(450)
    ck(`] on the work page steps the window ${tag}`, (await pop.locator('.app-viewer__meta').innerText()).startsWith('Source 2 of 6'), await pop.locator('.app-viewer__meta').innerText())
    await pop.keyboard.press(']'); await sleep(500)
    const wsrc = await page.evaluate(() => location.search)
    ck(`] in the window steps the work page it follows (the URL names the source) ${tag}`, /src=2\.1/.test(wsrc), wsrc)
    // a click on the same row again brings the window forward and says so
    await page.click('[data-item="f1"] [data-open]'); await sleep(250)
    ck(`opening the figure that the window already shows brings the window forward and says so ${tag}`, /Second window brought forward, showing the source of Due from shareholder/.test(await live(page)), await live(page))
    // tab change: the window follows to the new list
    await page.click('a[data-route="documents"]'); await sleep(400)
    await page.click('[data-item="v2"] [data-open]'); await sleep(600)
    const t2 = await pop.locator('#sv-title-window').innerText()
    ck(`the window follows a tab change and shows the new list ${tag}`, /Withdrawal on 20 Dec/.test(t2) && /Documents tab/.test(await pop.locator('#sv-win-msg').innerText()), `${t2} | ${await pop.locator('#sv-win-msg').innerText()}`)
    // reload the work page: both say open and following within 2 s
    const t0 = Date.now(); await page.reload()
    const okA = await waitText(page, '#sv-win-status', /open, following/, 2500), tA = Date.now() - t0
    const okB = await waitText(pop, '#sv-win-msg', /Following the work page/, 2500)
    ck(`after a work page reload both show open and following within 2 s (${tA} ms) ${tag}`, okA && okB && tA <= 2000, `${tA} ms`)
    const shown = await pop.locator('#sv-title-window').innerText()
    ck(`the window still shows the selection after the work page reloads ${tag}`, /Withdrawal on 20 Dec/.test(shown), shown)
    // reload the window: both say open and following within 2 s, the window shows the selection
    const t3 = Date.now(); await pop.reload()
    const okC = await waitText(page, '#sv-win-status', /open, following/, 2500), okD = await waitText(pop, '#sv-win-msg', /Following the work page/, 2500), tC = Date.now() - t3
    await sleep(300)
    ck(`after a window reload both show open and following within 2 s, the window shows the selection (${tC} ms) ${tag}`, okC && okD && tC <= 2200 && /Withdrawal on 20 Dec/.test(await pop.locator('#sv-title-window').innerText()), await pop.locator('#sv-title-window').innerText())
    // Follow off: the pane comes back; the window keeps its source; Follow on catches up
    await pop.uncheck('#sv-follow'); await sleep(500)
    ck(`Follow off brings the pane back and says so ${tag}`, (await page.evaluate(() => !document.getElementById('app-split').classList.contains('app-split--no-pane'))) && /not following/.test(await page.locator('#sv-win-status').innerText()), await page.locator('#sv-win-status').innerText())
    const keep = await pop.locator('#sv-title-window').innerText()
    await page.click('[data-item="v3"] [data-open]'); await sleep(500)
    ck(`with Follow off the window stays on its source and says what the work page shows ${tag}`, (await pop.locator('#sv-title-window').innerText()) === keep && /Not following\. The work page is now on Google Workspace on 17 Dec/.test(await pop.locator('#sv-win-msg').innerText()), await pop.locator('#sv-win-msg').innerText())
    await pop.check('#sv-follow'); await sleep(600)
    ck(`turning Follow on catches up to the work page ${tag}`, /Google Workspace on 17 Dec/.test(await pop.locator('#sv-title-window').innerText()), await pop.locator('#sv-title-window').innerText())
    // closed: the words and the pane
    const tc = Date.now(); await pop.close()
    const okE = await waitText(page, '#sv-win-status', /Window closed, open again/, 3500)
    const back = await page.evaluate(() => !document.getElementById('app-split').classList.contains('app-split--no-pane'))
    ck(`a closed window shows "Window closed, open again" and the pane returns (${Date.now() - tc} ms) ${tag}`, okE && back, '')
    // the choice is off, so o shows the source in the pane and does not open the window
    await page.keyboard.press('Escape'); await page.evaluate(() => document.activeElement && document.activeElement.blur())
    await page.keyboard.press('o'); await sleep(600)
    ck(`with the choice off, o shows the source in the pane and opens nothing ${tag}`, ctx.pages().length === 1 && FOCUSED_SOURCE.test(await fid(page)), `${ctx.pages().length} page(s), focus ${await fid(page)}`)
    // the button opens it again, in the same named window
    const pop2 = await openWin(ctx, page)
    ck(`"Open in a second window" opens it again after it was closed ${tag}`, !!pop2 && (await waitText(page, '#sv-win-status', /open, following/)), '')
    await ctx.close()
  }

  // never on load, the choice per signed-in person, the remembered choice, o after the window was closed
  { const ctx = await T.newCtx(1366, 650); const page = await ctx.newPage()
    await T.go(page, urlOf('cpa'))
    const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null), page.check('#sv-win-pref')])
    ck('ticking "Every time" opens the window now and says in words that it is on and remembered', !!pop && (await liveHas(page, /turned on for Dev Malhotra \(Test\), and remembered/)), await live(page))
    if (pop) { await pop.waitForSelector('#sv-follow'); await sleep(300); await pop.close() }
    await waitText(page, '#sv-win-status', /Window closed/, 3500)
    const before = ctx.pages().length
    await page.reload(); await T.settle(page, 300); await sleep(1700)
    ck('the window never opens on load: after a reload with the choice on, no window and the state says it opens when a source is shown', ctx.pages().length === before && /Second window: on for you\. It opens when you show a source or press o\./.test(await page.locator('#sv-win-status').innerText()) && (await page.locator('#sv-win-pref').isChecked()), `${ctx.pages().length} pages, ${await page.locator('#sv-win-status').innerText()}`)
    const [pop2] = await Promise.all([ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null), page.click('[data-item="f2"] [data-open]')])
    ck('with the choice on, showing a source opens the window (the click is the gesture) and it shows that source', !!pop2 && (await (async () => { await pop2.waitForSelector('#sv-title-window'); await sleep(900); return /Taxes payable/.test(await pop2.locator('#sv-title-window').innerText()) })()), '')
    if (pop2) await pop2.close()
    await waitText(page, '#sv-win-status', /Window closed/, 3500)
    await page.keyboard.press('Escape'); await page.evaluate(() => document.activeElement && document.activeElement.blur())
    const [pop3] = await Promise.all([ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null), page.keyboard.press('o')])
    ck('with the choice on, o opens the window again after it was closed (the key is the gesture)', !!pop3, '')
    // another signed-in person has their own choice (default off)
    const other = await ctx.newPage(); await other.goto(T.U('review.html?as=anita')); await T.settle(other, 300)
    ck('the choice is kept for each signed-in person: Anita Rao (Test) still has it off', !(await other.locator('#sv-win-pref').isChecked()), await other.locator('#sv-win-status').innerText())
    // turning the choice off: the window stops following and the pane comes back
    await page.uncheck('#sv-win-pref'); await sleep(700)
    ck('turning the choice off tells the window to stop following, the pane returns and the words say so', (await page.evaluate(() => !document.getElementById('app-split').classList.contains('app-split--no-pane'))) && (await liveHas(page, /turned off for Dev Malhotra \(Test\), and remembered/)) && !(await pop3.locator('#sv-follow').isChecked()), await live(page))
    await ctx.close() }

  // a blocked pop-up says so and the pane stays
  { const [c, page] = await T.newPage(1366, 650)
    await page.addInitScript(() => { window.open = () => null })
    await T.go(page, urlOf('cpa', 'f2', '1'))
    await page.click('#sv-open-window'); await sleep(250)
    ck('a blocked pop-up says so in words and the pane stays', /The browser blocked the second window\. Allow pop-ups for this site, then open it again\./.test(await page.locator('#sv-win-status').innerText()) && (await page.evaluate(() => !document.getElementById('app-split').classList.contains('app-split--no-pane'))), await page.locator('#sv-win-status').innerText())
    await c.close() }

  // the window page alone: waiting, no work page, and the work page's last state
  { const [c, page] = await T.newPage(1366, 650)
    await T.go(page, 'window.html')
    const w1 = await page.locator('#sv-win-msg').innerText()
    await sleep(1300)
    const w2 = await page.locator('#sv-win-msg').innerText()
    ck('the window opened by hand says "Waiting for the work page." and then "No work page found." with a link to open it', /Waiting for the work page/.test(w1) && /No work page found\./.test(w2) && (await page.locator('#sv-win-msg a').getAttribute('href')) === 'review.html', `${w1} | ${w2}`)
    ck('the window page has the identity of the return, a Follow control and the empty state in words', /Maple Ridge Consulting Inc\. \(Test\)/.test(await page.locator('[data-identity-bar]').innerText()) && (await page.locator('#sv-follow').isChecked()) && /No figure selected yet/.test(await page.locator('.app-viewer__empty').innerText()), '')
    await c.close() }
  { const ctx = await T.newCtx(1366, 650)
    const work = await ctx.newPage(); await T.go(work, urlOf('cpa', 'f2', '2'))
    const win = await ctx.newPage(); await win.goto(T.U('window.html')); await sleep(1500)
    ck('a window opened by hand shows the work page\'s selection (it follows the last work page of the same return)', /Taxes payable/.test(await win.locator('#sv-title-window').innerText()) && /Source 2 of 3/.test(await win.locator('.app-viewer__meta').innerText()), await win.locator('#sv-title-window').innerText())
    // two work tabs on one return: the window follows the one last used; a step in the window drives only that tab
    const work2 = await ctx.newPage(); await T.go(work2, urlOf('cpa')); await sleep(300)
    await work2.click('[data-item="f6"] [data-open]'); await sleep(600)
    ck('the window follows the work tab last used on the same return', /Home office/.test(await win.locator('#sv-title-window').innerText()), await win.locator('#sv-title-window').innerText())
    await work.click('[data-item="f4"] [data-open]'); await sleep(600)
    ck('and then the other work tab, when that one is used', /Sales to Northwind/.test(await win.locator('#sv-title-window').innerText()), await win.locator('#sv-title-window').innerText())
    await win.keyboard.press(']'); await sleep(500)
    const s1 = await work.locator('.app-viewer__meta').innerText(), s2 = await work2.locator('.app-viewer__meta').innerText()
    ck('a step in the window drives only the work tab it follows', /Source 2 of 2/.test(s1) && /Source 1 of 1/.test(s2), `${s1.slice(0, 20)} | ${s2.slice(0, 20)}`)
    const before = await win.locator('#sv-title-window').innerText()
    const foreign = await ctx.newPage(); await foreign.goto(T.U('signed-out.html'))
    await foreign.evaluate(() => { const ch = new BroadcastChannel('ashbridge-source-viewer'); ch.postMessage({ t: 'select', ret: 'Another Return Inc. (Test), year end 31 Dec 2025', tab: 'zz', item: 'f5', idx: 0, list: 'cpa', recordTab: 'review' }) })
    await sleep(500)
    ck("another return's work page never drives the window", (await win.locator('#sv-title-window').innerText()) === before, await win.locator('#sv-title-window').innerText())
    await work.close(); await work2.close()
    ck('when every work page is closed the window says so and keeps the last source, with a link to open the work page', await waitText(win, '#sv-win-msg', /The work page was closed\. This window keeps the last source\./, 8000) && (await win.locator('#sv-win-msg a').count()) === 1, await win.locator('#sv-win-msg').innerText())
    await ctx.close() }

  // sign-out from any window ends every page of the return (the prototype's second line; the server ends the session in the build)
  { const ctx = await T.newCtx(1366, 650); const page = await ctx.newPage()
    await T.go(page, urlOf('cpa'))
    const other = await ctx.newPage(); await other.goto(T.U('index.html')); await sleep(250)
    const pop = await openWin(ctx, page)
    const t0 = Date.now()
    if (pop) await pop.click('#sv-signout')
    await page.waitForURL(/signed-out\.html/, { timeout: 3000 }).catch(() => {}); await other.waitForURL(/signed-out\.html/, { timeout: 3000 }).catch(() => {})
    ck('extra: sign-out in the window signs out the work page and every other page of the prototype', /signed-out/.test(page.url()) && /signed-out/.test(other.url()), `${Date.now() - t0} ms ${page.url().split('/').pop()} ${other.url().split('/').pop()}`)
    await ctx.close()
    const ctx2 = await T.newCtx(1366, 650); const p2 = await ctx2.newPage()
    await T.go(p2, urlOf('cpa'))
    const pop2 = await openWin(ctx2, p2)
    await p2.click('#sv-signout'); await sleep(1200)
    ck('extra: sign-out on the work page ends the window', !pop2 || pop2.isClosed() || /signed-out/.test(pop2.url()), pop2 ? (pop2.isClosed() ? 'closed' : pop2.url()) : 'no window')
    await ctx2.close() }
}

// ---------------------------------------------------------------- the URL, the tabs as routes, Back, scroll and filter kept
sections.url = async (T) => {
  const { ck } = T
  { const [c, page] = await T.newPage(1366, 650)
    await page.goto(T.U('index.html')); await sleep(200)
    await T.go(page, urlOf('cpa', 'f1', '1'), 500)
    await page.keyboard.press(']'); await sleep(200); await page.keyboard.press(']'); await sleep(300)
    const h0 = await page.evaluate(() => history.length)
    ck('the URL follows the selection (item and source) by replaceState', /item=f1&src=2\.1/.test(page.url()), page.url().replace(T.BASE, ''))
    await page.fill('#sv-filter', 'due'); await sleep(250)
    ck('the filter is in the URL too, and the caption says "Showing 1 of 9"', /q=due/.test(page.url()) && (await page.locator('#sv-filter-count').innerText()) === 'Showing 1 of 9', page.url())
    await page.reload(); await T.settle(page, 500)
    const m1 = await page.evaluate(() => ({ t: document.getElementById('sv-title-pane').textContent, meta: document.querySelector('.app-viewer__meta').textContent, f: document.getElementById('sv-filter').value, h: history.length, cap: document.getElementById('sv-filter-count').textContent }))
    ck('a reload returns to the same figure, source and filter', /Due from shareholder/.test(m1.t) && /Source 2 of 6, entry source 1 of 7/.test(m1.meta) && m1.f === 'due' && m1.cap === 'Showing 1 of 9', JSON.stringify(m1))
    ck('selecting, stepping, filtering and reloading add no history entry', m1.h === h0, `${h0} then ${m1.h}`)
    await page.goto(T.U('signed-out.html')); await sleep(200)
    await page.goBack(); await T.settle(page, 500)
    const m2 = await page.evaluate(() => ({ t: document.getElementById('sv-title-pane').textContent, meta: document.querySelector('.app-viewer__meta').textContent, f: document.getElementById('sv-filter').value }))
    ck('Back from another page returns to the same figure, source and filter', /Due from shareholder/.test(m2.t) && /Source 2 of 6, entry source 1 of 7/.test(m2.meta) && m2.f === 'due', JSON.stringify(m2))
    await c.close() }
  { const [c, p] = await T.newPage(1093, 525)
    await T.go(p, urlOf('cpa'))
    const can = await p.evaluate(() => { const w = document.querySelector('.app-split__work'); w.scrollTop = 120; return w.scrollHeight > w.clientHeight })
    await sleep(400); await p.reload(); await T.settle(p, 400)
    const sc = await p.evaluate(() => document.querySelector('.app-split__work').scrollTop)
    ck('a reload keeps the scroll of the list (rule 21)', !can || sc > 60, `scrolled ${sc}`)
    await c.close() }

  // a tab change is a client route: 0 loads, its own URL, own heading and title, the filter and scroll of each tab kept
  { const ctx = await T.newCtx(1366, 650); const b = await ctx.newPage()
    await T.go(b, urlOf('cpa')); await b.fill('#sv-filter', 'due'); await sleep(200)
    await b.click('[data-item="f1"] [data-open]'); await sleep(300)
    await b.evaluate(() => { window.__loadMarker = 7 })
    const h1 = await b.evaluate(() => history.length)
    await b.click('a[data-route="documents"]'); await sleep(500)
    const r = await b.evaluate(() => ({ marker: window.__loadMarker, navs: performance.getEntriesByType('navigation').length, h1: document.getElementById('sv-h1').textContent, title: document.title, cur: document.querySelector('.moj-sub-navigation [aria-current="page"]').textContent, hist: history.length, rows: [...document.querySelectorAll('[data-panel]:not([hidden]) [data-item]')].filter((r) => !r.hidden).length, path: location.pathname.split('/').pop(), filter: document.getElementById('sv-filter').value, title2: document.getElementById('sv-title-pane') && document.getElementById('sv-title-pane').textContent }))
    ck('a tab change makes 0 loads, has its own URL, heading, title and current tab, and an empty viewer for the new list', r.marker === 7 && r.navs === 1 && r.path === 'documents.html' && r.h1 === 'Verify extracted values' && /^Verify extracted values, Maple Ridge/.test(r.title) && r.cur === 'Documents' && r.hist === h1 + 1 && r.rows === 6 && r.filter === '' && r.title2 === 'Source viewer', JSON.stringify(r))
    await b.fill('#sv-filter', 'closing'); await sleep(200)
    await b.goBack(); await sleep(500)
    const rb = await b.evaluate(() => ({ marker: window.__loadMarker, h1: document.getElementById('sv-h1').textContent, filter: document.getElementById('sv-filter').value, cap: document.getElementById('sv-filter-count').textContent, path: location.pathname.split('/').pop() }))
    ck('Back after a tab change returns to the first tab with 0 loads, and its filter is kept', rb.marker === 7 && rb.h1 === 'Review figures' && rb.path === 'review.html' && rb.filter === 'due' && rb.cap === 'Showing 1 of 9', JSON.stringify(rb))
    await b.goForward(); await sleep(500)
    const rf = await b.evaluate(() => ({ marker: window.__loadMarker, h1: document.getElementById('sv-h1').textContent, filter: document.getElementById('sv-filter').value }))
    ck('Forward returns to the second tab with its own filter kept, still 0 loads', rf.marker === 7 && rf.h1 === 'Verify extracted values' && rf.filter === 'closing', JSON.stringify(rf))
    // the current tab's link does something: back to the top of its list, focus on its heading
    await b.click('a[data-route="documents"]'); await sleep(250)
    ck('clicking the tab you are on goes to the top of its list with focus on the heading and says so', (await b.evaluate(() => document.activeElement.id)) === 'sv-h1' && /top of the list/.test(await live(b)), await live(b))
    // each tab of the record opens with its own noun and list
    for (const [t, h1t, rows] of [['workbench', 'Cite figures', 8], ['exceptions', 'Judge accepted risks', 6], ['ops', 'Check items', 6], ['review', 'Review figures', 1]]) {
      await b.click(`a[data-route="${t}"]`); await sleep(300)
      const q = await b.evaluate(() => ({ h1: document.getElementById('sv-h1').textContent, rows: [...document.querySelectorAll('[data-panel]:not([hidden]) [data-item]')].filter((r) => !r.hidden).length, marker: window.__loadMarker }))
      ck(`the ${t} tab is a client route with ${rows} row(s) showing${t === 'review' ? ' (its filter "due" was kept)' : ''} and the heading "${h1t}"`, q.h1 === h1t && q.rows === rows && q.marker === 7, JSON.stringify(q))
    }
    await ctx.close() }

  // a cited source survives a reload (the prototype keeps it in session storage so a reload can be tested)
  { const [c, page] = await T.newPage(1366, 650)
    await T.go(page, urlOf('prep', 'c8', '1'))
    await page.click('#sv-src-0'); await page.click('button[data-primary]'); await sleep(400)
    await page.reload(); await T.settle(page, 500)
    ck('a cited source survives a reload (the prototype keeps it in session storage)', /Cited/.test(await rowStatus(page, 'c8')) && (await page.locator('#sv-left-cite').textContent()) === '6', await rowStatus(page, 'c8'))
    await c.close() }
}

// ---------------------------------------------------------------- the shared next, "All items checked", Undo with a reason
sections.done = async (T) => {
  const { ck } = T
  for (const [w, h] of SIZES) {
    const tag = `@${w}x${h}`
    // Ops: next unhandled after this one in list order, then the first unhandled above, then the done message
    { const [c, page] = await T.newPage(w, h)
      await T.go(page, urlOf('ops'))
      const decide = async (id, which) => { await page.click(`[data-item="${id}"] [data-open]`); await T.settle(page, 300); await (which === 'chase' ? page.getByRole('button', { name: /^Chase/ }) : page.getByRole('button', { name: /^Complete/ })).click(); await sleep(250) }
      const at = () => page.evaluate(() => { const a = document.activeElement; return a.closest('[data-item]') ? a.closest('[data-item]').getAttribute('data-item') : a.id })
      await decide('o2', 'done'); const a1 = await at()
      await decide('o4', 'done'); const a2 = await at()
      await decide('o5', 'chase'); const a3 = await at()
      await decide('o6', 'done'); const a4 = await at()
      await decide('o3', 'done'); const a5 = await at()
      ck(`Ops: focus goes to the next unhandled row after this one, then to the first unhandled above (${a1}, ${a2}, ${a3}, ${a4}, ${a5}) ${tag}`, a1 === 'o3' && a2 === 'o5' && a3 === 'o6' && a4 === 'o1' && a5 === 'o1', [a1, a2, a3, a4, a5].join(' '))
      await decide('o1', 'done')
      const d = await page.evaluate(() => ({ id: document.activeElement.id, text: document.activeElement.textContent.trim(), hidden: document.getElementById('sv-done-ops').hidden }))
      ck(`Ops: Complete on the last unhandled row focuses "All items checked" and announces it ${tag}`, d.id === 'sv-done-ops' && /^All items checked/.test(d.text) && !d.hidden && /All items checked/.test((await live(page)) + d.text), JSON.stringify(d))
      await c.close() }
    // Documents: Accept on every value
    { const [c, page] = await T.newPage(w, h)
      await T.go(page, urlOf('verify', 'v1', '1'))
      await acceptAll(page)
      const d = await page.evaluate(() => ({ id: document.activeElement.id, hidden: document.getElementById('sv-done-documents').hidden, text: document.getElementById('sv-done-documents').textContent }))
      ck(`Documents: Accept on the last value focuses the done message and announces it ${tag}`, d.id === 'sv-done-documents' && !d.hidden && /Every value is checked/.test(await live(page) + d.text), JSON.stringify(d))
      await c.close() }
    // Exceptions: judge every accepted risk
    { const [c, page] = await T.newPage(w, h)
      await T.go(page, urlOf('risks', 'x1', '1'))
      await judgeAll(page)
      const d = await page.evaluate(() => ({ id: document.activeElement.id, hidden: document.getElementById('sv-done-exceptions').hidden }))
      ck(`Exceptions: judging the last accepted risk focuses "Every accepted risk is judged" and offers the Review tab ${tag}`, d.id === 'sv-done-exceptions' && !d.hidden && (await page.locator('#sv-done-exceptions a[data-route="review"]').count()) === 1, JSON.stringify(d))
      await c.close() }
    // Review: tick every source of every figure (the tick is a button; a figure with no evidence is skipped)
    { const [c, page] = await T.newPage(w, h)
      await T.go(page, urlOf('cpa', 'f1', '1'))
      await tickAll(page)
      const d = await page.evaluate(() => ({ id: document.activeElement.id, hidden: document.getElementById('sv-done-review').hidden, left: document.getElementById('sv-ticked').textContent }))
      ck(`Review: ticking the last source focuses the done message, which says a tick is not a review mark ${tag}`, d.id === 'sv-done-review' && !d.hidden && /not a review mark/.test(await page.locator('#sv-done-review').innerText()) && d.left === '8', JSON.stringify(d))
      await c.close() }
    // Workbench: cite every figure (candidates and reasons)
    { const [c, page] = await T.newPage(w, h)
      await T.go(page, urlOf('prep', 'c1', '1'))
      await citeAll(page)
      const d = await page.evaluate(() => ({ id: document.activeElement.id, done: !document.getElementById('sv-done-workbench').hidden, left: document.getElementById('sv-left-cite').textContent, note: document.getElementById('sv-recorded').textContent }))
      ck(`Workbench: citing the last figure ends on a message that says nothing is left, and the done message shows ${tag}`, d.done && d.left === '0' && /Nothing is left to cite/.test(d.note) && /^(sv-recorded|sv-done-workbench)$/.test(d.id), JSON.stringify(d))
      await c.close() }
  }

  // Undo that asks for a reason: on the row, from the done state of every kind
  for (const [w, h] of SIZES) {
    const tag = `@${w}x${h}`
    const CASES = [['ops', 'o2', 'sam', 'Complete', 'ops.html?as=sam&state=done&item=o2', 'sv-left-ops'], ['documents', 'v1', 'anita', 'Accepted', 'documents.html?as=anita&state=done&item=v1', 'sv-left-verify'], ['exceptions', 'x1', 'dev', 'Judged: accepted', 'exceptions.html?as=dev&state=done&item=x1', 'sv-left-risks']]
    for (const [tab, id, who, tagText, url, counter] of CASES) {
      const [c, page] = await T.newPage(w, h)
      await T.go(page, url, 500)
      const row = await page.evaluate((i) => { const r = document.querySelector(`[data-item="${i}"]`); const vis = (e) => e.getClientRects().length > 0; return { tag: r.querySelector('[data-status]').textContent.replace(/\s+/g, ' ').trim(), buttons: [...r.querySelectorAll('button')].filter(vis).map((b) => b.textContent.trim().replace(/\s+/g, ' ')) } }, id)
      ck(`${tab}: a done row shows the "${tagText}" tag and an Undo, with no Complete, Accept or Chase button on the row ${tag}`, row.tag.includes(tagText) && row.buttons.some((t) => /^Undo/.test(t)) && !row.buttons.some((t) => /^(Complete|Accept|Reject|Chase)/.test(t)), JSON.stringify(row))
      const slot = await page.locator('.app-viewer__foot--done').innerText()
      ck(`${tab}: the item's decision slot shows the same tag, who decided and when, and says to use Undo on the row ${tag}`, slot.includes(tagText) && /by .*\(Test\), 8 Jun 2026\./.test(slot) && /To undo it, use Undo on the row\./.test(slot) && (await page.locator('.app-viewer__foot--done button').count()) === 0, slot.replace(/\s+/g, ' '))
      const y0 = await page.evaluate(() => scrollY)
      const left0 = +(await page.locator('#' + counter).innerText())
      await page.click(`[data-item="${id}"] [data-undo]`); await sleep(150)
      ck(`${tab}: Undo opens a reason box in place and focuses it ${tag}`, (await fid(page)) === `undo-row-${id}-why` && (await page.locator(`[data-item="${id}"] [data-undo]`).getAttribute('aria-expanded')) === 'true', await fid(page))
      await page.click(`#undo-row-${id} button[type=submit]`); await sleep(200)
      const e = await page.evaluate((i) => ({ f: document.activeElement.className, t: document.title.slice(0, 7), m: !!document.getElementById(`undo-row-${i}-err`), y: scrollY, still: !!document.querySelector(`[data-item="${i}"] [data-undo]`), sum: (document.querySelector('.app-undo-sum a') || {}).textContent }), id)
      ck(`${tab}: Undo with no reason shows the error summary at the top of its own form (focused), the message at the field, "Error: " in the title, scroll kept ${tag}`, /app-undo-sum/.test(e.f) && e.t === 'Error: ' && e.m && Math.abs(e.y - y0) <= 8 && e.still && /Write the reason for undoing the decision on/.test(e.sum || ''), JSON.stringify(e))
      await page.fill(`#undo-row-${id}-why`, 'Wrong item, checked again with the statement.'); await page.click(`#undo-row-${id} button[type=submit]`); await sleep(300)
      const u = await page.evaluate(([i, cn]) => ({ tag: document.querySelector(`[data-item="${i}"] [data-status]`).textContent.replace(/\s+/g, ' ').trim(), row: document.activeElement.closest('[data-item]') ? document.activeElement.closest('[data-item]').getAttribute('data-item') : null, title: document.title.slice(0, 7), left: +document.getElementById(cn).textContent, undo: !!document.querySelector(`[data-item="${i}"] [data-undo]`) }), [id, counter])
      ck(`${tab}: Undo with a reason puts the item back, the count goes up by one, the title loses "Error: ", and focus returns to the row's button ${tag}`, !u.tag.includes(tagText) && u.row === id && u.title !== 'Error: ' && u.left === left0 + 1 && !u.undo, JSON.stringify(u))
      const slot2 = await page.locator('.app-viewer__foot').first().innerText().catch(() => '')
      ck(`${tab}: after Undo the decision slot offers the live decision again ${tag}`, (await page.locator('.app-viewer__foot button[data-primary]').count()) === 1, slot2.replace(/\s+/g, ' ').slice(0, 80))
      await c.close()
    }
    // Cancel closes the form and returns focus to Undo; a person who cannot decide sees no Undo
    { const [c, page] = await T.newPage(w, h)
      await T.go(page, 'ops.html?as=sam&state=done&item=o2', 500)
      await page.click('[data-item="o2"] [data-undo]'); await page.fill('#undo-row-o2-why', 'x'); await page.getByRole('button', { name: /^Cancel/ }).click(); await sleep(150)
      ck(`Cancel closes the Undo form, clears it and returns focus to the Undo button ${tag}`, (await page.locator('#undo-row-o2').isHidden()) && (await page.evaluate(() => document.activeElement.hasAttribute('data-undo'))) && (await page.locator('#undo-row-o2-why').inputValue()) === '', '')
      await c.close()
      const [c2, p2] = await T.newPage(w, h)
      await T.go(p2, 'ops.html?as=anita&state=done&item=o2', 500)
      ck(`a person who cannot decide on Ops (the preparer) sees the done row without Undo ${tag}`,(await p2.locator('[data-item="o2"] [data-undo]').count()) === 0 && /Complete/.test(await rowStatus(p2, 'o2')), '')
      await c2.close() }
  }

  // read-only slots: the sentence says who can decide and what the person can do
  { const [c, page] = await T.newPage(1366, 650)
    await T.go(page, 'workbench.html?as=dev&item=c2')
    ck('the CPA reviewer on the Workbench can read the candidates; the slot says only the preparer cites, with no Record button', /Only the preparer cites a source or writes a reason\. You are signed in as CPA reviewer and can read the candidates\./.test(await page.locator('.app-viewer__foot').innerText()) && (await page.locator('button[data-primary]').count()) === 0, '')
    await page.goto(T.U('exceptions.html?as=anita&item=x2')); await T.settle(page, 300)
    ck('the preparer on Exceptions can read; the slot says only the CPA reviewer judges', /Only the CPA reviewer judges an accepted risk\./.test(await page.locator('.app-viewer__foot').innerText()) && (await page.locator('button[data-primary]').count()) === 0, '')
    await page.goto(T.U('exceptions.html?as=dev&item=x4')); await T.settle(page, 300)
    ck('an explained exception has nothing to judge: the slot says who explained it and when', /Explained by .*\(Test\), 3 Jun 2026\. Nothing to judge here/.test(await page.locator('.app-viewer__foot').innerText()) && (await page.locator('button[data-primary]').count()) === 0, '')
    await c.close() }
}

// ---------------------------------------------------------------- search: the header box, the results page, and V6 (shared)
sections.search = async (T) => {
  const { ck } = T
  { const [c, page] = await T.newPage(1366, 650)
    await T.counters(page)
    await T.go(page, urlOf('cpa'))
    await page.fill('#sv-search', 'meals'); await T.resetCounters(page)
    await Promise.all([page.waitForNavigation({ timeout: 5000 }), page.press('#sv-search', 'Enter')])
    await T.settle(page, 300)
    const n = await page.locator('[data-result]').count()
    ck(`the header search shows a results page when more than one thing matches (${n} results for "meals"), with the count in words`, /search\.html\?q=meals/.test(page.url()) && n > 1 && new RegExp(`^${n} results for "meals"\\.`).test(await page.locator('#sv-results-count').innerText()), `${n} | ${await page.locator('#sv-results-count').innerText()}`)
    ck('the results page has a table with a caption and scoped headers (kind, result, where it is)', await page.evaluate(() => { const t = document.querySelector('#sv-results table'); return !!t && !!t.querySelector('caption') && [...t.querySelectorAll('th[scope=col]')].length === 3 && [...t.querySelectorAll('tbody th[scope=row]')].length > 1 }), '')
    // a result goes to the right tab with the figure selected and its source shown
    const first = page.locator('[data-result] a').first()
    const href = await first.getAttribute('href')
    await first.click(); await T.settle(page, 500)
    ck(`a result opens the right tab with the figure selected and its source shown (${href})`, /item=/.test(page.url()) && (await page.locator('.app-row--selected').count()) === 1 && (await page.locator('.app-viewer__card').count()) === 1, page.url().replace(T.BASE, ''))
    await c.close() }
  { const [c, page] = await T.newPage(1366, 650)
    await T.go(page, 'search.html')
    ck('with nothing typed the results page says so in words and says what to type', /Type a figure, a value, an exception, an item or a source/.test(await page.locator('#sv-results-count').innerText()) && /Nothing has been searched yet/.test(await page.locator('#sv-results').innerText()), '')
    await page.goto(T.U('search.html?q=zzzz')); await T.settle(page, 300)
    ck('with no match it says "0 results for", suggests what to check and links back to the record', /^0 results for "zzzz"\./.test(await page.locator('#sv-results-count').innerText()) && (await page.locator('#sv-results a').getAttribute('href')) === 'review.html', '')
    await c.close() }
  // V6 is run in verify-shared (search keeps its promise); here, the value shown on the page finds its row in each kind
  { const kinds = [
      ['a figure name', lists.cpa[2].name, 'Meals add-back'], ['an amount as shown', lists.cpa[0].amount, 'Due from shareholder'], ['a value as shown', lists.verify[0].amount, 'Deposit on 18 Dec'],
      ['an exception flag', lists.risks[1].flagId, 'Repay then reborrow'], ['an item', lists.ops[0].name, 'Lakeview chequing statement'], ['a source title', sources['qbo-1300'].title, 'QBO'],
      ['the QBO Transaction ID', '2188', 'transaction'],
    ]
    const [c, page] = await T.newPage(1366, 650)
    for (const [kind, value, expect] of kinds) {
      await page.goto(T.U('search.html?q=' + encodeURIComponent(value))); await T.settle(page, 250)
      const n = await page.locator('[data-result]').count()
      ck(`search finds ${kind} copied as shown ("${value}"): ${n} result(s)`, n >= 1, await page.locator('#sv-results-count').innerText())
    }
    await c.close() }
}
