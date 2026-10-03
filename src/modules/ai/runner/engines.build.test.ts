// A04 build tests (the builder's own; the acceptance file is not touched). They pin what mutation found the
// acceptance tests leave open: the reason words for an unreadable entry, an outbox entry named for the job that
// is a folder, and the order recordings are read in.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { aiEngines } from './engines'
import { RECORDINGS_DIR, collectLines, job, outboxResult, recording, startFakeProject, tempDir, writeOutbox } from './__fixtures__/harness'

let tmp: { dir: string; cleanup: () => void }
beforeEach(() => {
  tmp = tempDir('engines-build')
})
afterEach(() => {
  vi.restoreAllMocks()
  tmp.cleanup()
})

const recordingText = (value: unknown): string => JSON.stringify(value)

describe('ARC-16 an unreadable .json entry in the recordings folder is logged once, by name and error code', () => {
  test('ARC-16 a folder named like a recording: the reason is the error code', async () => {
    fs.mkdirSync(path.join(tmp.dir, 'a-dir.json'))
    fs.writeFileSync(path.join(tmp.dir, 'b-good.json'), recordingText(recording('finding-c01-good')))
    const { lines, sink } = collectLines()
    const ctx = { recordingsDir: tmp.dir, pollMs: 5, sink, waiting: new Set<string>(), seen: new Set<string>() }
    const res = await aiEngines.recorded.run(job('good'), ctx)
    expect(res.ok).toBe(true)
    expect(lines).toEqual(['ai exchange: ignored recording a-dir.json: EISDIR'])
  })
})

describe('ARC-16 recordings are read in name order, so the duplicate message lists names in order', () => {
  test('ARC-16 two recordings for one key list the earlier name first whatever order the folder lists them', async () => {
    const text = recordingText(recording('finding-c01-good'))
    fs.writeFileSync(path.join(tmp.dir, 'a-first.json'), text)
    fs.writeFileSync(path.join(tmp.dir, 'b-second.json'), text)
    const real = fs.readdirSync.bind(fs)
    vi.spyOn(fs, 'readdirSync').mockImplementation(((p: fs.PathLike, o?: unknown) => {
      return [...(real(p, o as never))].reverse()
    }) as typeof fs.readdirSync)
    const ctx = { recordingsDir: tmp.dir, pollMs: 5, sink: () => undefined, waiting: new Set<string>(), seen: new Set<string>() }
    const res = await aiEngines.recorded.run(job('good'), ctx)
    expect(res).toMatchObject({ ok: false })
    if (!res.ok) expect(res.reason).toContain('a-first.json and b-second.json')
  })
})

describe('ARC-22 an outbox entry named for this job that is a folder is ignored, logged once, and the job keeps waiting', () => {
  test('ARC-22 outbox/<job id>.json as a folder', async () => {
    const exchange = path.join(tmp.dir, 'exchange')
    const id = 'job-folder-entry-test'
    const { lines, sink } = collectLines()
    const good = recording('finding-c01-good')
    const fake = startFakeProject(exchange, () => {
      fs.mkdirSync(path.join(exchange, 'outbox', `${id}.json`), { recursive: true })
      setTimeout(() => {
        fs.rmSync(path.join(exchange, 'outbox', `${id}.json`), { recursive: true })
        writeOutbox(exchange, `${id}.json`, outboxResult(id, good.output, good.stamp))
      }, 60)
    })
    try {
      const ctx = { jobId: id, recordingsDir: RECORDINGS_DIR, exchangeDir: exchange, pollMs: 5, sink, waiting: new Set<string>(), seen: new Set<string>() }
      const res = await aiEngines.project.run(job('good'), ctx)
      expect(res.ok).toBe(true)
      expect(lines).toEqual([`ai exchange: ignored outbox file ${id}.json`])
    } finally {
      fake.stop()
    }
  })
})
