// F00 round 3 (reports/F00-findings-3.md, root cause 1, fix 5): nothing calls out at test time.
// The guard is src/core/test-no-network.ts, loaded through setupFiles; these tests rely on it
// being loaded for the unit project and check it is wired into db, evals and the mutation config.
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
// .invalid never resolves (RFC 6761), so without the guard nothing leaves the machine either.
const OUTSIDE_HOST = 'ashbridge-egress-probe.invalid'

/** Runs fetch and returns the error message, or "ok:<body>" when it succeeds. */
async function tryFetch(url: string): Promise<string> {
  try {
    const res = await (async () => fetch(url))()
    return `ok:${await res.text()}`
  } catch (e) {
    const err = e as Error & { cause?: unknown }
    const cause = err.cause instanceof Error ? ` | ${err.cause.message}` : ''
    return `${err.message}${cause}`
  }
}

/** Opens a raw socket and returns the error message, "connected", or "timeout". */
function trySocket(host: string, port: number, viaConnect: boolean): Promise<string> {
  return new Promise((resolve) => {
    try {
      const s = viaConnect ? new net.Socket() : net.createConnection({ host, port })
      const done = (r: string): void => {
        s.destroy()
        resolve(r)
      }
      s.setTimeout(1500, () => {
        done('timeout')
      })
      s.on('error', (e) => {
        done(e.message)
      })
      s.on('connect', () => {
        done('connected')
      })
      if (viaConnect) s.connect(port, host)
    } catch (e) {
      resolve((e as Error).message)
    }
  })
}

let server: http.Server
let port = 0

beforeAll(async () => {
  server = http.createServer((_req, res) => {
    res.end('loopback ok')
  })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve()
    })
  })
  const addr = server.address()
  port = typeof addr === 'object' && addr !== null ? addr.port : 0
})

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve()
    })
  })
})

describe('F00 no network in tests (SEC-10)', () => {
  test('SEC-10 a test that fetches an outside host fails with network blocked', async () => {
    expect(await tryFetch(`https://${OUTSIDE_HOST}/telemetry`)).toMatch(
      new RegExp(`network blocked in tests: ${OUTSIDE_HOST.replace(/\./g, '\\.')}`),
    )
  })

  test('SEC-10 a raw socket to an outside host fails with network blocked (Socket.connect and net.createConnection)', async () => {
    const blocked = new RegExp(`network blocked in tests: ${OUTSIDE_HOST.replace(/\./g, '\\.')}`)
    expect(await trySocket(OUTSIDE_HOST, 443, true)).toMatch(blocked)
    expect(await trySocket(OUTSIDE_HOST, 443, false)).toMatch(blocked)
    // an outside IP literal (TEST-NET-1) is refused before any packet is sent
    expect(await trySocket('192.0.2.1', 443, true)).toMatch(/network blocked in tests: 192\.0\.2\.1/)
  })

  test('SEC-10 loopback and file URLs still work', async () => {
    expect(await tryFetch(`http://127.0.0.1:${String(port)}/`)).toBe('ok:loopback ok')
    expect(await tryFetch(`http://localhost:${String(port)}/`)).toBe('ok:loopback ok')
    expect(await trySocket('127.0.0.1', port, true)).toBe('connected')
    expect(await tryFetch('data:text/plain,data%20ok')).toBe('ok:data ok')
    // Node's fetch may not support file: itself, but the guard must never be the one refusing it
    expect(await tryFetch(pathToFileURL(path.join(ROOT, 'package.json')).href)).not.toMatch(/network blocked/)
  })

  test('SEC-10 the guard is a setup file of the unit, db and evals projects and of the mutation config', async () => {
    expect(fs.existsSync(path.join(ROOT, 'src', 'core', 'test-no-network.ts'))).toBe(true)
    type Proj = { test?: { name?: string; setupFiles?: string | string[] } }
    const setupOf = (p: Proj | undefined): string[] => {
      const s = p?.test?.setupFiles
      return s === undefined ? [] : Array.isArray(s) ? s : [s]
    }
    const main = (await import('../../vitest.config')) as { default: { test?: { projects?: Proj[] } } }
    const projects = main.default.test?.projects ?? []
    for (const name of ['unit', 'db', 'evals']) {
      const p = projects.find((x) => x.test?.name === name)
      expect(p, `project ${name} exists`).toBeDefined()
      expect(setupOf(p).some((f) => /test-no-network/.test(f)), `${name} setupFiles loads test-no-network`).toBe(true)
    }
    const mutate = (await import('../../vitest.mutate.config')) as { default: Proj }
    expect(setupOf(mutate.default).some((f) => /test-no-network/.test(f)), 'vitest.mutate.config.ts setupFiles loads test-no-network').toBe(true)
  })
})
