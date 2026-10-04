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
export const NEVER_READ: { tables: readonly string[]; columns: readonly ColumnRef[]; markerIds: readonly string[] } = {
  tables: ['restricted_data'],
  // the marker answers (line 70): every answer to one reads as given in bridge.answer, never its value
  markerIds: ['PY3.sin', 'PY3.dob', 'PY3.bank', 'BQ7.sin', 'BQ1.bn'],
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
  // a whole-table dependency has column null, which equals no listed column
  return deps.filter((d) => NEVER_READ.tables.includes(d.table) || NEVER_READ.columns.some((c) => c.table === d.table && c.column === d.column))
}

/**
 * Every client-app column the drafts read (sources and alsoReads of every view), once, by table then column in plain
 * string order: "table.column" keys sort the same way, because "." sorts before every character of a name.
 */
export function draftReads(m: ViewsManifest): ColumnRef[] {
  const keys = m.views.flatMap((v) => [...v.columns.flatMap((c) => c.sources), ...v.alsoReads]).map((s) => s.source)
  return [...new Set(keys)].sort().map((k) => {
    const [table, column] = k.split('.') as [string, string] // every source is "table.column" (the manifest schema)
    return { table, column }
  })
}

/** The reads a database does not have, in the order of reads. */
export function missingColumns(reads: readonly ColumnRef[], present: readonly ColumnRef[]): ColumnRef[] {
  return reads.filter((r) => !present.some((p) => p.table === r.table && p.column === r.column))
}

// What the scan skips or reads, leftmost first: a line comment, a block comment, a single-quoted literal (group 1), a
// quoted identifier, or a dollar-quoted literal with its optional tag (group 2) and body (group 3). The leftmost match
// wins, so an apostrophe inside a comment is never a quote. Block comments do not nest, and E'..' strings are not
// special: the draft files use neither.
const TOKEN = /--[^\n]*|\/\*[\s\S]*?\*\/|'((?:[^']|'')*)'|"(?:[^"]|"")*"|(?<![A-Za-z0-9_$])\$([A-Za-z_][A-Za-z0-9_]*)?\$([\s\S]*?)\$\2\$/g

/** Every string literal of the SQL that holds a space, tab or line break (a sentence), by file and opening line. */
export function findSentenceLiterals(sql: string, file: string): SentenceLiteral[] {
  const out: SentenceLiteral[] = []
  for (const m of sql.matchAll(TOKEN)) {
    const literal = m[1]?.replaceAll("''", "'") ?? m[3]
    if (literal !== undefined && literal.search(/\s/) >= 0) out.push({ file, line: sql.slice(0, m.index).split('\n').length, literal })
  }
  return out
}

/**
 * U9 and ARC-2: what a role reaches beyond its allow-list (`extra`, in reach order) and what the allow-list gives that the
 * role does not reach (`missing`, in allow-list order). A reachable security definer function is always extra, even when
 * the allow-list names it.
 */
export function reachDiff(reach: readonly string[], allowed: readonly string[]): { extra: string[]; missing: string[] } {
  return {
    extra: reach.filter((k) => !allowed.includes(k) || k.endsWith(' security definer')),
    missing: allowed.filter((k) => !reach.includes(k)),
  }
}
