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

const GOOD = {
  key: 'a.b.c',
  valueType: 'money',
  period: 'instant',
  repeating: 'none',
  sensitive: 'none',
  suppliedBy: ['qbo'],
  label: 'Label',
  cites: [{ kind: 'answer_key', ref: 'accounts' }],
}

/** The refusal reasons for one entry with the given fields replaced (undefined deletes the field). */
function reasonsFor(patch: Record<string, unknown>): string[] {
  const entry = Object.fromEntries(Object.entries<unknown>({ ...GOOD, ...patch }).filter(([, v]) => v !== undefined))
  const r = loadFactCatalogue({ entries: [entry] })
  return r.ok ? [] : r.reasons
}

describe('EV-5 EV-10 SEC-4 every refusal says why, word for word', () => {
  test('EV-5 a good entry loads and can be looked up', () => {
    const r = loadFactCatalogue({ entries: [GOOD] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.catalogue.get('a.b.c')?.label).toBe('Label')
    expect(r.catalogue.get('x.y.z')).toBeUndefined()
    expect(r.catalogue.entries).toHaveLength(1)
  })

  test('EV-5 the file shape refusal names the entries list', () => {
    expect(loadFactCatalogue([])).toEqual({ ok: false, reasons: ['the catalogue must be an object with an "entries" list'] })
    expect(loadFactCatalogue({ entries: 'x' })).toEqual({ ok: false, reasons: ['the catalogue must be an object with an "entries" list'] })
    expect(loadFactCatalogue('x')).toMatchObject({ ok: false })
  })

  test('EV-5 a key outside the dotted pattern is refused with its text', () => {
    for (const key of ['abc', 'a.b', 'A.b.c', 'a.b.c.d', '1a.b.c', 'a.b.', 'a..c', 'a.b.c ', ' a.b.c', 'a-b.c.d', 'a.b.C']) {
      expect(reasonsFor({ key }), key).toEqual([`${key}: key "${key}" is not in the dotted pattern <area>.<subject>.<measure>`])
    }
    expect(reasonsFor({ key: 'a1_x.b2.c_3' })).toEqual([])
  })

  test('EV-5 a duplicate key is refused naming the key, once per extra copy', () => {
    const r = loadFactCatalogue({ entries: [GOOD, GOOD] })
    expect(r).toEqual({ ok: false, reasons: ['a.b.c: duplicate key'] })
  })

  test('EV-5 an entry that is not an object is refused naming its position', () => {
    const r = loadFactCatalogue({ entries: [GOOD, 5] })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reasons[0]).toMatch(/^entry 1: /)
    const r2 = loadFactCatalogue({ entries: [{ ...GOOD, key: 7 }] })
    expect(r2.ok ? '' : r2.reasons[0]).toMatch(/^entry 0: /)
  })

  test('EV-5 an entry with no text key is refused by its position, with the reason', () => {
    expect(reasonsFor({ key: undefined })).toEqual(['entry 0: Invalid input: expected string, received undefined'])
    expect(reasonsFor({ key: 7 })).toEqual(['entry 0: Invalid input: expected string, received number'])
  })

  test('EV-5 an unknown value type is refused, and each known one is accepted', () => {
    expect(reasonsFor({ valueType: 'bogus' })).toEqual(['a.b.c: unknown value type "bogus"'])
    expect(reasonsFor({ valueType: 5 })).toEqual(['a.b.c: unknown value type "5"'])
    expect(reasonsFor({ valueType: undefined })).toEqual(['a.b.c: unknown value type "undefined"'])
    for (const valueType of ['money', 'date', 'text', 'count', 'percent', 'boolean']) {
      expect(reasonsFor({ valueType }), valueType).toEqual([])
    }
    expect(reasonsFor({ valueType: 'enum', options: ['a', 'b'] })).toEqual([])
  })

  test('EV-5 an enum needs non-empty string option ids, and only an enum may have options', () => {
    const msg = ['a.b.c: an enum value type needs its option ids']
    expect(reasonsFor({ valueType: 'enum' })).toEqual(msg)
    expect(reasonsFor({ valueType: 'enum', options: [] })).toEqual(msg)
    expect(reasonsFor({ valueType: 'enum', options: 'a' })).toEqual(msg)
    expect(reasonsFor({ valueType: 'enum', options: [''] })).toEqual(msg)
    expect(reasonsFor({ valueType: 'enum', options: ['a', 3] })).toEqual(msg)
    expect(reasonsFor({ valueType: 'enum', options: ['a', ''] })).toEqual(msg)
    expect(reasonsFor({ valueType: 'money', options: ['a'] })).toEqual(['a.b.c: options are only for the enum value type'])
    expect(reasonsFor({ valueType: 'money', options: [] })).toEqual(['a.b.c: options are only for the enum value type'])
  })

  test('EV-5 the period is instant or duration, nothing else', () => {
    expect(reasonsFor({ period: 'duration' })).toEqual([])
    expect(reasonsFor({ period: 'always' })).toEqual(['a.b.c: unknown period "always"'])
    expect(reasonsFor({ period: undefined })).toEqual(['a.b.c: unknown period "undefined"'])
  })

  test('EV-5 a repeating key needs a non-empty row key', () => {
    const msg = ['a.b.c: a repeating key needs a non-empty row key (repeating.rowKey)']
    expect(reasonsFor({ repeating: { rowKey: 'slip' } })).toEqual([])
    expect(reasonsFor({ repeating: undefined })).toEqual(msg)
    expect(reasonsFor({ repeating: {} })).toEqual(msg)
    expect(reasonsFor({ repeating: { rowKey: '' } })).toEqual(msg)
    expect(reasonsFor({ repeating: { rowKey: '   ' } })).toEqual(msg)
    expect(reasonsFor({ repeating: { rowKey: 3 } })).toEqual(msg)
    expect(reasonsFor({ repeating: 'every' })).toEqual(msg)
    expect(reasonsFor({ repeating: [] })).toEqual(msg)
    expect(reasonsFor({ repeating: null })).toEqual(msg)
    expect(reasonsFor({ repeating: ['rowKey'] })).toEqual(msg)
  })

  test('SEC-4 an unknown sensitive kind is refused; a name that demands a kind must carry it', () => {
    expect(reasonsFor({ sensitive: 'secret' })).toEqual(['a.b.c: unknown sensitive kind "secret"'])
    expect(reasonsFor({ sensitive: undefined })).toEqual(['a.b.c: unknown sensitive kind "undefined"'])
    for (const sensitive of ['none', 'sin', 'birth_date', 'bank_account']) expect(reasonsFor({ sensitive }), sensitive).toEqual([])
    expect(reasonsFor({ key: 'x.y.account_number' })).toEqual([
      'x.y.account_number: sensitive must be "bank_account" because the key name says so (found "none")',
    ])
    expect(reasonsFor({ key: 'x.y.account_number', sensitive: 'sin' })).toEqual([
      'x.y.account_number: sensitive must be "bank_account" because the key name says so (found "sin")',
    ])
    expect(reasonsFor({ key: 'x.y.account_number', sensitive: 'bank_account' })).toEqual([])
    expect(reasonsFor({ key: 'x.y.employee_sin' })).toEqual([
      'x.y.employee_sin: sensitive must be "sin" because the key name says so (found "none")',
    ])
    expect(reasonsFor({ key: 'x.y.birth_date' })).toEqual([
      'x.y.birth_date: sensitive must be "birth_date" because the key name says so (found "none")',
    ])
    expect(reasonsFor({ key: 'x.y.card_number', sensitive: 'bank_account' })).toEqual([])
  })

  test('SEC-4 the name rule matches whole words, not fragments', () => {
    expect(sensitiveKindForKey('x.y.single')).toBe('none')
    expect(sensitiveKindForKey('x.y.birthday')).toBe('none')
    expect(sensitiveKindForKey('x.sin.amount')).toBe('sin')
    expect(sensitiveKindForKey('x.y.sin_x')).toBe('sin')
    expect(sensitiveKindForKey('birth.y.z')).toBe('birth_date')
    expect(sensitiveKindForKey('x.y.my_account_number')).toBe('bank_account')
    expect(sensitiveKindForKey('x.card_number.z')).toBe('none')
    expect(sensitiveKindForKey('x.y.number')).toBe('none')
    expect(sensitiveKindForKey('x.y.account')).toBe('none')
  })

  test('EV-10 suppliedBy needs at least one known document kind or named source', () => {
    expect(reasonsFor({ suppliedBy: [] })).toEqual(['a.b.c: suppliedBy needs at least one source'])
    expect(reasonsFor({ suppliedBy: 'bank' })).toEqual(['a.b.c: suppliedBy needs at least one source'])
    expect(reasonsFor({ suppliedBy: undefined })).toEqual(['a.b.c: suppliedBy needs at least one source'])
    expect(reasonsFor({ suppliedBy: ['nope'] })).toEqual([
      'a.b.c: suppliedBy source "nope" is not a document kind or a named source',
    ])
    expect(reasonsFor({ suppliedBy: [5] })).toEqual(['a.b.c: suppliedBy source "5" is not a document kind or a named source'])
    expect(reasonsFor({ suppliedBy: ['bank', 'nope', 'zzz'] })).toHaveLength(2)
    for (const s of ['bank', 'cra-notice', 'onboarding', 'qa', 'cra_capture', 'prior_return', 'qbo', 'judgment']) {
      expect(reasonsFor({ suppliedBy: [s] }), s).toEqual([])
    }
  })

  test('EV-5 a label is short, non-empty and has no final full stop', () => {
    expect(reasonsFor({ label: '' })).toEqual(['a.b.c: label is empty'])
    expect(reasonsFor({ label: '   ' })).toEqual(['a.b.c: label is empty'])
    expect(reasonsFor({ label: 7 })).toEqual(['a.b.c: label is empty'])
    expect(reasonsFor({ label: undefined })).toEqual(['a.b.c: label is empty'])
    expect(reasonsFor({ label: 'Ends here.' })).toEqual(['a.b.c: label ends in a full stop'])
    expect(reasonsFor({ label: 'x'.repeat(60) })).toEqual([])
    expect(reasonsFor({ label: 'x'.repeat(61) })).toEqual(['a.b.c: label is 61 characters, more than 60'])
    expect(reasonsFor({ label: `${'x'.repeat(60)}.` })).toEqual([
      'a.b.c: label is 61 characters, more than 60',
      'a.b.c: label ends in a full stop',
    ])
    expect(reasonsFor({ label: 'Mid. dle' })).toEqual([])
  })

  test('EV-5 every entry must cite, and each cite needs a known kind and a non-empty ref', () => {
    const none = ['a.b.c: an entry must cite where its meaning comes from (cites)']
    const bad = ['a.b.c: a cite needs a kind (cra_form, onboarding_contract or answer_key) and a ref']
    expect(reasonsFor({ cites: [] })).toEqual(none)
    expect(reasonsFor({ cites: undefined })).toEqual(none)
    expect(reasonsFor({ cites: 'x' })).toEqual(none)
    expect(reasonsFor({ cites: [{ kind: 'wish', ref: 'x' }] })).toEqual(bad)
    expect(reasonsFor({ cites: [{ kind: 'cra_form', ref: '' }] })).toEqual(bad)
    expect(reasonsFor({ cites: [{ kind: 'cra_form', ref: '  ' }] })).toEqual(bad)
    expect(reasonsFor({ cites: [{ kind: 'cra_form', ref: 4 }] })).toEqual(bad)
    expect(reasonsFor({ cites: [{ kind: 'cra_form' }] })).toEqual(bad)
    expect(reasonsFor({ cites: ['x'] })).toEqual(bad)
    expect(reasonsFor({ cites: [null] })).toEqual(bad)
    expect(reasonsFor({ cites: [[]] })).toEqual(bad)
    expect(reasonsFor({ cites: [{ kind: 'answer_key', ref: 'a' }, { kind: 'x', ref: 'a' }] })).toEqual(bad)
    // FX7 spec (R45-cite): a cra_form ref must fit its pattern, so the cra_form case uses a T2 line, not free text.
    for (const [kind, ref] of [['cra_form', 'T2 line 070'], ['onboarding_contract', 'x'], ['answer_key', 'x']]) {
      expect(reasonsFor({ cites: [{ kind, ref }] }), kind).toEqual([])
    }
  })

  test('EV-5 several problems in one entry are all reported, in order', () => {
    const r = reasonsFor({ key: 'bad', valueType: 'zz', period: 'p', label: '' })
    expect(r).toEqual([
      'bad: key "bad" is not in the dotted pattern <area>.<subject>.<measure>',
      'bad: unknown value type "zz"',
      'bad: unknown period "p"',
      'bad: label is empty',
    ])
  })
})

describe('EV-5 the catalogue version is a hash of content, not layout', () => {
  const other = { ...GOOD, key: 'd.e.f', label: 'Other' }
  const version = (entries: unknown[]): string => {
    const r = loadFactCatalogue({ entries })
    if (!r.ok) throw new Error(r.reasons.join())
    return r.catalogue.version
  }

  test('EV-5 the version is a 64 character hex digest', () => {
    expect(version([GOOD])).toMatch(/^[0-9a-f]{64}$/)
  })

  test('EV-5 the order of entries and of fields does not change it', () => {
    const reordered = Object.fromEntries(Object.entries(GOOD).reverse())
    expect(version([GOOD, other])).toBe(version([other, GOOD]))
    expect(version([GOOD, other])).toBe(version([reordered, other]))
  })

  test('EV-5 a change to a label, a cite, a source, a row key or the entry list changes it', () => {
    const base = version([GOOD, other])
    expect(version([{ ...GOOD, label: 'Label2' }, other])).not.toBe(base)
    expect(version([{ ...GOOD, cites: [{ kind: 'answer_key', ref: 'accounts2' }] }, other])).not.toBe(base)
    expect(version([{ ...GOOD, suppliedBy: ['qbo', 'qa'] }, other])).not.toBe(base)
    expect(version([{ ...GOOD, suppliedBy: ['qa', 'qbo'] }, other])).not.toBe(base)
    expect(version([GOOD])).not.toBe(base)
    expect(version([{ ...GOOD, repeating: { rowKey: 'a' } }, other])).not.toBe(version([{ ...GOOD, repeating: { rowKey: 'b' } }, other]))
    expect(version([{ ...GOOD, repeating: { rowKey: 'a' } }])).not.toBe(version([GOOD]))
  })

  test('EV-5 a value moved between a string and a nested list cannot collide', () => {
    expect(version([{ ...GOOD, label: '["a","b"]' }])).not.toBe(version([{ ...GOOD, label: 'a,b' }]))
  })
})
