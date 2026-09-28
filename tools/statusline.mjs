// Statusline for Lead sessions: shows the mode and plan usage, and copies the
// usage numbers Claude Code passes in (rate_limits) to plan/usage-now.json so
// the Lead and the Reviewer can pace ultra without asking Zo (decision 0004,
// M-3). Fields Claude Code does not send are shown as "?". Never fails.
import fs from 'node:fs'
import path from 'node:path'

let input = ''
process.stdin.on('data', (chunk) => (input += chunk))
process.stdin.on('end', () => {
  let d = {}
  try {
    d = JSON.parse(input || '{}')
  } catch {}
  const root = d?.workspace?.project_dir || process.cwd()
  let mode = '?'
  try {
    mode = JSON.parse(fs.readFileSync(path.join(root, 'plan', 'mode.json'), 'utf8')).mode
  } catch {}
  const rl = d.rate_limits || null
  const pct = (x) => (x && typeof x.used_percentage === 'number' ? `${Math.round(x.used_percentage)}%` : '?')
  try {
    fs.writeFileSync(
      path.join(root, 'plan', 'usage-now.json'),
      JSON.stringify({ at: new Date().toISOString(), rate_limits: rl, cost: d.cost || null }) + '\n',
    )
  } catch {}
  process.stdout.write(`mode ${mode} | 5h ${pct(rl?.five_hour)} | week ${pct(rl?.seven_day || rl?.weekly)}`)
})
