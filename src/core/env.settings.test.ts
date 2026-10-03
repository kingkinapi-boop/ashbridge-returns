import { describe, expect, test } from 'vitest'
import { readSettings } from './env'

describe('env.ts names every failing setting (SEC-10)', () => {
  test('SEC-10 two bad settings are named in order, separated by a comma and a space, with no value', () => {
    expect(() => readSettings({ NODE_ENV: 'PLANTED-a', AUTH_ENGINE: 'PLANTED-b' })).toThrow(new Error('Invalid settings: NODE_ENV, AUTH_ENGINE'))
  })

  test('ARC-6 a blank AUTH_ENGINE reads as unset', () => {
    expect(readSettings({ AUTH_ENGINE: '' }).AUTH_ENGINE).toBeUndefined()
  })
})
