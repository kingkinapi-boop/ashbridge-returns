// The Drive stand-in (ARC-6, SEC-11): a local folder shaped like the Shared Drive the client app writes,
// `<legal name> (<first 8 hex of corporation id>)/<tax year>/`, with an index of made-up drive file ids. Read-only.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { ClientDocument, ClientDocuments } from '../../../contracts/storage'
import type { Sink } from '../../../core/log'
import { assertSafe, readEngine, realInside } from '../safe'

export type DriveOptions = {
  root: string
  env?: Record<string, string | undefined>
  sink?: Sink
}

const Index = z.object({
  files: z.array(
    z.object({
      drive_file_id: z.string(),
      path: z.string(),
      mime_type: z.string(),
    }),
  ),
})
const REFUSED_TEST = 'refused: the company folder name lacks "(Test)", so it is not made-up data'

export function createDriveStandIn(options: DriveOptions): ClientDocuments {
  readEngine(options.env ?? process.env, 'STORAGE_DRIVE_ENGINE', options.sink)
  const root = path.resolve(options.root)

  function readIndex() {
    return Index.parse(JSON.parse(fs.readFileSync(realInside(root, path.join(root, 'index.json'), 'index'), 'utf8'))).files
  }

  function describe(entry: {
    drive_file_id: string
    path: string
    mime_type: string
  }): ClientDocument & { bytes: Uint8Array } {
    assertSafe('index path', entry.path)
    const company = entry.path.split('/')[0] ?? ''
    if (!company.includes('(Test)')) throw new Error(REFUSED_TEST)
    const file = path.join(root, entry.path)
    const real = realInside(root, file, 'file')
    const bytes = new Uint8Array(fs.readFileSync(real))
    return {
      driveFileId: entry.drive_file_id,
      name: path.basename(entry.path),
      mimeType: entry.mime_type,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      bytes,
    }
  }

  return {
    listFolder(corporation, taxYear) {
      return Promise.resolve().then(() => {
        if (!corporation.legalName.includes('(Test)')) throw new Error(REFUSED_TEST)
        const folder = `${corporation.legalName} (${corporation.id.slice(0, 8)})/${String(taxYear)}`
        assertSafe('folder', folder)
        const dir = path.join(root, folder)
        if (!fs.existsSync(dir)) return []
        realInside(root, dir, 'folder')
        const out: ClientDocument[] = []
        for (const e of readIndex()) {
          if (path.posix.dirname(e.path) !== folder) continue
          const doc = describe(e)
          out.push({ driveFileId: doc.driveFileId, name: doc.name, mimeType: doc.mimeType, sha256: doc.sha256 })
        }
        return out
      })
    },

    getFile(driveFileId) {
      return Promise.resolve().then(() => {
        assertSafe('file id', driveFileId)
        const entry = readIndex().find((e) => e.drive_file_id === driveFileId)
        if (!entry) throw new Error('unknown file id')
        return describe(entry)
      })
    },
  }
}
