// @mutate
// One call of the Claude program (AI-8, SEC-10, ARC-22): no shell, a time limit, stopped by its own handle (its own
// PID, never by a program name), the prompt on stdin. Only the exit code and the output come back, never stderr.
import { spawn, type ChildProcessByStdio } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'

export interface ClaudeCall {
  /** The program: a path ending .mjs, .cjs or .js is run with the running Node (so a fake works on every machine). */
  bin: string
  args: readonly string[]
  cwd: string
  env: Record<string, string>
  stdin: string
  timeoutMs: number
}

export type ClaudeCallResult = { ok: true; stdout: string } | { ok: false; reason: string }

/** The most output one call may print (a result is small). */
export const CLAUDE_OUTPUT_MAX_BYTES = 8_388_608
const KILL_GRACE_MS = 5000

const isScript = (bin: string): boolean => /\.(?:mjs|cjs|js)$/i.test(bin)

export function runClaude(call: ClaudeCall): Promise<ClaudeCallResult> {
  return new Promise((resolve) => {
    const script = isScript(call.bin)
    const file: string = script ? process.execPath : call.bin
    const args: string[] = script ? [call.bin, ...call.args] : [...call.args]
    const child: ChildProcessByStdio<Writable, Readable, null> = spawn(file, args, { cwd: call.cwd, env: call.env as NodeJS.ProcessEnv, stdio: ['pipe', 'pipe', 'ignore'], shell: false, windowsHide: true })
    const chunks: Buffer[] = []
    let bytes = 0
    let stopped: string | undefined
    const stop = (why: string): void => {
      if (stopped !== undefined) return
      stopped = why
      child.kill()
      setTimeout(() => child.kill('SIGKILL'), KILL_GRACE_MS).unref()
    }
    const timer = setTimeout(() => {
      stop(`the Claude CLI did not finish within the time limit (${String(Math.round(call.timeoutMs / 1000))} seconds)`)
    }, call.timeoutMs)
    child.on('error', (e: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      resolve({ ok: false, reason: `the Claude program could not be started (${e.code ?? 'error'})` })
    })
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length
      if (bytes > CLAUDE_OUTPUT_MAX_BYTES) stop('the Claude CLI printed more than it may')
      else chunks.push(chunk)
    })
    // the program may exit before it reads the prompt
    child.stdin.on('error', () => undefined)
    child.stdin.end(call.stdin)
    child.on('close', (code) => {
      clearTimeout(timer)
      if (stopped !== undefined) resolve({ ok: false, reason: stopped })
      else if (code !== 0) resolve({ ok: false, reason: `the Claude CLI exited with code ${String(code)}` })
      else resolve({ ok: true, stdout: new TextDecoder().decode(Buffer.concat(chunks)) })
    })
  })
}
