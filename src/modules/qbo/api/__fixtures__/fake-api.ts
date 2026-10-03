// B04 spec: a local fake of Intuit's QBO web interface (ARC-20). Test support only; product code never imports it.
// It answers from the files in ./unconfirmed (each marked "confirmed": false) and the stand-in fixture's attachments,
// records every request with the time on the test's clock, and never touches the network.
//
// Routes (path after https://sandbox-quickbooks.api.intuit.com/v3/company/<realm>/; query strings decoded by URL):
//   companyinfo/<realm>                         CompanyInfo (LegalName from `legalName`, default the fixture's)
//   preferences                                 Preferences (home currency)
//   reports/TrialBalance?end_date=YYYY-MM-DD    the trial balance of that date (2025-12-31 or 2024-12-31), else 400
//   reports/GeneralLedger[?account=<id>[,<id>]][&start_date=&end_date=]   sections of those accounts, rows in the dates
//   reports/TransactionList[?start_date=&end_date=]                       rows in the dates
//   query?query=select ... from <Entity> ...    Account, JournalEntry or Attachable (every entity of that kind)
//   attachable/<id>                             one Attachable
//   download/<id>                               the attachment's bytes (the TempDownloadUri in attachables.json)
// The OAuth token exchange, POST https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer, gets a made-up token.
// Anything else is a 404. A route can be replaced (`overrides`) and the first `throttle` requests answered 429.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SANDBOX_HOST = 'https://sandbox-quickbooks.api.intuit.com'
export const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
export const UNCONFIRMED = path.join(path.dirname(fileURLToPath(import.meta.url)), 'unconfirmed')
const STANDIN_ATTACHMENTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '__fixtures__', 'standin', '9130000000000001', 'attachments')

export type FakeRequest = { method: string; url: string; headers: Record<string, string> }
export type FakeResponse = { status: number; headers: Record<string, string>; body: Uint8Array }
export type Transport = (request: FakeRequest) => Promise<FakeResponse>
export type Recorded = { method: string; url: string; at: number; status: number }

export type RouteName =
  | 'companyinfo'
  | 'preferences'
  | 'trial-balance-2025-12-31'
  | 'trial-balance-2024-12-31'
  | 'general-ledger'
  | 'transaction-list'
  | 'accounts'
  | 'journal-entries'
  | 'attachables'

export type FakeOptions = {
  /** The test's clock: each request is stamped with now(). */
  now: () => number
  /** The realm the fake serves; requests for another realm get 404. */
  realm?: string
  legalName?: string
  /** The first `throttle` requests to the company host are answered 429. Infinity: every one. */
  throttle?: number
  overrides?: Partial<Record<RouteName, unknown>>
}

export function readUnconfirmed(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(UNCONFIRMED, name), 'utf8')) as unknown
}

const enc = (s: string): Uint8Array => new TextEncoder().encode(s)
const json = (status: number, v: unknown): FakeResponse => ({ status, headers: { 'content-type': 'application/json' }, body: enc(JSON.stringify(v)) })

type Cell = { value: string; id?: string }
type Row = { type?: string; ColData?: Cell[]; Header?: { ColData: Cell[] }; Rows?: { Row: Row[] }; Summary?: unknown }
type Report = { Columns: { Column: { MetaData: { Name: string; Value: string }[] }[] }; Rows: { Row: Row[] } }

function colIndex(report: Report, key: string): number {
  return report.Columns.Column.findIndex((c) => c.MetaData.some((m) => m.Name === 'ColKey' && m.Value === key))
}

function inDates(report: Report, rows: Row[], from: string | null, to: string | null): Row[] {
  const at = colIndex(report, 'tx_date')
  return rows.filter((r) => {
    const d = r.ColData?.[at]?.value ?? ''
    return (from === null || d >= from) && (to === null || d <= to)
  })
}

export function createFakeQboApi(options: FakeOptions): { transport: Transport; requests: Recorded[] } {
  const realm = options.realm ?? '9130000000000001'
  const requests: Recorded[] = []
  let throttled = 0
  const route = (name: RouteName, file: string): unknown => (options.overrides && name in options.overrides ? options.overrides[name] : readUnconfirmed(file))

  function answer(req: FakeRequest): FakeResponse {
    if (req.url === TOKEN_URL && req.method === 'POST') {
      return json(200, { token_type: 'bearer', access_token: 'fake-access (Test)', expires_in: 3600, refresh_token: 'fake-refresh (Test)', x_refresh_token_expires_in: 8640000 })
    }
    const base = `${SANDBOX_HOST}/v3/company/${realm}/`
    if (!req.url.startsWith(base)) return json(404, { Fault: { Error: [{ Message: 'not found (fake)' }] } })
    if (req.method !== 'GET') return json(405, { Fault: { Error: [{ Message: 'the fake QBO API is read only' }] } })
    if (throttled < (options.throttle ?? 0)) {
      throttled++
      return json(429, readUnconfirmed('rate-limited-429.json'))
    }
    const url = new URL(req.url)
    const rest = url.pathname.slice(`/v3/company/${realm}/`.length)
    const p = url.searchParams
    if (rest === `companyinfo/${realm}`) {
      const info = route('companyinfo', 'company-info.json') as { CompanyInfo: Record<string, unknown> }
      return json(200, options.legalName === undefined ? info : { ...info, CompanyInfo: { ...info.CompanyInfo, LegalName: options.legalName, CompanyName: options.legalName } })
    }
    if (rest === 'preferences') return json(200, route('preferences', 'preferences.json'))
    if (rest === 'reports/TrialBalance') {
      const end = p.get('end_date')
      if (end === '2025-12-31') return json(200, route('trial-balance-2025-12-31', 'trial-balance-2025-12-31.json'))
      if (end === '2024-12-31') return json(200, route('trial-balance-2024-12-31', 'trial-balance-2024-12-31.json'))
      return json(400, { Fault: { Error: [{ Message: 'the fake has no trial balance for that end_date' }] } })
    }
    if (rest === 'reports/GeneralLedger') {
      const report = structuredClone(route('general-ledger', 'general-ledger.json')) as Report
      const wanted = p.get('account')?.split(',').map((s) => s.trim())
      report.Rows.Row = report.Rows.Row.filter((s) => wanted === undefined || wanted.includes(s.Header?.ColData[0]?.id ?? '')).map((s) => ({
        ...s,
        Rows: { Row: inDates(report, s.Rows?.Row ?? [], p.get('start_date'), p.get('end_date')) },
      }))
      return json(200, report)
    }
    if (rest === 'reports/TransactionList') {
      const report = structuredClone(route('transaction-list', 'transaction-list.json')) as Report
      report.Rows.Row = inDates(report, report.Rows.Row, p.get('start_date'), p.get('end_date'))
      return json(200, report)
    }
    if (rest === 'query') {
      const q = p.get('query') ?? ''
      if (/\bfrom\s+Account\b/i.test(q)) return json(200, route('accounts', 'accounts.json'))
      if (/\bfrom\s+JournalEntry\b/i.test(q)) return json(200, route('journal-entries', 'journal-entries.json'))
      if (/\bfrom\s+Attachable\b/i.test(q)) return json(200, route('attachables', 'attachables.json'))
      return json(400, { Fault: { Error: [{ Message: 'the fake answers Account, JournalEntry and Attachable queries only' }] } })
    }
    const one = /^attachable\/(\w+)$/.exec(rest)
    if (one) {
      const all = (route('attachables', 'attachables.json') as { QueryResponse: { Attachable: { Id: string }[] } }).QueryResponse.Attachable
      const hit = all.find((a) => a.Id === one[1])
      return hit ? json(200, { Attachable: hit }) : json(404, { Fault: { Error: [{ Message: 'no such attachable (fake)' }] } })
    }
    const dl = /^download\/(\w+)$/.exec(rest)
    if (dl) {
      const index = JSON.parse(fs.readFileSync(path.join(STANDIN_ATTACHMENTS, 'index.json'), 'utf8')) as { attachmentId: string; file: string; mimeType: string }[]
      const hit = index.find((a) => a.attachmentId === dl[1])
      if (!hit) return json(404, { Fault: { Error: [{ Message: 'no such download (fake)' }] } })
      return { status: 200, headers: { 'content-type': hit.mimeType }, body: new Uint8Array(fs.readFileSync(path.join(STANDIN_ATTACHMENTS, hit.file))) }
    }
    return json(404, { Fault: { Error: [{ Message: 'not found (fake)' }] } })
  }

  const transport: Transport = (req) => {
    const res = answer(req)
    requests.push({ method: req.method, url: req.url, at: options.now(), status: res.status })
    return Promise.resolve(res)
  }
  return { transport, requests }
}
