// @mutate
// GL3 (ARC-2, END-7, U9): the pure scans of the bridge draft. What no view may read, which client-app columns the
// drafts read, which of them a database lacks, and which string literals in the draft SQL hold a sentence.
import type { ViewsManifest } from './manifest'

export interface ViewDependency {
  view: string
  table: string
  /** null: the whole table is referenced */
  column: string | null
}

export interface ColumnRef {
  table: string
  column: string
}

export interface SentenceLiteral {
  file: string
  line: number
  literal: string
}

/** Contract section 3: the table and the columns no bridge view may read. */
export const NEVER_READ: { tables: readonly string[]; columns: readonly ColumnRef[] } = {
  tables: ['restricted_data'],
  columns: [
    { table: 'quickbooks_connections', column: 'access_token_encrypted' },
    { table: 'quickbooks_connections', column: 'refresh_token_encrypted' },
    { table: 'links', column: 'token_hash' },
    { table: 'signin_codes', column: 'code_hash' },
    { table: 'handoff_tokens', column: 'token_hash' },
    { table: 'person_sessions', column: 'token_hash' },
    { table: 'person_own_codes', column: 'code_hash' },
    { table: 'people', column: 'email' },
    { table: 'people', column: 'mobile_number' },
    { table: 'predecessor_requests', column: 'email' },
    { table: 'message_log', column: 'to_address' },
    { table: 'message_log', column: 'body' },
    { table: 'qa_transcript', column: 'body' },
    { table: 'client_requests', column: 'message' },
    { table: 'intakes', column: 'raw_payload' },
  ],
}

/** The dependencies on a never-read table (any column, or the whole table) or a never-read column, in input order. */
export function neverReadFindings(deps: readonly ViewDependency[]): ViewDependency[] {
  return deps.filter(
    (d) =>
      NEVER_READ.tables.includes(d.table) ||
      (d.column !== null && NEVER_READ.columns.some((c) => c.table === d.table && c.column === d.column)),
  )
}

function byTableThenColumn(a: ColumnRef, b: ColumnRef): number {
  if (a.table !== b.table) return a.table < b.table ? -1 : 1
  if (a.column !== b.column) return a.column < b.column ? -1 : 1
  return 0
}

/** Every client-app column the drafts read (sources and alsoReads of every view), once, by table then column. */
export function draftReads(m: ViewsManifest): ColumnRef[] {
  const found = new Map<string, ColumnRef>()
  for (const view of m.views) {
    for (const s of [...view.columns.flatMap((c) => c.sources), ...view.alsoReads]) {
      found.set(s.source, { table: s.source.split('.')[0] ?? '', column: s.source.split('.')[1] ?? '' })
    }
  }
  return [...found.values()].sort(byTableThenColumn)
}

/** The reads a database does not have, in the order of reads. */
export function missingColumns(reads: readonly ColumnRef[], present: readonly ColumnRef[]): ColumnRef[] {
  return reads.filter((r) => !present.some((p) => p.table === r.table && p.column === r.column))
}

// A comment to its line end, the start of a block comment, a quoted literal, a quoted identifier, or the opening of a
// dollar quote. The leftmost match wins, so an apostrophe inside a comment is never a quote.
const TOKEN = /--[^\n]*|\/\*|'(?:[^']|'')*'|"(?:[^"]|"")*"|\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/g

function blockCommentEnd(sql: string, from: number): number {
  let depth = 1
  let i = from
  while (i < sql.length && depth > 0) {
    if (sql.startsWith('/*', i)) {
      depth += 1
      i += 2
    } else if (sql.startsWith('*/', i)) {
      depth -= 1
      i += 2
    } else {
      i += 1
    }
  }
  return i
}

/** Every string literal of the SQL that holds a space, tab or line break (a sentence), by file and opening line. */
export function findSentenceLiterals(sql: string, file: string): SentenceLiteral[] {
  const out: SentenceLiteral[] = []
  const add = (index: number, literal: string): void => {
    if (/\s/.test(literal)) out.push({ file, line: sql.slice(0, index).split('\n').length, literal })
  }
  const re = new RegExp(TOKEN.source, 'g')
  for (let m = re.exec(sql); m !== null; m = re.exec(sql)) {
    const token = m[0]
    if (token === '/*') {
      re.lastIndex = blockCommentEnd(sql, m.index + 2)
    } else if (token.startsWith("'")) {
      add(m.index, token.slice(1, -1).replaceAll("''", "'"))
    } else if (token.startsWith('$')) {
      if (/[A-Za-z0-9_$]/.test(sql[m.index - 1] ?? '')) {
        re.lastIndex = m.index + 1 // part of an identifier, not a quote
        continue
      }
      const close = sql.indexOf(token, m.index + token.length)
      const end = close === -1 ? sql.length : close
      add(m.index, sql.slice(m.index + token.length, end))
      re.lastIndex = close === -1 ? sql.length : close + token.length
    }
  }
  return out
}
