import { describe, expect, test, vi } from 'vitest'

const destroyed = vi.hoisted(() => ({ count: 0 }))

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', async (original) => {
  const real = await original<typeof import('pdfjs-dist/legacy/build/pdf.mjs')>()
  return {
    ...real,
    getDocument: (...args: Parameters<typeof real.getDocument>) => {
      const task = real.getDocument(...args)
      const destroy = task.destroy.bind(task)
      task.destroy = () => {
        destroyed.count += 1
        return destroy()
      }
      return task
    },
  }
})

import { createTextLayerEngine } from './index'
import { fixtureDoc } from './__fixtures__/harness'

describe('A01 text layer cleanup', () => {
  test('ARC-6 the library task is destroyed after a good read and after a refused one', async () => {
    destroyed.count = 0
    await createTextLayerEngine().read(fixtureDoc('one-page.pdf'))
    expect(destroyed.count).toBe(1)
    await expect(createTextLayerEngine().read(fixtureDoc('truncated.pdf'))).rejects.toThrow('refused')
    expect(destroyed.count).toBe(2)
  })
})
