// SC6: spec-ownership and verify rules R77, R78 and R81 (unit project). Card plan/cards/SC6.md; clauses ARC-12 (R77,
// R81: the builder never edits the spec job's files) and ARC-16 (R78). Sources: reports/W16-findings.md ("Rule tests to
// add"), reports/SC6-spec-review.md (A408), reports/FX8-findings.md (R81, A417, A430), reports/SC6-check.md and the
// Lead directives of 3 Oct 15:04Z (A493, eight fixes) and 17:07Z (A503, G1 to G8 and grammar coverage). Each rule is first shown failing on its planted examples under
// tools/test/__fixtures__/spec-rules/ (copies taken from git history) or on small typed cards, then applied to the repo.
// This file was tools/test/card-rules.test.mjs (A493: SC10 owns that name).
//
// Cards read (fix 2, G8). Every card in plan/slices.json is read (its own file, or its family template with its params):
// the sentinel (plan/cards/SC6.md) and the floors (more than 50 card files, at least one family template, at least one
// card with an expectation file in Paths) are checked over all of them, so they hold with any statuses (every card set
// done included); every family card reads with none of its own {param} placeholders left; an open card with no source
// file fails by id; only then are the open cards (not done or parked) kept for R77 and R81: a landed card's text is
// history, not a build order.
//
// R77 (ARC-12): no open card gives a file the spec job owns to the build. Its grammar is closed (fix 4, A503 G1 to G7):
//   - Quotations. Text in double quotes names a form and gives no order: it is blanked before a line is read.
//   - Headings (G4). A heading at any level starts a section. "Who does what" is read bullet by bullet (a bullet
//     starting with the spec job is the spec job's, one starting with the build is the build's). Otherwise the first job
//     word of the heading, outside code spans and file names, names its class: spec, specs, spec-writer, acceptance,
//     golden, goldens, fixture or fixtures make it a Spec section (the spec job's); (re)build(s) or builder(s) make it
//     the build's. A heading with no job word takes its parent's job (the nearest heading above it at a lower level);
//     the card's title (its first heading, level 1) names the card and has no job.
//   - Directives. A bold Lead directive (a paragraph starting "**Lead directive") is one unit up to its blank line, and
//     the job word of its header (the bold part) owns its sentences: "spec patch", "spec round" or "spec fixup" is the
//     spec job's, "build round" is the build's (the first of them wins), a header with only "round N" is a round
//     directive, and any other header has no job.
//   - Labels (G1). A label is a job word (spec, build or rebuild, builder, check or checker, acceptance, golden,
//     fixtures), optionally followed by "files" or "job", optionally "round N" or "patch", optionally a bracket, then a
//     colon. A label at the start of a line that is not a bullet (bold allowed) gives its job to the rest of its line and
//     to the bullet lines under it, up to the first line that is not a bullet; then the section's or directive's job
//     returns. A sentence ending in a colon that is a label (after "first", "then", "and", "so", "also", "next", and
//     "a", "an" or "the") gives its job to the rest of its line. spec, acceptance, golden and fixtures labels are the
//     spec job's, build and builder labels the build's, check labels the check's. Anything else before a colon ("Build
//     rules added:", "Build risks:", "Spec commit:") is no label.
//   - Sentences split after ".", "!", "?", ".**", "**" and ": " (a colon followed by a space); clauses split at commas,
//     semicolons, brackets and "and".
//   - Job words (G3): a sentence or clause that starts with (re)build(s), builder(s) or "the build" (after "then",
//     "and", "so", "also" or "next"), a sentence ending in "(build)", and a clause with "by the build" are the build's;
//     a clause starting with "the check" or "the checker", or holding "by the check", is the check's. A clause that
//     hands a file to the spec job ("the spec job writes ...") is the spec job's. A clause with a verb of its own starts
//     fresh; one without inherits the clause before it.
//   - Negation (G2), closed. With file names masked (so a negation's scope crosses their dots), a clause is negated when
//     "never", "not", "n't", "without", "nor" or "no line of" comes before an editing verb (edit, change, touch, write,
//     rewrite, update, modify, add, regenerate, create, delete, remove, in any form), or it says "no change(s) to",
//     "no edit(s) to", "stays (remains) as it is" or "is (are) out of scope". So "no line of <file> changes", "do not add
//     a <file> line", "no change to <file>", "<file> stays as it is", "<file> is out of scope (<card> owns it)" and
//     "don't regenerate <file>" are negations. "forget to" and "fail to" are not: "never forget to update <file>" and
//     "don't forget to rewrite <file>" are orders. A negated clause is dropped (never a build order, never ownership),
//     and so is a following clause with no verb of its own.
//   - Naming a job (G3). A sentence names its job only when one of its clauses starts with a job word (spec, the spec
//     job, a spec patch, (re)build, the build, builder, the check, the checker), a label gives it, or a clause holds
//     "by the <job>" or hands a file to the spec job. A job word anywhere else ("counts the spec job left stale", "after
//     the checks pass") names nothing. In a round directive a sentence that names a spec-owned file and names no job
//     fails as ambiguous.
//   - Spec-owned files, one reading for R77 and R81 (G5): the expectation files (tools/lib.mjs isExpectationFile, a
//     README in any case, never a `*.build.test.*` file: that is the builder's own test, G7) a Spec section names (by
//     this reader and by CQ4's sectionNames), every file a "Who does what" spec bullet names, the expectation files a
//     spec clause hands over, the files inside a fixture or golden folder those name, and by standing rule (fix 5,
//     .claude/rules/testing.md) every `*.acceptance.*` file and every file under `__golden__/`, with no Spec mention. A
//     README a Spec section only names is the file under test (GL3), the build's; it is the spec job's only when a spec
//     clause, a "Who does what" spec bullet or a Spec file label ("`<file>`: what the spec job writes in it") hands it
//     over. File names match in any case, with any slash spelling, by suffix at a "/", and a glob on either side (G7)
//     owns what it matches (tools/lib.mjs globToRegExp, matched by suffix).
//   - Out of reach by design: anything else (an order with no job word outside a Build section or label, a job named
//     only in the middle of a sentence, a file named without an extension or folder slash, an order inside quotes).
//     scope.mjs R82 and the protect-spec hook catch those at check time.
//   Planted: plan/cards/W16.md as on main before A404 (b170854), the six forms of reports/SC6-check.md item 2, the real
//   directive form, the passive clause of check item 3, the folder of item 4, the standing owners of item 9, and the
//   A503 forms: the GL3, SC11 and G18 labels, S00's non-label line, the negation table, FX8's A417 check sentence,
//   DB16's colon form, the heading spellings on main, CQ11's A490 sentence and the glob pairs.
// Grammar coverage (A503, a rule for everywhere): every heading (the title aside) and every label line on an open card
//   that holds a job word (spec, build, builder, acceptance, golden, fixtures; check for labels) reads as the job its
//   first job word names, and a label gives that job to the bullets under it; anything else fails by name. Planted:
//   round 1's reader (49e9d2e7) over the real forms, which it names.
// R81 (ARC-12, A417 lesson 35): each expectation file in an open card's Paths (a verify script, a README with counts, a
//   test, a fixture folder) is owned by the Spec side (R77's spec-owned files above, G5, which use CQ4's sectionNames in
//   tools/lib.mjs over the Spec sections less their negated clauses) or by the Build side (as R77 reads it); owned by
//   neither fails, owned by both is R77's finding. A Paths glob is checked as written and over every file git lists
//   that it matches (G7). `*.acceptance.*` and `__golden__/**` files are the spec job's by standing rule (fix 5).
//   Planted: plan/cards/FX8.md as first carded (650f3d5a): its README count had no owner.
// R78 (ARC-16: a check over sample data is deterministic and depends on the data, not on git history). Reach by class
//   (fix 3): every test file the repository holds (`git ls-files --cached --others --exclude-standard`, never a disk
//   walk) and every checker script over sample data (reference/sample-clients, testworld) is scanned, except a test
//   that builds its own repository (G6 a: mkdtemp in its code and a git call whose subcommand is init) and this file
//   (SELF, the one named entry: it quotes its plants). A file is over sample data when it lies in those folders or
//   names them as a path or as path segments (G6 b: path.join(ROOT, 'reference', 'sample-clients')). A scanned file
//   holds no git call that names a ref other than HEAD, and no frozen "unchanged" claim. Each call is read whole, across
//   lines (fix 7): a git call is spawnSync/execFileSync('git', ...), git(...), or a string starting "git "; its
//   subcommand is its first word that is not an option or an option's value. It fails when it names main or master
//   with any subcommand but init (G6 c), shows "REF:file" for a REF other than HEAD, rev-parses a ref other than HEAD,
//   or runs describe. Any code line fails on origin/..., refs/..., FETCH_HEAD, ORIG_HEAD, @{u}, @{N}, HEAD~N, HEAD^,
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
import { globToRegExp, isExpectationFile, sectionNames } from "../lib.mjs";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const FIX = path.join(ROOT, "tools", "test", "__fixtures__", "spec-rules");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const fix = (name) => fs.readFileSync(path.join(FIX, name), "utf8");
const PLANTED_CARD = "planted-W16-before-A404.md.txt";
const PLANTED_VERIFY = "planted-verify-before-W16-r2.mjs.txt";
const PLANTED_FX8 = "planted-FX8-first-carded.md.txt";
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

// ---------- file names ----------
const FILE_RE =
  /(?:[\w.*@-]+[/\\])*[\w*@-]+(?:\.[\w-]+)*\.(?:mjs|cjs|js|jsx|ts|tsx|json|jsonl|md|csv|sql|txt|ya?ml|pdf|xlsx|toml|html)\b|\breadme\b/gi;
// A folder is a path that ends in "/" or "/**" (`tools/test/__fixtures__/x/`).
const FOLDER_RE = /(?:[\w.@-]+[/\\])+(?:\*\*)?(?![\w.*@-])/g;
const normPath = (r) =>
  /^readme$/i.test(r)
    ? "README.md"
    : r.replace(/\\/g, "/").replace(/^\.\//, "");
const refs = (text) => uniq((text.match(FILE_RE) ?? []).map(normPath));
/** A README in any case is a README (check item 5). */
const canonReadme = (f) => f.replace(/(^|\/)readme\.md$/i, "$1README.md");
// G7: a `*.build.test.*` file is the builder's own test (A490, CQ11), never an expectation file, so a sentence naming
// that glob never hands it to the spec job.
const isBuildTest = (f) => /\.build\.test\./i.test(f.split("/").pop() ?? "");
const isExp = (f) => !isBuildTest(f) && isExpectationFile(canonReadme(f));
const isReadme = (f) => /(^|\/)readme\.md$/i.test(f);
const folderOf = (r) => normPath(r).replace(/\/\*\*$/, "/");
/** A folder whose files are expectation files (a fixture or golden folder). */
const isExpFolder = (d) => isExpectationFile(`${d}x`);
const folders = (text) =>
  uniq((text.match(FOLDER_RE) ?? []).map(folderOf)).filter(isExpFolder);
/** Files the spec job owns by standing rule, whatever the card says (fix 5). */
const standingOwner = (f) =>
  /\.acceptance\./i.test(f.split("/").pop() ?? "")
    ? "standing owner: *.acceptance.*"
    : /(^|\/)__golden__\//i.test(f)
      ? "standing owner: __golden__/**"
      : undefined;
/** One file named two ways: equal in any case, or one ends with the other at a "/". */
const sameFile = (a, b) => {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x === y || x.endsWith(`/${y}`) || y.endsWith(`/${x}`);
};
/** A file inside a folder (both spelled as above; the folder ends in "/"). */
const inFolder = (f, d) => {
  const x = f.toLowerCase();
  const y = d.toLowerCase();
  return x.startsWith(y) || x.includes(`/${y}`) || sameFile(x, y.slice(0, -1));
};
/** G7: a glob matched by suffix at a "/" (globToRegExp, any case). */
const globSuffix = (g) =>
  new RegExp(`(?:^|/)${globToRegExp(g.toLowerCase()).source.slice(1)}`);
const starsAsName = (g) => g.replace(/\*+/g, "x");
/** One name covers another: equal, by suffix, a folder holding it, or a glob on either side matching the other. */
const namesMatch = (f, s) => {
  if (s.endsWith("/")) return inFolder(f, s);
  if (s.includes("*") || f.includes("*"))
    return (
      (s.includes("*") && globSuffix(s).test(starsAsName(f).toLowerCase())) ||
      (f.includes("*") && globSuffix(f).test(starsAsName(s).toLowerCase()))
    );
  return sameFile(f, s);
};
const ownerIn = (f, owned) => owned.find((s) => namesMatch(f, s));

// ---------- R77 grammar ----------
const HEADING = /^(#{1,6})\s+(.*)$/;
const WHO_HEADING = /who does what/i;
const SPEC_BULLET = /^\s*[-*+]\s+(\*\*)?(the\s+)?spec(\s+job|-writer)?\b/i;
const BUILD_BULLET = /^\s*[-*+]\s+(\*\*)?(the\s+)?build(\s+job|er)?\b/i;
const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+/;
const DIRECTIVE = /^\s*\*\*Lead directive\b/i;
const HEADER_JOB = /\b(spec\s+(?:patch|round|fixup)|build\s+round)\b/i;
const ROUND = /\bround\b/i;
// Job words at the start of a sentence or clause (G3): (re)build(s), builder(s), "the build"; "spec", "the spec job",
// "a spec patch"; "the check", "the checker".
const LEADS = "(?:(?:then|and|so|also|next)\\s+)?";
const START_BUILD = new RegExp(`^${LEADS}(?:the\\s+)?(?:re)?build(?:s|ers?)?\\b`, "i");
const START_SPEC = new RegExp(
  `^(?:(?:then|and|so|also|next|first)\\s+)?(?:(?:a|an|the)\\s+)?spec\\b`,
  "i",
);
const START_CHECK = new RegExp(`^${LEADS}the\\s+check(?:er)?\\b`, "i");
const TRAILING_BUILD = /\(build\)[\s.;!*]*$/i;
const BY_BUILD = /\bby\s+the\s+(?:re)?build(?:ers?)?\b/i;
const BY_JOB =
  /\bby\s+the\s+(?:(?:re)?build(?:ers?)?|spec(?:\s+job|-writer)?|check(?:er)?)\b/i;
const BY_CHECK = /\bby\s+the\s+check(?:er)?\b/i;
// A label (G1): a job word, optionally "files" or "job", optionally "round N" or "patch", optionally a bracket, then a
// colon. At the start of a line that is not a bullet it gives its job to the rest of the line and to the bullet lines
// under it; at the start of a sentence ending in a colon (after "first", "then" ... and "a", "the") it gives its job to
// the rest of its line.
const LABEL_WORDS = "spec|(?:re)?build(?:s|ers?)?|check(?:er)?|acceptance|golden|fixtures";
const LABEL = new RegExp(
  `^\\s*(?:\\*\\*)?(?:the\\s+)?(${LABEL_WORDS})(?:\\s+(?:files?|job))?(?:\\s+round\\s+\\d+|\\s+patch)?(?:\\s*\\((?:[^()]|\\([^()]*\\))*\\))?\\s*:(?:\\*\\*)?(?=\\s|$)`,
  "i",
);
const INLINE_LABEL = new RegExp(
  `^(?:(?:first|then|and|so|also|next)\\s+)*(?:(?:a|an|the)\\s+)?(${LABEL_WORDS})(?:\\s+(?:files?|job))?(?:\\s+round\\s+\\d+|\\s+patch)?(?:\\s*\\(.*\\))?\\s*:\\s*(?:\\*\\*)?\\s*$`,
  "i",
);
/** The job a label word names: spec, build or check. */
const labelClass = (w) =>
  /^(?:re)?build/i.test(w) ? "build" : /^check/i.test(w) ? "check" : "spec";
/** The state a label gives: the build's, the check's, or the spec job's (a spec section stays a spec section). */
const labelState = (cls, base) =>
  cls === "build"
    ? "build"
    : cls === "check"
      ? "check"
      : base.startsWith("spec")
        ? base
        : "spec-directive";
// G4: the job words of a heading (outside code spans and file names); the first one names its class.
const JOB_WORD =
  /\b(?:(spec(?:s|-writer)?|acceptance|golden|goldens|fixtures?)|((?:re)?build(?:s|ers?)?))\b/i;
const outsideNames = (t) =>
  t.replace(/`[^`]*`/g, " ").replace(FILE_RE, " ");
/** The job a heading's words name: "spec-section" or "build", or undefined when it holds no job word. */
function wordJob(text) {
  const m = JOB_WORD.exec(outsideNames(text));
  return m ? (m[1] ? "spec-section" : "build") : undefined;
}
/** The reader R77 and R81 use (and the grammar coverage rule checks). */
const READER = {
  headingJob: (heading, parent) =>
    WHO_HEADING.test(heading) ? "who" : (wordJob(heading) ?? parent),
  labelJob: (line) => {
    if (BULLET.test(line)) return undefined;
    const m = LABEL.exec(line);
    return m ? { job: labelClass(m[1]), length: m[0].length } : undefined;
  },
  bullets: true,
};
// A quotation names a form, never gives an order: text in double quotes is blanked before a line is read.
const maskQuotes = (line) => line.replace(/"[^"\n]*"|“[^”\n]*”/g, '""');
// G2: a closed negation grammar. With file names masked (so the scope crosses their dots), a clause is negated when a
// negation word (never, not, n't, without, nor, "no line of") comes before an editing verb, or it says "no change to",
// "stays as it is" or "is out of scope". "forget to" and "fail to" are not negations: "never forget to update" orders.
const NEG_VERBS =
  "edit|edits|editing|edited|change|changes|changed|touch|touches|touched|write|writes|written|rewrite|rewrites|rewritten|update|updates|updated|modify|modifies|modified|add|adds|added|regenerate|regenerates|regenerated|create|creates|created|delete|deletes|deleted|remove|removes|removed";
const NEG_PAIR = new RegExp(
  `(?:\\b(?:never|not|without|nor|no\\s+line\\s+of)\\b|n't\\b)[^.;,]*\\b(?:${NEG_VERBS})\\b`,
  "i",
);
const NEG_STATE =
  /\bno\s+(?:changes?|edits?)\s+(?:to|in)\b|\b(?:stays?|remains?)\s+as\s+(?:it\s+is|they\s+are)\b|\b(?:is|are)\s+out\s+of\s+scope\b/i;
const NOT_NEG = /(?:\b(?:never|not)\s+|n't\s+)(?:forget|fail)\s+to\b/gi;
function negated(clause) {
  const masked = clause.replace(FILE_RE, "FILE").replace(NOT_NEG, " ");
  return NEG_PAIR.test(masked) || NEG_STATE.test(masked);
}
// A clause that hands a file to the spec job (only the clause, never the whole sentence).
const SPEC_OWNS =
  /\bspec(\s+job|-writer|\s+writer)?('s)?\s+(job\s+)?(owns?|writes?|wrote|keeps?|holds?|updates?|rewrites?|adds?|sets?|edits?|fills?|puts?)\b|\bspec[- ]owned\b|\b(is|are|stays?|remains?)\s+(the\s+)?spec(\s+job|-writer)?'s\b|\bbelongs?\s+to\s+the\s+spec\b|\bby\s+the\s+spec(\s+job|-writer)?\b|\b(the\s+)?spec(\s+job|-writer)?'s\s+(files?|lines?|counts?|tables?|tests?)\b/i;
// A clause with a verb of its own starts fresh; one without (", and README.md") inherits the clause before it.
const OWN_VERB =
  /\b(write|writes|rewrite|rewrites|update|updates|add|adds|edit|edits|change|changes|fix|fixes|commit|commits|bring|brings|regenerate|regenerates|run|runs|create|creates|remove|removes|delete|deletes|replace|replaces|move|moves|copy|copies|set|sets|list|lists|put|puts|record|records|patch|patches|generate|generates|make|makes|owns?|keeps?|holds?|fills?)\b/i;
const SENTENCE_SPLIT = /(?<=\*\*|[.!?:])\s+/;
const CLAUSE_SPLIT = /\s*(?:[,;()]|\band\b)\s*/i;
const stripMarks = (s) => s.replace(/^[\s*_(`>]+/, "");
// G5: a Spec line that is a file label ("`<file>`: what the spec job writes in it") hands that file to the spec job.
const FILE_LABEL = /^`?([^\s`]+)`?\s*:\s*(?:\*\*)?\s*$/;

function sections(text) {
  const out = [];
  let cur = { level: 0, heading: "", lines: [] };
  for (const line of text.split(/\r?\n/)) {
    const m = HEADING.exec(line);
    if (m) {
      out.push(cur);
      cur = { level: m[1].length, heading: m[2], lines: [] };
    } else cur.lines.push(line);
  }
  out.push(cur);
  return out;
}
/** The job a directive's header gives its sentences: spec, build, round or none. */
function directiveJob(header) {
  const m = HEADER_JOB.exec(header);
  if (m) return /^spec/i.test(m[1]) ? "spec-directive" : "build";
  return ROUND.test(header) ? "round" : "none";
}
/** One line split into clauses, each with the job that owns it. `given` says a label gave the line its job. */
function lineClauses(line, base, given = false) {
  const out = [];
  const body = line.replace(BULLET, "");
  let carry;
  for (const s of body.split(SENTENCE_SPLIT)) {
    const t = stripMarks(s);
    if (!t.trim()) continue;
    const explicit = START_BUILD.test(t) || TRAILING_BUILD.test(s);
    const job = explicit ? "build" : (carry ?? base);
    const labelled = given || carry !== undefined;
    if (/:\s*(?:\*\*)?\s*$/.test(s)) {
      const m = INLINE_LABEL.exec(t);
      if (m) carry = labelState(labelClass(m[1]), base);
    }
    const clauses = s.split(CLAUSE_SPLIT).filter((c) => c.trim());
    // G3: a sentence names its job only when a clause starts with a job word, a label gives it, or a clause holds
    // "by the <job>" or hands a file to the spec job.
    const named =
      explicit ||
      labelled ||
      clauses.some((c) => {
        const x = stripMarks(c);
        return (
          START_BUILD.test(x) ||
          START_SPEC.test(x) ||
          START_CHECK.test(x) ||
          BY_JOB.test(x) ||
          SPEC_OWNS.test(x)
        );
      });
    let state = job;
    for (const clause of clauses) {
      const c = stripMarks(clause);
      if (negated(c)) state = "dropped";
      else if (SPEC_OWNS.test(c)) state = "spec-owns";
      else if (BY_BUILD.test(c) || START_BUILD.test(c)) state = "build";
      else if (BY_CHECK.test(c) || START_CHECK.test(c)) state = "check";
      else if (OWN_VERB.test(c)) state = job;
      out.push({ state: state === "round" && named ? "none" : state, text: c });
    }
  }
  return out;
}
/** Read one line: a label line, a bullet under a label, or a plain line. Returns the state a label hands on. */
function readLine(line, base, label, out, reader) {
  const lab = reader.labelJob(line);
  if (lab) {
    const state = labelState(lab.job, base);
    out.push(...lineClauses(line.slice(lab.length), state, true));
    return reader.bullets ? state : undefined;
  }
  if (label !== undefined && BULLET.test(line)) {
    out.push(...lineClauses(line, label, true));
    return label;
  }
  out.push(...lineClauses(line, base));
  return undefined;
}
/** Every clause of a card with its owner: spec-section, spec-who, spec-owns, spec-directive, build, check, round, none
 * or dropped. */
function cardClauses(text, reader = READER) {
  const out = [];
  const stack = [];
  let seenHeading = false;
  for (const sec of sections(text)) {
    let job = "none";
    if (sec.level > 0) {
      while (stack.length && stack[stack.length - 1].level >= sec.level)
        stack.pop();
      const parent = stack.length ? stack[stack.length - 1].job : "none";
      // The card's title (its first heading, level 1) names the card, never a job.
      const title = !seenHeading && sec.level === 1;
      seenHeading = true;
      job = title ? "none" : (reader.headingJob(sec.heading, parent) ?? "none");
      stack.push({ level: sec.level, job: job === "who" ? "none" : job });
    }
    let label;
    for (let i = 0; i < sec.lines.length; i++) {
      const line = maskQuotes(sec.lines[i]);
      if (DIRECTIVE.test(line)) {
        const header = /^\s*\*\*(.*?)\*\*/.exec(line)?.[1] ?? line;
        const base = directiveJob(header);
        let inner;
        for (; i < sec.lines.length && sec.lines[i].trim() !== ""; i++)
          inner = readLine(maskQuotes(sec.lines[i]), base, inner, out, reader);
        label = undefined;
        continue;
      }
      const base =
        job !== "who"
          ? job
          : SPEC_BULLET.test(line)
            ? "spec-who"
            : BUILD_BULLET.test(line)
              ? "build"
              : "none";
      label = readLine(line, base, label, out, reader);
    }
  }
  return out;
}
const backticked = (t) => [...t.matchAll(/`([^`\s]+)`/g)].map((m) => m[1]);
/** The files a card gives to the spec job and to the build, and the files of ambiguous round sentences. R77 and R81
 * read the spec job's files this one way (G5). */
function cardOwnership(text) {
  const clauses = cardClauses(text);
  const of = (state) =>
    clauses
      .filter((c) => c.state === state)
      .map((c) => c.text)
      .join("\n");
  const specSection = of("spec-section");
  const who = of("spec-who");
  const owns = of("spec-owns");
  // A README a Spec section names is what it tests (GL3's db/bridge/README.md); a README is the spec job's only when a
  // "Who does what" spec bullet, a clause or a Spec file label hands it over (W16's README line, FX8's count).
  const fileLabels = clauses
    .filter((c) => c.state === "spec-section")
    .map((c) => FILE_LABEL.exec(c.text)?.[1])
    .filter((f) => f !== undefined)
    .map(normPath);
  const notReadme = (r) => isExp(r) && !isReadme(r);
  const specOwned = uniq([
    ...refs(specSection).filter(notReadme),
    ...sectionNames(`## Spec\n${specSection}`, "Spec")
      .map(normPath)
      .filter(notReadme),
    ...fileLabels.filter((r) => isExp(r)),
    ...refs(who),
    ...backticked(who).map(normPath),
    ...refs(owns).filter((r) => isExp(r)),
    ...folders(`${specSection}\n${who}\n${owns}`),
  ]);
  const build = uniq([...refs(of("build")), ...folders(of("build"))]);
  const round = uniq([...refs(of("round")), ...folders(of("round"))]);
  return { specOwned, build, round };
}
const specOwner = (f, specOwned) => ownerIn(f, specOwned) ?? standingOwner(f);

function r77(rel, text) {
  const { specOwned, build, round } = cardOwnership(text);
  const out = [];
  for (const b of build) {
    const s = specOwner(b, specOwned);
    if (s)
      out.push(`${rel}: a build order names ${b}, which the spec job owns (${s})`);
  }
  for (const r of round) {
    const s = specOwner(r, specOwned);
    if (s)
      out.push(
        `${rel}: a round directive sentence names ${r}, which the spec job owns (${s}), and names no job (spec or build)`,
      );
  }
  return out;
}

// ---------- grammar coverage: every heading and label holding a job word maps to its job ----------
const JOB_NAME = { "spec-section": "spec", build: "build", spec: "spec", check: "check", who: "who does what", none: "no" };
/** Every heading (the title aside) and every label line of a card that holds a job word (spec, build, builder,
 * acceptance, golden, fixtures; check for labels) must read as the job its first job word names, and a label must give
 * that job to the bullets under it; anything else fails by name. */
function grammarCoverage(rel, text, reader = READER) {
  const out = [];
  const lines = text.split(/\r?\n/).map(maskQuotes);
  const stack = [];
  let seenHeading = false;
  lines.forEach((line, i) => {
    const h = HEADING.exec(line);
    if (h) {
      const level = h[1].length;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      const parent = stack.length ? stack[stack.length - 1].job : "none";
      const title = !seenHeading && level === 1;
      seenHeading = true;
      const job = title ? "none" : (reader.headingJob(h[2], parent) ?? "none");
      stack.push({ level, job: job === "who" ? "none" : job });
      const named = wordJob(h[2]);
      if (!title && named && job !== named)
        out.push(
          `${rel}: the heading "${h[2]}" names the ${JOB_NAME[named]} job but reads as ${JOB_NAME[job] ?? job} job`,
        );
      return;
    }
    const m = LABEL.exec(line);
    if (!m || BULLET.test(line)) return;
    const named = labelClass(m[1]);
    const label = m[0].trim();
    const got = reader.labelJob(line)?.job ?? "none";
    if (got !== named)
      out.push(
        `${rel}: the label "${label}" names the ${named} job but reads as ${JOB_NAME[got] ?? got} job`,
      );
    else if (!reader.bullets && BULLET.test(lines[i + 1] ?? ""))
      out.push(`${rel}: the label "${label}" gives its job to no bullet under it`);
  });
  return out;
}
/** Round 1's reader (49e9d2e7, the plant for the coverage rule): three heading names and no inheritance; a sentence
 * ending in a colon gave the build only when it was the bare word, the spec when it named the spec anywhere, and its job
 * reached no bullet. */
const ROUND1_READER = {
  headingJob: (heading) =>
    /^(spec\b|golden files|test fixtures)|spec-writer/i.test(heading)
      ? "spec-section"
      : /^build\b/i.test(heading)
        ? "build"
        : WHO_HEADING.test(heading)
          ? "who"
          : "none",
  labelJob: (line) => {
    const m = LABEL.exec(line);
    if (!m) return undefined;
    const head = stripMarks(m[0]);
    const job = /^(?:the\s+)?(?:re)?build(?:s|ers?)?(?:\s+job)?\s*:/i.test(head)
      ? "build"
      : /\bspec\b/i.test(head)
        ? "spec"
        : "none";
    return { job, length: m[0].length };
  },
  bullets: false,
};

// ---------- R81: every expectation file in Paths has an owner ----------
/** Whether a name a section gives covers a Paths entry (a file, a folder, or a glob such as a fixtures folder). */
function covers(name, entry) {
  const n = name.replace(/\\/g, "/").replace(/\/\*\*$/, "/");
  if (n.endsWith("/"))
    return inFolder(entry.split("*")[0] || entry, n) || sameFile(n.slice(0, -1), entry.split("*")[0].replace(/\/+$/, ""));
  if (!entry.includes("*") && !n.includes("*")) return sameFile(n, entry);
  // G7: a glob on either side matches the other by suffix; a Paths glob also covers the folder its literal start names.
  const lit = entry.split("*")[0].replace(/\/+$/, "");
  return namesMatch(entry, n) || (entry.includes("*") && sameFile(n, lit));
}
// `*.acceptance.*` and `__golden__/**` are the spec job's by standing rule (fix 5), and tests and fixtures by its role
// (scope.mjs R82 holds them to the spec job); a verify script or a README has an owner only when the card names one
// (FX8-findings RC2, lesson 35).
const needsNamedOwner = (entry) =>
  isExp(entry) &&
  !standingOwner(entry) &&
  !isTest(entry.replace(/\*+/g, "x")) &&
  !/\.test\./.test(entry) &&
  !isFixture(entry);
/** R81 finds the expectation files no side owns; a file both sides own is R77's problem. The spec side is R77's own
 * reading (G5). A Paths glob is checked as written and, when `files` is given (git's list), over every file it matches
 * (G7). */
function r81(rel, text, paths, files) {
  const { build, specOwned } = cardOwnership(text);
  const out = [];
  for (const entry of paths) {
    const expanded =
      entry.includes("*") && files
        ? files.filter((f) => globToRegExp(entry).test(f) && f !== entry)
        : [];
    for (const target of [entry, ...expanded]) {
      if (!needsNamedOwner(target)) continue;
      const bySpec =
        specOwned.some((n) => covers(n, target)) || !!standingOwner(target);
      const byBuild = build.some((n) => covers(n, target));
      if (!bySpec && !byBuild)
        out.push(
          target === entry
            ? `${rel}: ${entry} is an expectation file in Paths that neither the Spec nor the Build side owns`
            : `${rel}: ${target} (Paths ${entry}) is an expectation file in Paths that neither the Spec nor the Build side owns`,
        );
    }
  }
  return out;
}
const pathsLine = (text) =>
  (/^Paths:\s*(.*)$/m.exec(text)?.[1] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

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
  // G6 (c): any git call naming main or master fails, whatever its subcommand, except init (it names a new branch).
  main: [
    (w) =>
      gitSubcommand(w) !== "init" &&
      w.some((x) =>
        /^(?:main|master)(?:$|:|\.\.)|\.\.(?:main|master)$/.test(x),
      ),
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
    callsAt.set(n, [...(callsAt.get(n) ?? []), callWords(c.text)]);
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
/** A test that builds its own repository (mkdtemp, and init as a git call's subcommand, both in its code) reads its own
 * history, not the repo's (G6 (a)). */
const buildsOwnRepo = (text) => {
  const { code, skel } = scanSource(text);
  return (
    /\bmkdtemp(?:Sync)?\b/.test(code) &&
    gitCalls(code, skel).some((c) => gitSubcommand(callWords(c.text)) === "init")
  );
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
const plantCard = (lines) =>
  [
    "# X1 A card (Test)",
    "",
    "Phase 0. Size S. Deps: none.",
    "Paths: reference/sample-clients/verify.mjs, reference/sample-clients/README.md",
    "",
    ...lines,
  ].join("\n");
const CLEAN_SPEC = [
  "## Spec",
  "- The spec job writes the `reference/sample-clients/verify.mjs` rule line and the `reference/sample-clients/README.md` pass count.",
];
const README_FAIL =
  "plan/cards/X1.md: a build order names README.md, which the spec job owns (reference/sample-clients/README.md)";
/** A card with a block put before its Phase line (a preamble directive) or after its Spec section. */
const withPreamble = (block) =>
  plantCard(CLEAN_SPEC).replace("Phase 0.", `${block}\n\nPhase 0.`);
const withTail = (block) => `${plantCard(CLEAN_SPEC)}\n\n${block}\n`;

describe("SC6 cards read by R77 and R81 (fix 2)", () => {
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

describe("SC6 R77: the build never gets a file the spec job owns (ARC-12)", () => {
  test("ARC-12 R77 rule: W16.md as on main before A404 fails (the README is the spec job's and the Build section names it)", () => {
    expect(r77("plan/cards/W16.md", fix(PLANTED_CARD))).toEqual([
      "plan/cards/W16.md: a build order names README.md, which the spec job owns (README.md)",
    ]);
  });

  test("ARC-12 R77 rule: the planted W16.md passes once its Build section hands the moved-figure list to the spec job", () => {
    const planted = fix(PLANTED_CARD);
    const fixed = planted.replace(
      "and list each moved figure in the README with the reason.",
      "and report each moved figure with the reason in reports/W16-build.md (the spec job writes them into the README).",
    );
    expect(fixed).not.toBe(planted);
    expect(r77("plan/cards/W16.md", fixed)).toEqual([]);
  });

  test("ARC-12 R77 rule: a Spec section that only names the product file it tests does not own it", () => {
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
      "plan/cards/X1.md: a build order names x.acceptance.test.ts, which the spec job owns (src/modules/x/x.acceptance.test.ts)",
    ]);
  });

  // reports/SC6-check.md item 2: the six forms a build order takes outside a "## Build" heading. Each must fail.
  const SIX_FORMS = [
    [
      "a build round directive whose later sentence gives the order",
      withPreamble(
        "**Lead directive, 3 Oct (A999): build round 2.** Rewrite README.md counts.",
      ),
    ],
    [
      "a directive whose bold header is the order",
      withPreamble(
        "**Lead directive, 3 Oct: Build rewrites README.md counts.**",
      ),
    ],
    [
      'a "Fix round" bullet ending in "(build)"',
      withTail("## Fix round 1\n- Rewrite README.md counts (build)."),
    ],
    [
      'a "Builders" sentence',
      withTail("## Fix round 1\nBuilders rewrite README.md"),
    ],
    ['a "Rebuild:" label', withTail("## Fix round 1\n- Rebuild: rewrite README.md")],
    ['a "### Build" heading', withTail("### Build\n- Rewrite README.md counts.")],
  ];
  test.each(SIX_FORMS)(
    "ARC-12 R77 rule (check item 2): %s fails",
    (_name, card) => {
      expect(r77("plan/cards/X1.md", plantCard(CLEAN_SPEC))).toEqual([]);
      expect(r77("plan/cards/X1.md", card)).toEqual([README_FAIL]);
    },
  );

  test("ARC-12 R77 rule (A493): the real directive form, a round header and a later sentence naming the build, fails", () => {
    // Copied from main's form (plan/cards/W16.md, A404; plan/cards/DB16.md, A441): "**Lead directive, <date> <time>
    // (Annn): round N ...** <orders>".
    const card = withPreamble(
      "**Lead directive, 3 Oct 10:10Z (A999): round 2 from reports/X1-findings.md (on claude/X1), on a fresh branch.** The build changes README.md counts.",
    );
    expect(r77("plan/cards/X1.md", card)).toEqual([README_FAIL]);
  });

  test("ARC-12 R77 rule (fix 4): in a round directive a sentence naming a spec-owned file with no job fails as ambiguous; naming its job passes", () => {
    const head =
      "**Lead directive, 3 Oct 10:10Z (A999): round 2 from reports/X1-findings.md (on claude/X1).**";
    expect(
      r77("plan/cards/X1.md", withPreamble(`${head} Rewrite README.md counts.`)),
    ).toEqual([
      "plan/cards/X1.md: a round directive sentence names README.md, which the spec job owns (reference/sample-clients/README.md), and names no job (spec or build)",
    ]);
    expect(
      r77(
        "plan/cards/X1.md",
        withPreamble(`${head} The spec job rewrites README.md counts.`),
      ),
    ).toEqual([]);
    expect(
      r77(
        "plan/cards/X1.md",
        withPreamble(
          `${head} First a spec patch (Opus): README.md counts for the landing state. Then build round 3, src/x.ts only.`,
        ),
      ),
    ).toEqual([]);
    // A round sentence that names no spec-owned file is not ambiguous.
    expect(
      r77(
        "plan/cards/X1.md",
        withPreamble(`${head} Merge origin/main first; fix src/x.ts.`),
      ),
    ).toEqual([]);
  });

  test("ARC-12 R77 rule (fix 4): a spec patch header owns its sentences; a sentence in it that starts with the build is still the build's", () => {
    const head = "**Lead directive, 3 Oct 14:27Z (A999): spec patch, one item; then the build.**";
    expect(
      r77("plan/cards/X1.md", withPreamble(`${head} Rewrite README.md counts.`)),
    ).toEqual([]);
    expect(
      r77(
        "plan/cards/X1.md",
        withPreamble(`${head} Rewrite src/x.ts. The build rewrites README.md counts.`),
      ),
    ).toEqual([README_FAIL]);
    // "build round" is the header's first job word here, so its sentences are the build's.
    const build = "**Lead directive, 3 Oct (A999): build round 4 from reports/X1-findings.md, no spec patch.**";
    expect(
      r77("plan/cards/X1.md", withPreamble(`${build} Rewrite README.md counts.`)),
    ).toEqual([README_FAIL]);
    // A directive paragraph ends at its blank line: a later paragraph is not the directive's.
    expect(
      r77(
        "plan/cards/X1.md",
        withPreamble(`${build} Rewrite src/x.ts.\n\nRewrite README.md counts.`),
      ),
    ).toEqual([]);
  });

  test("ARC-12 R77 rule (check item 3): a passive build clause after a spec clause is the build's", () => {
    expect(
      r77(
        "plan/cards/X1.md",
        withTail(
          "## Fix round 1\n- The spec job writes the verify.mjs rule line, and README.md counts are rewritten by the build.",
        ),
      ),
    ).toEqual([README_FAIL]);
    expect(
      r77(
        "plan/cards/X1.md",
        withTail(
          "## Fix round 1\n- README.md counts are never rewritten by the build.",
        ),
      ),
    ).toEqual([]);
  });

  test("ARC-12 R77 rule: only the negated or spec-owned clause is dropped, never the whole sentence", () => {
    const withBuild = (sentence) =>
      plantCard([...CLEAN_SPEC, "## Build", `- ${sentence}`]);
    expect(
      r77(
        "plan/cards/X1.md",
        withBuild(
          "Bring over the data; never edit verify.mjs, and rewrite README.md counts.",
        ),
      ),
    ).toEqual([README_FAIL]);
    expect(
      r77(
        "plan/cards/X1.md",
        withBuild("Rewrite README.md counts the spec job left stale."),
      ),
    ).toEqual([README_FAIL]);
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

  test("ARC-12 R77 rule (check item 5): README in any case and a path spelled by its suffix or with backslashes are the same file", () => {
    const withBuild = (sentence) =>
      plantCard([...CLEAN_SPEC, "## Build", `- ${sentence}`]);
    expect(
      r77("plan/cards/X1.md", withBuild("Regenerate, then fix the readme pass count.")),
    ).toEqual([README_FAIL]);
    expect(
      r77("plan/cards/X1.md", withBuild("Regenerate, then fix the Readme.md pass count.")),
    ).toEqual([
      "plan/cards/X1.md: a build order names Readme.md, which the spec job owns (reference/sample-clients/README.md)",
    ]);
    expect(
      r77(
        "plan/cards/X1.md",
        withBuild("Update sample-clients/verify.mjs for the new folders."),
      ),
    ).toEqual([
      "plan/cards/X1.md: a build order names sample-clients/verify.mjs, which the spec job owns (reference/sample-clients/verify.mjs)",
    ]);
    expect(
      r77(
        "plan/cards/X1.md",
        withBuild(
          "Update reference\\sample-clients\\Verify.mjs for the new folders.",
        ),
      ),
    ).toEqual([
      "plan/cards/X1.md: a build order names reference/sample-clients/Verify.mjs, which the spec job owns (reference/sample-clients/verify.mjs)",
    ]);
    // A Spec section that spells its README "readme.md" owns it all the same.
    const lower = [
      "# X1 A card (Test)",
      "## Who does what",
      "- The spec job writes the count in `reference/x/readme.md`.",
      "## Build",
      "- Update reference/x/README.md.",
    ].join("\n");
    expect(r77("plan/cards/X1.md", lower)).toEqual([
      "plan/cards/X1.md: a build order names reference/x/README.md, which the spec job owns (reference/x/readme.md)",
    ]);
    // Two different files that only share a basename stay two files.
    expect(
      r77("plan/cards/X1.md", withBuild("Update testworld/README.md for the new kind.")),
    ).toEqual([]);
  });

  test("ARC-12 R77 rule (fix 5, check item 9): *.acceptance.* and __golden__/** files are the spec job's with no Spec mention", () => {
    const card = (build) =>
      ["# X1 A card (Test)", "## Spec", "- Rules in `tools/test/x-rules.test.mjs`.", "## Build", build].join("\n");
    expect(r77("plan/cards/X1.md", card("- Write `src/x/index.ts`."))).toEqual([]);
    expect(
      r77("plan/cards/X1.md", card("- Write `src/x/index.ts`; refresh `src/x/__golden__/t2.csv`.")),
    ).toEqual([
      "plan/cards/X1.md: a build order names src/x/__golden__/t2.csv, which the spec job owns (standing owner: __golden__/**)",
    ]);
    expect(
      r77("plan/cards/X1.md", card("- Write `src/x/index.ts` and fix `src/x/y.acceptance.test.ts`.")),
    ).toEqual([
      "plan/cards/X1.md: a build order names src/x/y.acceptance.test.ts, which the spec job owns (standing owner: *.acceptance.*)",
    ]);
    expect(
      r77("plan/cards/X1.md", card("- Regenerate the goldens in `src/x/__golden__/`.")),
    ).toEqual([
      "plan/cards/X1.md: a build order names src/x/__golden__/, which the spec job owns (standing owner: __golden__/**)",
    ]);
  });

  test("ARC-12 R77 rule (fix 5, check item 4): a fixture folder named in Spec owns the files in it", () => {
    const card = (build) =>
      [
        "# X1 A card (Test)",
        "## Spec",
        "- Plants in `tools/test/__fixtures__/x/`, each shown failing.",
        "## Build",
        build,
      ].join("\n");
    expect(r77("plan/cards/X1.md", card("- Write `tools/x.mjs`."))).toEqual([]);
    expect(
      r77("plan/cards/X1.md", card("- Write `tools/x.mjs` and fix `tools/test/__fixtures__/x/a.json`.")),
    ).toEqual([
      "plan/cards/X1.md: a build order names tools/test/__fixtures__/x/a.json, which the spec job owns (tools/test/__fixtures__/x/)",
    ]);
    // A product folder a Spec section names is not the spec job's.
    const product = [
      "# X1 A card (Test)",
      "## Spec",
      "- Tests for `src/modules/x/`.",
      "## Build",
      "- Write `src/modules/x/index.ts`.",
    ].join("\n");
    expect(r77("plan/cards/X1.md", product)).toEqual([]);
  });

  test("ARC-12 R77 rule: only open cards are read; a done or parked card's text is history", () => {
    const planted = fix(PLANTED_CARD);
    const cards = [{ id: "W16" }];
    const src = () => ({ rel: "plan/cards/W16.md", label: "plan/cards/W16.md", text: planted });
    const run = (status) =>
      scanCards(cards, { ...PINNED, W16: status }, src).open.flatMap((c) =>
        r77(c.src.label, c.src.text),
      );
    expect(run("carded")).toHaveLength(1);
    expect(run("done")).toEqual([]);
    expect(run("parked")).toEqual([]);
    expect(isOpen(PINNED, "NOPE")).toBe(false);
  });

  // G1 (A503): the three real label forms on main (GL3 A498, SC11 A500, G18 A499), headers copied, each with a B bullet
  // naming the spec-owned README. Round 1 read each B bullet as spec work.
  const LABEL_FORMS = [
    [
      'GL3 (A498): "Build (after the spec commit, all inside Paths):"',
      [
        "**Lead directive, 3 Oct 15:50Z (A498): round 4, the last: a spec patch (S1 to S6), then the build (B1 to B6), then an Opus check and a fresh security review before boarding.** From GL3's security review of 470bc705 (one medium, five lows) and its findings review 2; both reports stay on the laptop (A496), so these lines are the whole brief.",
        "Spec patch (every new test fails on 470bc705 first; the builder never edits tests, contract.ts or the stand-in):",
        '- S6 README test: it names probeReach and the one-transaction apply; "nothing else" is gone.',
        "Build (after the spec commit, all inside Paths):",
        "- B5 `probeReach` in src/modules/golive/bridge, its pure diff in scan.ts (@mutate, 100).",
        "- B6 README: one migration, one transaction; the marker mask (contract line 70); security_barrier.",
        "Re-test: unit and db on PGlite and TEST_DB=pg16; test:flake 5 of 5.",
      ].join("\n"),
    ],
    [
      'SC11 (A500): "Build:"',
      [
        "**Lead directive, 3 Oct 16:23Z (A500): round 2. First restore plan/cards/DB16.md from origin/main (`git checkout origin/main -- plan/cards/DB16.md`: refit 428cc413 kept its stale \"Spec commit\" line, and landing would revert main's). Then a spec patch (S1 to S3: rules R116 and R117), then the build (B1, B2), then an Opus read and a security review before boarding (A496).** From SC11's findings review 1 (Opus; the report stays on the laptop, so these lines are the whole brief).",
        "Spec patch (each new test fails on 87066e33 first):",
        "- S1, R116 (both backends, all of src/**): every `new Pool(` or `new Client(` from pg in a non-test file has an `error` listener.",
        "Build:",
        "- B1: track every client a pool opens (pool `connect` to client `end`).",
        "- B2: pool and client listeners record into the handle's problems; the README pass count gains the two rules.",
      ].join("\n"),
    ],
    [
      'G18 (A499): "Build (data only, inside Paths, after the spec commit): ..."',
      [
        "**Lead directive, 3 Oct 16:08Z (A499): round 2: a spec patch (Opus), then the build (Opus, data only), then a check by a third Opus worker.** From G18's findings review 1 (Opus; the report stays on the laptop, so these lines are the whole brief).",
        "Spec patch (coverage.acceptance.test.ts; every new rule and pin fails on 5e8f0643 first, every plant passes as planted):",
        "- R6 labels: a bank label keeps its catalogue label's side words (due to, due from, personal, personally, paid). Plant: Q-SHL-002 as built.",
        'Build (data only, inside Paths, after the spec commit): relabel Q-SHL-002 "Due to shareholders at year end"; rewrite the map so all 105 flags appear once:',
        "- Reason rows, kind `check`, as owner, clause, flags: Q13 CK-13 02-F03.",
        "- The README pass count follows the map.",
        "Check (a third Opus worker): every changed row against the flag's detail and the owner's clause.",
      ].join("\n"),
    ],
  ];
  test.each(LABEL_FORMS)(
    "ARC-12 R77 rule (G1): the label %s gives the build its line and the bullets under it, so a B bullet naming the spec-owned README fails",
    (_name, block) => {
      expect(r77("plan/cards/X1.md", withPreamble(block))).toEqual([README_FAIL]);
      // The label's job ends at the first line that is not a bullet.
      const after = withPreamble(
        block
          .split("\n")
          .filter((l) => !/README (pass count|test)|B6 README/.test(l))
          .concat("Re-test: the README pass count again.")
          .join("\n"),
      );
      expect(r77("plan/cards/X1.md", after)).toEqual([]);
    },
  );

  test('ARC-12 R77 rule (G1): S00\'s "Build rules added:" line is no label, so the bullet under it is not the build\'s', () => {
    // plan/cards/S00.md:60, as on main (cut after RT-7).
    const s00 =
      "The spec was written without the Opus spec writer; an Opus review returned REVISE. Build rules added: a yes or no cell imported as `\"\"` resets to `N` with a \"replaced\" line (FINDINGS Q20, RT-12, RT-23), and several new copy keys in one file take the following indexes in order (RT-7).";
    const bullet = "- The README pass count gains the two rules.";
    expect(r77("plan/cards/X1.md", withTail(`## Notes (Test)\n${s00}\n${bullet}`))).toEqual([]);
    expect(
      r77("plan/cards/X1.md", withTail(`## Notes (Test)\nBuild rules added: a yes or no cell resets to N.\n${bullet}`)),
    ).toEqual([]);
    // The same bullet under a real label is the build's.
    expect(r77("plan/cards/X1.md", withTail(`## Notes (Test)\nBuild round 2:\n${bullet}`))).toEqual([README_FAIL]);
  });

  // G2 (A503): a closed negation grammar whose scope crosses file names. <file> is the spec-owned verify.mjs.
  const VERIFY = "reference/sample-clients/verify.mjs";
  const VERIFY_FAIL = `plan/cards/X1.md: a build order names ${VERIFY}, which the spec job owns (${VERIFY})`;
  const NEGATIONS = [
    `no line of ${VERIFY} changes`,
    `do not add a ${VERIFY} line`,
    `no change to ${VERIFY}`,
    `${VERIFY} stays as it is`,
    `${VERIFY} is out of scope (FX8 owns it)`,
    `don't regenerate ${VERIFY}`,
  ];
  test.each(NEGATIONS)(
    'ARC-12 R77 R81 rule (G2): "%s" is a negation: never a build order in R77, never ownership in R81',
    (neg) => {
      const build = plantCard([...CLEAN_SPEC, "## Build", `- Regenerate the folders; ${neg}.`]);
      expect(r77("plan/cards/X1.md", build)).toEqual([]);
      const spec = ["# X1 A card (Test)", "## Spec", `- ${neg}.`, "## Build", "- Write `src/x/index.ts`."].join("\n");
      expect(r81("plan/cards/X1.md", spec, [VERIFY])).toEqual([
        `plan/cards/X1.md: ${VERIFY} is an expectation file in Paths that neither the Spec nor the Build side owns`,
      ]);
    },
  );
  test.each([
    `never forget to update ${VERIFY}`,
    `don't forget to rewrite ${VERIFY}`,
    `do not fail to update ${VERIFY}`,
  ])('ARC-12 R77 rule (G2): "%s" is no negation, so in a build section it fails', (order) => {
    expect(r77("plan/cards/X1.md", plantCard([...CLEAN_SPEC, "## Build", `- Regenerate the folders; ${order}.`]))).toEqual([
      VERIFY_FAIL,
    ]);
  });

  test("ARC-12 R77 rule (G3): in a round directive a sentence names its job only by a clause that starts with a job word, a label, \"by the <job>\" or a spec-owns clause", () => {
    const head = "**Lead directive, 3 Oct 10:10Z (A999): round 2 from reports/X1-findings.md (on claude/X1).**";
    const ambiguous =
      "plan/cards/X1.md: a round directive sentence names README.md, which the spec job owns (reference/sample-clients/README.md), and names no job (spec or build)";
    expect(r77("plan/cards/X1.md", withPreamble(`${head} Rewrite README.md counts the spec job left stale.`))).toEqual([
      ambiguous,
    ]);
    expect(r77("plan/cards/X1.md", withPreamble(`${head} Fix README.md counts after the checks pass.`))).toEqual([
      ambiguous,
    ]);
    expect(r77("plan/cards/X1.md", withPreamble(`${head} The spec job rewrites README.md counts.`))).toEqual([]);
    // FX8's A417 check sentence (plan/cards/FX8.md, header as on main).
    expect(
      r77(
        "plan/cards/X1.md",
        withPreamble(
          "**Lead directive, 3 Oct (A417): round 2 from reports/FX8-findings.md, on a fresh branch claude/FX8-r2 from main after W16 lands.** The check runs verify.mjs green on the branch and again after merging origin/main into a scratch copy.",
        ),
      ),
    ).toEqual([]);
    // DB16's colon form (plan/cards/DB16.md A441, header as on main).
    expect(
      r77(
        "plan/cards/X1.md",
        withPreamble(
          "**Lead directive, 3 Oct 08:25Z (A441): final round from reports/DB16-findings-4.md (on claude/DB16).** First a spec patch (Opus, core-grade): tests T1 to T5 into pg16.acceptance.db.test.ts and the README.md counts, each shown failing on 36672c88. Then build round 5, fix list items 2 to 5 only.",
        ),
      ),
    ).toEqual([]);
  });

  // G4 (A503): headings by class, one card per spelling on main; each section names a fixture a build order names.
  const FIXTURE = "tools/test/__fixtures__/x/a.json";
  const FIXTURE_FAIL = `plan/cards/X1.md: a build order names ${FIXTURE}, which the spec job owns (${FIXTURE})`;
  const specHeadingCard = (heading) =>
    ["# X1 A card (Test)", heading, `- Plants in \`${FIXTURE}\`, each shown failing.`, "## Build", `- Write \`tools/x.mjs\` and fix \`${FIXTURE}\`.`].join("\n");
  const SPEC_HEADINGS = [
    "## Acceptance checks",
    "## Acceptance checks (a new spec worker writes them first; Opus)",
    "### Tests for the spec job (before the build reopens; not the builder)",
    "## Round 3 spec fix (2 Oct, from reports/DG-build.md on claude/DG; single cause, A306)",
  ];
  test.each(SPEC_HEADINGS)("ARC-12 R77 rule (G4): the heading \"%s\" is the spec job's", (heading) => {
    expect(r77("plan/cards/X1.md", specHeadingCard(heading))).toEqual([FIXTURE_FAIL]);
  });
  test("ARC-12 R77 rule (G4): a heading naming the builder is the build's, and a deeper heading takes its parent's job", () => {
    const spec = ["# X1 A card (Test)", "## Spec", `- Plants in \`${FIXTURE}\`, each shown failing.`];
    // plan/cards/F00.md:50, a third-level heading under a findings heading.
    const builder = [...spec, "## Findings review 1 (Test)", "### Fix list for the builder, in order", `1. Fix \`tools/x.mjs\` and \`${FIXTURE}\`.`];
    expect(r77("plan/cards/X1.md", builder.join("\n"))).toEqual([FIXTURE_FAIL]);
    const deeper = [...spec, "## Build", "- Write `tools/x.mjs`.", "### Round 2 (Test)", `- Fix \`${FIXTURE}\`.`];
    expect(r77("plan/cards/X1.md", deeper.join("\n"))).toEqual([FIXTURE_FAIL]);
    // A heading after the build section that names no job is not the build's; nor is the card's title.
    const sibling = [...spec, "## Build", "- Write `tools/x.mjs`.", "## Notes (Test)", `- Fix \`${FIXTURE}\`.`];
    expect(r77("plan/cards/X1.md", sibling.join("\n"))).toEqual([]);
    expect(r77("plan/cards/X1.md", ["# X1 Build the spec fixtures (Test)", `- Fix \`${FIXTURE}\`.`].join("\n"))).toEqual([]);
  });

  test("ARC-12 R77 rule (G7): a Spec name with a glob owns what it matches, and a build glob covers a spec-owned file", () => {
    const card = (specLine, buildLine) =>
      ["# X1 A card (Test)", "## Spec", specLine, "## Build", buildLine].join("\n");
    expect(
      r77("plan/cards/X1.md", card("- `reference/sample-clients/verify*.mjs` gain the rule.", "- Update `reference/sample-clients/verify-folders.mjs`.")),
    ).toEqual([
      "plan/cards/X1.md: a build order names reference/sample-clients/verify-folders.mjs, which the spec job owns (reference/sample-clients/verify*.mjs)",
    ]);
    expect(
      r77("plan/cards/X1.md", card("- `reference/sample-clients/verify.mjs` gains the rule.", "- Regenerate `reference/sample-clients/verify*.mjs`.")),
    ).toEqual([
      "plan/cards/X1.md: a build order names reference/sample-clients/verify*.mjs, which the spec job owns (reference/sample-clients/verify.mjs)",
    ]);
    expect(
      r77("plan/cards/X1.md", card("- `reference/sample-clients/verify*.mjs` gain the rule.", "- Update `reference/sample-clients/generate.mjs`.")),
    ).toEqual([]);
  });

  test("ARC-12 R77 rule (G7): a `*.build.test.*` file is the builder's, so CQ11's A490 sentence hands no glob to the spec job", () => {
    expect(isExp("src/modules/x/engines.build.test.ts")).toBe(false);
    expect(isExp("src/modules/x/engines.test.ts")).toBe(true);
    const card = [
      "# X1 A card (Test)",
      "**Lead directive, 3 Oct 14:27Z (A490): spec patch, one item.** A465's scope item joins CQ11 (CQ9 could not do it: Paths): tools/scope.mjs tells a builder-owned `*.build.test.ts` file from a spec-owned test file (A04 round 5b failed scope on engines.build.test.ts).",
      "",
      "## Build",
      "- The builder adds cases to `src/modules/x/engines.build.test.ts`.",
    ].join("\n");
    expect(r77("plan/cards/X1.md", card)).toEqual([]);
  });

  test("ARC-12 R77 no open card gives the build a file the spec job owns (KNOWN entries aside)", () => {
    const { problems: scan, open } = scanCards(SLICES().cards, liveStatuses());
    expect(scan).toEqual([]);
    const problems = uniq(open.flatMap((c) => r77(c.src.label, c.src.text)));
    expect(onlyKnown("R77", problems)).toEqual([]);
  });
});

describe("SC6 R81: every expectation file in Paths has an owner (ARC-12, A417)", () => {
  test("ARC-12 R81 rule: FX8.md as first carded fails on its README, which neither the Spec nor the Build side owns", () => {
    const planted = fix(PLANTED_FX8);
    const paths = pathsLine(planted);
    expect(paths).toContain("reference/sample-clients/README.md");
    expect(r81("plan/cards/FX8.md", planted, paths)).toEqual([
      "plan/cards/FX8.md: reference/sample-clients/README.md is an expectation file in Paths that neither the Spec nor the Build side owns",
    ]);
  });

  test("ARC-12 R81 rule (G5): the planted FX8.md passes once its Spec section hands the README count to the spec job in words", () => {
    const planted = fix(PLANTED_FX8);
    const fixed = planted.replace(
      "- verify.mjs gains the same rule, so a regenerated folder is refused too.",
      "- verify.mjs gains the same rule, so a regenerated folder is refused too.\n- The spec job writes the pass count sentence in `reference/sample-clients/README.md`, for the landing state.",
    );
    expect(fixed).not.toBe(planted);
    expect(r81("plan/cards/FX8.md", fixed, pathsLine(fixed))).toEqual([]);
  });

  test("ARC-12 R81 rule: a verify script nobody names fails; a test or a fixture folder is the spec job's by role; one both sides own is R77's finding", () => {
    const paths = [
      "reference/sample-clients/verify.mjs",
      "tools/test/__fixtures__/x/**",
      "tools/test/x.test.mjs",
      "src/x/index.ts",
    ];
    const card = (
      build,
      spec = "- `reference/sample-clients/verify.mjs` gains a line; tests in `tools/test/x.test.mjs`; plants in `tools/test/__fixtures__/x/`.",
    ) => ["# X1 A card (Test)", "## Spec", spec, "## Build", build].join("\n");
    expect(r81("plan/cards/X1.md", card("- Write `src/x/index.ts`."), paths)).toEqual([]);
    expect(
      r81(
        "plan/cards/X1.md",
        card("- Write `src/x/index.ts`.", "- Tests in `tools/test/x.test.mjs`."),
        paths,
      ),
    ).toEqual([
      "plan/cards/X1.md: reference/sample-clients/verify.mjs is an expectation file in Paths that neither the Spec nor the Build side owns",
    ]);
    const both = card("- Write `src/x/index.ts` and add a line to verify.mjs.");
    expect(r81("plan/cards/X1.md", both, paths)).toEqual([]);
    expect(r77("plan/cards/X1.md", both)).toEqual([
      "plan/cards/X1.md: a build order names verify.mjs, which the spec job owns (reference/sample-clients/verify.mjs)",
    ]);
  });

  test("ARC-12 R81 rule (fix 5, check item 9): *.acceptance.* and __golden__/** in Paths are owned with no mention; a build order naming one is R77's finding", () => {
    const card = (build) =>
      ["# X1 A card (Test)", "## Spec", "- Rules in `tools/test/x-rules.test.mjs`.", "## Build", build].join("\n");
    const paths = ["src/x/x.acceptance.test.ts", "src/x/__golden__/**", "**/*.acceptance.test.ts", "src/x/index.ts"];
    expect(r81("plan/cards/X1.md", card("- Write `src/x/index.ts`."), paths)).toEqual([]);
    const golden = card("- Write `src/x/index.ts` and the goldens in `src/x/__golden__/`.");
    expect(r81("plan/cards/X1.md", golden, paths)).toEqual([]);
    expect(r77("plan/cards/X1.md", golden)).toEqual([
      "plan/cards/X1.md: a build order names src/x/__golden__/, which the spec job owns (standing owner: __golden__/**)",
    ]);
  });

  test("ARC-12 R81 rule (fix 5): a name covers a Paths entry by file, by suffix, by glob and by folder", () => {
    expect(covers("verify.mjs", "reference/sample-clients/verify.mjs")).toBe(true);
    expect(covers("tools/test/__fixtures__/x/", "tools/test/__fixtures__/x/a.json")).toBe(true);
    expect(covers("tools/test/__fixtures__/x/", "tools/test/__fixtures__/x/**")).toBe(true);
    expect(covers("tools/test/__fixtures__/x/a.json", "tools/test/__fixtures__/x/**")).toBe(true);
    expect(covers("tools/test/__fixtures__/x/", "tools/test/__fixtures__/y/a.json")).toBe(false);
    expect(covers("verify.mjs", "reference/sample-clients/verify-x.mjs")).toBe(false);
  });

  test("ARC-12 R81 rule (fix 6, check item 6): a negated Spec clause owns nothing", () => {
    const card = (spec) =>
      ["# X1 A card (Test)", "## Spec", spec, "## Build", "- Write `src/x/index.ts`."].join("\n");
    const paths = ["reference/sample-clients/verify.mjs"];
    expect(r81("plan/cards/X1.md", card("- Never touch verify.mjs."), paths)).toEqual([
      "plan/cards/X1.md: reference/sample-clients/verify.mjs is an expectation file in Paths that neither the Spec nor the Build side owns",
    ]);
    expect(
      r81("plan/cards/X1.md", card("- The build never edits `reference/sample-clients/verify.mjs`."), paths),
    ).toEqual([
      "plan/cards/X1.md: reference/sample-clients/verify.mjs is an expectation file in Paths that neither the Spec nor the Build side owns",
    ]);
    expect(r81("plan/cards/X1.md", card("- verify.mjs gains a line."), paths)).toEqual([]);
  });

  test("ARC-12 R81 rule (check item 5): a README in Paths spelled in any case still needs an owner", () => {
    const card = ["# X1 A card (Test)", "## Spec", "- Tests in `tools/test/x.test.mjs`.", "## Build", "- Write `src/x/index.ts`."].join("\n");
    expect(r81("plan/cards/X1.md", card, ["reference/x/readme.md"])).toEqual([
      "plan/cards/X1.md: reference/x/readme.md is an expectation file in Paths that neither the Spec nor the Build side owns",
    ]);
  });

  test("ARC-12 R77 R81 rule: a README the Spec section only tests (GL3) is the build's; one a spec clause hands over is the spec job's", () => {
    const card = (specLine) =>
      [
        "# X1 A card (Test)",
        "Paths: db/x/README.md",
        "## Spec",
        specLine,
        "## Build",
        "- `db/x/README.md` (apply order, for the client repo).",
      ].join("\n");
    const tested = card("- Contract base: `db/x/README.md` names the client-app commit.");
    expect(r77("plan/cards/X1.md", tested)).toEqual([]);
    expect(r81("plan/cards/X1.md", tested, ["db/x/README.md"])).toEqual([]);
    const handed = card("- The spec job writes the commit line in `db/x/README.md`.");
    expect(r77("plan/cards/X1.md", handed)).toEqual([
      "plan/cards/X1.md: a build order names db/x/README.md, which the spec job owns (db/x/README.md)",
    ]);
  });

  test('ARC-12 R81 rule: a "Who does what" spec bullet owns what it names', () => {
    const card = [
      "# X1 A card (Test)",
      "## Who does what",
      "- The spec job writes `tools/test/x.test.mjs` and the README count.",
      "- The build writes `src/x/index.ts`.",
    ].join("\n");
    expect(
      r81("plan/cards/X1.md", card, ["tools/test/x.test.mjs", "README.md", "src/x/index.ts"]),
    ).toEqual([]);
    expect(
      r81("plan/cards/X1.md", card.replace(" and the README count", ""), [
        "tools/test/x.test.mjs",
        "README.md",
      ]),
    ).toEqual([
      "plan/cards/X1.md: README.md is an expectation file in Paths that neither the Spec nor the Build side owns",
    ]);
  });

  test("ARC-12 R77 R81 rule (G5): FX8's fixed form plus a build bullet rewriting the sample-clients README pass count fails R77", () => {
    // Round 1's fixed plant: a Spec file label for the README; R81 counted it as the spec job's, R77 did not.
    const planted = fix(PLANTED_FX8);
    const fixed = planted.replace(
      "- verify.mjs gains the same rule, so a regenerated folder is refused too.",
      "- verify.mjs gains the same rule, so a regenerated folder is refused too.\n- `reference/sample-clients/README.md`: the pass count sentence, for the landing state.",
    );
    expect(fixed).not.toBe(planted);
    expect(r77("plan/cards/FX8.md", fixed)).toEqual([]);
    expect(r81("plan/cards/FX8.md", fixed, pathsLine(fixed))).toEqual([]);
    const both = fixed.replace(
      "regenerate 07, 09, 14, 15 with generate.mjs;",
      "regenerate 07, 09, 14, 15 with generate.mjs;\n- Rewrite the pass count in the sample-clients README for the landing state.\n",
    );
    expect(both).not.toBe(fixed);
    expect(r77("plan/cards/FX8.md", both)).toEqual([
      "plan/cards/FX8.md: a build order names README.md, which the spec job owns (reference/sample-clients/README.md)",
    ]);
    expect(r81("plan/cards/FX8.md", both, pathsLine(both))).toEqual([]);
  });

  test("ARC-12 R81 rule (G5): a README a Spec section only names is not the spec job's in R81 either, so with no build owner it fails", () => {
    const card = [
      "# X1 A card (Test)",
      "## Spec",
      "- Contract base: `db/x/README.md` names the client-app commit.",
      "## Build",
      "- Write `src/x/index.ts`.",
    ].join("\n");
    expect(r77("plan/cards/X1.md", card)).toEqual([]);
    expect(r81("plan/cards/X1.md", card, ["db/x/README.md"])).toEqual([
      "plan/cards/X1.md: db/x/README.md is an expectation file in Paths that neither the Spec nor the Build side owns",
    ]);
  });

  test("ARC-12 R81 rule (G7): a Paths glob is expanded over git's file list, and a Spec glob owns what it matches", () => {
    const files = [
      "reference/sample-clients/verify.mjs",
      "reference/sample-clients/verify-folders.mjs",
      "reference/sample-clients/generate.mjs",
    ];
    const paths = ["reference/sample-clients/verify*.mjs"];
    const card = (specLine) =>
      ["# X1 A card (Test)", "## Spec", specLine, "## Build", "- Write `src/x/index.ts`."].join("\n");
    expect(r81("plan/cards/X1.md", card("- `reference/sample-clients/verify.mjs` gains a line."), paths, files)).toEqual([
      "plan/cards/X1.md: reference/sample-clients/verify-folders.mjs (Paths reference/sample-clients/verify*.mjs) is an expectation file in Paths that neither the Spec nor the Build side owns",
    ]);
    expect(r81("plan/cards/X1.md", card("- `reference/sample-clients/verify*.mjs` gain a line."), paths, files)).toEqual([]);
    // A Spec glob owns a plain Paths entry it matches.
    expect(
      r81("plan/cards/X1.md", card("- `reference/sample-clients/verify*.mjs` gain a line."), ["reference/sample-clients/verify-folders.mjs"]),
    ).toEqual([]);
  });

  test("ARC-12 R81 every expectation file in an open card's Paths has an owner (KNOWN entries aside)", () => {
    const { problems: scan, read, open } = scanCards(SLICES().cards, liveStatuses());
    expect(scan).toEqual([]);
    // G8: the floor reads every card, never only the open ones.
    expect(
      read.filter((c) => c.paths.some((p) => isExp(p))).length,
      "no card has an expectation file in its Paths",
    ).toBeGreaterThan(0);
    const files = repoFiles();
    const problems = uniq(open.flatMap((c) => r81(c.src.label, c.src.text, c.paths, files)));
    expect(onlyKnown("R81", problems)).toEqual([]);
   }, 30_000);
});

describe("SC6 grammar coverage: every heading and label holding a job word maps to its job (ARC-12, A503)", () => {
  // Real forms from main: F03R's and W16's acceptance headings, F00's two third-level headings (plan/cards/F00.md:50,
  // :59), DG's spec fix heading, GL3's A498 build label and SC11's A500 bare label.
  const PLANT = [
    "# X1 A card (Test)",
    "## Acceptance checks (a new spec worker writes them first; Opus)",
    "- Plants in `tools/test/__fixtures__/x/`.",
    "## Findings review 1 (Test)",
    "### Fix list for the builder, in order",
    "1. Fix `tools/x.mjs`.",
    "### Tests for the spec job (before the build reopens; written by a worker who is not the builder)",
    "1. A plant for each fix.",
    "## Round 3 spec fix (2 Oct, from reports/DG-build.md on claude/DG; single cause, A306)",
    "Build (after the spec commit, all inside Paths):",
    "- B1 bridge.answer: answer_verbatim is `given` when the question id is a marker id.",
    "Build:",
    "- B1: track every client a pool opens.",
    "## Spec",
    "- Rules in `tools/test/x-rules.test.mjs`.",
    "## Build",
    "- Write `tools/x.mjs`.",
  ].join("\n");

  test("ARC-12 grammar coverage rule: round 1's reader fails each real form by name", () => {
    expect(grammarCoverage("plan/cards/X1.md", PLANT, ROUND1_READER)).toEqual([
      'plan/cards/X1.md: the heading "Acceptance checks (a new spec worker writes them first; Opus)" names the spec job but reads as no job',
      'plan/cards/X1.md: the heading "Fix list for the builder, in order" names the build job but reads as no job',
      'plan/cards/X1.md: the heading "Tests for the spec job (before the build reopens; written by a worker who is not the builder)" names the spec job but reads as no job',
      'plan/cards/X1.md: the heading "Round 3 spec fix (2 Oct, from reports/DG-build.md on claude/DG; single cause, A306)" names the spec job but reads as no job',
      'plan/cards/X1.md: the label "Build (after the spec commit, all inside Paths):" names the build job but reads as spec job',
      'plan/cards/X1.md: the label "Build:" gives its job to no bullet under it',
    ]);
  });

  test("ARC-12 grammar coverage rule: the reader R77 and R81 use maps every one of them", () => {
    expect(grammarCoverage("plan/cards/X1.md", PLANT)).toEqual([]);
  });

  test("ARC-12 grammar coverage rule: a heading or label with no job word, a label-like line that is not a label, and the title are out of its reach", () => {
    const card = [
      "# X1 Build the spec fixtures (Test)",
      "## Fix round 1",
      "## Also (A459, reports/W00c-spec-review-4.md)",
      "Spec commit: f64dedb0",
      "Build risks: keep the status literals.",
      "Build rules added: a yes or no cell resets to N.",
      "- Build: a bullet label gives its job to its own line only.",
    ].join("\n");
    expect(grammarCoverage("plan/cards/X1.md", card, ROUND1_READER)).toEqual([]);
    expect(grammarCoverage("plan/cards/X1.md", card)).toEqual([]);
  });

  test("ARC-12 grammar coverage: every heading and label line on an open card maps to its job", () => {
    const { problems: scan, open } = scanCards(SLICES().cards, liveStatuses());
    expect(scan).toEqual([]);
    expect(open.flatMap((c) => grammarCoverage(c.src.label, c.src.text))).toEqual([]);
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

  test("ARC-16 R78 rule (G6 a): the temp-repo tests exempt on main are exactly those with mkdtemp and a git init call", () => {
    const files = r78Files();
    const exempt = files.filter((f) => buildsOwnRepo(read(f)));
    expect(exempt.length, "no temp-repo test found").toBeGreaterThan(0);
    for (const f of exempt) {
      const { code, skel } = scanSource(read(f));
      expect(gitCalls(code, skel).some((c) => gitSubcommand(callWords(c.text)) === "init"), f).toBe(true);
    }
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
      "KNOWN[4] R99 reference/sample-clients/verify.mjs: the rule is not one of R77, R78, R81",
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
