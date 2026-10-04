// PLANT (SC11 round 4 S14, spec-owned, A540): the clone list of src/core/db/index.ts as SC11's round 2 build left it
// (git show 030e1d6f:src/core/db/index.ts, lines 562 to 585): closeClones ends every clone with Promise.all, so its
// rejection names only the first clone that failed. Types narrowed to what these lines use; the bodies are unchanged.
// Imported by pool-rules.acceptance.test.ts only; never edited.
interface Clone {
  readonly closed: boolean
  close(): Promise<void>
}
interface DbTemplate {
  clone(): Promise<Clone>
  close(): Promise<void>
}

let active: DbTemplate | undefined
const clones: Clone[] = []

/** Used by the db project's setup file only. */
export function setActiveTemplate(template: DbTemplate | undefined): void {
  active = template
}

export async function cloneTestDb(): Promise<Clone> {
  if (!active) throw new Error('db warm-up did not run')
  const db = await active.clone()
  clones.push(db)
  return db
}

/** Closes every clone made since the last call (the db project's afterEach). */
export async function closeClones(): Promise<void> {
  const open = clones.splice(0)
  await Promise.all(open.filter((c) => !c.closed).map((c) => c.close()))
}
