// Builder unit tests for the kinds register: the folder check is faked so built and not-built are both exercised.
import { join } from 'node:path'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const built = new Set<string>()
const asked: string[] = []

vi.mock('node:fs', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs')>()
  return {
    ...real,
    existsSync: (p: string): boolean => {
      if (p.includes('kinds')) {
        asked.push(p)
        return built.has(p)
      }
      return real.existsSync(p)
    },
    // W00b spec (findings W00 r2 S8): loadKind now runs guardFolder on the kind folder, so a faked built folder is
    // also an empty one when read; the assertions below are unchanged.
    readdirSync: (p: string, ...rest: unknown[]): unknown =>
      p.includes('kinds') && [...built].some((b) => p.startsWith(b)) ? [] : (real.readdirSync as (...a: unknown[]) => unknown)(p, ...rest),
  }
})

import { REPO_ROOT } from '../clients/load'
import { KIND_IDS, listKinds, loadKind, type KindId } from './kinds'

const folder = (id: string): string => join(REPO_ROOT, 'testworld', 'kinds', id)

beforeEach(() => {
  built.clear()
  asked.length = 0
})

describe('listKinds', () => {
  test('END-9 lists the thirteen kinds in order with the blueprint start points', () => {
    expect(listKinds()).toEqual([
      { id: 'K01', startsFrom: 'new', status: 'not built' },
      { id: 'K02', startsFrom: ['C08'], status: 'not built' },
      { id: 'K03', startsFrom: ['C09'], status: 'not built' },
      { id: 'K04', startsFrom: ['C02'], status: 'not built' },
      { id: 'K05', startsFrom: 'new', status: 'not built' },
      { id: 'K06', startsFrom: 'new', status: 'not built' },
      { id: 'K07', startsFrom: ['C05', 'C06'], status: 'not built' },
      { id: 'K08', startsFrom: ['C01'], status: 'not built' },
      { id: 'K09', startsFrom: ['C04', 'C03'], status: 'not built' },
      { id: 'K10', startsFrom: ['C05'], status: 'not built' },
      { id: 'K11', startsFrom: ['C08', 'C10'], status: 'not built' },
      { id: 'K12', startsFrom: ['C10'], status: 'not built' },
      { id: 'K13', startsFrom: 'new', status: 'not built' },
    ])
    expect(KIND_IDS).toHaveLength(13)
  })

  test('END-9 a kind is built exactly when its own folder testworld/kinds/<id> exists', () => {
    built.add(folder('K05'))
    const statuses = listKinds().map((k) => `${k.id}:${k.status}`)
    expect(statuses.filter((s) => s.endsWith(':built'))).toEqual(['K05:built'])
    expect(asked).toContain(folder('K05'))
    expect(asked).toContain(folder('K13'))
  })
})

describe('loadKind', () => {
  test('END-9 a built kind loads with its entry and its folder', () => {
    built.add(folder('K09'))
    expect(loadKind('K09')).toEqual({ id: 'K09', startsFrom: ['C04', 'C03'], status: 'built', folder: folder('K09') })
  })

  test('END-9 loading one built kind does not pick another kind', () => {
    built.add(folder('K02'))
    built.add(folder('K03'))
    expect(loadKind('K03').id).toBe('K03')
    expect(loadKind('K02').id).toBe('K02')
  })

  test('END-9 a kind with no folder throws "not built" with its id and folder text', () => {
    expect(() => loadKind('K04')).toThrow(new Error('kind K04 is not built yet (no testworld/kinds/K04/ folder)'))
  })

  test('END-9 an id outside K01 to K13 throws naming the id', () => {
    expect(() => loadKind('K14' as KindId)).toThrow(new Error('K14 is not a kind; kinds are K01 to K13'))
  })
})
