// SC6: the verify rule R78 and the card scan (unit project). Card plan/cards/SC6.md; clause ARC-16 (R78). Sources:
// reports/W16-findings.md ("Rule tests to add"), reports/SC6-spec-review.md (A408), reports/SC6-check.md and the Lead
// directives of 3 Oct 15:04Z (A493), 17:07Z (A503), 20:08Z (A518) and 21:53Z (A528: SC6 lands R78 only; R77, its
// prose reader and R81 moved to SC7 as a data rule). Each rule is first shown failing on its planted examples under
// tools/test/__fixtures__/spec-rules/ (copies taken from git history) or on small typed text, then applied to the repo.
// This file was tools/test/card-rules.test.mjs (A493: SC10 owns that name).
//
// Cards read (fix 2, G8). Every card in plan/slices.json is read (its own file, or its family template with its params):
// the sentinel (plan/cards/SC6.md) and the floors (more than 50 card files, at least one family template, at least one
// card with an expectation file in Paths) are checked over all of them, so they hold with any statuses (every card set
// done included); every family card reads with none of its own {param} placeholders left; an open card with no source
// file fails by id.
//
// R78 (ARC-16: a check over sample data is deterministic and depends on the data, not on git history). Reach by class
//   (fix 3): every test file the repository holds (`git ls-files --cached --others --exclude-standard`, never a disk
//   walk) and every checker script over sample data (reference/sample-clients, testworld) is scanned, except a test
//   that builds its own repository (G6 a, A518 fix 9: mkdtemp or mkdtempSync called in its code, never in a string or
//   a comment, and a git init call it executes: git(<dir>, 'init', ...) or any git(...) helper call whose subcommand is
//   init, spawn, spawnSync, execFile or execFileSync('git', [..., 'init']), or an exec or execSync string with a shell
//   segment starting "git init"; a test title or any other string is no call; a plain oracle cross-checks it, fix 10)
//   and this file
//   (SELF, the one named entry: it quotes its plants). A file is over sample data when it lies in those folders or
//   names them as a path or as path segments (G6 b: path.join(ROOT, 'reference', 'sample-clients')). A scanned file
//   holds no git call that names a ref other than HEAD, and no frozen "unchanged" claim. Each call is read whole, across
//   lines (fix 7): a git call is spawnSync/execFileSync('git', ...), git(...), or a string starting "git "; its words
//   split at &&, ||, ; and | into segments, and each segment that starts with git (a git(...) helper's words are one
//   segment) is judged alone (A518 fix 8); a segment's subcommand is its first word that is not an option or an
//   option's value. A segment fails when it names main or master as a ref (refs/, heads/ or remotes/<r>/ in front, ~N,
//   ^N or @{..} after, a ":path" after that, or at either end of ".." or "...") with any subcommand but init (G6 c),
//   shows "REF:file" for a REF other than HEAD, rev-parses a ref other than HEAD, or runs describe. Any code line fails on origin/..., refs/..., FETCH_HEAD, ORIG_HEAD, @{u}, @{N}, HEAD~N, HEAD^,
//   merge-base, show-ref or for-each-ref. Any line, comments included, fails on "folders N to M identical/unchanged/the
//   same", "unchanged since (or versus) main", "same as (on) main" or "versus main". In a file over sample data, a hex
//   literal of 40 characters or more and a sha256- or sha512- base64 literal fail too. Comments are read as JavaScript
//   reads them: a line starting with `*` is a comment only inside /* */. Out of reach by design: refs through variables
//   or wrappers, and split literals (FX8's history-free run covers sample data). Unchanged files are tools/scope.mjs's
//   job.
//   Planted: reference/sample-clients/verify.mjs as on main before W16 round 2 (7f15c0a), and the variants below.
//
// KNOWN (A407, SC6 "KNOWN shape"): each entry names one rule, one file, the exact problem strings (no regex) and an
// open owner card; any problem not listed fails, and a listed string not produced fails as stale. Every file scan
// asserts it read at least one file and a named sentinel. KNOWN is empty.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { isExpectationFile } from "../lib.mjs";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const FIX = path.join(ROOT, "tools", "test", "__fixtures__", "spec-rules");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const fix = (name) => fs.readFileSync(path.join(FIX, name), "utf8");
const PLANTED_VERIFY = "planted-verify-before-W16-r2.mjs.txt";
const SELF = "tools/test/spec-rules.test.mjs";
const SENTINEL_CARD = "plan/cards/SC6.md";
const uniq = (xs) => [...new Set(xs)];

// ---------- cards and statuses (fix 2) ----------
const SLICES = () => JSON.parse(read("plan/slices.json"));
const liveStatuses = () =>
  Object.fromEntries(SLICES().cards.map((c) => [c.id, c.status]));
const CLOSED = new Set(["done", "parked"]);
const isOpen = (statuses, id) =>
  typeof statuses[id] === "string" && !CLOSED.has(statuses[id]);

/** The card's text and the file it lives in: its own card file, or its family template with its params filled in. */
function cardSource(card) {
  const own = `plan/cards/${card.id}.md`;
  if (fs.existsSync(path.join(ROOT, own)))
    return { rel: own, label: own, text: read(own) };
  if (!card.family) return undefined;
  const rel = `plan/cards/families/${card.family}.md`;
  if (!fs.existsSync(path.join(ROOT, rel))) return undefined;
  let text = read(rel);
  for (const [k, v] of Object.entries(card.params ?? {}))
    text = text.split(`{${k}}`).join(String(v));
  return { rel, label: `${rel} (${card.id})`, text };
}
/** A file scan reads at least one file and its named sentinel (findings SC RC3). */
const scanProblems = (label, files, sentinel) =>
  files.length === 0
    ? [`${label}: the scan read no file`]
    : files.includes(sentinel)
      ? []
      : [`${label}: the scan missed its sentinel ${sentinel}`];
/** Read every card, check the sentinel and the floors over all of them and fail an open card with no file by id;
 * only then keep the open cards. */
function scanCards(cards, statuses, sourceOf = cardSource) {
  const all = cards.map((c) => ({
    id: c.id,
    paths: c.paths ?? [],
    src: sourceOf(c),
  }));
  const problems = [];
  for (const c of all)
    if (!c.src && isOpen(statuses, c.id))
      problems.push(
        `cards: the open card ${c.id} has no card file (plan/cards/${c.id}.md or its family template)`,
      );
  const labels = all.filter((c) => c.src).map((c) => c.src.label);
  problems.push(...scanProblems("cards", labels, SENTINEL_CARD));
  if (labels.length <= 50)
    problems.push(
      `cards: only ${String(labels.length)} card files read (the floor is 51)`,
    );
  if (!labels.some((l) => l.startsWith("plan/cards/families/")))
    problems.push("cards: no family template read");
  const read = all.filter((c) => c.src);
  const open = read.filter((c) => isOpen(statuses, c.id));
  return { problems, read, open };
}

/** G8: every family card reads from its template with none of its own {param} placeholders left. */
function familyProblems(cards, sourceOf = cardSource) {
  return cards.flatMap((c) => {
    const src = sourceOf(c);
    if (!src)
      return [`${c.id}: no card file and no template plan/cards/families/${c.family}.md`];
    return Object.keys(c.params ?? {})
      .filter((k) => src.text.includes(`{${k}}`))
      .map((k) => `${c.id}: {${k}} left in ${src.label}`);
  });
}

// ---------- KNOWN: known defects on main, each owned by an open card ----------
/** @type {{ rule: string, file: string, problems: string[], owner: string }[]} */
const KNOWN = [];
const KNOWN_RULES = new Set(["R78"]);
const KNOWN_KEYS = ["rule", "file", "problems", "owner"];

/** The KNOWN shape (A407): one rule, one real file, literal problem strings that name that file, an open owner card. */
function knownShapeProblems(known, statuses, fileExists) {
  const out = [];
  const seen = new Set();
  known.forEach((k, i) => {
    const at = `KNOWN[${String(i)}] ${String(k?.rule)} ${String(k?.file)}`;
    for (const key of Object.keys(k))
      if (!KNOWN_KEYS.includes(key))
        out.push(
          `${at}: the key ${key} is not one of rule, file, problems, owner`,
        );
    if (!KNOWN_RULES.has(k.rule))
      out.push(`${at}: the rule is not R78`);
    if (typeof k.file !== "string" || /[*?|()[\]{}]/.test(k.file))
      out.push(`${at}: the file is not one plain path`);
    else if (!fileExists(k.file)) out.push(`${at}: the file does not exist`);
    if (!Array.isArray(k.problems) || k.problems.length === 0)
      out.push(`${at}: problems is not a non-empty list`);
    else
      for (const p of k.problems) {
        if (typeof p !== "string")
          out.push(
            `${at}: a problem that is not a literal string (${String(p)})`,
          );
        else if (!p.startsWith(`${k.file}`))
          out.push(
            `${at}: the problem ${JSON.stringify(p)} does not name its file first`,
          );
        else if (seen.has(p))
          out.push(`${at}: the problem ${JSON.stringify(p)} is listed twice`);
        else seen.add(p);
      }
    if (typeof k.owner !== "string" || !(k.owner in statuses))
      out.push(
        `${at}: the owner ${JSON.stringify(k.owner)} is not a card in plan/slices.json`,
      );
    else if (!isOpen(statuses, k.owner))
      out.push(
        `${at}: the owner ${k.owner} is ${statuses[k.owner]}, so it can never fix the defect`,
      );
  });
  return out;
}
function onlyKnown(rule, problems, known = KNOWN) {
  const mine = known.filter((k) => k.rule === rule);
  const listed = mine.flatMap((k) => k.problems);
  const unknown = problems.filter((p) => !listed.includes(p));
  const stale = mine.flatMap((k) =>
    k.problems
      .filter((s) => !problems.includes(s))
      .map(
        (s) =>
          `stale KNOWN entry ${k.rule} ${k.file} (owner ${k.owner}): ${JSON.stringify(s)} no longer fails; remove it`,
      ),
  );
  return [...unknown, ...stale];
}

// ---------- file names ----------
// A `*.build.test.*` file is the builder's own test (A490, CQ11), never an expectation file.
const isBuildTest = (f) => /\.build\.test\./i.test(f.split("/").pop() ?? "");
const isExp = (f) =>
  !isBuildTest(f) &&
  isExpectationFile(f.replace(/(^|\/)readme\.md$/i, "$1README.md"));

// ---------- R78: no frozen history guard in a checker over sample data or in any test ----------
/** Comments blanked (newlines kept), and a skeleton with string, template and regex contents blanked too. */
function scanSource(src) {
  let code = "";
  let skel = "";
  let prev = "";
  const put = (c, keepInSkel) => {
    code += c;
    skel += keepInSkel || c === "\n" ? c : " ";
  };
  const blank = (c) => {
    code += c === "\n" ? "\n" : " ";
    skel += c === "\n" ? "\n" : " ";
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      while (i < src.length && src[i] !== "\n") blank(src[i++]);
      continue;
    }
    if (c === "/" && d === "*") {
      blank(src[i++]);
      blank(src[i++]);
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/"))
        blank(src[i++]);
      if (i < src.length) {
        blank(src[i++]);
        blank(src[i++]);
      }
      continue;
    }
    const regexStart =
      c === "/" && (prev === "" || "(,=:[!&|?{};+-*%<>~^".includes(prev));
    if (c === '"' || c === "'" || c === "`" || regexStart) {
      put(c, true);
      i++;
      let inClass = false;
      while (i < src.length) {
        const e = src[i];
        if (e === "\\") {
          put(e, false);
          if (i + 1 < src.length) put(src[i + 1], false);
          i += 2;
          continue;
        }
        if (e === "\n" && c !== "`") break;
        if (regexStart && e === "[") inClass = true;
        else if (regexStart && e === "]") inClass = false;
        if (e === c && !inClass) {
          put(e, true);
          i++;
          break;
        }
        put(e, false);
        i++;
      }
      prev = c;
      continue;
    }
    put(c, true);
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return { code, skel };
}
const OPEN = "([{";
const CLOSE = ")]}";
/** The end of the bracket that opens at `p` (the skeleton has no string contents, so brackets in strings never count). */
function matchEnd(skel, p) {
  let depth = 0;
  for (let i = p; i < skel.length; i++) {
    if (OPEN.includes(skel[i])) depth++;
    else if (CLOSE.includes(skel[i]) && --depth === 0) return i;
  }
  return skel.length - 1;
}
const lineAt = (text, i) => text.slice(0, i).split("\n").length;
/** Every git call, read whole across lines: spawnSync/execFileSync('git', ...), git(...), and strings starting "git ". */
function gitCalls(code, skel) {
  const calls = [];
  const before = (i) => {
    let j = i - 1;
    while (j >= 0 && /\s/.test(skel[j])) j--;
    return j;
  };
  for (const m of code.matchAll(/(['"`])git\1\s*,/g)) {
    const p = before(m.index);
    if (p >= 0 && skel[p] === "(")
      calls.push({ start: m.index, text: code.slice(p, matchEnd(skel, p) + 1) });
  }
  for (const m of code.matchAll(/(?<![\w.$])git\s*\(/g)) {
    const p = m.index + m[0].length - 1;
    calls.push({ start: m.index, text: code.slice(p, matchEnd(skel, p) + 1) });
  }
  for (const m of code.matchAll(/(['"`])git\s+[a-z-]/g)) {
    const p = before(m.index);
    if (p >= 0 && skel[p] === "(") {
      calls.push({ start: m.index, text: code.slice(p, matchEnd(skel, p) + 1) });
      continue;
    }
    const q = m[1];
    let e = m.index + 1;
    while (e < code.length && !(skel[e] === q)) e++;
    calls.push({ start: m.index, text: code.slice(m.index, e + 1) });
  }
  return calls;
}
const OPTION_WORDS = new Set([
  "utf8",
  "utf-8",
  "pipe",
  "inherit",
  "ignore",
  "buffer",
  "latin1",
]);
/** The words of a call: the contents of its string literals, split at spaces. */
const callWords = (text) =>
  [...text.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`([^`]*)`/g)]
    .flatMap((m) => (m[1] ?? m[2] ?? m[3] ?? "").split(/\s+/))
    .filter(Boolean);
/** The subcommand of a git call's words (its string literals): the first word after "git" that is not an option or an
 * option's value (a path or a key=value; a variable passed to -C leaves no word). */
function gitSubcommand(words) {
  const w = words[0] === "git" ? words.slice(1) : words;
  return w.find((x) => !x.startsWith("-") && !/[=/\\]/.test(x) && x !== ".");
}
// A518 fix 8: main or master as a ref: refs/, heads/ or remotes/<r>/ in front, ~N, ^N or @{..} after, a ":path" after
// that, and either end of ".." or "...".
const MAIN_REF =
  /^(?:refs\/)?(?:heads\/|remotes\/[^/\s]+\/)?(?:main|master)(?:~\d*|\^\d*|@\{[^}]*\})*(?::.*)?$/;
// A shell quote around a ref is no part of it ("main", 'main').
const unquote = (x) => x.replace(/^[\\'"]+|[\\'"]+$/g, "");
const namesMainRef = (x) => unquote(x).split(/\.\.\.?/).some((p) => MAIN_REF.test(unquote(p)));
const SHELL_SEPARATORS = new Set(["&&", "||", ";", "|"]);
/** A call's words split at &&, ||, ; and | (A518 fix 8). A call whose words start with "git" (a spawn of git, or a shell
 * string) keeps only its segments that start with "git"; a git(...) helper's words are one git segment. */
function gitSegments(words) {
  if (words[0] !== "git") return [words.filter((x) => !SHELL_SEPARATORS.has(x))];
  return shellSegments(words);
}
/** A shell string's words split at &&, ||, ; and |, keeping the segments that start with "git". */
function shellSegments(words) {
  const segs = [[]];
  for (const x of words.flatMap((w) => w.split(/(&&|\|\||;|\|)/)).filter(Boolean)) {
    if (SHELL_SEPARATORS.has(x)) segs.push([]);
    else segs[segs.length - 1].push(x);
  }
  return segs.filter((s) => s[0] === "git");
}
const CALL_CHECKS = {
  revParse: [
    (w) => {
      const at = w.indexOf("rev-parse");
      if (at < 0) return false;
      const next = w
        .slice(at + 1)
        .find((x) => !x.startsWith("-") && !OPTION_WORDS.has(x));
      return next !== undefined && !/^HEAD$/.test(next);
    },
    "a git rev-parse of a ref other than HEAD",
  ],
  show: [
    (w) =>
      w.includes("show") &&
      w.some((x) => /^(?!HEAD:)[^\s:-][^\s:]*:[^\s/]/.test(x)),
    "a git show of a ref other than HEAD",
  ],
  // G6 (c), A518 fix 8: any git segment naming main or master as a ref fails, whatever its subcommand, except init (it
  // names a new branch).
  main: [
    (w) => gitSubcommand(w) !== "init" && w.some(namesMainRef),
    "a git call naming main",
  ],
  describe: [(w) => w.includes("describe"), "a git describe (it reads tags)"],
};
// Each line's checks in order; the first that fires is the line's problem. "text" checks read the raw line, comments
// included (a comment can carry the frozen claim the code relies on); "code" checks read the line with comments blanked;
// "call" checks read each git call that starts on the line, whole.
const R78_CHECKS = [
  [
    "text",
    /\b(folders?|clients?)\s+\d+\s*(to|through|-|–)\s*\d+\s+(are\s+|is\s+)?(byte-)?(identical|unchanged|the\s+same)\b/i,
    'a hard-coded "folders N to M identical" check',
  ],
  [
    "text",
    /\b(byte-)?(identical|unchanged)\s+(to|since|from|with|versus|vs\.?)\s+(origin\/)?main\b/i,
    'a hard-coded "unchanged since main" check',
  ],
  [
    "text",
    /\bsame\s+as\s+(on\s+|in\s+)?(origin\/)?main\b|\bversus\s+(origin\/)?main\b/i,
    'a hard-coded "same as main" check',
  ],
  ["code", /\bmerge-base\b/, "a git merge-base guard"],
  ["call", ...CALL_CHECKS.revParse],
  ["code", /\borigin\/[\w.-]/, "a git ref on origin"],
  ["code", /(?<![\w./-])refs\/[\w*.-]/, "a git ref by its refs/ name"],
  ["code", /\b(?:FETCH_HEAD|ORIG_HEAD)\b/, "a git ref left by fetch or merge"],
  ["code", /@\{(?:u|upstream|push)\}/, "a git upstream ref"],
  ["code", /@\{-?\d+\}/, "a git reflog ref"],
  ["code", /\bHEAD(?:~\d*|\^)/, "a git ref behind HEAD"],
  ["code", /\b(?:show-ref|for-each-ref)\b/, "a git ref listing"],
  ["call", ...CALL_CHECKS.show],
  ["call", ...CALL_CHECKS.main],
  ["call", ...CALL_CHECKS.describe],
];
const SAMPLE_CHECKS = [
  [
    "code",
    /(?<![0-9A-Za-z_])[0-9a-f]{40,}(?![0-9A-Za-z_])/i,
    "a pinned hash literal (40 or more hex characters)",
  ],
  [
    "code",
    /\bsha(?:256|512)-[A-Za-z0-9+/]{16,}={0,2}/,
    "a pinned sha256 or sha512 digest",
  ],
];

function r78(rel, text, { overSampleData = true } = {}) {
  const { code, skel } = scanSource(text);
  const raw = text.split(/\r?\n/);
  const codeLines = code.split(/\r?\n/);
  const callsAt = new Map();
  for (const c of gitCalls(code, skel)) {
    const n = lineAt(code, c.start);
    callsAt.set(n, [...(callsAt.get(n) ?? []), ...gitSegments(callWords(c.text))]);
  }
  const checks = [...R78_CHECKS, ...(overSampleData ? SAMPLE_CHECKS : [])];
  const out = [];
  raw.forEach((line, i) => {
    const n = i + 1;
    const hit = checks.find(([kind, re, what]) => {
      void what;
      if (kind === "text") return re.test(line);
      if (kind === "code") return re.test(codeLines[i] ?? "");
      return (callsAt.get(n) ?? []).some((w) => re(w));
    });
    if (hit)
      out.push(
        `${rel}:${String(n)}: ${hit[2]} (scope.mjs checks unchanged files)`,
      );
  });
  return out;
}
// This file quotes its planted variants; it is the one named entry (fix 3).
const R78_ALLOW = { [SELF]: "this file quotes its planted variants" };
const SAMPLE_DIRS = ["reference/sample-clients", "testworld"];
const isTest = (f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f);
const isFixture = (f) => /(^|\/)(__fixtures__|__golden__)\//.test(f);
const isScript = (f) => /\.(mjs|cjs|js|ts)$/.test(f) && !f.endsWith(".d.ts");
// G6 (b): sample data named as a path or as path segments (path.join(ROOT, 'reference', 'sample-clients')).
const mentionsSampleData = (text) =>
  /reference[/\\]sample-clients|\btestworld[/\\]/.test(text) ||
  /['"`]reference['"`]\s*,\s*['"`]sample-clients['"`]/.test(text) ||
  /['"`]testworld['"`]\s*[,)]/.test(text);
/** A518 fix 9, A528: the git init calls a file executes: git(<dir>, 'init', ...) (a git helper whose subcommand is
 * init), spawn, spawnSync, execFile or execFileSync('git', [..., 'init']) (a segment whose subcommand is init), or an
 * exec or execSync string with a shell segment that starts "git init". Each is a bare call or one on a child_process
 * import (cp.execSync); never `.exec(` after a dot (a regex's exec is no call). A string elsewhere (a test title) is
 * no call. */
/** The names a file binds to the child_process module: import x from, import * as x from, const x = require(). */
function childProcessNames(code) {
  const mod = "['\"`](?:node:)?child_process['\"`]";
  const names = [
    ...code.matchAll(new RegExp(`\\bimport\\s+(?:\\*\\s+as\\s+)?([\\w$]+)\\s+from\\s+${mod}`, "g")),
    ...code.matchAll(new RegExp(`\\b(?:const|let|var)\\s+([\\w$]+)\\s*=\\s*require\\(\\s*${mod}\\s*\\)`, "g")),
  ].map((m) => m[1]);
  return new Set(names);
}
function initCalls(code, skel) {
  const out = [];
  const cp = childProcessNames(code);
  for (const m of skel.matchAll(/(?<![\w$.])git\s*\(|(?<![\w$.])(?:([\w$]+)\s*\.\s*)?(spawn|spawnSync|execFile|execFileSync|exec|execSync)\s*\(/g)) {
    if (m[1] !== undefined && !cp.has(m[1])) continue;
    const p = m.index + m[0].length - 1;
    const text = code.slice(p, matchEnd(skel, p) + 1);
    const w = callWords(text);
    const callee = m[2];
    if (!callee) {
      if (gitSubcommand(w) === "init") out.push(text);
    } else if (/^exec(?:Sync)?$/.test(callee)) {
      const first = /^\(\s*(['"`])((?:[^\\]|\\.)*?)\1/.exec(text)?.[2] ?? "";
      const segs = shellSegments(first.split(/\s+/).filter(Boolean));
      if (segs.some((s) => s[1] === "init")) out.push(text);
    } else if (/^\(\s*(['"`])git\1\s*,/.test(text)) {
      if (gitSegments(w).some((s) => gitSubcommand(s) === "init")) out.push(text);
    }
  }
  return out;
}
/** A test that builds its own repository reads its own history, not the repo's (G6 (a), A518 fix 9): mkdtemp as a call
 * in its skeleton (never in a string or a comment), and a git init call it executes. */
const buildsOwnRepo = (text) => {
  const { code, skel } = scanSource(text);
  return /(?<![\w$])mkdtemp(?:Sync)?\s*\(/.test(skel) && initCalls(code, skel).length > 0;
};
/** The files git holds or would add (never a disk walk: that differs by machine and enters the excluded Assets/).
 * The tests that call it set a 30 s timeout (FX1: a test that spawns a process sets one). */
function repoFiles() {
  const r = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`git ls-files failed: ${r.stderr}`);
  return r.stdout
    .split("\0")
    .filter(Boolean)
    .filter((f) => fs.existsSync(path.join(ROOT, f)));
}
/** The R78 scan: every test file and every checker script over sample data, less SELF. */
function r78Files(files = repoFiles()) {
  const checkers = files.filter(
    (f) =>
      SAMPLE_DIRS.some((d) => f.startsWith(`${d}/`)) &&
      isScript(f) &&
      !isTest(f) &&
      !isFixture(f),
  );
  const tests = files.filter((f) => isTest(f));
  return uniq([...checkers, ...tests])
    .filter((f) => !(f in R78_ALLOW))
    .sort();
}
function r78File(rel, text) {
  if (buildsOwnRepo(text)) return [];
  const overSampleData =
    SAMPLE_DIRS.some((d) => rel.startsWith(`${d}/`)) ||
    mentionsSampleData(text);
  return r78(rel, text, { overSampleData });
}

// ---------- typed plant cards ----------
const PINNED = {
  W14: "done",
  W16: "carded",
  FX8: "carded",
  SC6: "carded",
  X1: "carded",
  X9: "parked",
};
// A518 fix 9 plants: a test title naming git init, and mkdtemp in a string beside a real init. Neither builds its own
// repository, so each reads the repo's history on its line 3.
const G6A_TITLE_PLANT = [
  "describe('git init flow (Test)', () => {",
  "  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'x-'))",
  "  test('x', () => { spawnSync('git', ['diff', '--quiet', 'origin/main'], { cwd: dir }) })",
  "})",
].join("\n");
const G6A_STRING_PLANT = [
  "const step = 'mkdtemp'",
  "execSync('git init -q', { cwd: dir })",
  "spawnSync('git', ['diff', '--quiet', 'origin/main'], { cwd: dir })",
].join("\n");

describe("SC6 cards read (fix 2)", () => {
  test("ARC-12 cards rule: with every card pinned done, SC6 included, the sentinel and the floors still pass and no card is open", () => {
    const cards = SLICES().cards;
    const allDone = Object.fromEntries(cards.map((c) => [c.id, "done"]));
    const scan = scanCards(cards, allDone);
    expect(scan.problems).toEqual([]);
    expect(scan.open).toEqual([]);
    const sc6Done = { ...liveStatuses(), SC6: "done" };
    const live = scanCards(cards, sc6Done);
    expect(live.problems).toEqual([]);
    expect(live.open.some((c) => c.id === "SC6")).toBe(false);
  });

  test("ARC-12 cards rule: a pinned open card with no card file fails by id; the same card done or parked does not", () => {
    const cards = [...SLICES().cards, { id: "ZZ9", status: "carded", paths: [] }];
    const statuses = { ...liveStatuses(), ZZ9: "carded" };
    expect(scanCards(cards, statuses).problems).toEqual([
      "cards: the open card ZZ9 has no card file (plan/cards/ZZ9.md or its family template)",
    ]);
    expect(scanCards(cards, { ...statuses, ZZ9: "parked" }).problems).toEqual(
      [],
    );
    expect(scanCards(cards, { ...statuses, ZZ9: "done" }).problems).toEqual([]);
  });

  test("ARC-12 cards rule: a scan that misses its sentinel, reads too few cards or no family template fails", () => {
    const few = SLICES()
      .cards.filter(
        (c) =>
          c.id !== "SC6" &&
          fs.existsSync(path.join(ROOT, `plan/cards/${c.id}.md`)),
      )
      .slice(0, 10);
    const statuses = liveStatuses();
    expect(scanCards(few, statuses).problems).toEqual([
      "cards: the scan missed its sentinel plan/cards/SC6.md",
      "cards: only 10 card files read (the floor is 51)",
      "cards: no family template read",
    ]);
    expect(scanCards([], statuses).problems).toEqual([
      "cards: the scan read no file",
      "cards: only 0 card files read (the floor is 51)",
      "cards: no family template read",
    ]);
  });

  test("ARC-12 cards rule (G8): every family card in plan/slices.json reads from its template with none of its own {param} placeholders left", () => {
    const family = SLICES().cards.filter((c) => c.family);
    expect(family.length, "no family card in plan/slices.json").toBeGreaterThan(0);
    expect(familyProblems(family)).toEqual([]);
  });

  test("ARC-12 cards rule (G8): a family card read with a param left unfilled, or with no template, fails by id", () => {
    const tpl = SLICES().cards.find((c) => c.family && Object.keys(c.params ?? {}).length > 0);
    expect(tpl, "no family card with params").toBeDefined();
    const [k] = Object.keys(tpl.params);
    const unfilled = (c) => {
      const rel = `plan/cards/families/${c.family}.md`;
      return { rel, label: `${rel} (${c.id})`, text: read(rel) };
    };
    expect(familyProblems([{ ...tpl, id: "ZZ8" }], unfilled)).toContain(
      `ZZ8: {${k}} left in plan/cards/families/${tpl.family}.md (ZZ8)`,
    );
    expect(familyProblems([{ id: "ZZ7", family: "nope-family", params: {} }])).toEqual([
      "ZZ7: no card file and no template plan/cards/families/nope-family.md",
    ]);
  });

  // G8 (A493 root cause 1, landing traps): the floors come from the unfiltered read, so they hold with any statuses.
  test.each([
    ["live statuses", () => liveStatuses()],
    ["SC6 set done", () => ({ ...liveStatuses(), SC6: "done" })],
    ["every card set done", () => Object.fromEntries(SLICES().cards.map((c) => [c.id, "done"]))],
  ])("ARC-12 cards on main (G8, %s): every card read, the sentinel and the floors pass, no open card lacks a file", (_name, statuses) => {
    const scan = scanCards(SLICES().cards, statuses());
    expect(scan.problems).toEqual([]);
    expect(scan.read.length, "no card read").toBeGreaterThan(50);
    expect(
      scan.read.filter((c) => c.paths.some((p) => isExp(p))).length,
      "no card has an expectation file in its Paths",
    ).toBeGreaterThan(0);
  });
});

describe("SC6 R78: no frozen history guard over sample data or in a test (ARC-16)", () => {
  test("ARC-16 R78 rule: verify.mjs as on main before W16 round 2 fails on its two merge-base guards and nothing else", () => {
    const problems = r78("reference/sample-clients/verify.mjs", fix(PLANTED_VERIFY));
    expect(problems.map((p) => Number(/:(\d+):/.exec(p)?.[1]))).toEqual([996, 1000, 1003, 1007]);
    expect(problems[0]).toMatch(/a git merge-base guard/);
    expect(problems[1]).toMatch(/folders N to M identical/);
  });

  test("ARC-16 R78 rule: the planted verify.mjs passes once the two guards are retired, keeping the second-generation check", () => {
    const lines = fix(PLANTED_VERIFY).split("\n");
    const kept = lines.filter((_, i) => ![995, 996, 997, 998, 999, 1002, 1003, 1004, 1005, 1006].includes(i));
    const text = kept.join("\n");
    expect(text).toMatch(/a second generation \(generate\.mjs, then make-csv\.mjs\) is byte-identical/);
    expect(r78("reference/sample-clients/verify.mjs", text)).toEqual([]);
  });

  // The rule matches behaviour, not labels. Each variant must fail on its line; `git diff HEAD` must not.
  const VARIANTS = [
    ["git diff against origin/main", "const q = spawnSync('git', ['diff', '--quiet', 'origin/main', '--', ...old], { cwd: root })", "a git ref on origin"],
    ["git show of a file on origin/main", "const was = execSync('git show origin/main:reference/sample-clients/01-x/answer-key.json')", "a git ref on origin"],
    ["git rev-parse origin/main", "const tip = spawnSync('git', ['rev-parse', 'origin/main']).stdout.trim()", "a git rev-parse of a ref other than HEAD"],
    ["merge-base in a template", "const cmd = `git merge-base HEAD ${upstream}`", "a git merge-base guard"],
    ['"clients 1-10 are unchanged" with no spaces around the dash', "line(same, 'ARC-16 clients 1-10 are unchanged after regeneration')", 'a hard-coded "folders N to M identical" check'],
    ["a table of pinned sha256 hex hashes", "const PINNED = { '01-x/answer-key.json': '3f1c9e0b7d24c6a8e5f1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6a0' }", "a pinned hash literal (40 or more hex characters)"],
    ["git show of a file on main", "const old = spawnSync('git', ['show', 'main:reference/sample-clients/README.md'])", "a git show of a ref other than HEAD"],
    ["git diff against main by name", "const d = git(['diff', '--stat', 'main', '--', dir])", "a git call naming main"],
    ["git diff against HEAD~1", "const d = spawnSync('git', ['diff', 'HEAD~1', '--', dir])", "a git ref behind HEAD"],
    ["git diff against the upstream", "const d = spawnSync('git', ['diff', '@{u}', '--', dir])", "a git upstream ref"],
    // fix 7 and check item 8
    ["git diff against refs/heads/main", "const d = spawnSync('git', ['diff', 'refs/heads/main', '--', dir])", "a git ref by its refs/ name"],
    ["git diff against FETCH_HEAD", "const d = spawnSync('git', ['diff', 'FETCH_HEAD', '--', dir])", "a git ref left by fetch or merge"],
    ["git diff against ORIG_HEAD", "const d = execSync('git diff ORIG_HEAD -- reference/sample-clients')", "a git ref left by fetch or merge"],
    ["git diff against HEAD@{1}", "const d = spawnSync('git', ['diff', 'HEAD@{1}', '--', dir])", "a git reflog ref"],
    ["git show-ref", "const r = spawnSync('git', ['show-ref', '--hash', 'main'])", "a git ref listing"],
    ["git for-each-ref", "const r = execSync('git for-each-ref --format=%(objectname) refs/heads')", "a git ref by its refs/ name"],
    ["git describe", "const v = spawnSync('git', ['describe', '--tags'])", "a git describe (it reads tags)"],
    ["git grep on main", "const g = spawnSync('git', ['grep', '-n', 'TODO', 'main', '--', dir])", "a git call naming main"],
    ["git archive of main", "const a = execSync('git archive main reference/sample-clients')", "a git call naming main"],
    ['"folders 01 to 10 are the same as on main"', "line(ok, 'ARC-16 folders 01 to 10 are the same as on main')", 'a hard-coded "folders N to M identical" check'],
    ['"unchanged versus main"', "line(ok, 'ARC-16 the answer keys are unchanged versus main')", 'a hard-coded "unchanged since main" check'],
    ['"the same as main"', "line(ok, 'ARC-16 every answer key is the same as main')", 'a hard-coded "same as main" check'],
    ["a pinned 40-hex commit", "const BASE = '931d08fa1b2c3d4e5f60718293a4b5c6d7e8f90a'", "a pinned hash literal (40 or more hex characters)"],
    ["a pinned sha256- base64 digest", "const D = { '01-x/answer-key.json': 'sha256-n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=' }", "a pinned sha256 or sha512 digest"],
    ["a pinned sha512- base64 digest", "const D = 'sha512-z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuwvY7kxvUdBeoGlODJ6+SfaPg=='", "a pinned sha256 or sha512 digest"],
  ];
  test.each(VARIANTS)("ARC-16 R78 rule: a checker with %s fails", (_name, line, what) => {
    const text = `// a checker over sample data (Test)\nimport { spawnSync } from 'node:child_process'\n${line}\n`;
    expect(r78("reference/sample-clients/check-x.mjs", text)).toEqual([
      `reference/sample-clients/check-x.mjs:3: ${what} (scope.mjs checks unchanged files)`,
    ]);
  });

  test("ARC-16 R78 rule (fix 7, check item 7): a git call split across lines is read whole", () => {
    const text = [
      "// a checker over sample data (Test)",
      "const d = spawnSync('git', [",
      "  'diff',",
      "  '--quiet',",
      "  'main',",
      "  '--', dir,",
      "], { cwd: root })",
      "const s = git([",
      "  'show',",
      "  'main:reference/sample-clients/README.md',",
      "])",
    ].join("\n");
    expect(r78("reference/sample-clients/check-x.mjs", text)).toEqual([
      "reference/sample-clients/check-x.mjs:2: a git call naming main (scope.mjs checks unchanged files)",
      "reference/sample-clients/check-x.mjs:8: a git show of a ref other than HEAD (scope.mjs checks unchanged files)",
    ]);
  });

  test("ARC-16 R78 rule (fix 7, check item 8): a code line starting with * is code; it is a comment only inside /* */", () => {
    const text = [
      "// a checker over sample data (Test)",
      "const n = base",
      "  * Number(spawnSync('git', ['rev-list', '--count', 'origin/main']).stdout)",
      "/*",
      " * compares with origin/main through scope.mjs, never here",
      " */",
    ].join("\n");
    expect(r78("reference/sample-clients/check-x.mjs", text)).toEqual([
      "reference/sample-clients/check-x.mjs:3: a git ref on origin (scope.mjs checks unchanged files)",
    ]);
  });

  test('ARC-16 R78 rule: git diff HEAD, git ls-files, rev-parse HEAD, a vitest describe and a comment that says "never main" stay allowed', () => {
    const text = [
      "const q = git(['diff', '--quiet', '--ignore-cr-at-eol', 'HEAD'])",
      "const u = spawnSync('git', ['ls-files', '--others', '--exclude-standard'])",
      "const h = spawnSync('git', ['rev-parse', 'HEAD'])",
      "const t = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' })",
      "const s = spawnSync('git', ['show', 'HEAD:reference/sample-clients/README.md'])",
      "  // compares with HEAD, never main, so no card's folder list lives here",
      "await expect(page.getByRole('main')).toBeVisible()",
      "describe('main (Test)', () => { test('x', () => {}) })",
      "const url = 'https://example.test/refs' // not a git ref",
    ].join("\n");
    expect(r78("reference/sample-clients/check-x.mjs", text)).toEqual([]);
  });

  test("ARC-16 R78 rule: a hash literal in a test that does not read sample data is not a run-dependent baseline", () => {
    const promptHash = "const k = { promptHash: '3f1c9e0b7d24c6a8e5f1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6a0' }";
    expect(r78File("src/x/a.test.ts", promptHash)).toEqual([]);
    expect(r78File("src/x/a.test.ts", `// reads reference/sample-clients/01-x\n${promptHash}`)).toEqual([
      "src/x/a.test.ts:2: a pinned hash literal (40 or more hex characters) (scope.mjs checks unchanged files)",
    ]);
  });

  test("ARC-16 R78 rule (fix 3): a test that builds its own repository may read origin/main; the same lines without the repository fail", () => {
    const reads = "test('x (Test)', () => { spawnSync('git', ['diff', '--quiet', 'origin/main'], { cwd: dir }) })";
    const withRepo = [
      "const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'x-'))",
      "spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: dir })",
      reads,
    ].join("\n");
    expect(r78File("tools/test/x.test.mjs", withRepo)).toEqual([]);
    const fail = ["tools/test/x.test.mjs:1: a git ref on origin (scope.mjs checks unchanged files)"];
    expect(r78File("tools/test/x.test.mjs", reads)).toEqual(fail);
    // Both halves are needed: a temp folder with no repository, or git init with no temp folder, reads the real history.
    expect(r78File("tools/test/x.test.mjs", `const dir = fs.mkdtempSync('x-')\n${reads}`)).toEqual([
      "tools/test/x.test.mjs:2: a git ref on origin (scope.mjs checks unchanged files)",
    ]);
    expect(r78File("tools/test/x.test.mjs", `execSync('git init')\n${reads}`)).toEqual([
      "tools/test/x.test.mjs:2: a git ref on origin (scope.mjs checks unchanged files)",
    ]);
  });

  test("ARC-16 R78 rule (fix 3): the file list is git's, SELF is the one named entry, and a planted test anywhere is in reach", () => {
    expect(Object.keys(R78_ALLOW)).toEqual([SELF]);
    const files = repoFiles();
    expect(files).toContain(SELF);
    expect(files.some((f) => f.startsWith("node_modules/"))).toBe(false);
    expect(files.some((f) => /^assets\//i.test(f))).toBe(false);
    const listed = r78Files([
      ...files,
      "src/modules/x/planted.test.ts",
      "reference/sample-clients/lib/check-x.mjs",
      "reference/sample-clients/__fixtures__/x.mjs",
      "tools/scope.mjs",
    ]);
    expect(listed).toContain("src/modules/x/planted.test.ts");
    expect(listed).toContain("reference/sample-clients/lib/check-x.mjs");
    expect(listed).not.toContain("reference/sample-clients/__fixtures__/x.mjs");
    expect(listed).not.toContain("tools/scope.mjs");
    expect(listed).not.toContain(SELF);
    expect(r78File("src/modules/x/planted.test.ts", "test('x (Test)', () => { execSync('git diff origin/main -- src/x') })")).toEqual([
      "src/modules/x/planted.test.ts:1: a git ref on origin (scope.mjs checks unchanged files)",
    ]);
   }, 30_000);

  test("ARC-16 R78 rule (G6 a): init counts only as a git call's subcommand in code, so these temp folders do not exempt the file", () => {
    const reads = "spawnSync('git', ['diff', '--quiet', 'origin/main'], { cwd: ROOT })";
    const tmp = "const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'x-'))";
    const fail = ["tools/test/x.test.mjs:3: a git ref on origin (scope.mjs checks unchanged files)"];
    for (const second of [
      "const step = 'init'",
      "// then git init in it",
      "spawnSync('npm', ['init', '-y'], { cwd: dir })",
    ])
      expect(r78File("tools/test/x.test.mjs", [tmp, second, reads].join("\n"))).toEqual(fail);
    for (const second of [
      "execSync('git init -q', { cwd: dir })",
      "git(['-C', dir, 'init', '-q'])",
      "spawnSync('git', ['-c', 'init.defaultBranch=main', 'init'], { cwd: dir })",
    ])
      expect(r78File("tools/test/x.test.mjs", [tmp, second, reads].join("\n"))).toEqual([]);
  });

  test("ARC-16 R78 rule (G6 b): sample data named by path segments is sample data (src/contracts/facts.acceptance.test.ts:25)", () => {
    const pinned = "const BASE = '931d08fa1b2c3d4e5f60718293a4b5c6d7e8f90a'";
    for (const first of [
      "const SAMPLES = path.join(ROOT, 'reference', 'sample-clients')",
      'const KINDS = path.join(ROOT, "testworld", "kinds")',
    ])
      expect(r78File("src/contracts/x.acceptance.test.ts", `${first}\n${pinned}`)).toEqual([
        "src/contracts/x.acceptance.test.ts:2: a pinned hash literal (40 or more hex characters) (scope.mjs checks unchanged files)",
      ]);
    expect(r78File("src/contracts/x.acceptance.test.ts", `const P = path.join(ROOT, 'reference', 'taxprep')\n${pinned}`)).toEqual([]);
  });

  test.each([
    ["git push to main", "spawnSync('git', ['push', 'origin', 'main'])"],
    ["git merge of main", "git(['merge', '--ff-only', 'main'])"],
    ["git cherry against master", "execSync('git cherry -v master')"],
    ["git branch at main", "spawnSync('git', ['branch', '-f', 'x', 'main'])"],
    ["git worktree on main", "git(['worktree', 'add', dir, 'main'])"],
  ])("ARC-16 R78 rule (G6 c): any git call naming main fails, whatever its subcommand: %s", (_name, line) => {
    expect(r78("reference/sample-clients/check-x.mjs", `// a checker over sample data (Test)\n${line}\n`)).toEqual([
      "reference/sample-clients/check-x.mjs:2: a git call naming main (scope.mjs checks unchanged files)",
    ]);
  });
  test("ARC-16 R78 rule (G6 c): git init naming main is the one exception", () => {
    expect(
      r78("reference/sample-clients/check-x.mjs", "spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: dir })\nexecSync('git init -b master')"),
    ).toEqual([]);
  });

  // Rewritten in round 3 (A518 fix 10 supersedes it): it checked buildsOwnRepo with the reader under test. Now a second
  // plain oracle judges every scanned file and the two G6 a plants; any file the two disagree on fails by name. The count
  // is never pinned (a landing trap).
  test("ARC-16 R78 rule (G6 a, A518 fix 10): buildsOwnRepo agrees with a plain oracle (mkdtempSync( and git(<dir>, 'init') on every scanned file and on the G6 a plants", () => {
    const oracle = (t) => t.includes("mkdtempSync(") && /git\(\w+, 'init'/.test(t);
    const texts = [
      ...r78Files().map((f) => [f, read(f)]),
      ["plant: a test title naming git init", G6A_TITLE_PLANT],
      ["plant: mkdtemp in a string", G6A_STRING_PLANT],
    ];
    expect(texts.filter(([, t]) => buildsOwnRepo(t)).length, "no temp-repo test found").toBeGreaterThan(0);
    const disagree = texts
      .filter(([, t]) => buildsOwnRepo(t) !== oracle(t))
      .map(([f, t]) => `${f}: buildsOwnRepo ${String(buildsOwnRepo(t))}, oracle ${String(oracle(t))}`);
    expect(disagree).toEqual([]);
  }, 30_000);

  test('ARC-16 R78 no checker over sample data and no test holds a git ref other than HEAD or a frozen "unchanged" guard (KNOWN entries aside)', () => {
    const files = r78Files();
    expect(scanProblems("R78 checkers and tests", files, "reference/sample-clients/verify.mjs")).toEqual([]);
    expect(files).toContain("tools/test/sample-prior-year.test.mjs");
    expect(files.filter((f) => isTest(f)).length, "too few test files read").toBeGreaterThan(20);
    const exempt = files.filter((f) => buildsOwnRepo(read(f)));
    expect(exempt, "no temp-repo test found").toContain("tools/test/claim.test.mjs");
    const problems = files.flatMap((f) => r78File(f, read(f)));
    expect(onlyKnown("R78", problems)).toEqual([]);
   }, 30_000);
});

// Round 3 (A518) fixes 8 and 9, and the A528 fixes: the shell and init readers of R78. Fixes 1 to 7 belonged to R77's
// prose reader, which moved to SC7 as a data rule (A528).
describe("SC6 round 3: shell segments, refs and init calls (ARC-16, A518, A528)", () => {
  // fix 8 (G6 c): main or master as a ref in any spelling, each shell segment judged alone.
  test.each([
    ["git diff main~1", "execSync('git diff main~1 -- x')"],
    ["git diff main^", "spawnSync('git', ['diff', 'main^', '--', dir])"],
    ["git log master~2", "execSync('git log master~2 -- x')"],
    ["git diff heads/main", "spawnSync('git', ['diff', 'heads/main'])"],
    ["git diff remotes/upstream/main", "spawnSync('git', ['diff', 'remotes/upstream/main'])"],
    ["git log main@{yesterday}", "git(['log', 'main@{yesterday}'])"],
    ["git init then git diff main (&&)", "execSync('git init -q && git diff --quiet main -- x')"],
    ["git init then git diff main (;)", "execSync('git init -q; git diff --quiet main -- x')"],
    ["git init or git diff master (||)", "execSync('git init -q || git diff master -- x')"],
  ])("ARC-16 R78 rule (A518 fix 8): %s fails as a git call naming main", (_name, line) => {
    expect(r78("reference/sample-clients/check-x.mjs", `// a checker over sample data (Test)\n${line}\n`)).toEqual([
      "reference/sample-clients/check-x.mjs:2: a git call naming main (scope.mjs checks unchanged files)",
    ]);
  });
  test("ARC-16 R78 rule (A518 fix 8, control): git init -q -b main and git show HEAD:src/main.ts pass", () => {
    expect(
      r78(
        "reference/sample-clients/check-x.mjs",
        [
          "execSync('git init -q -b main')",
          "spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: dir })",
          "spawnSync('git', ['show', 'HEAD:src/main.ts'])",
          "execSync('git init -q && git add -A && git commit -qm x')",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  // A528 (check items 5 and 6): a shell string splits at its separators glued or spaced; a quoted ref is the ref.
  test.each([
    ["a glued &&", "execSync('git init -q&&git diff main')"],
    ["a glued ;", "execSync('git init -q;git diff main')"],
    ["a glued ||", "execSync('git init -q||git diff master')"],
    ["a glued |", "execSync('git init -q|git diff main')"],
    ["a double-quoted ref", "execSync('git diff --quiet \"main\" -- x')"],
    ["a single-quoted ref", 'execSync("git diff --quiet \'main\' -- x")'],
    ["a quoted ref after an init segment", "execSync('git init -q && git diff \"main\"')"],
  ])("ARC-16 R78 rule (A528): %s fails as a git call naming main", (_name, line) => {
    expect(r78("reference/sample-clients/check-x.mjs", `// a checker over sample data (Test)\n${line}\n`)).toEqual([
      "reference/sample-clients/check-x.mjs:2: a git call naming main (scope.mjs checks unchanged files)",
    ]);
  });
  test("ARC-16 R78 rule (A528, control): glued separators and quotes around a branch that is not main pass", () => {
    expect(
      r78(
        "reference/sample-clients/check-x.mjs",
        [
          "execSync('git init -q&&git add -A&&git commit -qm x')",
          "execSync('git init -q;git status')",
          "execSync('git diff --quiet \"HEAD\" -- x')",
          "execSync(\"git init -q -b 'main'\")",
        ].join("\n"),
      ),
    ).toEqual([]);
  });
  // A528: an init call is a bare exec or execSync call, or one on a child_process import; never `.exec(` after a dot (a
  // regex's exec is no call).
  const REGEX_EXEC_PLANT = [
    "const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'x-'))",
    String.raw`const m = /^git (\w+)/.exec('git init -q')`,
    "spawnSync('git', ['diff', '--quiet', 'origin/main'], { cwd: dir })",
  ].join("\n");
  test("ARC-16 R78 rule (A528): a regex's .exec('git init -q') is no init call, so a file with mkdtempSync and it is not exempt", () => {
    expect(buildsOwnRepo(REGEX_EXEC_PLANT)).toBe(false);
    expect(r78File("tools/test/x.test.mjs", REGEX_EXEC_PLANT)).toEqual([
      "tools/test/x.test.mjs:3: a git ref on origin (scope.mjs checks unchanged files)",
    ]);
  });
  test.each([
    ["a bare execSync", "import { execSync } from 'node:child_process'", "execSync('git init -q', { cwd: dir })"],
    ["a bare exec", "import { exec } from 'node:child_process'", "exec('git init -q', { cwd: dir }, cb)"],
    ["execSync on a namespace import", "import * as cp from 'node:child_process'", "cp.execSync('git init -q', { cwd: dir })"],
    ["execSync on a default import", "import cp from 'child_process'", "cp.execSync('git init -q', { cwd: dir })"],
    ["execSync on a require", "const cp = require('node:child_process')", "cp.execSync('git init -q', { cwd: dir })"],
  ])("ARC-16 R78 rule (A528, control): mkdtempSync with %s builds its own repository", (_name, imp, init) => {
    const text = [imp, "const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'x-'))", init, "spawnSync('git', ['diff', 'origin/main'], { cwd: dir })"].join("\n");
    expect(buildsOwnRepo(text)).toBe(true);
    expect(r78File("tools/test/x.test.mjs", text)).toEqual([]);
  });
  test("ARC-16 R78 rule (A528): .execSync( on an object that is no child_process import is no init call", () => {
    const text = ["const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'x-'))", "other.execSync('git init -q')", "spawnSync('git', ['diff', 'origin/main'], { cwd: dir })"].join("\n");
    expect(buildsOwnRepo(text)).toBe(false);
  });

  // fix 9 (G6 a): mkdtemp counts only as a call; init only in an executed call.
  test.each([
    ["a test title naming git init", () => G6A_TITLE_PLANT],
    ["mkdtemp in a string beside a real init", () => G6A_STRING_PLANT],
  ])("ARC-16 R78 rule (A518 fix 9): %s does not exempt the file", (_name, text) => {
    expect(buildsOwnRepo(text())).toBe(false);
    expect(r78File("tools/test/x.test.mjs", text())).toEqual([
      "tools/test/x.test.mjs:3: a git ref on origin (scope.mjs checks unchanged files)",
    ]);
  });
  test.each([
    ["git(dir, 'init', ...)", "git(dir, 'init', '-q', '-b', 'main')"],
    ["spawnSync('git', [..., 'init'])", "spawnSync('git', ['-c', 'init.defaultBranch=main', 'init'], { cwd: dir })"],
    ["an execSync string with a git init segment", "execSync('cd x && git init -q', { cwd: dir })"],
  ])("ARC-16 R78 rule (A518 fix 9, control): mkdtempSync( with %s builds its own repository", (_name, init) => {
    const text = ["const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'x-'))", init, "spawnSync('git', ['diff', 'origin/main'], { cwd: dir })"].join("\n");
    expect(buildsOwnRepo(text)).toBe(true);
    expect(r78File("tools/test/x.test.mjs", text)).toEqual([]);
  });
});

describe("SC6 KNOWN shape (A407)", () => {
  test("ARC-12 KNOWN shape rule: a planted entry with a regex, a pattern file, a done owner, an unknown key or a duplicate is caught; a clean one is not", () => {
    const exists = (f) => f === "reference/sample-clients/verify.mjs";
    const clean = {
      rule: "R78",
      file: "reference/sample-clients/verify.mjs",
      problems: ["reference/sample-clients/verify.mjs:9: a git ref on origin (scope.mjs checks unchanged files)"],
      owner: "W16",
    };
    expect(knownShapeProblems([clean], PINNED, exists)).toEqual([]);
    const planted = [
      { ...clean, problems: [/verify\.mjs:\d+/] },
      { ...clean, file: "reference/sample-clients/*.mjs", problems: ["reference/sample-clients/*.mjs:1: x"] },
      { ...clean, owner: "W14", problems: ["reference/sample-clients/verify.mjs:10: x"] },
      { ...clean, owner: "NOPE", match: "x", problems: ["reference/sample-clients/verify.mjs:11: x"] },
      { ...clean, rule: "R99", problems: ["plan/cards/W00c.md: x"] },
      clean,
      clean,
    ];
    expect(knownShapeProblems(planted, PINNED, exists)).toEqual([
      "KNOWN[0] R78 reference/sample-clients/verify.mjs: a problem that is not a literal string (/verify\\.mjs:\\d+/)",
      "KNOWN[1] R78 reference/sample-clients/*.mjs: the file is not one plain path",
      "KNOWN[2] R78 reference/sample-clients/verify.mjs: the owner W14 is done, so it can never fix the defect",
      "KNOWN[3] R78 reference/sample-clients/verify.mjs: the key match is not one of rule, file, problems, owner",
      'KNOWN[3] R78 reference/sample-clients/verify.mjs: the owner "NOPE" is not a card in plan/slices.json',
      "KNOWN[4] R99 reference/sample-clients/verify.mjs: the rule is not R78",
      'KNOWN[4] R99 reference/sample-clients/verify.mjs: the problem "plan/cards/W00c.md: x" does not name its file first',
      'KNOWN[6] R78 reference/sample-clients/verify.mjs: the problem "reference/sample-clients/verify.mjs:9: a git ref on origin (scope.mjs checks unchanged files)" is listed twice',
    ]);
  });

  test("ARC-12 KNOWN rule: an unlisted problem fails, a listed string no longer produced fails as stale", () => {
    const k = [{ rule: "R78", file: "a.mjs", problems: ["a.mjs:1: x"], owner: "W16" }];
    expect(onlyKnown("R78", ["a.mjs:1: x"], k)).toEqual([]);
    expect(onlyKnown("R78", ["a.mjs:1: x", "a.mjs:2: y"], k)).toEqual(["a.mjs:2: y"]);
    expect(onlyKnown("R78", [], k)).toEqual([
      'stale KNOWN entry R78 a.mjs (owner W16): "a.mjs:1: x" no longer fails; remove it',
    ]);
  });

  test("ARC-12 KNOWN on main has the shape and is empty", () => {
    expect(knownShapeProblems(KNOWN, liveStatuses(), (f) => fs.existsSync(path.join(ROOT, f)))).toEqual([]);
    expect(KNOWN).toEqual([]);
  });
});
