// The fault catalogue: what each sample client plants and the exact flag or exception it must raise (ARC-8).
// W01 to W13 add to it through testworld/kinds/<kind>/faults.ts.
import { clientFolders, loadClient } from './clients/load'
import type { ClientId } from './model/index'
import type { KindId } from './kinds'

export type FaultEntry = {
  id: string
  client?: ClientId
  kind?: KindId
  flagId?: string
  planted: string
  expected: string
  clause?: string
}

let cached: FaultEntry[] | undefined

/** Every flag in each sample client's answer key, and each month a client's own data says does not roll. */
export function faults(): FaultEntry[] {
  if (cached !== undefined) return cached
  const out: FaultEntry[] = []
  for (const id of clientFolders().keys()) {
    const c = loadClient(id)
    for (const f of c.flags) {
      out.push({
        id: f.id,
        client: id,
        flagId: f.id,
        planted: `${f.rule}: ${f.detail}`,
        expected: `flag ${f.id} (${f.rule})${f.severity === null ? '' : `, ${f.severity}`}${f.action === null ? '' : `: ${f.action}`}`,
      })
    }
    for (const a of c.accounts) {
      for (const m of a.months.filter((x) => !x.rolls)) {
        out.push({
          id: `${id}-roll-${a.key}-${m.month}`,
          client: id,
          planted: `${a.key} ${m.month} does not roll: opening plus the exported activity is not the closing balance`,
          expected: `roll exception for ${a.key} ${m.month}, listed so the loader accepts it`,
        })
      }
    }
  }
  cached = out
  return out
}
