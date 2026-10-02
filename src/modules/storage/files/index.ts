// The local-folder file store (ARC-6): content-addressed, write-once, no delete.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { FileStore } from '../../../contracts/storage'
import type { Sink } from '../../../core/log'
import { assertSafe, inside, readEngine } from '../safe'

export type FileStoreOptions = {
  root: string
  env?: Record<string, string | undefined>
  sink?: Sink
  /** Test hook: runs after the temp file is written and before it is renamed. */
  testHooks?: { beforeRename?: () => void }
}

const KEY = /^sha256\/([0-9a-f]{2})\/([0-9a-f]{64})$/
const sha = (bytes: Uint8Array): string => crypto.createHash('sha256').update(bytes).digest('hex')

export function createFileStore(options: FileStoreOptions): FileStore {
  readEngine(options.env ?? process.env, 'STORAGE_FILES_ENGINE', options.sink)
  const root = path.resolve(options.root)

  function keyPath(key: string): string {
    assertSafe('key', key)
    const m = KEY.exec(key)
    if (!m || m[2]?.slice(0, 2) !== m[1]) throw new Error('refused: key is not a stored-file key')
    return path.join(root, key)
  }

  // A stored file's folder must really sit under the root (no symlink out), and the file must be a plain file.
  function checkOnDisk(file: string): void {
    const realRoot = fs.realpathSync(root)
    if (!inside(realRoot, fs.realpathSync(path.dirname(file))))
      throw new Error('refused: key resolves outside the storage root')
    if (!fs.lstatSync(file).isFile()) throw new Error('refused: key is not a plain file')
  }

  const exists = (file: string): boolean => {
    try {
      return fs.lstatSync(file).isFile()
    } catch {
      return false
    }
  }

  return {
    put(bytes) {
      const hash = sha(bytes)
      const key = `sha256/${hash.slice(0, 2)}/${hash}`
      const file = path.join(root, key)
      if (exists(file)) return Promise.resolve({ key, sha256: hash })
      fs.mkdirSync(path.dirname(file), { recursive: true })
      const tmp = path.join(path.dirname(file), `.tmp-${crypto.randomUUID()}`)
      try {
        fs.writeFileSync(tmp, bytes, { mode: 0o444, flag: 'wx' })
        options.testHooks?.beforeRename?.()
        fs.renameSync(tmp, file)
      } catch (e) {
        fs.rmSync(tmp, { force: true })
        return Promise.reject(e instanceof Error ? e : new Error(String(e)))
      }
      return Promise.resolve({ key, sha256: hash })
    },

    get(key) {
      return Promise.resolve().then(() => {
        const file = keyPath(key)
        checkOnDisk(file)
        const bytes = new Uint8Array(fs.readFileSync(file))
        if (sha(bytes) !== KEY.exec(key)?.[2]) throw new Error('stored file changed')
        return bytes
      })
    },

    has(key) {
      return Promise.resolve().then(() => exists(keyPath(key)))
    },

    list(prefix) {
      return Promise.resolve().then(() => {
        assertSafe('prefix', prefix)
        const out: string[] = []
        const base = path.join(root, 'sha256')
        if (fs.existsSync(base) && fs.lstatSync(base).isDirectory()) {
          for (const d of fs.readdirSync(base)) {
            const dir = path.join(base, d)
            if (!/^[0-9a-f]{2}$/.test(d) || !fs.lstatSync(dir).isDirectory()) continue
            for (const f of fs.readdirSync(dir)) {
              const key = `sha256/${d}/${f}`
              if (KEY.test(key) && exists(path.join(dir, f)) && key.startsWith(prefix)) out.push(key)
            }
          }
        }
        return out.sort()
      })
    },
  }
}
