// F00 round 3 (reports/F00-findings-3.md, root causes 1 and 3): rule tests that run everywhere.
// Nothing leaves the machine unpinned or unasked at build or test time, and no script builds a
// shell command line from data. Each rule is first shown failing on a planted bad example in
// tools/test/__fixtures__/, then applied to the real repo.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, test } from 'vitest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const FIX = path.join(ROOT, 'tools', 'test', '__fixtures__')
const FIX_EGRESS = path.join(FIX, 'egress')
const THIS_FILE = fileURLToPath(import.meta.url)
const read = (...p: string[]): string => fs.readFileSync(path.join(...p), 'utf8')

const SKIP = new Set(['node_modules', '.next', '.git', '__fixtures__', '__golden__', 'coverage', 'test-results', '.stryker-tmp'])
function walk(dir: string, ext: RegExp, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, ext, out)
    else if (ext.test(e.name)) out.push(p)
  }
  return out
}
const indentOf = (l: string): number => l.length - l.trimStart().length

// ---------- GitHub workflows ----------

/** Every `uses:` names a full 40-hex commit SHA with a version comment. */
function usesProblems(yml: string): string[] {
  const problems: string[] = []
  for (const line of yml.split('\n')) {
    const m = /^\s*(?:-\s*)?uses:\s*([^\s#]+)(.*)$/.exec(line)
    if (!m) continue
    const ref = m[1] ?? ''
    if (ref.startsWith('./')) continue
    const at = ref.split('@')[1] ?? ''
    if (!/^[0-9a-f]{40}$/.test(at)) problems.push(`${ref} is not pinned by a full commit SHA`)
    else if (!/#\s*v\d/.test(m[2] ?? '')) problems.push(`${ref} has no "# vX.Y.Z" comment`)
  }
  return problems
}

/** Every actions/checkout step sets persist-credentials: false. */
const checkoutCount = (yml: string): number => yml.split('\n').filter((l) => /uses:\s*actions\/checkout@/.test(l)).length
function checkoutProblems(yml: string): string[] {
  const lines = yml.split('\n')
  const problems: string[] = []
  if (checkoutCount(yml) === 0) problems.push('no actions/checkout step found')
  lines.forEach((line, i) => {
    if (!/uses:\s*actions\/checkout@/.test(line)) return
    const dash = line.trimStart().startsWith('-') ? indentOf(line) : indentOf(line) - 2
    const block: string[] = []
    for (const next of lines.slice(i + 1)) {
      if (next.trim() !== '' && indentOf(next) <= dash) break
      block.push(next)
    }
    if (!block.some((b) => /persist-credentials:\s*false\b/.test(b))) problems.push(`checkout on line ${String(i + 1)} keeps credentials`)
  })
  return problems
}

/** Every curl or wget writes a file, and the first later line that uses that file checks it with sha256sum -c. */
function downloadProblems(yml: string): string[] {
  const lines = yml.split('\n')
  const problems: string[] = []
  lines.forEach((line, i) => {
    if (!/(?:^|[\s;&|(])(curl|wget)\s/.test(line)) return
    if (/(?:^|[\s;&|(])(?:curl|wget)\s[^|;&]*\|(?!\|)/.test(line)) {
      problems.push(`line ${String(i + 1)} pipes a download straight into a command`)
      return
    }
    // the download command is the segment holding curl/wget; later segments and lines are its uses
    const segments = line.split(/&&|;/)
    const at = segments.findIndex((s) => /(?:^|[\s(])(?:curl|wget)\s/.test(s))
    const download = segments[at] ?? line
    let file = /(?:^|\s)(?:-o|--output|-O|--output-document)(?:\s+|=)(\S+)/.exec(download)?.[1]
    if (file === undefined && /(?:^|\s)(?:-O|--remote-name)(?:\s|$)/.test(download)) {
      file = /https?:\/\/\S+/.exec(download)?.[0].split('/').pop()
    }
    if (file === undefined || file === '-') {
      problems.push(`line ${String(i + 1)} downloads without writing a file`)
      return
    }
    const name = file.replace(/^["']|["']$/g, '')
    const firstUse = [...segments.slice(at + 1), ...lines.slice(i + 1)].find((l) => l.includes(name))
    if (firstUse === undefined || !/sha256sum\s+(?:-c|--check)\b/.test(firstUse)) {
      problems.push(`${name} is used before sha256sum -c checks it`)
    }
  })
  return problems
}

function telemetryEnvProblems(yml: string): string[] {
  return /NEXT_TELEMETRY_DISABLED:\s*['"]?1['"]?/.test(yml) ? [] : ['the workflow env does not set NEXT_TELEMETRY_DISABLED: 1']
}

function workflowFiles(): string[] {
  return walk(path.join(ROOT, '.github'), /\.ya?ml$/)
}

// ---------- next, npm, fonts, Stryker ----------

const RUNS_RAW_NEXT = /(?:^|[\s;&|(])(?:npx\s+)?next(?:\s|$)/

/** Every package.json script that runs next goes through tools/run-next.mjs. */
function nextScriptProblems(pkgText: string): string[] {
  const scripts = (JSON.parse(pkgText) as { scripts?: Record<string, string> }).scripts ?? {}
  const problems: string[] = []
  for (const [name, cmd] of Object.entries(scripts)) {
    if (RUNS_RAW_NEXT.test(cmd)) problems.push(`script ${name} runs next directly`)
  }
  for (const name of ['dev', 'build', 'e2e']) {
    if (!(scripts[name] ?? '').includes('tools/run-next.mjs')) problems.push(`script ${name} does not use tools/run-next.mjs`)
  }
  return problems
}

/** Playwright's webServer.command goes through tools/run-next.mjs and webServer.env sets NEXT_TELEMETRY_DISABLED. */
function playwrightProblems(src: string): string[] {
  const problems: string[] = []
  const cmd = /command:\s*(['"`])(.*?)\1/.exec(src)?.[2] ?? ''
  if (RUNS_RAW_NEXT.test(cmd) || !cmd.includes('tools/run-next.mjs')) problems.push(`webServer.command "${cmd}" does not use tools/run-next.mjs`)
  const env = /webServer\s*:\s*\{[\s\S]*?\benv\s*:\s*\{([\s\S]*?)\}/.exec(src)?.[1] ?? ''
  if (!/NEXT_TELEMETRY_DISABLED/.test(env)) problems.push('webServer.env does not set NEXT_TELEMETRY_DISABLED')
  return problems
}

function npmrcProblems(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  return ['update-notifier=false', 'fund=false'].filter((want) => !lines.includes(want)).map((w) => `.npmrc lacks ${w}`)
}

const GOOGLE_FONT = new RegExp(['next', 'font', 'google'].join('\\/') + '|fonts\\.(?:googleapis|gstatic)\\.com')
function fontProblems(files: string[]): string[] {
  return files.filter((f) => GOOGLE_FONT.test(fs.readFileSync(f, 'utf8'))).map((f) => `${path.relative(ROOT, f)} fetches a Google font`)
}

function strykerProblems(src: string): string[] {
  return /reporters\s*:\s*\[[^\]]*['"]dashboard['"]/.test(src) ? ['a Stryker config lists the dashboard reporter'] : []
}

function strykerConfigs(): string[] {
  const roots = fs
    .readdirSync(ROOT)
    .filter((f) => /stryker.*\.(?:m?js|cjs|json)$/.test(f))
    .map((f) => path.join(ROOT, f))
  const canary = path.join(FIX, 'mutation-canary')
  const inCanary = fs.existsSync(canary)
    ? fs
        .readdirSync(canary)
        .filter((f) => /stryker/.test(f))
        .map((f) => path.join(canary, f))
    : []
  return [...roots, ...inCanary]
}

// ---------- shell-outs in tools/ ----------

const SHELL_ALLOWED = new Set([path.join(ROOT, 'tools', 'heavy.mjs')])
/** No spawn/exec in tools with a truthy shell; no exec/execSync (always a shell); no spawning npx (needs a shell on Windows). */
function shellProblems(src: string): string[] {
  const problems: string[] = []
  if (/\bshell\s*:\s*(?!false\b)/.test(src)) problems.push('a child process option sets shell to something other than false')
  if (/import\s*\{[^}]*\b(?:exec|execSync)\b[^}]*\}\s*from\s*['"](?:node:)?child_process['"]/.test(src)) problems.push('imports exec/execSync, which always run a shell')
  if (/\b(?:spawn|spawnSync|execFile|execFileSync)\(\s*['"]npx(?:\.cmd)?['"]/.test(src)) problems.push('spawns npx (needs a shell on Windows); run the bin through process.execPath')
  return problems
}

// ---------- logger messages ----------

const LOG_CALL = String.raw`\.(?:info|warn|error|debug)\(\s*`
const INTERPOLATED = [
  new RegExp(LOG_CALL + '`[^`]*\\$\\{'),
  new RegExp(LOG_CALL + `(['"])(?:(?!\\1).)*\\1\\s*\\+`),
  new RegExp(LOG_CALL + '[\\w.]+\\s*\\+'),
]
function loggerProblems(src: string): string[] {
  return src
    .split('\n')
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => INTERPOLATED.some((re) => re.test(l)))
    .map(({ i }) => `line ${String(i + 1)} logs an interpolated message`)
}

function srcFiles(): string[] {
  return walk(path.join(ROOT, 'src'), /\.(?:ts|tsx|mts|js|mjs|css)$/).filter((f) => f !== THIS_FILE)
}

// ---------- ESLint ----------

describe('F00 egress and shell-out rules (SEC-10, ARC-15)', () => {
  test('SEC-10 rule: a planted workflow with @v4, kept credentials, curl | tar and telemetry on is caught', () => {
    const yml = read(FIX, 'planted-workflow.yml.txt')
    expect(usesProblems(yml).length).toBeGreaterThanOrEqual(2)
    expect(checkoutProblems(yml)).toHaveLength(1)
    expect(downloadProblems(yml)).toHaveLength(1)
    expect(telemetryEnvProblems(yml)).toHaveLength(1)
  })
  test('SEC-10 rule: a planted download to a file used before its checksum is caught, and one checked first passes', () => {
    expect(downloadProblems(read(FIX, 'planted-download-unchecked.txt'))).toHaveLength(1)
    expect(downloadProblems(read(FIX, 'planted-download-checked.txt'))).toEqual([])
  })
  test('SEC-10 every uses: under .github is pinned by a 40-hex commit SHA', () => {
    const files = workflowFiles()
    expect(files.length).toBeGreaterThan(0)
    expect(files.flatMap((f) => usesProblems(fs.readFileSync(f, 'utf8')))).toEqual([])
  })
  test('SEC-10 rule: a planted checkout without persist-credentials: false is caught, and a workflow with no checkout step is caught', () => {
    expect(checkoutProblems(read(FIX_EGRESS, 'planted-checkout-no-setting.yml.txt'))).toHaveLength(1)
    expect(checkoutProblems(read(FIX_EGRESS, 'planted-no-checkout.yml.txt'))).toContain('no actions/checkout step found')
  })
  test('SEC-10 every checkout sets persist-credentials: false, and checks.yml has at least one checkout', () => {
    const checks = read(ROOT, '.github', 'workflows', 'checks.yml')
    expect(checkoutCount(checks), 'checks.yml has an actions/checkout step').toBeGreaterThan(0)
    expect(workflowFiles().flatMap((f) => checkoutProblems(fs.readFileSync(f, 'utf8')).filter((p) => !p.startsWith('no actions/checkout')))).toEqual([])
  })
  test('SEC-10 every curl or wget writes a file that sha256sum -c checks before use', () => {
    expect(workflowFiles().flatMap((f) => downloadProblems(fs.readFileSync(f, 'utf8')))).toEqual([])
  })
  test('SEC-10 the workflow env sets NEXT_TELEMETRY_DISABLED', () => {
    expect(telemetryEnvProblems(read(ROOT, '.github', 'workflows', 'checks.yml'))).toEqual([])
  })

  test('SEC-10 rule: a planted "build": "next build" script is caught', () => {
    expect(nextScriptProblems(read(FIX, 'planted-next-scripts-package.json.txt'))).toContain('script build runs next directly')
  })
  test('SEC-10 every package.json script that runs next goes through tools/run-next.mjs', () => {
    expect(nextScriptProblems(read(ROOT, 'package.json'))).toEqual([])
  })
  test('SEC-10 rule: a planted Playwright webServer running npx next start is caught', () => {
    expect(playwrightProblems(read(FIX, 'planted-playwright-config.txt'))).toHaveLength(2)
  })
  test('SEC-10 Playwright webServer.command goes through tools/run-next.mjs and webServer.env sets NEXT_TELEMETRY_DISABLED', () => {
    expect(playwrightProblems(read(ROOT, 'playwright.config.ts'))).toEqual([])
  })
  test('SEC-10 tools/run-next.mjs sets NEXT_TELEMETRY_DISABLED and runs the next bin through process.execPath', () => {
    const p = path.join(ROOT, 'tools', 'run-next.mjs')
    expect(fs.existsSync(p), 'tools/run-next.mjs exists').toBe(true)
    const src = fs.readFileSync(p, 'utf8')
    expect(src).toMatch(/NEXT_TELEMETRY_DISABLED/)
    expect(src).toMatch(/process\.execPath/)
    expect(src).toMatch(/next\/dist\/bin\/next/)
    expect(shellProblems(src)).toEqual([])
  })

  test('SEC-10 rule: a planted .npmrc without update-notifier=false and fund=false is caught', () => {
    expect(npmrcProblems(read(FIX, 'planted-npmrc.txt'))).toHaveLength(2)
  })
  test('SEC-10 .npmrc turns off the update notifier and funding calls', () => {
    expect(npmrcProblems(read(ROOT, '.npmrc'))).toEqual([])
  })

  test('SEC-10 rule: a planted next/font/google import is caught', () => {
    expect(fontProblems([path.join(FIX, 'planted-next-font.tsx.txt')])).toHaveLength(1)
  })
  test('SEC-10 no Google font is fetched anywhere in src (fonts are self-hosted files)', () => {
    expect(fontProblems(srcFiles())).toEqual([])
  })

  test('SEC-10 rule: a planted Stryker config with the dashboard reporter is caught', () => {
    expect(strykerProblems(read(FIX, 'planted-stryker-dashboard.txt'))).toHaveLength(1)
  })
  test('SEC-10 no Stryker config lists the dashboard reporter', () => {
    const configs = strykerConfigs()
    expect(configs.length).toBeGreaterThan(0)
    expect(configs.flatMap((f) => strykerProblems(fs.readFileSync(f, 'utf8')))).toEqual([])
  })

  test('SEC-10 rule: a planted tool spawning npx with shell on Windows is caught', () => {
    expect(shellProblems(read(FIX, 'planted-shell-tool.mjs.txt')).length).toBeGreaterThanOrEqual(2)
  })
  test('SEC-10 no spawn or exec in tools/ runs a shell, except tools/heavy.mjs', () => {
    const files = walk(path.join(ROOT, 'tools'), /\.(?:mjs|js|cjs|ts)$/).filter((f) => !SHELL_ALLOWED.has(f))
    expect(files.length).toBeGreaterThan(0)
    const problems = files.flatMap((f) => shellProblems(fs.readFileSync(f, 'utf8')).map((p) => `${path.relative(ROOT, f)}: ${p}`))
    expect(problems).toEqual([])
  })
  test('SEC-10 mutate-changed.mjs and test-flake.mjs run their bins through process.execPath', () => {
    expect(read(ROOT, 'tools', 'mutate-changed.mjs')).toMatch(/process\.execPath[\s\S]*@stryker-mutator\/core\/bin\/stryker\.js|@stryker-mutator\/core\/bin\/stryker\.js[\s\S]*process\.execPath/)
    expect(read(ROOT, 'tools', 'test-flake.mjs')).toMatch(/process\.execPath[\s\S]*vitest\/vitest\.mjs|vitest\/vitest\.mjs[\s\S]*process\.execPath/)
  })

  test('SEC-5 rule: a planted logger call with an interpolated message is caught', () => {
    expect(loggerProblems(read(FIX, 'planted-interpolated-log.ts.txt'))).toHaveLength(3)
  })
  test('SEC-5 no logger call in src has an interpolated message', () => {
    const problems = srcFiles().flatMap((f) => loggerProblems(fs.readFileSync(f, 'utf8')).map((p) => `${path.relative(ROOT, f)}: ${p}`))
    expect(problems).toEqual([])
  })
  test('SEC-5 ESLint refuses console and interpolated logger messages in src, except the db global setup', async () => {
    const eslint = new ESLint({ cwd: ROOT })
    // lintText takes the text from the fixture but the path of a real src file, so the type-aware parser finds it.
    const lint = async (file: string, fixture: string): Promise<string[]> => {
      const [r] = await eslint.lintText(read(FIX_EGRESS, fixture), { filePath: path.join(ROOT, 'src', 'core', file) })
      return (r?.messages ?? []).map((m) => m.ruleId ?? '')
    }
    const planted = await lint('log.ts', 'planted-logging.ts.txt')
    expect(planted, 'console.log is refused').toContain('no-console')
    expect(planted, 'an interpolated logger message is refused').toContain('no-restricted-syntax')
    expect(await lint('log.ts', 'clean-logging.ts.txt')).toEqual([])
    expect((await lint('db/global-setup.ts', 'planted-logging.ts.txt')).filter((r) => r === 'no-console')).toEqual([])
  })
})
