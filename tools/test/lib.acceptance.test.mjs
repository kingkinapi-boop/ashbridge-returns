// F08 check 1 (ARC-19): lib.globToRegExp and pathsOverlap. Pure functions, property-tested with a fixed seed.
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { globToRegExp, pathsOverlap } from '../lib.mjs'

const SEED = { seed: 20261001, numRuns: 200 }
const name = fc.stringMatching(/^[a-z]{1,6}$/)

describe('ARC-19 globToRegExp and pathsOverlap', () => {
  test('ARC-19 src/** overlaps src/a/b.ts and not srcx/a', () => {
    expect(pathsOverlap(['src/**'], ['src/a/b.ts'])).toBe(true)
    expect(pathsOverlap(['src/**'], ['srcx/a'])).toBe(false)
    expect(globToRegExp('src/**').test('src/a/b.ts')).toBe(true)
    expect(globToRegExp('src/**').test('srcx/a')).toBe(false)
  })

  test('ARC-19 a/*.ts does not match a/b/c.ts and does match a/b.ts', () => {
    expect(globToRegExp('a/*.ts').test('a/b/c.ts')).toBe(false)
    expect(globToRegExp('a/*.ts').test('a/b.ts')).toBe(true)
  })

  test('ARC-19 a glob with regex characters matches them literally', () => {
    expect(globToRegExp('a.b/(c)+.ts').test('a.b/(c)+.ts')).toBe(true)
    expect(globToRegExp('a.b/c.ts').test('aXb/c.ts')).toBe(false)
  })

  test('ARC-19 property: dir/** matches every path under dir and nothing under dirx', () => {
    fc.assert(
      fc.property(name, fc.array(name, { minLength: 1, maxLength: 4 }), (dir, rest) => {
        const re = globToRegExp(`${dir}/**`)
        expect(re.test(`${dir}/${rest.join('/')}.ts`)).toBe(true)
        expect(re.test(`${dir}x/${rest.join('/')}.ts`)).toBe(false)
      }),
      SEED,
    )
  })

  test('ARC-19 property: dir/*.ts matches one level only', () => {
    fc.assert(
      fc.property(name, name, name, (dir, a, b) => {
        const re = globToRegExp(`${dir}/*.ts`)
        expect(re.test(`${dir}/${a}.ts`)).toBe(true)
        expect(re.test(`${dir}/${a}/${b}.ts`)).toBe(false)
      }),
      SEED,
    )
  })

  test('ARC-19 property: globs under two different top folders never overlap', () => {
    fc.assert(
      fc.property(name, name, name, (r1, r2, leaf) => {
        fc.pre(r1 !== r2)
        expect(pathsOverlap([`${r1}/**`], [`${r2}/**`])).toBe(false)
        expect(pathsOverlap([`${r1}/${leaf}.ts`], [`${r2}/**`, `${r2}/${leaf}.ts`])).toBe(false)
      }),
      SEED,
    )
  })

  test('ARC-19 property: overlap is symmetric', () => {
    const glob = fc.stringMatching(/^[ab/*.]{1,8}$/)
    fc.assert(
      fc.property(fc.array(glob, { maxLength: 4 }), fc.array(glob, { maxLength: 4 }), (x, y) => {
        expect(pathsOverlap(x, y)).toBe(pathsOverlap(y, x))
      }),
      SEED,
    )
  })

  test('ARC-19 an empty path list overlaps nothing', () => {
    expect(pathsOverlap([], ['src/**'])).toBe(false)
    expect(pathsOverlap(['src/**'], [])).toBe(false)
  })
})
