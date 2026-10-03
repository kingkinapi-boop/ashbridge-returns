// A04 build tests for readRegularFile (the builder's own). They import the module statically so the mutation run
// (related tests only) sees them; the acceptance file loads it by name.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { readRegularFile } from './safe-read'

let dir: string
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a04-safe-read-build-'))
})
afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(dir, { recursive: true, force: true })
})
const at = (name: string): string => path.join(dir, name)

describe('ARC-22 readRegularFile', () => {
  test('ARC-22 reads UTF-8 text up to the cap; one byte more is too-big; empty reads empty', () => {
    fs.writeFileSync(at('a.json'), 'éé')
    expect(readRegularFile(at('a.json'), 4)).toEqual({ ok: true, text: 'éé' })
    expect(readRegularFile(at('a.json'), 3)).toEqual({ ok: false, reason: 'too-big' })
    fs.writeFileSync(at('e.json'), '')
    expect(readRegularFile(at('e.json'), 0)).toEqual({ ok: true, text: '' })
    fs.writeFileSync(at('x.json'), 'x')
    expect(readRegularFile(at('x.json'), 0)).toEqual({ ok: false, reason: 'too-big' })
  })

  test('ARC-22 missing is gone; a folder is not-a-file and never opened', () => {
    expect(readRegularFile(at('none.json'), 10)).toEqual({ ok: false, reason: 'gone' })
    fs.mkdirSync(at('d.json'))
    const open = vi.spyOn(fs, 'openSync')
    expect(readRegularFile(at('d.json'), 10)).toEqual({ ok: false, reason: 'not-a-file' })
    expect(open).not.toHaveBeenCalled()
  })

  test('ARC-22 a failed open is gone, and nothing is closed that was never opened', () => {
    fs.writeFileSync(at('a.json'), '{}')
    vi.spyOn(fs, 'openSync').mockImplementation(() => {
      throw new Error('planted')
    })
    const close = vi.spyOn(fs, 'closeSync')
    expect(readRegularFile(at('a.json'), 10)).toEqual({ ok: false, reason: 'gone' })
    expect(close).not.toHaveBeenCalled()
  })

  test('ARC-22 another inode or another device on the descriptor is gone, and the descriptor is closed', () => {
    fs.writeFileSync(at('a.json'), '{}')
    const real = fs.fstatSync.bind(fs)
    for (const change of [{ ino: 1 }, { dev: 1 }]) {
      const close = vi.spyOn(fs, 'closeSync')
      vi.spyOn(fs, 'fstatSync').mockImplementation(((fd: number) => Object.assign(Object.create(Object.getPrototypeOf(real(fd)) as object) as fs.Stats, real(fd), change)))
      expect(readRegularFile(at('a.json'), 10)).toEqual({ ok: false, reason: 'gone' })
      expect(close).toHaveBeenCalledTimes(1)
      vi.restoreAllMocks()
    }
  })

  test('ARC-22 a descriptor that is not a regular file is not-a-file, closed, and nothing is read', () => {
    fs.writeFileSync(at('a.json'), '{}')
    const real = fs.fstatSync.bind(fs)
    vi.spyOn(fs, 'fstatSync').mockImplementation(((fd: number) => {
      const st = real(fd)
      return Object.assign(Object.create(Object.getPrototypeOf(st) as object) as fs.Stats, st, { isFile: () => false })
    }))
    const close = vi.spyOn(fs, 'closeSync')
    const read = vi.spyOn(fs, 'readSync')
    expect(readRegularFile(at('a.json'), 10)).toEqual({ ok: false, reason: 'not-a-file' })
    expect(close).toHaveBeenCalledTimes(1)
    expect(read).not.toHaveBeenCalled()
  })

  test('ARC-22 the file is read in as many reads as the OS gives, and the loop stops at end of file', () => {
    fs.writeFileSync(at('a.json'), 'abcdef')
    const real = fs.readSync.bind(fs)
    const sizes: number[] = []
    vi.spyOn(fs, 'readSync').mockImplementation(((fd: number, buf: Buffer, off: number, len: number, pos: null) => {
      const n = real(fd, buf, off, Math.min(len, 2), pos)
      sizes.push(n)
      return n
    }) as typeof fs.readSync)
    expect(readRegularFile(at('a.json'), 100)).toEqual({ ok: true, text: 'abcdef' })
    expect(sizes).toEqual([2, 2, 2, 0])
  })

  test('ARC-22 a read that stops once the buffer is full never asks for more', () => {
    fs.writeFileSync(at('a.json'), 'abcdef')
    const read = vi.spyOn(fs, 'readSync')
    expect(readRegularFile(at('a.json'), 3)).toEqual({ ok: false, reason: 'too-big' })
    expect(read).toHaveBeenCalledTimes(1)
  })

  test('ARC-22 the open flags are read-only plus O_NONBLOCK when defined', () => {
    fs.writeFileSync(at('a.json'), '{}')
    const open = vi.spyOn(fs, 'openSync')
    readRegularFile(at('a.json'), 10)
    const nb = (fs.constants as Readonly<Record<string, number | undefined>>)['O_NONBLOCK'] ?? 0
    expect(open.mock.calls[0]?.[1]).toBe(fs.constants.O_RDONLY | nb)
  })
})
