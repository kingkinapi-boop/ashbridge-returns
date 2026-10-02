// The rule behind SEC-10 "no shell in tools", in one place. Returns a list of problems for a source text.
// A253 fix: the old pattern put the lookahead after the spacing, so a false value written with a
// space after the colon matched by backtracking the spacing to nothing, and tools had to be written
// without the space. The lookahead now allows the spacing, so the false value is clean with or
// without spaces and any other value is caught.
// (This comment avoids the literal option text because the rule scans every file in tools/.)
export function shellProblems(src) {
  const problems = []
  if (/\bshell\s*:(?!\s*false\b)/.test(src)) problems.push('a child process option sets shell to something other than false')
  if (/import\s*\{[^}]*\b(?:exec|execSync)\b[^}]*\}\s*from\s*['"](?:node:)?child_process['"]/.test(src)) problems.push('imports exec/execSync, which always run a shell')
  if (/\b(?:spawn|spawnSync|execFile|execFileSync)\(\s*['"]npx(?:\.cmd)?['"]/.test(src)) problems.push('spawns npx (needs a shell on Windows); run the bin through process.execPath')
  return problems
}
