import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
const jobs = [
  ['guard', 'testworld/model/guard.ts', 'testworld/model/guard.test.ts'],
  ['money', 'src/core/money.ts', 'src/contracts/checks.acceptance.test.ts,src/core/money.acceptance.test.ts,testworld/clients/load.test.ts,testworld/model/money-converter.test.ts,testworld/model/money.acceptance.test.ts'],
  ['kinds', 'testworld/model/kinds.ts', 'testworld/model/kinds.test.ts,testworld/model/kinds-faults.acceptance.test.ts'],
  ['faults', 'testworld/model/faults.ts', 'testworld/clients/checks-rolls.test.ts,testworld/clients/clients.acceptance.test.ts,testworld/clients/w00c-checks.test.ts,testworld/clients/w00c-survivors.test.ts,testworld/model/checks.test.ts,testworld/model/fault-markers.acceptance.test.ts,testworld/model/faults.test.ts,testworld/model/kinds-faults.acceptance.test.ts'],
  ['checks', 'testworld/model/checks.ts', 'src/contracts/blank-rule.acceptance.test.ts,src/contracts/checks.acceptance.test.ts,src/contracts/checks.test.ts,testworld/clients/checks-rolls.test.ts,testworld/clients/model-issues.acceptance.test.ts,testworld/clients/w00c-checks.test.ts,testworld/clients/w00c-survivors.test.ts,testworld/model/checks.test.ts'],
  ['schema', 'testworld/model/schema.ts', 'testworld/model/schema.test.ts,testworld/model/guard.test.ts,testworld/model/checks.test.ts,testworld/clients/load.test.ts,testworld/clients/w00c-load.test.ts'],
  ['generate', 'testworld/generate.ts', 'testworld/clients/regenerate.acceptance.test.ts,testworld/model/generate.test.ts'],
  ['index-model', 'testworld/model/index.ts', 'testworld/model/links.acceptance.test.ts,testworld/model/ranges.acceptance.test.ts,testworld/model/marker-pins.acceptance.test.ts,testworld/model/money.acceptance.test.ts,testworld/model/kinds-faults.acceptance.test.ts'],
  ['index-world', 'testworld/index.ts', 'testworld/clients/clients.acceptance.test.ts,testworld/clients/made-up-data.acceptance.test.ts'],
]
const only = process.argv.slice(2)
for (const [n, file, tests] of jobs) {
  if (only.length && !only.includes(n)) continue
  fs.writeFileSync(`reports/W00c-mutation/n-${n}.testfiles.txt`, tests.split(',').join('\n') + '\n')
  fs.writeFileSync('vitest.scratch.mjs', `import base from './vitest.mutate.config.ts'\nexport default { ...base, test: { ...base.test, testTimeout: 30000, hookTimeout: 30000, include: ${JSON.stringify(tests.split(','))} } }\n`)
  fs.writeFileSync('stryker.scratch.mjs', `import base from './stryker.config.mjs'\nexport default { ...base, vitest: { configFile: 'vitest.scratch.mjs', related: true }, incrementalFile: 'reports/W00c-mutation/n-${n}-incr.json', jsonReporter: { fileName: 'reports/W00c-mutation/n-${n}.json' }, reporters: ['progress','clear-text','json'], dryRunTimeoutMinutes: 90, timeoutMS: 10000, timeoutFactor: 1.5, mutate: ['${file}'] }\n`)
  const r = spawnSync('npx', ['stryker', 'run', 'stryker.scratch.mjs'], { encoding: 'utf8', maxBuffer: 1 << 28 })
  fs.writeFileSync(`reports/W00c-mutation/n-${n}.log`, (r.stdout || '') + (r.stderr || ''))
}
