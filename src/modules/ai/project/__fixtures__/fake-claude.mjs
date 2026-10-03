#!/usr/bin/env node
// A08 fake `claude` program (spec-writer fixture; builders never edit this file). No network, no model.
// Tests copy this file into a temp folder next to `fake-claude.control.json` and point the setting
// AI_PROJECT_CLAUDE_BIN at the copy. The launcher runs a program path ending in .mjs with the running Node.
//
// Each call appends one JSON line to `fake-claude.calls.jsonl` beside this file:
//   { argv, stdin, cwd, envNames, systemPrompt, settingsText, cwdFiles, pid, configDir, configDirFiles }
//   systemPrompt: the text given by --system-prompt <text> or --system-prompt-file <path> (null if neither)
//   settingsText: the text given by --settings <path or JSON> (the file's text when it names a file; null if absent)
//   cwdFiles: every file under the working folder, by relative path, with its text
//   pid: this process's id (so a test can see whether the launcher stopped it)
//   configDir: the value of CLAUDE_CONFIG_DIR (null when unset); configDirFiles: every entry under that folder when
//   the fake starts, by relative path (folders end in "/"), or null when it does not exist (A509 gap 2)
// Then it prints an answer shaped like `claude -p --output-format json` (one JSON object):
//   { type: 'result', subtype: 'success', is_error: false, result: <the model's text>, num_turns: 1,
//     session_id, modelUsage: { <model id>: { inputTokens, outputTokens } } }
// The model id it reports is the rule's `model` when given (null: no modelUsage at all), else the --model value.
// Without --output-format json it prints the model's text alone, as the real CLI does.
//
// Control file: { rules: [{ match, result, model?, modelUsage?, hangMs?, exitCode?, isError?, subtype?, emptyStdout?,
//   stderr? }], defaultResult, hangMs?, exitCode?, isError?, subtype?, emptyStdout?, stderr?, arrive?: { match, file, text } }
//   The first rule whose `match` occurs in any argument or in stdin picks the answer.
//   `modelUsage` (on the rule): the exact modelUsage object to print (several models; A509 ruling); it wins over `model`.
//   The failure controls (A509 gap 8; on the rule, else at the top): `isError` sets is_error, `subtype` sets subtype
//   (both keep `result` as given, so a launcher that reads it anyway is caught), `emptyStdout` prints nothing on
//   stdout, `stderr` is written to stderr, and `exitCode` is the code the fake exits with (default 0).
//   `hangMs` (on the rule, else at the top): after logging the call the fake waits that long before answering, so a
//   test can see the launcher's timeout stop it.
//   `arrive`: when `match` occurs, the fake writes `text` to `file` (if absent) before answering, so a test can
//   add an inbox job while a run is in progress.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const control = JSON.parse(fs.readFileSync(path.join(here, 'fake-claude.control.json'), 'utf8'))
const argv = process.argv.slice(2)

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('')
      return
    }
    let text = ''
    let done = false
    const finish = () => {
      if (done) return
      done = true
      process.stdin.pause()
      resolve(text)
    }
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      text += chunk
    })
    process.stdin.on('end', finish)
    process.stdin.on('error', finish)
    // a launcher that passes the prompt as an argument may leave stdin open: do not wait for ever
    setTimeout(finish, 1500).unref()
  })
}

function flagValue(name) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === name) return argv[i + 1]
    if (a.startsWith(`${name}=`)) return a.slice(name.length + 1)
  }
  return undefined
}

function textOf(value) {
  if (value === undefined) return null
  try {
    if (fs.existsSync(value) && fs.statSync(value).isFile()) return fs.readFileSync(value, 'utf8')
  } catch {
    // not a path
  }
  return value
}

function listFiles(dir, base = dir, out = {}) {
  let entries = []
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) listFiles(p, base, out)
    else {
      try {
        out[path.relative(base, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8')
      } catch {
        out[path.relative(base, p).split(path.sep).join('/')] = null
      }
    }
  }
  return out
}

function listEntries(dir, base = dir, out = []) {
  let entries = []
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    const rel = path.relative(base, p).split(path.sep).join('/')
    if (e.isDirectory()) {
      out.push(`${rel}/`)
      listEntries(p, base, out)
    } else out.push(rel)
  }
  return out
}

const stdin = await readStdin()
const promptFile = flagValue('--system-prompt-file')
const systemPrompt = promptFile !== undefined ? textOf(promptFile) : (flagValue('--system-prompt') ?? null)
const settingsText = textOf(flagValue('--settings'))

fs.appendFileSync(
  path.join(here, 'fake-claude.calls.jsonl'),
  JSON.stringify({
    argv,
    stdin,
    cwd: process.cwd(),
    envNames: Object.keys(process.env).sort(),
    systemPrompt,
    settingsText,
    cwdFiles: listFiles(process.cwd()),
    pid: process.pid,
    configDir: process.env.CLAUDE_CONFIG_DIR ?? null,
    configDirFiles:
      process.env.CLAUDE_CONFIG_DIR !== undefined && fs.existsSync(process.env.CLAUDE_CONFIG_DIR)
        ? listEntries(process.env.CLAUDE_CONFIG_DIR).sort()
        : null,
  }) + '\n',
)

const haystack = [...argv, stdin].join('\n')
if (control.arrive && haystack.includes(control.arrive.match) && !fs.existsSync(control.arrive.file)) {
  fs.writeFileSync(control.arrive.file, control.arrive.text)
}
const rule = (control.rules ?? []).find((r) => haystack.includes(r.match))
const result = rule ? rule.result : control.defaultResult
const model = rule && 'model' in rule ? rule.model : (flagValue('--model') ?? 'claude-default (Test)')
const hangMs = rule && typeof rule.hangMs === 'number' ? rule.hangMs : control.hangMs
if (typeof hangMs === 'number' && hangMs > 0) await new Promise((r) => setTimeout(r, hangMs))
const pick = (name) => (rule && name in rule ? rule[name] : control[name])
const isError = pick('isError') === true
const subtype = typeof pick('subtype') === 'string' ? pick('subtype') : 'success'
const emptyStdout = pick('emptyStdout') === true
const stderr = pick('stderr')
const exitCode = typeof pick('exitCode') === 'number' ? pick('exitCode') : 0

if (!emptyStdout) {
  if (flagValue('--output-format') === 'json') {
    const envelope = {
      type: 'result',
      subtype,
      is_error: isError,
      num_turns: 1,
      result,
      session_id: '00000000-0000-4000-8000-000000000a08',
    }
    if (rule && rule.modelUsage) envelope.modelUsage = rule.modelUsage
    else if (model !== null) envelope.modelUsage = { [model]: { inputTokens: 10, outputTokens: 10 } }
    process.stdout.write(JSON.stringify(envelope) + '\n')
  } else {
    process.stdout.write(result + '\n')
  }
}
if (typeof stderr === 'string') process.stderr.write(stderr + '\n')
process.exitCode = exitCode
