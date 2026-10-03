// FX7 acceptance tests, the A508 section: textlayer's cleanup (`await task.destroy()` in a finally or a catch) must
// never mask the error already in flight. The first error stays primary (SC11's settleAll pattern): the read rejects
// with that error itself, or with an error whose `cause` is that error; the library task is still destroyed.
// A520: a clean read whose destroy rejects rejects with that cleanup error (itself or as cause) and stores nothing.
// The library (pdfjs-dist) is wrapped here, never our own modules: a flag makes a page read fail and destroy reject.
import { afterEach, describe, expect, test, vi } from 'vitest'

const plan = vi.hoisted(() => ({ pageFails: false, destroyFails: false, destroyed: 0 }))
const PAGE_ERROR = vi.hoisted(() => new Error('page read failed (Test)'))
const DESTROY_ERROR = vi.hoisted(() => new Error('destroy failed (Test)'))

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', async (original) => {
  const real = await original<typeof import('pdfjs-dist/legacy/build/pdf.mjs')>()
  return {
    ...real,
    getDocument: (...args: Parameters<typeof real.getDocument>) => {
      const task = real.getDocument(...args)
      const destroy = task.destroy.bind(task)
      task.destroy = async () => {
        plan.destroyed += 1
        await destroy()
        if (plan.destroyFails) throw DESTROY_ERROR
      }
      if (plan.pageFails) {
        const loaded = task.promise
        Object.defineProperty(task, 'promise', {
          value: loaded.then(
            (doc) =>
              new Proxy(doc, {
                get(target, prop) {
                  if (prop === 'getPage') return () => Promise.reject(PAGE_ERROR)
                  const v: unknown = Reflect.get(target, prop, target)
                  return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v
                },
              }),
          ),
        })
      }
      return task
    },
  }
})

import { createTextLayerEngine } from './index'
import { fixtureDoc } from './__fixtures__/harness'

afterEach(() => {
  plan.pageFails = false
  plan.destroyFails = false
  plan.destroyed = 0
})

async function rejection(name: string): Promise<Error> {
  try {
    await createTextLayerEngine().read(fixtureDoc(name))
  } catch (e) {
    expect(e).toBeInstanceOf(Error)
    return e as Error
  }
  throw new Error(`${name} was read; a rejection was expected`)
}

/** The error itself, or the error its `cause` names. */
const primaryOf = (e: Error): unknown => (e.cause === undefined ? e : e.cause)

describe('FX7 textlayer cleanup keeps the first error primary (A508)', () => {
  test('ARC-6 control: with nothing failing, a good read destroys the task once', async () => {
    const r = await createTextLayerEngine().read(fixtureDoc('one-page.pdf'))
    expect(r.pageCount).toBe(1)
    expect(plan.destroyed).toBe(1)
  })
  test('ARC-6 control: a page read failing alone rejects with that error', async () => {
    plan.pageFails = true
    const e = await rejection('one-page.pdf')
    expect(e === PAGE_ERROR || e.cause === PAGE_ERROR).toBe(true)
    expect(plan.destroyed).toBe(1)
  })
  test('ARC-6 planted: a page read fails and then destroy rejects: the page error stays primary, never the destroy error', async () => {
    plan.pageFails = true
    plan.destroyFails = true
    const e = await rejection('one-page.pdf')
    expect(e).not.toBe(DESTROY_ERROR)
    expect(primaryOf(e)).toBe(PAGE_ERROR)
    expect(plan.destroyed).toBe(1)
  })
  test('ARC-6 planted: a broken PDF is refused and then destroy rejects: the refusal stays primary', async () => {
    plan.destroyFails = true
    const e = await rejection('truncated.pdf')
    expect(e).not.toBe(DESTROY_ERROR)
    const primary = primaryOf(e)
    expect(primary).toBeInstanceOf(Error)
    expect((primary as Error).message).toMatch(/^Reading refused: /)
    expect(plan.destroyed).toBe(1)
  })
  // A520 gap 6 (amber, SC11's settleAll: with no earlier error the cleanup error is primary). A build that swallows
  // every destroy error (`await task.destroy().catch(() => undefined)`) returns and stores the result: caught here.
  test('ARC-6 planted: a good read whose destroy rejects rejects with the destroy error, stores nothing, and the next read parses again', async () => {
    plan.destroyFails = true
    const engine = createTextLayerEngine()
    const doc = fixtureDoc('one-page.pdf')
    let caught: unknown
    try {
      await engine.read(doc)
    } catch (e) {
      caught = e
    }
    expect(caught, 'a clean read whose cleanup failed was returned as a success').toBeInstanceOf(Error)
    const e = caught as Error
    expect(e === DESTROY_ERROR || e.cause === DESTROY_ERROR).toBe(true)
    expect(plan.destroyed).toBe(1)
    expect(engine.parseCount()).toBe(1)
    plan.destroyFails = false
    const r = await engine.read(doc)
    expect(r.pageCount).toBe(1)
    expect(engine.parseCount()).toBe(2)
    expect(plan.destroyed).toBe(2)
  })
})
