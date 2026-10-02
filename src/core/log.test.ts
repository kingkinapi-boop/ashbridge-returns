// F00T builder's unit tests for the logger (the acceptance tests are in log.acceptance.test.ts).
import { describe, expect, test } from 'vitest'
import { redact, REDACTED, SENSITIVE_KINDS } from './log'

describe('F00T unit: log', () => {
  test('SEC-5 a key with no word parts is never a sensitive key, whatever the kind list holds', () => {
    expect(redact({ '': 'a', '__': 'b', '-': 'c' })).toEqual({ '': 'a', '__': 'b', '-': 'c' })
  })

  test('SEC-10 every listed kind redacts a key spelled as that kind and a key spelled in camel case', () => {
    for (const kind of SENSITIVE_KINDS) {
      const snake = kind.replace(/ /g, '_')
      const camel = kind.replace(/ (\w)/g, (_m, c: string) => c.toUpperCase())
      expect(redact({ [snake]: 'x', [camel]: 'y' })).toEqual({ [snake]: REDACTED, [camel]: REDACTED })
    }
  })

  test('SEC-10 the compound credential kinds redact on their own words, not through the single word token', () => {
    for (const key of ['access token', 'refresh token', 'token hash']) {
      expect(redact({ [key]: 'x' })).toEqual({ [key]: REDACTED })
    }
  })
})
