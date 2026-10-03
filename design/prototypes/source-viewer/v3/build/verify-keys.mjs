// Keys (rules 10, 22) and the keyboard walk (rule 11, WCAG 2.4.11, 2.5.8), the splitter by keyboard (rule 12).
import { sleep, SIZES } from './verify-lib.mjs'
import { urlOf } from './verify-act.mjs'
import { sources } from './data.mjs'

export const sections = {}
export const BOXES = '.app-box, .app-cell-boxed, .app-viewer__card, .app-viewer__stage'
// D01's one list (A485): the only keys a page may carry
export const KEYS = ['m', 'n', 'p', 'o', ']', '[', 's', 'Escape']
const SHOWN = { m: 'm', n: 'n', p: 'p', o: 'o', ']': ']', '[': '[', s: 's', Escape: 'Esc' }

const state = (page) => page.evaluate(() => {
  const v = document.getElementById('sv-title-pane'), m = document.querySelector('.app-viewer__meta')
  const a = document.activeElement
  return {
    title: v ? v.textContent : '', meta: m ? m.textContent : '', url: location.search,
    focus: a ? (a.id || a.tagName.toLowerCase() + ':' + (a.textContent || '').trim().slice(0, 20)) : 'none',
    row: a && a.closest && a.closest('[data-item]') ? a.closest('[data-item]').getAttribute('data-item') : null,
    live: (document.getElementById('sv-live') || {}).textContent || '',
    sel: (document.querySelector('.app-row--selected') || { getAttribute: () => null }).getAttribute('data-item'),
  }
})
const press = async (page, k, ms = 160) => { await page.keyboard.press(k); await sleep(ms) }
const blur = (page) => page.evaluate(() => document.activeElement && document.activeElement.blur())

sections.keys = async (T) => {
  const { ck } = T
  for (const [w, h] of SIZES) {
    const tag = `@${w}x${h}`
    const [c, page] = await T.newPage(w, h)
    await T.go(page, urlOf('cpa'))
    // m: the first press opens the first number, then the next; focus goes into the source
    await blur(page)
    await press(page, 'm'); let s = await state(page)
    ck(`m opens the first number with its source shown, focus in the source ${tag}`, s.sel === 'f1' && /Due from shareholder/.test(s.title) && /item=f1&src=1/.test(s.url) && /^sv-(box|card)-pane$/.test(s.focus), JSON.stringify(s))
    await press(page, 'm'); s = await state(page)
    ck(`m again moves to the next number (f2) ${tag}`, s.sel === 'f2' && /Taxes payable/.test(s.title), JSON.stringify(s))
    // n and p walk the flags only
    await press(page, 'n'); s = await state(page)
    ck(`n goes to the next flag (f3, 01-F10) ${tag}`, s.sel === 'f3', JSON.stringify(s))
    await press(page, 'n'); await press(page, 'n'); s = await state(page)
    ck(`n twice more reaches the last flag (f6) ${tag}`, s.sel === 'f6', JSON.stringify(s))
    await press(page, 'n'); s = await state(page)
    ck(`n at the last flag stays there and says so in words ${tag}`, s.sel === 'f6' && /Last flag in the list/.test(s.live), JSON.stringify(s))
    await press(page, 'p'); s = await state(page)
    ck(`p goes back to the previous flag (f4) ${tag}`, s.sel === 'f4', JSON.stringify(s))
    // ] and [ step the sources; the URL follows by replaceState (no history entry)
    const hist0 = await page.evaluate(() => history.length)
    await press(page, ']'); s = await state(page)
    ck(`] shows the next source of the figure, the URL names it ${tag}`, /item=f4&src=2/.test(s.url) && /Source 2 of 2/.test(s.meta), JSON.stringify(s))
    await press(page, ']'); s = await state(page)
    ck(`] on the last source stays and says so ${tag}`, /src=2/.test(s.url) && /Last source reached/.test(s.live), JSON.stringify(s))
    await press(page, '['); s = await state(page)
    ck(`[ goes back one source ${tag}`, /src=1/.test(s.url) && /Source 1 of 2/.test(s.meta), JSON.stringify(s))
    await press(page, '['); s = await state(page)
    ck(`[ on the first source stays and says so ${tag}`, /src=1/.test(s.url) && /First source reached/.test(s.live), JSON.stringify(s))
    ck(`steps, flags and numbers added no history entry ${tag}`, (await page.evaluate(() => history.length)) === hist0, '')
    // Escape returns focus to the figure's button; o opens the source of the number in hand, focus in the box
    await press(page, 'Escape'); s = await state(page)
    ck(`Escape returns focus to the button of the figure you came from ${tag}`, s.row === 'f4' && /Sources \(2\)/.test(s.focus), JSON.stringify(s))
    await press(page, 'o'); s = await state(page)
    ck(`o opens the source of the number in hand, focus in the source ${tag}`, s.sel === 'f4' && /^sv-(box|card)-pane$/.test(s.focus), JSON.stringify(s))
    // s moves to the header search
    await blur(page); await press(page, 's'); s = await state(page)
    ck(`s moves focus to the search box ${tag}`, s.focus === 'sv-search', JSON.stringify(s))
    // keys typed in a text field fire nothing: the filter, the header search
    const before = await state(page)
    await page.keyboard.type('m]nop[s'); await sleep(120)
    const afterSearch = await state(page)
    ck(`keys typed in the header search fire nothing and are typed ${tag}`, (await page.inputValue('#sv-search')) === 'm]nop[s' && afterSearch.sel === before.sel && afterSearch.url === before.url, JSON.stringify({ before: before.url, after: afterSearch.url }))
    await page.fill('#sv-search', '')
    await page.focus('#sv-filter'); await page.keyboard.type('m]n'); await sleep(150)
    const afterFilter = await state(page)
    ck(`keys typed in the filter fire nothing ${tag}`, (await page.inputValue('#sv-filter')) === 'm]n' && afterFilter.sel === before.sel, JSON.stringify(afterFilter))
    await c.close()

    // no key ticks, unticks, approves, sends or deletes: every key of the list and the likely extras leave the ticks as they were
    const [c2, p2] = await T.newPage(w, h)
    await T.go(p2, urlOf('cpa', 'f2', '1'))
    await p2.click('.app-viewer__foot--tick button[data-primary]'); await sleep(200)
    const ticks0 = await p2.evaluate(() => sessionStorage.getItem('sv-ticks'))
    for (const k of ['m', 'n', 'p', 'o', ']', '[', 's', 'r', 'a', 'c', 'x', 'd', 'u', 'Delete', 'Backspace', 'Enter']) { await blur(p2); await press(p2, k, 90) }
    const ticks1 = await p2.evaluate(() => sessionStorage.getItem('sv-ticks'))
    const done = await p2.locator('#sv-done-review:not([hidden])').count()
    ck(`no key ticks, unticks or approves: the ticks are unchanged after every key of the list and the likely extras ${tag}`, ticks0 === ticks1 && done === 0, `${ticks0} | ${ticks1}`)
    // the tick: pressed twice on one source it never unticks (a button; the only way off is "Remove tick", also a button)
    await p2.evaluate(() => sessionStorage.removeItem('sv-ticks'))
    await p2.goto(T.U(urlOf('cpa', 'f2', '1'))); await T.settle(p2, 250)
    const label1 = await p2.locator('.app-viewer__foot--tick button[data-primary]').innerText()
    await p2.click('.app-viewer__foot--tick button[data-primary]'); await sleep(200)
    await p2.goto(T.U(urlOf('cpa', 'f2', '1'))); await T.settle(p2, 250)
    const label2 = await p2.locator('.app-viewer__foot--tick button[data-primary]').innerText()
    await p2.click('.app-viewer__foot--tick button[data-primary]'); await sleep(200)
    await p2.goto(T.U(urlOf('cpa', 'f2', '1'))); await T.settle(p2, 250)
    const marks = await p2.evaluate(() => JSON.parse(sessionStorage.getItem('sv-ticks') || '{}'))
    const rm = p2.getByRole('button', { name: /Remove tick/ })
    ck(`the tick pressed twice on one source never unticks; the second press says "Already ticked" ${tag}`, marks['f2:cra-hst'] === true && /^Already ticked/.test(label2) && /^Supports/.test(label1), `${label1} | ${label2} | ${JSON.stringify(marks)}`)
    ck(`"Remove tick" is a button with no key; "Supports, next source" has no key either ${tag}`, (await rm.count()) === 1 && (await rm.getAttribute('aria-keyshortcuts')) === null && (await p2.locator('.app-viewer__foot--tick button[data-primary]').getAttribute('aria-keyshortcuts')) === null, '')
    await c2.close()

    // Turn off single-key shortcuts: m and ] do nothing, Escape still works, the choice is kept after a reload
    const [c3, p3] = await T.newPage(w, h)
    await T.go(p3, urlOf('cpa', 'f1', '1'))
    await p3.click('summary:has-text("Keyboard shortcuts")'); await p3.check('#sv-keys-off'); await sleep(100)
    await blur(p3); await press(p3, 'm'); await press(p3, ']')
    let off = await state(p3)
    ck(`with single-key shortcuts turned off, m and ] do nothing ${tag}`, /item=f1&src=1/.test(off.url) && off.sel === 'f1', JSON.stringify(off))
    await p3.reload(); await T.settle(p3, 300)
    const kept = await p3.evaluate(() => { document.querySelector('details').open = true; return document.getElementById('sv-keys-off').checked })
    await blur(p3); await press(p3, 'm')
    off = await state(p3)
    ck(`the choice to turn the shortcuts off is kept after a reload ${tag}`, kept === true && off.sel === 'f1', JSON.stringify(off))
    await p3.uncheck('#sv-keys-off'); await blur(p3); await press(p3, 'm')
    off = await state(p3)
    ck(`turning the shortcuts on again brings m back ${tag}`, off.sel === 'f2', JSON.stringify(off))
    await c3.close()
  }

  // the keys on the other tabs: m, n and o mean the same thing; the step keys work on the entry's own sources
  { const [c, page] = await T.newPage(1366, 650)
    await T.go(page, urlOf('prep'))
    await blur(page); await press(page, 'n'); let s = await state(page)
    ck('Workbench: n goes to the first flagged figure (c4, Home office)', s.sel === 'c4' && /Home office/.test(s.title), JSON.stringify(s))
    await press(page, 'm'); s = await state(page)
    ck('Workbench: m goes to the next number (c5, an override with no candidate)', s.sel === 'c5', JSON.stringify(s))
    await c.close() }
  { const kids = sources['aje-01'].children.length
    const [c, page] = await T.newPage(1366, 650)
    await T.go(page, urlOf('cpa', 'f1', '2'))
    await blur(page)
    const seq = []
    for (let i = 0; i < kids; i++) { await press(page, ']', 120); const s = await state(page); seq.push(/src=([\d.]+)/.exec(s.url)[1]) }
    ck(`] runs through the adjusting entry's ${kids} own sources in turn (2.1 to 2.${kids})`, seq.join(' ') === Array.from({ length: kids }, (_, i) => `2.${i + 1}`).join(' '), seq.join(' '))
    await press(page, ']', 120)
    const s2 = await state(page)
    ck('] after the entry\'s last own source goes on to the next top-level source (3)', /src=3(&|$)/.test(s2.url), JSON.stringify(s2))
    await press(page, '[', 120)
    const s3 = await state(page)
    ck(`[ from source 3 goes back to the entry's last own source (2.${kids})`, new RegExp(`src=2\\.${kids}(&|$)`).test(s3.url), JSON.stringify(s3))
    await c.close() }
  { const [c, page] = await T.newPage(1366, 650)
    await T.go(page, 'ops.html?as=sam')
    await blur(page); await press(page, 'm'); await press(page, 'm'); await press(page, 'm'); await press(page, 'm'); await press(page, 'm')
    const s = await state(page)
    ck('Ops: m reaches the item with no sources (o5), which says "Not checked: no evidence"', s.sel === 'o5' && /Not checked: no evidence/.test(await page.locator('.app-viewer__card').innerText()), JSON.stringify(s))
    await c.close() }

  // the keys on every page: only D01's list, each repeated by a visible control and listed in the shortcuts table
  const PAGES = [['workbench list', urlOf('prep')], ['workbench c2', urlOf('prep', 'c2', '1')], ['review f1 entry', urlOf('cpa', 'f1', '2.1')], ['documents v1', urlOf('verify', 'v1')], ['exceptions x2', urlOf('risks', 'x2', '1')], ['ops o1', urlOf('ops', 'o1', '1')], ['window', 'window.html'], ['search', 'search.html?q=meals']]
  for (const [label, url] of PAGES) {
    const [c, page] = await T.newPage(1366, 650)
    await T.go(page, url)
    const r = await page.evaluate((allowed) => {
      const vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'
      // a control counts when it shows, or is the narrow-screen Back control (shown under 600 px only)
      const ctl = [...document.querySelectorAll('[aria-keyshortcuts]')].filter((e) => vis(e) || (!e.closest('[hidden]') && e.closest('.app-only-narrow')))
      const carried = [...new Set(ctl.map((e) => e.getAttribute('aria-keyshortcuts')))]
      const all = [...new Set([...document.querySelectorAll('[aria-keyshortcuts]')].map((e) => e.getAttribute('aria-keyshortcuts')))]
      const listed = [...document.querySelectorAll('details table .app-key')].map((e) => e.textContent.trim())
      return { carried, all, listed, outside: all.filter((k) => !allowed.includes(k)), details: !!document.querySelector('details') }
    }, KEYS)
    const bad = []
    if (r.outside.length) bad.push('keys outside the list: ' + r.outside.join(' '))
    if (r.details) for (const k of r.carried) if (!r.listed.includes(SHOWN[k])) bad.push(`key ${k} is carried but not listed under Keyboard shortcuts`)
    ck(`${label}: every aria-keyshortcuts is in D01's list (${r.carried.join(' ') || 'none'}), sits on a visible control and is listed under Keyboard shortcuts`, bad.length === 0, bad.join('; '))
    await c.close()
  }
  { const [c, page] = await T.newPage(1366, 650)
    await T.go(page, urlOf('cpa'))
    const listed = await page.evaluate(() => [...document.querySelectorAll('details table .app-key')].map((e) => e.textContent.trim()))
    ck('the shortcuts table lists exactly D01\'s eight keys: m n p o ] [ s Esc', JSON.stringify([...listed].sort()) === JSON.stringify(Object.values(SHOWN).sort()), listed.join(' '))
    await c.close() }
}

// ---------------------------------------------------------------- the keyboard walk
sections.keyboard = async (T) => {
  const { ck } = T
  const PAGES = [
    ['Review f1 (steps, tick)', urlOf('cpa', 'f1', '1')], ['Review f5 (masked slip)', urlOf('cpa', 'f5', '1')], ['Workbench c2 (cite form)', urlOf('prep', 'c2', '1')], ['Workbench c5 (reason only)', urlOf('prep', 'c5')],
    ['Documents v1', urlOf('verify', 'v1')], ['Exceptions x2 (judge)', urlOf('risks', 'x2', '1')], ['Ops o1', urlOf('ops', 'o1', '1')], ['Workbench void g1', 'workbench.html?state=void&as=anita&item=g1'],
    ['window page', 'window.html'], ['search results', 'search.html?q=meals'], ['landing', 'index.html'], ['signed out', 'signed-out.html'],
  ]
  for (const [w, h] of SIZES) {
    for (const [name, url] of PAGES) {
      const [c, page] = await T.newPage(w, h)
      await T.go(page, url, 500)
      const seen = [], bad = []
      let first = null
      for (let i = 0; i < 170; i++) {
        await page.keyboard.press('Tab')
        const r = await page.evaluate(() => {
          const e = document.activeElement; if (!e || e === document.body) return null
          const cs = getComputedStyle(e), b = e.getBoundingClientRect()
          const styled = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || cs.boxShadow !== 'none' || /govuk-(checkboxes|radios)__input/.test(e.className)
          const inView = b.top >= -1 && b.bottom <= innerHeight + 1 && b.right <= innerWidth + 1 && b.left >= -1
          const scroller = /region|separator/.test(e.getAttribute('role') || '') || e.tagName === 'SECTION' || e.tagName === 'MAIN'
          const cx = Math.min(Math.max(b.left + b.width / 2, 0), innerWidth - 1), cy = Math.min(Math.max(b.top + Math.min(b.height / 2, 12), 0), innerHeight - 1)
          const top = document.elementFromPoint(cx, cy)
          const covered = !!top && !(top === e || e.contains(top) || top.contains(e) || (e.labels && [...e.labels].some((l) => l === top || l.contains(top))))
          const id = e.id ? '#' + e.id : e.tagName.toLowerCase() + ':' + (e.textContent || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 26)
          return { id, styled, inView, topInView: b.top >= -1 && b.top < innerHeight - 24, scroller, covered, w: Math.round(b.width), h: Math.round(b.height), isInput: /^(INPUT)$/.test(e.tagName) && /checkbox|radio/.test(e.type), tag: e.tagName }
        })
        if (!r) continue
        if (first === null) first = r.id
        else if (r.id === first && i > 3) break
        seen.push(r.id)
        if (!r.styled) bad.push('no focus style: ' + r.id)
        if (!r.inView && !(r.scroller && r.topInView)) bad.push('not in view: ' + r.id)
        if (r.covered && !r.isInput) bad.push('covered by another element: ' + r.id)
        if ((r.w < 24 || r.h < 24) && !r.isInput) bad.push(`target ${r.w}x${r.h}: ${r.id}`)
      }
      T.out.keyboard.push({ page: name, size: `${w}x${h}`, stops: seen.length, problems: [...new Set(bad)].slice(0, 6) })
      ck(`keyboard walk ${name} @${w}x${h}: ${seen.length} stops, focus visible, in view and not covered, targets 24 x 24 px or more`, bad.length === 0 && seen.length >= 3, [...new Set(bad)].slice(0, 4).join('; '))
      await c.close()
    }
  }

  // the order of the walk is top to bottom: skip link, header, return bar, record tabs, then the work, then the pane
  { const [c, page] = await T.newPage(1366, 650)
    await T.go(page, urlOf('cpa', 'f1', '1'))
    const names = []
    for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); names.push(await page.evaluate(() => { const e = document.activeElement; return e.className.toString().includes('skip') ? 'skip' : e.id === 'sv-search' ? 'search' : e.id === 'sv-signout' ? 'signout' : e.closest('.moj-sub-navigation') && !e.closest('.app-viewer') ? 'tabs' : e.id === 'sv-filter' ? 'filter' : e.closest('.app-tools') ? 'tools' : e.closest('[data-item]') ? 'rows' : e.closest('.app-viewer') ? 'viewer' : e.id === 'app-splitter' ? 'splitter' : e.className.toString().includes('brand') ? 'brand' : 'other' })) }
    // the search button and the scrollable work region are neither named group: they sit between named stops, in order
    const order = names.filter((n) => n !== 'other').filter((n, i, a) => n !== a[i - 1])
    const want = ['skip', 'brand', 'search', 'signout', 'tabs', 'filter', 'tools', 'rows']
    ck('the walk follows the page top to bottom: skip link, header, search, sign out, record tabs, filter, tools, rows', want.every((n, i) => order[i] === n), order.join(' > '))
    await c.close() }

  // from the box, 1 Tab reaches the decision (cite, tick, accept, judge, complete), at both sizes
  const DECIDE = [
    ['Workbench cite', urlOf('prep'), 'c2', /^(sv-src-0|sv-reason)$/], ['Workbench reason only', urlOf('prep'), 'c5', /^sv-reason$/], ['Review tick', urlOf('cpa'), 'f2', /Supports, next source/],
    ['Documents accept', urlOf('verify'), 'v1', /^Accept/], ['Exceptions judge', urlOf('risks'), 'x2', /^sv-judge-why$/], ['Ops complete', urlOf('ops'), 'o1', /^Complete/],
  ]
  for (const [w, h] of SIZES) for (const [label, url, row, expect] of DECIDE) {
    const [c, page] = await T.newPage(w, h)
    await T.go(page, url)
    await page.click(`[data-item="${row}"] [data-open]`); await T.settle(page, 350)
    await page.keyboard.press('Tab')
    const txt = await page.evaluate(() => { const e = document.activeElement; return e.id && /^sv-(src-0|reason|judge-why)$/.test(e.id) ? e.id : (e.textContent || '').trim() })
    ck(`${label} @${w}x${h}: from the box 1 Tab reaches the decision`, expect.test(txt), txt.slice(0, 40))
    await c.close()
  }

  // the splitter takes arrow keys, Home, End and Enter (rule 12); nothing needs dragging
  { const [c, page] = await T.newPage(1366, 650)
    await T.go(page, urlOf('cpa'))
    await page.focus('#app-splitter')
    const val = async () => +(await page.getAttribute('#app-splitter', 'aria-valuenow'))
    const w0 = await val()
    await page.keyboard.press('ArrowLeft'); const w1 = await val()
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); const w2 = await val()
    await page.keyboard.press('Home'); const w3 = await val()
    await page.keyboard.press('End'); const w4 = await val()
    await page.keyboard.press('Enter'); const w5 = await val()
    const max = +(await page.getAttribute('#app-splitter', 'aria-valuemax'))
    const m = await page.evaluate(() => { const l = document.querySelector('.app-split__work').getBoundingClientRect().width; const p = document.getElementById('source-pane').getBoundingClientRect().width; return { l: Math.round(l), p: Math.round(p) } })
    ck('the splitter takes Left (wider by 24), Right (narrower by 24), Home (360), End (the most that leaves the list 240 px) and Enter (480)', w1 === w0 + 24 && w2 === w0 - 24 && w3 === 360 && w4 === max && w5 === 480 && m.l >= 240, `${w0} ${w1} ${w2} ${w3} ${w4} ${w5} max ${max} list ${m.l}`)
    await c.close() }
}
