// The register of the thirteen return kinds (END-9, blueprint 00): which sample client each starts from, and whether it is built.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ClientId } from './index'
import { REPO_ROOT } from '../clients/load'

export const KIND_IDS = ['K01', 'K02', 'K03', 'K04', 'K05', 'K06', 'K07', 'K08', 'K09', 'K10', 'K11', 'K12', 'K13'] as const
export type KindId = (typeof KIND_IDS)[number]
export type KindEntry = { id: KindId; startsFrom: 'new' | ClientId[]; status: 'built' | 'not built' }
export type Kind = KindEntry & { folder: string }

// blueprint/00-end-state.md, "The thirteen return kinds", column "Starts from sample client".
const STARTS_FROM: Record<KindId, 'new' | ClientId[]> = {
  K01: 'new',
  K02: ['C08'],
  K03: ['C09'],
  K04: ['C02'],
  K05: 'new',
  K06: 'new',
  K07: ['C05', 'C06'],
  K08: ['C01'],
  K09: ['C04', 'C03'],
  K10: ['C05'],
  K11: ['C08', 'C10'],
  K12: ['C10'],
  K13: 'new',
}

const folderOf = (id: KindId): string => join(REPO_ROOT, 'testworld', 'kinds', id)

export function listKinds(): KindEntry[] {
  return KIND_IDS.map((id) => ({ id, startsFrom: STARTS_FROM[id], status: existsSync(folderOf(id)) ? 'built' : 'not built' }))
}

/** A built kind. Throws "not built" for a kind with no folder yet (never a stub), and names an id outside K01 to K13. */
export function loadKind(id: KindId): Kind {
  const entry = listKinds().find((k) => k.id === id)
  if (entry === undefined) throw new Error(`${id as string} is not a kind; kinds are K01 to K13`)
  if (entry.status === 'not built') throw new Error(`kind ${id} is not built yet (no testworld/kinds/${id}/ folder)`)
  return { ...entry, folder: folderOf(id) }
}
