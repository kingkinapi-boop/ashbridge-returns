// SC6: card and verify rules R77, R78 and R81 (unit project). Card plan/cards/SC6.md; clauses ARC-15, ARC-16.
// Sources: reports/W16-findings.md ("Rule tests to add"), reports/SC6-spec-review.md (gaps 1 to 6, A408),
// reports/FX8-findings.md (R81, A417, A430). Each rule is first shown failing on its planted examples under
// tools/test/__fixtures__/card-rules/ (copies taken from git history) or on small typed cards, then applied to the repo.
//
// R77 (ARC-15: the tests decide when a card is done, so the spec job's files must be the spec job's alone): no open
//   card gives the same file both to the spec job and to the build. Spec-owned files are every file the "Who does
//   what" spec bullet names, plus the expectation-class files (tools/lib.mjs isExpectationFile: tests, fixtures,
//   goldens, verify scripts, READMEs) a Spec, Test fixtures or Golden files section names. Build files are every file
//   the Build section, the "Who does what" build bullet, or any sentence or bullet anywhere in the card (the preamble,
//   bold Lead directives, "Fix round" and "From findings" sections) that starts with "Build" or "Builder" names,
//   leaving out only the clauses (split at sentences, commas, semicolons, colons, brackets and "and") that hand a file
//   to the spec job or say the build never edits it. File names match in any case, with any slash spelling, and by
//   suffix at a "/" (sample-clients/verify.mjs is reference/sample-clients/verify.mjs). Only cards that are not done
//   or parked are read: a landed card's text is history, not a build order. Family cards are read from their family
//   template with the card's params.
//   Planted: plan/cards/W16.md as on main before A404 (b170854): the README is both the spec's and the build's.
// R78 (ARC-16: a check over sample data is deterministic and depends on the data, not on git history): no checker
//   script over sample data (reference/sample-clients, testworld) and no test file anywhere (*.test.*, *.spec.*)
//   holds a git call that names a ref other than HEAD (origin/..., main, merge-base, rev-parse of anything but HEAD,
//   "show REF:", HEAD~N, HEAD^, @{u}), a hard-coded "unchanged since main" or "folders N to M identical" check, or (in a
//   file over sample data) a pinned 64-hex hash literal: unchanged files are tools/scope.mjs's job. `git diff HEAD`
//   stays allowed (W16 gap 1). The queue tools that read origin/main on purpose, and their tests, are a named allow
//   list. Planted: reference/sample-clients/verify.mjs as on main before W16 round 2 (7f15c0a), and ten variants.
// R81 (ARC-15, A417 lesson 35): each expectation file in an open card's Paths (a verify script, a README with counts, a
//   test, a fixture or golden folder) is owned by exactly one of the Spec side (CQ4's Spec-names parser, sectionNames
//   in tools/lib.mjs, plus the "Who does what" spec bullet) and the Build side (as R77 reads it). Owned by neither or
//   by both fails. Planted: plan/cards/FX8.md as first carded (650f3d5a): its README count had no owner.
//
// KNOWN (A407, SC6 "KNOWN shape"): each entry names one rule, one file, the exact problem strings (no regex) and an
// open owner card; any problem not listed fails, and a listed string not produced fails as stale. Every file scan
// asserts it read at least one file and a named sentinel. SC6 depends on W16, so KNOWN starts empty.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { globToRegExp, isExpectationFile, sectionNames } from "../lib.mjs";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const FIX = path.join(ROOT, "tools", "test", "__fixtures__", "card-rules");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const fix = (name) => fs.readFileSync(path.join(FIX, name), "utf8");
const PLANTED_CARD = "planted-W16-before-A404.md.txt";
const PLANTED_VERIFY = "planted-verify-before-W16-r2.mjs.txt";
const PLANTED_FX8 = "planted-FX8-first-carded.md.txt";
const SELF = "tools/test/card-rules.test.mjs";

// ---------- cards and statuses ----------
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
/** Every open card (not done or parked) with its text and its Paths from plan/slices.json. */
function openCards(statuses = liveStatuses()) {
  return SLICES()
    .cards.filter((c) => isOpen(statuses, c.id))
    .map((c) => ({ id: c.id, paths: c.paths ?? [], src: cardSource(c) }))
    .filter((c) => c.src);
}

// ---------- KNOWN: known defects on main, each owned by an open card (validated on main 931d08fa, 3 Oct) ----------
/** @type {{ rule: string, file: string, problems: string[], owner: string }[]} */
const KNOWN = [];
const KNOWN_RULES = new Set(["R77", "R78", "R81"]);
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
      out.push(`${at}: the rule is not one of R77, R78, R81`);
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
/** A file scan reads at least one file and its named sentinel (findings SC RC3). */
const scanProblems = (label, files, sentinel) =>
  files.length === 0
    ? [`${label}: the scan read no file`]
    : files.includes(sentinel)
      ? []
      : [`${label}: the scan missed its sentinel ${sentinel}`];

// ---------- files ----------
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".stryker-tmp",
  "coverage",
  "test-results",
  "playwright-report",
  ".claude",
]);
function walk(dirRel, out = []) {
  const abs = path.join(ROOT, dirRel);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const r = dirRel === "." ? e.name : `${dirRel}/${e.name}`;
    if (e.isDirectory()) walk(r, out);
    else out.push(r);
  }
  return out;
}
const isTest = (f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f);
const isFixture = (f) => /(^|\/)(__fixtures__|__golden__)\//.test(f);

// ---------- R77: one owner per file ----------
const FILE_RE =
  /(?:[\w.*@-]+[/\\])*[\w*@-]+(?:\.[\w-]+)*\.(?:mjs|cjs|js|jsx|ts|tsx|json|jsonl|md|csv|sql|txt|ya?ml|pdf|xlsx|toml|html)\b|\breadme\b/gi;
const SPEC_HEADING = /^(spec\b|golden files|test fixtures)|spec-writer/i;
const BUILD_HEADING = /^build\b/i;
const WHO_HEADING = /who does what/i;
const SPEC_BULLET = /^\s*[-*+]\s+(\*\*)?(the\s+)?spec(\s+job|-writer)?\b/i;
const BUILD_BULLET = /^\s*[-*+]\s+(\*\*)?(the\s+)?build(\s+job|er)?\b/i;
// A sentence or bullet anywhere in the card that starts with "Build" or "Builder" is a build order (review gap 1).
const BUILD_START = /^(the\s+)?build(er|\s+job)?\b/i;
// A clause that hands a file to the spec job (review gap 2: only the clause, never the whole sentence).
const SPEC_OWNS =
  /\bspec(\s+job|-writer|\s+writer)?('s)?\s+(job\s+)?(owns?|writes?|wrote|keeps?|holds?|updates?|rewrites?|adds?|sets?|edits?|fills?|puts?)\b|\bspec[- ]owned\b|\b(is|are|stays?|remains?)\s+(the\s+)?spec(\s+job|-writer)?'s\b|\bbelongs?\s+to\s+the\s+spec\b|\bby\s+the\s+spec(\s+job|-writer)?\b|\b(the\s+)?spec(\s+job|-writer)?'s\s+(files?|lines?|counts?|tables?|tests?)\b/i;
// A clause that says the build never edits a file.
const NEVER_EDITS =
  /\b(never|not|without|no line of|nor)\b[^.;,]*\b(edit|edits|editing|edited|change|changes|touch|touches|write|writes|rewrite|rewrites|update|updates|modify|modifies)\b/i;
// A clause with a verb of its own starts fresh; one without (", and README.md") inherits the clause before it.
const OWN_VERB =
  /\b(write|writes|rewrite|rewrites|update|updates|add|adds|edit|edits|change|changes|fix|fixes|commit|commits|bring|brings|regenerate|regenerates|run|runs|create|creates|remove|removes|delete|deletes|replace|replaces|move|moves|copy|copies|set|sets|list|lists|put|puts|record|records|patch|patches|generate|generates|make|makes|owns?|keeps?|holds?|fills?)\b/i;

function sections(text) {
  const out = [];
  let cur = { heading: "", lines: [] };
  for (const line of text.split(/\r?\n/)) {
    const m = /^##\s+(.*)$/.exec(line);
    if (m) {
      out.push(cur);
      cur = { heading: m[1], lines: [] };
    } else cur.lines.push(line);
  }
  out.push(cur);
  return out.map((s) => ({ heading: s.heading, body: s.lines.join("\n") }));
}
const bullets = (body) => body.split(/\n(?=\s*[-*+] )/);
const sentences = (text) => text.split(/(?<=[.;:!?])\s+/);
const normPath = (r) =>
  /^readme$/i.test(r)
    ? "README.md"
    : r.replace(/\\/g, "/").replace(/^\.\//, "");
const refs = (text) => [...new Set((text.match(FILE_RE) ?? []).map(normPath))];

/** The text of the clauses that hand a file to the spec job ("the spec job writes X and the README count"), in any section. */
function specClauses(text) {
  const kept = [];
  for (const s of sentences(text)) {
    let owned = false;
    for (const clause of s.split(/\s*(?:[,;:()]|\band\b)\s*/i)) {
      if (!clause.trim()) continue;
      if (SPEC_OWNS.test(clause)) owned = true;
      else if (OWN_VERB.test(clause) || NEVER_EDITS.test(clause)) owned = false;
      if (owned) kept.push(clause);
    }
  }
  return kept.join("\n");
}
/** The text of the clauses that give a file to the build: spec-owned and never-edit clauses are dropped, and so is
 * a verbless clause that follows a dropped one ("never edit verify.mjs and README.md"). */
function buildWrites(text) {
  const kept = [];
  for (const s of sentences(text)) {
    let dropped = false;
    for (const clause of s.split(/\s*(?:[,;:()]|\band\b)\s*/i)) {
      if (!clause.trim()) continue;
      if (SPEC_OWNS.test(clause) || NEVER_EDITS.test(clause)) dropped = true;
      else if (OWN_VERB.test(clause)) dropped = false;
      if (!dropped) kept.push(clause);
    }
  }
  return kept.join("\n");
}
const stripMarks = (s) => s.replace(/^[\s*_(`]+/, "");
/** Build orders outside the Build and "Who does what" sections: every sentence or bullet starting "Build"/"Builder". */
function buildSentences(body) {
  const out = [];
  for (const line of body.split(/\r?\n/)) {
    const isBullet = /^\s*(?:[-*+]|\d+[.)])\s+/.test(line);
    const ss = line
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
      .split(/(?<=[.!?])\s+/);
    ss.forEach((s, i) => {
      if (!BUILD_START.test(stripMarks(s))) return;
      out.push(isBullet && i === 0 ? ss.join(" ") : s);
    });
  }
  return out.join("\n");
}

/** The files a card gives to the spec job and the files it gives to the build. */
function cardOwnership(text) {
  let who = "";
  let spec = "";
  let build = "";
  for (const s of sections(text)) {
    if (SPEC_HEADING.test(s.heading)) spec += `\n${s.body}`;
    else if (BUILD_HEADING.test(s.heading)) build += `\n${buildWrites(s.body)}`;
    else if (WHO_HEADING.test(s.heading)) {
      for (const b of bullets(s.body)) {
        if (SPEC_BULLET.test(b)) who += `\n${b}`;
        else if (BUILD_BULLET.test(b)) build += `\n${buildWrites(b)}`;
        else build += `\n${buildWrites(buildSentences(b))}`;
      }
    } else build += `\n${buildWrites(buildSentences(s.body))}`;
  }
  // A README a Spec section names is what it tests (GL3's db/bridge/README.md); a README is the spec job's only when a
  // "Who does what" spec bullet or a clause hands it over (W16's README line, FX8's count).
  const inSpec = refs(spec).filter(
    (r) => isExpectationFile(r) && !/(^|\/)readme\.md$/i.test(r),
  );
  const handed = refs(specClauses(text)).filter((r) => isExpectationFile(r));
  const specOwned = [...new Set([...refs(who), ...inSpec, ...handed])];
  return { spec: specOwned, build: refs(build), who, handed };
}
/** One file named two ways: equal in any case, or one ends with the other at a "/". */
const sameFile = (a, b) => {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x === y || x.endsWith(`/${y}`) || y.endsWith(`/${x}`);
};

function r77(rel, text) {
  const { spec, build } = cardOwnership(text);
  const out = [];
  for (const b of build) {
    const s = spec.find((x) => sameFile(b, x));
    if (s)
      out.push(
        `${rel}: the Build section names ${b}, which the spec job owns (${s})`,
      );
  }
  return out;
}

// ---------- R81: every expectation file in Paths has exactly one owner ----------
/** Whether a name a section gives covers a Paths entry (a file, or a glob such as a fixtures folder). */
function covers(name, entry) {
  if (!entry.includes("*")) return sameFile(name, entry);
  const n = name
    .replace(/\\/g, "/")
    .replace(/\/+$/, "")
    .replace(/\/\*\*$/, "");
  const lit = entry.split("*")[0].replace(/\/+$/, "");
  return globToRegExp(entry).test(n) || sameFile(n, lit);
}
// Tests, fixtures and goldens are the spec job's by standing rule (.claude/rules/testing.md: acceptance tests, goldens
// and their fixtures belong to the spec-writer), so they always have an owner. A verify script or a README has none
// unless the card names one (FX8-findings RC2, lesson 35).
const NEEDS_NAMED_OWNER = (f) =>
  /(^|\/)verify[^/]*\.mjs$/i.test(f) || /(^|\/)readme\.md$/i.test(f);
/** R81 finds the expectation files no section owns; a file both sides own is R77's problem (tools/lib.mjs specOwnedFiles). */
function r81(rel, text, paths) {
  const { build, who, handed } = cardOwnership(text);
  const backticked = (t) => [...t.matchAll(/`([^`\s]+)`/g)].map((m) => m[1]);
  const specNames = [
    ...sectionNames(text, "Spec"),
    ...refs(who),
    ...backticked(who),
    ...handed,
  ];
  const out = [];
  for (const entry of paths.filter(
    (p) => isExpectationFile(p) && NEEDS_NAMED_OWNER(p),
  )) {
    const bySpec = specNames.some((n) => covers(n, entry));
    const byBuild = build.some((n) => covers(n, entry));
    if (!bySpec && !byBuild)
      out.push(
        `${rel}: ${entry} is an expectation file in Paths that neither the Spec nor the Build section owns`,
      );
  }
  return out;
}
const pathsLine = (text) =>
  (/^Paths:\s*(.*)$/m.exec(text)?.[1] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// ---------- R78: no frozen history guard in a checker over sample data or in any test ----------
const COMMENT = /^\s*(\/\/|\*|\/\*|#)/;
const GIT_SUB =
  "(?:diff|show|log|merge-base|rev-parse|rev-list|cat-file|ls-tree|checkout|reset|fetch|switch|restore|blame)";
// Text checks run on every line, comments included (a comment can carry the frozen claim the code relies on).
const R78_TEXT = [
  [
    /\b(folders?|clients?)\s+\d+\s*(to|through|-|–)\s*\d+\s+(are\s+|is\s+)?(byte-)?(identical|unchanged)\b/i,
    'a hard-coded "folders N to M identical" check',
  ],
  [
    /\b(byte-)?(identical|unchanged)\s+(to|since|from|with)\s+(origin\/)?main\b/i,
    'a hard-coded "unchanged since main" check',
  ],
];
// Git-ref checks run on code lines only (a comment that says "never main" is not a call).
const R78_CODE = [
  [/\bmerge-base\b/, "a git merge-base guard"],
  [
    /\brev-parse\b(?![\s'"`,]*(?:--\S+[\s'"`,]*)*HEAD\b(?![~^@]))/,
    "a git rev-parse of a ref other than HEAD",
  ],
  [/\borigin\/[\w.-]/, "a git ref on origin"],
  [/@\{(u|upstream|push)\}/, "a git upstream ref"],
  [/\bHEAD(~\d*|\^)/, "a git ref behind HEAD"],
  [
    new RegExp(
      `(?:\\bgit\\s+show\\s+|['"\`]show['"\`]\\s*,\\s*['"\`])(?!HEAD:)[^\\s'"\`:]+:`,
    ),
    "a git show of a ref other than HEAD",
  ],
  [
    new RegExp(
      `(?:\\bgit\\s+${GIT_SUB}\\b|['"\`]${GIT_SUB}['"\`])[^\\n]*?(?:\\s|['"\`])(?:main|master)(?:['"\`\\s:]|$)`,
    ),
    "a git call naming main",
  ],
];
const HEX_LITERAL = [/['"`][0-9a-f]{64}['"`]/i, "a pinned 64-hex hash"];

function r78(rel, text, { overSampleData = true } = {}) {
  const out = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const checks = [
      ...R78_TEXT,
      ...(COMMENT.test(line) ? [] : R78_CODE),
      ...(overSampleData ? [HEX_LITERAL] : []),
    ];
    for (const [re, what] of checks) {
      if (re.test(line)) {
        out.push(
          `${rel}:${String(i + 1)}: ${what} (scope.mjs checks unchanged files)`,
        );
        break;
      }
    }
  });
  return out;
}
// The queue tools read origin/main on purpose (claim, scope, mutate-changed), and their tests drive them in temp
// repos; this file quotes its own plants. Each entry names one file and why (review gap 6).
const R78_ALLOW = {
  "tools/scope.mjs": "the scope tool: unchanged files are its job",
  "tools/claim.mjs": "the claim tool validates a spec on origin/main",
  "tools/mutate-changed.mjs":
    "mutation runs on files changed since the merge base",
  "tools/test/claim.test.mjs":
    "claim.mjs test (line 99 reads origin/main on purpose)",
  "tools/test/claim-wait.test.mjs": "claim.mjs test in a temp repo",
  "tools/test/claim-race.test.mjs": "claim.mjs test in a temp repo",
  "tools/test/claim-needs-lead.test.mjs": "claim.mjs test in a temp repo",
  "tools/test/scope.test.mjs": "scope.mjs test in a temp repo",
  "tools/test/scope-spec-files.test.mjs": "scope.mjs test in a temp repo",
  "tools/test/done-gate.test.mjs":
    "scope.mjs and mutate-changed.mjs tests in a temp repo",
  "tools/test/queue.test.mjs":
    "claim.mjs, next.mjs and scope.mjs tests in a temp repo",
  [SELF]: "this file quotes its planted variants",
};
const SAMPLE_DIRS = ["reference/sample-clients", "testworld"];
const isScript = (f) => /\.(mjs|cjs|js|ts)$/.test(f) && !f.endsWith(".d.ts");
const mentionsSampleData = (text) =>
  /reference\/sample-clients|\btestworld\//.test(text);
/** The R78 scan: checker scripts over sample data and every test file in the repo, less the allow list. */
function r78Files() {
  const checkers = SAMPLE_DIRS.flatMap((d) => walk(d)).filter(
    (f) => isScript(f) && !isTest(f) && !isFixture(f),
  );
  const tests = walk(".").filter((f) => isTest(f));
  return [...new Set([...checkers, ...tests])]
    .filter((f) => !(f in R78_ALLOW))
    .sort();
}
const r78File = (f) => {
  const text = read(f);
  const overSampleData =
    SAMPLE_DIRS.some((d) => f.startsWith(`${d}/`)) || mentionsSampleData(text);
  return r78(f, text, { overSampleData });
};

// ---------- typed plant cards ----------
const PINNED = {
  W14: "done",
  W16: "carded",
  FX8: "carded",
  SC6: "carded",
  X1: "carded",
  X9: "parked",
};
const plantCard = (lines) =>
  [
    "# X1 A card (Test)",
    "Phase 0. Size S. Deps: none.",
    "Paths: reference/sample-clients/verify.mjs, reference/sample-clients/README.md",
    ...lines,
  ].join("\n");
const CLEAN_SPEC = [
  "## Spec",
  "- The spec job writes the `reference/sample-clients/verify.mjs` rule line and the `reference/sample-clients/README.md` pass count.",
];

describe("SC6 R77: one owner per file (ARC-15)", () => {
  test("ARC-15 R77 rule: W16.md as on main before A404 fails (the README is the spec job's and the Build section names it)", () => {
    const problems = r77("plan/cards/W16.md", fix(PLANTED_CARD));
    expect(problems).toEqual([
      "plan/cards/W16.md: the Build section names README.md, which the spec job owns (README.md)",
    ]);
  });

  test("ARC-15 R77 rule: the planted W16.md passes once its Build section hands the moved-figure list to the spec job", () => {
    const planted = fix(PLANTED_CARD);
    const fixed = planted.replace(
      "and list each moved figure in the README with the reason.",
      "and report each moved figure with the reason in reports/W16-build.md (the spec job writes them into the README).",
    );
    expect(fixed).not.toBe(planted);
    expect(r77("plan/cards/W16.md", fixed)).toEqual([]);
  });

  test("ARC-15 R77 rule: a Spec section that only names the product file it tests does not own it", () => {
    const card = [
      "# X1 A card (Test)",
      "## Spec",
      "- Tests in `src/modules/x/x.acceptance.test.ts` for `src/modules/x/index.ts`.",
      "## Build",
      "- Write `src/modules/x/index.ts`.",
    ].join("\n");
    expect(r77("plan/cards/X1.md", card)).toEqual([]);
    const bad = card.replace(
      "- Write `src/modules/x/index.ts`.",
      "- Write `src/modules/x/index.ts` and fix `x.acceptance.test.ts`.",
    );
    expect(r77("plan/cards/X1.md", bad)).toEqual([
      "plan/cards/X1.md: the Build section names x.acceptance.test.ts, which the spec job owns (src/modules/x/x.acceptance.test.ts)",
    ]);
  });

  test('ARC-15 R77 rule (gap 1): a bold "Build:" directive in the preamble and a "Build:" bullet under "## Fix round 1" are build orders', () => {
    const clean = plantCard(CLEAN_SPEC);
    expect(r77("plan/cards/X1.md", clean)).toEqual([]);
    const directive = clean.replace(
      "Phase 0.",
      "**Build: rewrite README.md counts.**\n\nPhase 0.",
    );
    expect(r77("plan/cards/X1.md", directive)).toEqual([
      "plan/cards/X1.md: the Build section names README.md, which the spec job owns (reference/sample-clients/README.md)",
    ]);
    const fixRound = `${clean}\n\n## Fix round 1\n- Build: update verify.mjs KNOWN.\n`;
    expect(r77("plan/cards/X1.md", fixRound)).toEqual([
      "plan/cards/X1.md: the Build section names verify.mjs, which the spec job owns (reference/sample-clients/verify.mjs)",
    ]);
    const builder = `${clean}\n\n## From findings round 2\nThe checker found two faults. Builder: fix the pass count in README.md.\n`;
    expect(r77("plan/cards/X1.md", builder)).toEqual([
      "plan/cards/X1.md: the Build section names README.md, which the spec job owns (reference/sample-clients/README.md)",
    ]);
  });

  test("ARC-15 R77 rule (gap 2): only the negated or spec-owned clause is dropped, never the whole sentence", () => {
    const withBuild = (sentence) =>
      plantCard([...CLEAN_SPEC, "## Build", `- ${sentence}`]);
    expect(
      r77(
        "plan/cards/X1.md",
        withBuild(
          "Bring over the data; never edit verify.mjs, and rewrite README.md counts.",
        ),
      ),
    ).toEqual([
      "plan/cards/X1.md: the Build section names README.md, which the spec job owns (reference/sample-clients/README.md)",
    ]);
    expect(
      r77(
        "plan/cards/X1.md",
        withBuild("Rewrite README.md counts the spec job left stale."),
      ),
    ).toEqual([
      "plan/cards/X1.md: the Build section names README.md, which the spec job owns (reference/sample-clients/README.md)",
    ]);
    // The clean forms still pass: a whole negated list, and a clause that hands the file to the spec job.
    expect(
      r77(
        "plan/cards/X1.md",
        withBuild("Bring over the data; never edit verify.mjs and README.md."),
      ),
    ).toEqual([]);
    expect(
      r77(
        "plan/cards/X1.md",
        withBuild(
          "Regenerate the folders, and the spec job writes the README.md counts.",
        ),
      ),
    ).toEqual([]);
  });

  test("ARC-15 R77 rule (gap 3): README in any case and a path spelled by its suffix or with backslashes are the same file", () => {
    const withBuild = (sentence) =>
      plantCard([...CLEAN_SPEC, "## Build", `- ${sentence}`]);
    expect(
      r77(
        "plan/cards/X1.md",
        withBuild("Regenerate, then fix the readme pass count."),
      ),
    ).toEqual([
      "plan/cards/X1.md: the Build section names README.md, which the spec job owns (reference/sample-clients/README.md)",
    ]);
    expect(
      r77(
        "plan/cards/X1.md",
        withBuild("Update sample-clients/verify.mjs for the new folders."),
      ),
    ).toEqual([
      "plan/cards/X1.md: the Build section names sample-clients/verify.mjs, which the spec job owns (reference/sample-clients/verify.mjs)",
    ]);
    expect(
      r77(
        "plan/cards/X1.md",
        withBuild(
          "Update reference\\sample-clients\\Verify.mjs for the new folders.",
        ),
      ),
    ).toEqual([
      "plan/cards/X1.md: the Build section names reference/sample-clients/Verify.mjs, which the spec job owns (reference/sample-clients/verify.mjs)",
    ]);
    // Two different files that only share a basename stay two files.
    expect(
      r77(
        "plan/cards/X1.md",
        withBuild("Update testworld/README.md for the new kind."),
      ),
    ).toEqual([]);
  });

  test("ARC-15 R77 rule (gap 4): only open cards are read; a done or parked card's text is history", () => {
    const planted = fix(PLANTED_CARD);
    const run = (statuses) =>
      isOpen(statuses, "W16") ? r77("plan/cards/W16.md", planted) : [];
    expect(run({ ...PINNED, W16: "carded" })).toHaveLength(1);
    expect(run({ ...PINNED, W16: "done" })).toEqual([]);
    expect(run({ ...PINNED, W16: "parked" })).toEqual([]);
    expect(isOpen(PINNED, "NOPE")).toBe(false);
  });

  test("ARC-15 R77 rule: a family card is read from its template with its params filled in", () => {
    const src = cardSource({
      id: "W01",
      family: "kind",
      params: { kind: "K01" },
    });
    expect(src?.rel).toBe("plan/cards/families/kind.md");
    expect(src?.text).toContain("testworld/kinds/K01/kind.ts");
    expect(src?.text).not.toContain("{kind}");
  });

  test("ARC-15 R77 no open card gives the same file both to the spec job and to the build (KNOWN entries aside)", () => {
    const cards = openCards();
    const labels = cards.map((c) => c.src.label);
    expect(scanProblems("R77 open cards", labels, "plan/cards/SC6.md")).toEqual(
      [],
    );
    expect(labels.length, "too few open cards read").toBeGreaterThan(50);
    expect(labels.some((l) => l.startsWith("plan/cards/families/"))).toBe(true);
    const problems = [
      ...new Set(cards.flatMap((c) => r77(c.src.label, c.src.text))),
    ];
    expect(onlyKnown("R77", problems)).toEqual([]);
  });
});

describe("SC6 R81: every expectation file in Paths has exactly one owner (ARC-15, A417)", () => {
  test("ARC-15 R81 rule: FX8.md as first carded fails on its README, which neither the Spec nor the Build section owns", () => {
    const planted = fix(PLANTED_FX8);
    const paths = pathsLine(planted);
    expect(paths).toContain("reference/sample-clients/README.md");
    expect(r81("plan/cards/FX8.md", planted, paths)).toEqual([
      "plan/cards/FX8.md: reference/sample-clients/README.md is an expectation file in Paths that neither the Spec nor the Build section owns",
    ]);
  });

  test("ARC-15 R81 rule: the planted FX8.md passes once its Spec section owns the README count sentence", () => {
    const planted = fix(PLANTED_FX8);
    const fixed = planted.replace(
      "- verify.mjs gains the same rule, so a regenerated folder is refused too.",
      "- verify.mjs gains the same rule, so a regenerated folder is refused too.\n- `reference/sample-clients/README.md`: the pass count sentence, for the landing state.",
    );
    expect(fixed).not.toBe(planted);
    expect(r81("plan/cards/FX8.md", fixed, pathsLine(fixed))).toEqual([]);
  });

  test("ARC-15 R81 rule: a verify script nobody names fails; one both sections own is R77's finding; a fixtures glob is the spec job's by rule", () => {
    const paths = [
      "reference/sample-clients/verify.mjs",
      "tools/test/__fixtures__/x/**",
      "tools/test/x.test.mjs",
      "src/x/index.ts",
    ];
    const card = (
      build,
      spec = "- `reference/sample-clients/verify.mjs` gains a line; plants in `tools/test/__fixtures__/x/`.",
    ) => ["# X1 A card (Test)", "## Spec", spec, "## Build", build].join("\n");
    expect(
      r81("plan/cards/X1.md", card("- Write `src/x/index.ts`."), paths),
    ).toEqual([]);
    expect(
      r81(
        "plan/cards/X1.md",
        card(
          "- Write `src/x/index.ts`.",
          "- Tests in `tools/test/x.test.mjs`.",
        ),
        paths,
      ),
    ).toEqual([
      "plan/cards/X1.md: reference/sample-clients/verify.mjs is an expectation file in Paths that neither the Spec nor the Build section owns",
    ]);
    const both = card("- Write `src/x/index.ts` and add a line to verify.mjs.");
    expect(r81("plan/cards/X1.md", both, paths)).toEqual([]);
    expect(r77("plan/cards/X1.md", both)).toEqual([
      "plan/cards/X1.md: the Build section names verify.mjs, which the spec job owns (reference/sample-clients/verify.mjs)",
    ]);
  });

  test("ARC-15 R77 R81 rule: a README the Spec section only tests (GL3) is the build's; one a spec clause hands over is the spec job's", () => {
    const card = (specLine) =>
      [
        "# X1 A card (Test)",
        "Paths: db/x/README.md",
        "## Spec",
        specLine,
        "## Build",
        "- `db/x/README.md` (apply order, for the client repo).",
      ].join("\n");
    const tested = card(
      "- Contract base: `db/x/README.md` names the client-app commit.",
    );
    expect(r77("plan/cards/X1.md", tested)).toEqual([]);
    expect(r81("plan/cards/X1.md", tested, ["db/x/README.md"])).toEqual([]);
    const handed = card(
      "- The spec job writes the commit line in `db/x/README.md`.",
    );
    expect(r77("plan/cards/X1.md", handed)).toEqual([
      "plan/cards/X1.md: the Build section names db/x/README.md, which the spec job owns (db/x/README.md)",
    ]);
  });

  test('ARC-15 R81 rule: a "Who does what" spec bullet owns what it names', () => {
    const card = [
      "# X1 A card (Test)",
      "## Who does what",
      "- The spec job writes `tools/test/x.test.mjs` and the README count.",
      "- The build writes `src/x/index.ts`.",
    ].join("\n");
    expect(
      r81("plan/cards/X1.md", card, [
        "tools/test/x.test.mjs",
        "README.md",
        "src/x/index.ts",
      ]),
    ).toEqual([]);
    expect(
      r81("plan/cards/X1.md", card.replace(" and the README count", ""), [
        "tools/test/x.test.mjs",
        "README.md",
      ]),
    ).toEqual([
      "plan/cards/X1.md: README.md is an expectation file in Paths that neither the Spec nor the Build section owns",
    ]);
  });

  test("ARC-15 R81 every expectation file in an open card's Paths has exactly one owner (KNOWN entries aside)", () => {
    const cards = openCards();
    const labels = cards.map((c) => c.src.label);
    expect(scanProblems("R81 open cards", labels, "plan/cards/SC6.md")).toEqual(
      [],
    );
    const withExpectations = cards.filter((c) =>
      c.paths.some((p) => isExpectationFile(p)),
    );
    expect(
      withExpectations.length,
      "no open card has an expectation file in its Paths",
    ).toBeGreaterThan(0);
    const problems = [
      ...new Set(cards.flatMap((c) => r81(c.src.label, c.src.text, c.paths))),
    ];
    expect(onlyKnown("R81", problems)).toEqual([]);
  });
});

describe("SC6 R78: no frozen history guard over sample data (ARC-16)", () => {
  test("ARC-16 R78 rule: verify.mjs as on main before W16 round 2 fails on its two merge-base guards and nothing else", () => {
    const problems = r78(
      "reference/sample-clients/verify.mjs",
      fix(PLANTED_VERIFY),
    );
    expect(problems.map((p) => Number(/:(\d+):/.exec(p)?.[1]))).toEqual([
      996, 1000, 1003, 1007,
    ]);
    expect(problems[0]).toMatch(/a git merge-base guard/);
    expect(problems[1]).toMatch(/folders N to M identical/);
  });

  test("ARC-16 R78 rule: the planted verify.mjs passes once the two guards are retired, keeping the second-generation check", () => {
    const lines = fix(PLANTED_VERIFY).split("\n");
    const kept = lines.filter(
      (_, i) =>
        ![995, 996, 997, 998, 999, 1002, 1003, 1004, 1005, 1006].includes(i),
    );
    const text = kept.join("\n");
    expect(text).toMatch(
      /a second generation \(generate\.mjs, then make-csv\.mjs\) is byte-identical/,
    );
    expect(r78("reference/sample-clients/verify.mjs", text)).toEqual([]);
  });

  // Review gap 5: the rule matches behaviour, not labels. Each variant must fail; `git diff HEAD` must not.
  const VARIANTS = [
    [
      "git diff against origin/main",
      "const q = spawnSync('git', ['diff', '--quiet', 'origin/main', '--', ...old], { cwd: root })",
      "a git ref on origin",
    ],
    [
      "git show of a file on origin/main",
      "const was = execSync('git show origin/main:reference/sample-clients/01-x/answer-key.json')",
      "a git ref on origin",
    ],
    [
      "git rev-parse origin/main",
      "const tip = spawnSync('git', ['rev-parse', 'origin/main']).stdout.trim()",
      "a git rev-parse of a ref other than HEAD",
    ],
    [
      "merge-base through a variable",
      "const cmd = `git merge-base HEAD ${upstream}`",
      "a git merge-base guard",
    ],
    [
      '"clients 1-10 are unchanged" with no spaces around the dash',
      "line(same, 'ARC-16 clients 1-10 are unchanged after regeneration')",
      'a hard-coded "folders N to M identical" check',
    ],
    [
      "a table of pinned sha256 hashes",
      "const PINNED = { '01-x/answer-key.json': '3f1c9e0b7d24c6a8e5f1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6a0' }",
      "a pinned 64-hex hash",
    ],
    [
      "git show of a file on main",
      "const old = spawnSync('git', ['show', 'main:reference/sample-clients/README.md'])",
      "a git show of a ref other than HEAD",
    ],
    [
      "git diff against main by name",
      "const d = git(['diff', '--stat', 'main', '--', dir])",
      "a git call naming main",
    ],
    [
      "git diff against HEAD~1",
      "const d = spawnSync('git', ['diff', 'HEAD~1', '--', dir])",
      "a git ref behind HEAD",
    ],
    [
      "git diff against the upstream",
      "const d = spawnSync('git', ['diff', '@{u}', '--', dir])",
      "a git upstream ref",
    ],
  ];
  test.each(VARIANTS)(
    "ARC-16 R78 rule (gap 5): a checker with %s fails",
    (_name, line, what) => {
      const text = `// a checker over sample data (Test)\nimport { spawnSync } from 'node:child_process'\n${line}\n`;
      expect(r78("reference/sample-clients/check-x.mjs", text)).toEqual([
        `reference/sample-clients/check-x.mjs:3: ${what} (scope.mjs checks unchanged files)`,
      ]);
    },
  );

  test('ARC-16 R78 rule (gap 5): git diff HEAD, git ls-files, rev-parse HEAD and a comment that says "never main" stay allowed', () => {
    const text = [
      "const q = git(['diff', '--quiet', '--ignore-cr-at-eol', 'HEAD'])",
      "const u = spawnSync('git', ['ls-files', '--others', '--exclude-standard'])",
      "const h = spawnSync('git', ['rev-parse', 'HEAD'])",
      "const s = spawnSync('git', ['show', 'HEAD:reference/sample-clients/README.md'])",
      "  // compares with HEAD, never main, so no card's folder list lives here",
      "await expect(page.getByRole('main')).toBeVisible()",
    ].join("\n");
    expect(r78("reference/sample-clients/check-x.mjs", text)).toEqual([]);
  });

  test("ARC-16 R78 rule (gap 6): a planted test file anywhere with git diff origin/main fails; the allow list names real files", () => {
    const planted =
      "test('x (Test)', () => { execSync('git diff origin/main -- src/x') })";
    expect(
      r78("src/modules/x/planted.test.ts", planted, { overSampleData: false }),
    ).toEqual([
      "src/modules/x/planted.test.ts:1: a git ref on origin (scope.mjs checks unchanged files)",
    ]);
    // A recorded-answer prompt hash in a test that does not read sample data is not a run-dependent baseline.
    const promptHash =
      "const k = { promptHash: '3f1c9e0b7d24c6a8e5f1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6a0' }";
    expect(
      r78("src/x/a.test.ts", promptHash, { overSampleData: false }),
    ).toEqual([]);
    const missing = Object.keys(R78_ALLOW).filter(
      (f) => !fs.existsSync(path.join(ROOT, f)),
    );
    expect(missing, "stale R78 allow entries").toEqual([]);
    expect(r78Files().some((f) => f in R78_ALLOW)).toBe(false);
  });

  test('ARC-16 R78 no checker script over sample data and no test file holds a git ref other than HEAD or a frozen "unchanged" guard (KNOWN entries aside)', () => {
    const files = r78Files();
    expect(
      scanProblems(
        "R78 checkers and tests",
        files,
        "reference/sample-clients/verify.mjs",
      ),
    ).toEqual([]);
    expect(files).toContain("tools/test/sample-prior-year.test.mjs");
    expect(
      files.filter((f) => isTest(f)).length,
      "too few test files read",
    ).toBeGreaterThan(20);
    const problems = files.flatMap((f) => r78File(f));
    expect(onlyKnown("R78", problems)).toEqual([]);
  });
});

describe("SC6 KNOWN shape (A407)", () => {
  test("ARC-15 KNOWN shape rule: a planted entry with a regex, a pattern file, a done owner, an unknown key or a duplicate is caught; a clean one is not", () => {
    const exists = (f) => f === "reference/sample-clients/verify.mjs";
    const clean = {
      rule: "R78",
      file: "reference/sample-clients/verify.mjs",
      problems: [
        "reference/sample-clients/verify.mjs:9: a git ref on origin (scope.mjs checks unchanged files)",
      ],
      owner: "W16",
    };
    expect(knownShapeProblems([clean], PINNED, exists)).toEqual([]);
    const planted = [
      { ...clean, problems: [/verify\.mjs:\d+/] },
      {
        ...clean,
        file: "reference/sample-clients/*.mjs",
        problems: ["reference/sample-clients/*.mjs:1: x"],
      },
      {
        ...clean,
        owner: "W14",
        problems: ["reference/sample-clients/verify.mjs:10: x"],
      },
      {
        ...clean,
        owner: "NOPE",
        match: "x",
        problems: ["reference/sample-clients/verify.mjs:11: x"],
      },
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
      "KNOWN[4] R99 reference/sample-clients/verify.mjs: the rule is not one of R77, R78, R81",
      'KNOWN[4] R99 reference/sample-clients/verify.mjs: the problem "plan/cards/W00c.md: x" does not name its file first',
      'KNOWN[6] R78 reference/sample-clients/verify.mjs: the problem "reference/sample-clients/verify.mjs:9: a git ref on origin (scope.mjs checks unchanged files)" is listed twice',
    ]);
  });

  test("ARC-15 KNOWN rule: an unlisted problem fails, a listed string no longer produced fails as stale", () => {
    const k = [
      { rule: "R78", file: "a.mjs", problems: ["a.mjs:1: x"], owner: "W16" },
    ];
    expect(onlyKnown("R78", ["a.mjs:1: x"], k)).toEqual([]);
    expect(onlyKnown("R78", ["a.mjs:1: x", "a.mjs:2: y"], k)).toEqual([
      "a.mjs:2: y",
    ]);
    expect(onlyKnown("R78", [], k)).toEqual([
      'stale KNOWN entry R78 a.mjs (owner W16): "a.mjs:1: x" no longer fails; remove it',
    ]);
  });

  test("ARC-15 KNOWN on main has the shape: one rule, one file, exact strings, an open owner card", () => {
    expect(
      knownShapeProblems(KNOWN, liveStatuses(), (f) =>
        fs.existsSync(path.join(ROOT, f)),
      ),
    ).toEqual([]);
  });
});
