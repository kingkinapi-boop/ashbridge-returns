/**
 * PreToolUse hook for Agent (Task in older builds) and RemoteTrigger.
 * Logs every dispatch to plan/ledger.jsonl and refuses it when the mode in
 * plan/mode.json allows no more today (decisions 0004 and 0007).
 *
 * Why: usage must stay under control without the Lead spending tokens on
 * counting, and turbo must be something Zo unleashes on purpose, not a
 * Lead's drift. The ledger is also what the Reviewer reads for waste.
 *
 * Caps per UTC day: pause 0, hold 0, prep 15, normal 40; turbo and wind-down
 * have no cap (wind-down's "no new cards" is a Lead rule). RemoteTrigger
 * calls that only read (list, get, status) are neither counted nor blocked.
 * When mode.json has `cap_from` (the time the mode was lowered), the day's
 * cap counts only dispatches from then on, so a Reviewer SLOW on a busy day
 * slows the build instead of stopping it (Review 3 Oct).
 *
 * Contract (code.claude.com/docs/en/hooks): stdin is JSON with tool_name,
 * tool_input and cwd. Exit 2 blocks the call and shows stderr to Claude.
 * Any read or parse error: allow (the rule in CLAUDE.md still holds).
 */
import fs from 'node:fs'
import path from 'node:path'

const CAPS = { pause: 0, hold: 0, prep: 15, normal: 40 }

let input = ''
process.stdin.on('data', (chunk) => (input += chunk))
process.stdin.on('end', () => {
  let data = {}
  try {
    data = JSON.parse(input || '{}')
  } catch {
    process.exit(0)
  }
  const tool = String(data.tool_name || '')
  const ti = data.tool_input || {}
  const action = String(ti.action || ti.operation || '')
  if (tool === 'RemoteTrigger' && /^(list|get|read|status|view)$/i.test(action)) process.exit(0)

  const root = process.env.CLAUDE_PROJECT_DIR || data.cwd || process.cwd()
  const ledger = path.join(root, 'plan', 'ledger.jsonl')
  let mode = 'prep'
  let capFrom = NaN
  try {
    const m = JSON.parse(fs.readFileSync(path.join(root, 'plan', 'mode.json'), 'utf8'))
    mode = m.mode || 'prep'
    if (m.cap_from) capFrom = Date.parse(m.cap_from)
  } catch {
    // no mode file: treat as prep
  }
  const day = new Date().toISOString().slice(0, 10)
  let used = 0
  try {
    for (const line of fs.readFileSync(ledger, 'utf8').split('\n')) {
      if (!(line.includes(`"day":"${day}"`) && line.includes('"allowed":true'))) continue
      if (!Number.isNaN(capFrom)) {
        try {
          if (Date.parse(JSON.parse(line).ts) < capFrom) continue
        } catch {
          // unreadable row: count it
        }
      }
      used++
    }
  } catch {
    // no ledger yet
  }
  const cap = Object.prototype.hasOwnProperty.call(CAPS, mode) ? CAPS[mode] : Infinity
  const allowed = used < cap
  const entry = {
    ts: new Date().toISOString(),
    day,
    mode,
    tool,
    type: ti.subagent_type || null,
    model: ti.model || null,
    where: ti.isolation || (tool === 'RemoteTrigger' ? 'cloud' : 'local'),
    desc: String(ti.description || ti.prompt || action || '').slice(0, 80),
    allowed,
  }
  try {
    fs.appendFileSync(ledger, JSON.stringify(entry) + '\n')
  } catch {
    // cannot log: still enforce the cap
  }
  if (!allowed) {
    process.stderr.write(
      `Refused by the budget hook: mode "${mode}" allows ${cap} dispatches a day and ${used} have run today${Number.isNaN(capFrom) ? '' : ' since cap_from'} (plan/ledger.jsonl). ` +
        'Only Zo raises the mode. Rewrite NOW.md with where things stand and wait, or do the work without a helper.\n',
    )
    process.exit(2)
  }
  process.exit(0)
})
