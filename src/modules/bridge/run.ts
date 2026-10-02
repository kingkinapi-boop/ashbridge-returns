// END-1, OUT-6, FLOW-11, RT-5: turn a made-up client-app snapshot into returns. What the client app
// leaves unclear is never guessed: it becomes an ops-confirms item and the corporation waits.
import type { PGlite } from '@electric-sql/pglite'
import { BridgeSnapshotSchema, type BridgeCorporation, type BridgeEntity, type OpsItemKind } from '../../contracts/bridge'
import { newId } from '../../core/ids'
import { formatClientRef } from './client-ref'
import { returnYearEnd } from './year-end'

export interface OpsItem {
  id: string
  kind: OpsItemKind
  corporationId: string
  taxYear: number | null
  engagementIds: string[]
}
export interface CreatedReturn {
  returnId: string
  corporationId: string
  taxYear: number
  clientRef: string
}
export interface SkippedEntity {
  entityId: string
  reason: 't1_only' | 'no_t2'
}
export interface BridgeRun {
  created: CreatedReturn[]
  items: OpsItem[]
  skipped: SkippedEntity[]
}
export interface BridgeReturn {
  returnId: string
  corporationId: string
  taxYear: number
  yearEnd: string
  clientRef: string
  incorporationDate: string | null
  booksSource: 'firm-books' | 'client-qbo'
  groupId: string | null
  linkedReturnIds: string[]
}

type Query = Pick<PGlite, 'query'>

interface Wanted {
  kind: OpsItemKind
  taxYear: number | null
  engagementIds: string[]
}

/** What the snapshot leaves unclear for one company with T2 engagements. Pure. */
function unclear(corp: BridgeCorporation, t2: BridgeEntity['engagements']): Wanted[] {
  const out: Wanted[] = []
  const byYear = new Map<number, string[]>()
  const noYear: string[] = []
  for (const e of t2) {
    if (e.tax_year === null) noYear.push(e.id)
    else byYear.set(e.tax_year, [...(byYear.get(e.tax_year) ?? []), e.id])
  }
  if (noYear.length > 0) out.push({ kind: 'tax_year_missing', taxYear: null, engagementIds: noYear })
  const years = [...byYear.keys()].sort((a, b) => a - b)
  if (!corp.financial_year_end_confirmed || corp.financial_year_end === null) {
    for (const y of years) out.push({ kind: 'year_end_unconfirmed', taxYear: y, engagementIds: byYear.get(y) ?? [] })
  }
  const answer = corp.all_prior_years_filed
  if (answer === 'no' || answer === 'unsure' || (corp.outstanding_years ?? '').trim() !== '') {
    out.push({ kind: 'unfiled_years_text', taxYear: null, engagementIds: [] })
  }
  for (const y of years) {
    const ids = byYear.get(y) ?? []
    if (ids.length > 1) out.push({ kind: 'duplicate_year', taxYear: y, engagementIds: ids })
  }
  if (corp.services === null || corp.services.length === 0) {
    out.push({ kind: 'books_source_unclear', taxYear: null, engagementIds: [] })
  }
  return out
}

async function mintClientRef(tx: Query, corporationId: string): Promise<string> {
  const have = await tx.query<{ client_ref: string }>('select client_ref from returns.client_refs where corporation_id = $1', [
    corporationId,
  ])
  if (have.rows[0] !== undefined) return have.rows[0].client_ref
  const top = await tx.query<{ n: number }>(
    "select coalesce(max(substring(client_ref from 5)::numeric), 0)::float8 as n from returns.client_refs",
  )
  const ref = formatClientRef((top.rows[0]?.n ?? 0) + 1)
  await tx.query('insert into returns.client_refs (corporation_id, client_ref) values ($1, $2)', [corporationId, ref])
  return ref
}

/** FLOW-11: connected sets of associated corporations (either side may name the other). */
function components(corps: Map<string, BridgeCorporation>, withReturns: Set<string>): string[][] {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let r = x
    while ((parent.get(r) ?? r) !== r) r = parent.get(r) ?? r
    parent.set(x, r)
    return r
  }
  for (const id of withReturns) parent.set(id, id)
  for (const id of withReturns) {
    for (const other of corps.get(id)?.associated_corporation_ids ?? []) {
      if (withReturns.has(other)) parent.set(find(id), find(other))
    }
  }
  const groups = new Map<string, string[]>()
  for (const id of withReturns) groups.set(find(id), [...(groups.get(find(id)) ?? []), id])
  return [...groups.values()].filter((g) => g.length > 1)
}

export async function runBridge(db: PGlite, snapshot: unknown): Promise<BridgeRun> {
  const snap = BridgeSnapshotSchema.parse(snapshot)
  return db.transaction(async (tx) => {
    const run: BridgeRun = { created: [], items: [], skipped: [] }
    const corps = new Map<string, BridgeCorporation>()
    const considered: { corp: BridgeCorporation; t2: BridgeEntity['engagements'] }[] = []
    for (const entity of snap.entities) {
      const corp = entity.corporation
      if (entity.kind === 'personal' || corp === null) {
        run.skipped.push({ entityId: entity.id, reason: 't1_only' })
        continue
      }
      const t2 = entity.engagements.filter((e) => e.service === 't2')
      if (t2.length === 0) {
        run.skipped.push({ entityId: entity.id, reason: 'no_t2' })
        continue
      }
      corps.set(corp.id, corp)
      considered.push({ corp, t2 })
    }

    for (const { corp, t2 } of considered) {
      const clientRef = await mintClientRef(tx, corp.id)
      const wanted = unclear(corp, t2)
      for (const w of wanted) {
        const ins = await tx.query<{ id: string }>(
          `insert into returns.bridge_ops_items (corporation_id, kind, tax_year, engagement_ids)
           values ($1, $2, $3, $4::uuid[]) on conflict do nothing returning id`,
          [corp.id, w.kind, w.taxYear, w.engagementIds],
        )
        const row = ins.rows[0]
        if (row !== undefined) {
          run.items.push({ id: row.id, kind: w.kind, corporationId: corp.id, taxYear: w.taxYear, engagementIds: w.engagementIds })
        }
      }
      if (wanted.length > 0 || corp.financial_year_end === null) continue

      const booksSource = corp.services?.includes('bookkeeping') === true ? 'firm-books' : 'client-qbo'
      const years = [...new Set(t2.flatMap((e) => (e.tax_year === null ? [] : [e.tax_year])))].sort((a, b) => a - b)
      for (const taxYear of years) {
        const exists = await tx.query('select 1 from returns.bridge_returns where corporation_id = $1 and tax_year = $2', [
          corp.id,
          taxYear,
        ])
        if (exists.rows.length > 0) continue
        const yearEnd = returnYearEnd(corp.financial_year_end, taxYear)
        const returnId = newId()
        await tx.query('insert into returns.returns (id, entity_name, year_end, state) values ($1, $2, $3, $4)', [
          returnId,
          corp.legal_name,
          yearEnd,
          'intake',
        ])
        await tx.query(
          `insert into returns.bridge_returns (return_id, corporation_id, tax_year, incorporation_date, books_source)
           values ($1, $2, $3, $4, $5)`,
          [returnId, corp.id, taxYear, corp.incorporation_date, booksSource],
        )
        run.created.push({ returnId, corporationId: corp.id, taxYear, clientRef })
      }
    }

    // FLOW-11: associated companies share a group, which keeps its id as members join it.
    const held = await tx.query<{ corporation_id: string }>('select distinct corporation_id from returns.bridge_returns')
    for (const group of components(corps, new Set(held.rows.map((r) => r.corporation_id)))) {
      const existing = await tx.query<{ group_id: string }>(
        'select distinct group_id from returns.bridge_returns where corporation_id = any($1::uuid[]) and group_id is not null order by group_id',
        [group],
      )
      const groupId = existing.rows[0]?.group_id ?? crypto.randomUUID()
      await tx.query(
        'update returns.bridge_returns set group_id = $1 where corporation_id = any($2::uuid[]) and group_id is distinct from $1',
        [groupId, group],
      )
    }
    return run
  })
}

type Reader = Pick<PGlite, 'query'>

interface ReturnRow {
  return_id: string
  corporation_id: string
  tax_year: number
  year_end: string
  client_ref: string
  incorporation_date: string | null
  books_source: 'firm-books' | 'client-qbo'
  group_id: string | null
}

/** Every return the bridge made, ordered by client_ref number, then tax year. */
export async function listBridgeReturns(db: Reader): Promise<BridgeReturn[]> {
  const r = await db.query<ReturnRow>(
    `select b.return_id, b.corporation_id, b.tax_year, x.year_end::text as year_end, c.client_ref,
            b.incorporation_date::text as incorporation_date, b.books_source, b.group_id
     from returns.bridge_returns b
     join returns.returns x on x.id = b.return_id
     join returns.client_refs c on c.corporation_id = b.corporation_id
     order by c.seq, b.tax_year`,
  )
  return r.rows.map((row) => ({
    returnId: row.return_id,
    corporationId: row.corporation_id,
    taxYear: row.tax_year,
    yearEnd: row.year_end,
    clientRef: row.client_ref,
    incorporationDate: row.incorporation_date,
    booksSource: row.books_source,
    groupId: row.group_id,
    linkedReturnIds:
      row.group_id === null
        ? []
        : r.rows
            .filter((o) => o.group_id === row.group_id && o.return_id !== row.return_id)
            .map((o) => o.return_id)
            .sort(),
  }))
}

/** Every ops-confirms item ever raised, in raise order. */
export async function listOpsItems(db: Reader): Promise<OpsItem[]> {
  const r = await db.query<{ id: string; kind: OpsItemKind; corporation_id: string; tax_year: number | null; engagement_ids: string[] }>(
    'select id, kind, corporation_id, tax_year, engagement_ids from returns.bridge_ops_items order by seq',
  )
  return r.rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    corporationId: row.corporation_id,
    taxYear: row.tax_year,
    engagementIds: row.engagement_ids,
  }))
}

/** Every client_ref in order of minting. */
export async function listClientRefs(db: Reader): Promise<{ corporationId: string; clientRef: string }[]> {
  const r = await db.query<{ corporation_id: string; client_ref: string }>(
    'select corporation_id, client_ref from returns.client_refs order by seq',
  )
  return r.rows.map((row) => ({ corporationId: row.corporation_id, clientRef: row.client_ref }))
}
