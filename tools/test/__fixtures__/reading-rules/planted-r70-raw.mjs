// Planted (SC4 R70): a raw sheet-XML reader that knows one spelling of each element: double-quoted attributes, no
// namespace prefix, no attribute on <v>. A well-formed `<x:c r='A1'>` is silently not a cell.
const attr = (attrs, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1]

/** The parts of a one-sheet workbook to `{ sheet name: { address: { type, value, formula } } }`. */
export function readParts(parts) {
  const sheet = /<sheet\s([^>]*?)\/>/.exec(parts.workbook)
  const name = sheet ? attr(` ${sheet[1]}`, 'name') : undefined
  const cells = {}
  for (const m of parts.sheet.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = attr(` ${m[1]}`, 'r')
    if (ref === undefined) continue
    const inner = m[2] ?? ''
    cells[ref] = {
      type: attr(` ${m[1]}`, 't'),
      value: /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1],
      formula: /<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/.exec(inner)?.[1],
    }
  }
  return name === undefined ? {} : { [name]: cells }
}
