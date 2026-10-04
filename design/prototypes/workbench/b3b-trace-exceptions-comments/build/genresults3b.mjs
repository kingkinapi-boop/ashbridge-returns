// Writes results.html: version B's search page with the search data following this version's trace cells.
// Run after gen3b.mjs: node design/prototypes/workbench/b3b-trace-exceptions-comments/build/genresults3b.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MAPLE, EGLINTON } from './data3b.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(here, '..')
let r = fs.readFileSync(path.join(here, '..', '..', 'b-split-pane', 'results.html'), 'utf8')
const val = (c) => String(c.valueLabel || c.value)
const cells = MAPLE.traced.rows.filter((c) => c.cls !== 'changed').map((c) => ({ name: c.cell, val: val(c), href: `record.html?stage=traced&sel=${c.id}#/trace` }))
const t10 = MAPLE.rework.items.find((c) => c.id === 't10')
cells.push({ name: t10.cell, val: val(t10), href: 'record.html?stage=rework&sel=t10#/trace' })
for (const c of EGLINTON.traced.rows.filter((x) => x.cls !== 'changed')) cells.push({ name: `${c.cell} (Eglinton Retail)`, val: val(c), href: `record-eglinton.html?sel=${c.id}#/trace` })
r = r.replace(/"cells":\[.*?\],"returns"/, `"cells":${JSON.stringify(cells)},"returns"`)
r = r.replace('shell-other.html?tab=Workbench&r=Eglinton%20Retail%20Ltd.%20(Test)', 'record-eglinton.html#/trace')
r = r.replace("'Cells in the Maple Ridge trace'", "'Cells in the traces'")
fs.writeFileSync(path.join(OUT, 'results.html'), r)
console.log('results.html:', cells.length, 'cells')
