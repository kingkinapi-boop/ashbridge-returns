// `npm run ai:once`: one pass over the exchange folder, then it stops (decision 0010). Started by hand, never by a
// timer. It prints each log line, and the reason when the run is refused (exit code 1).
import { register } from 'node:module'

register('./ts-resolve.mjs', import.meta.url)
const { runAiProjectOnce } = await import('../src/modules/ai/project/index.ts')

const result = await runAiProjectOnce({ argv: process.argv.slice(2), env: process.env, sink: (line) => console.log(line) })
if (!result.ok) {
  console.error(result.reason)
  process.exitCode = 1
}
