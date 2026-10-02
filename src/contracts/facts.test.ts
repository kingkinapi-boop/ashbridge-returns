import { describe, expect, test } from 'vitest'
import { loadFactCatalogue, sensitiveKindForKey } from './facts'

describe('EV-5 SEC-4 fact catalogue unit tests', () => {
  test('SEC-4 the name rule marks account, card number, sin and birth keys', () => {
    expect(sensitiveKindForKey('bank.statement.account_number')).toBe('bank_account')
    expect(sensitiveKindForKey('card.statement.card_number')).toBe('bank_account')
    expect(sensitiveKindForKey('card.statement.line_number')).toBe('none')
    expect(sensitiveKindForKey('t4.slip.employee_sin')).toBe('sin')
    expect(sensitiveKindForKey('director.identity.birth_date')).toBe('birth_date')
    expect(sensitiveKindForKey('corporation.identity.business_number')).toBe('none')
  })

  test('EV-5 a file with no entries list is refused', () => {
    expect(loadFactCatalogue({})).toMatchObject({ ok: false })
    expect(loadFactCatalogue(null)).toMatchObject({ ok: false })
  })

  test('EV-5 an enum with no options is refused', () => {
    const r = loadFactCatalogue({
      entries: [
        {
          key: 'a.b.c',
          valueType: 'enum',
          period: 'instant',
          repeating: 'none',
          sensitive: 'none',
          suppliedBy: ['qbo'],
          label: 'X',
          cites: [{ kind: 'answer_key', ref: 'accounts' }],
        },
      ],
    })
    expect(r).toMatchObject({ ok: false })
  })
})
