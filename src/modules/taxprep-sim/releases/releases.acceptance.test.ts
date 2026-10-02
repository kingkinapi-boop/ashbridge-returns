// S02 acceptance: Taxprep release identifier lists (RT-22, RT-21, RT-23, RT-4, RT-7).
// Public functions under test (src/modules/taxprep-sim/releases/index.ts):
//   loadRelease(name, options?: { dir?: string }) -> { ok: true; release: Release } | { ok: false; reason: string }
//     (reads <dir or data/taxprep/releases>/<name>.json, validates it with zod, refuses duplicates, an identifier on
//     both lists and identifiers F03's grammar refuses, naming the identifier in the reason)
//   release.isInput(identifier: string) -> boolean (any copy index of a repeating group answers as its copy [1] cell)
//   diffReleases(from, to) -> { added: string[]; removed: string[]; renamed: { from: string; to: string }[] }
//   blockedBy(used, from, to) -> { identifier: string; replacement: string | null }[]
//   toReleaseList(release) -> the simulator's (S00) ReleaseCell list for the release's input cells
// Every test that runs against an unconfirmed release names it, with the word "unconfirmed", in its title (check 6).
import fc from "fast-check";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import {
  NATURAL_KEYS,
  parseCellId,
  parseTaxprepCsv,
  withCopyIndex,
} from "../../../contracts/taxprep";
import { createSimulator } from "../index";
import {
  CCA,
  SEED,
  committedReleaseNames,
  gifiByCode,
  readReleaseFile,
  s8,
  s8Changed,
  s8Release,
  sampleImportFiles,
  tempReleaseDir,
  trialDescriptions,
  type ReleaseFileFixture,
  type TempDir,
} from "./__fixtures__/release-files";
import {
  blockedBy,
  diffReleases,
  loadRelease,
  toReleaseList,
  type Release,
} from "./index";

const SIM1 = "SIM-2025.1";
const SIM2 = "SIM-2025.2";

function mustLoad(name: string, dir?: string): Release {
  const r = dir === undefined ? loadRelease(name) : loadRelease(name, { dir });
  if (!r.ok)
    throw new Error(`expected release ${name} to load, got: ${r.reason}`);
  return r.release;
}

const ids = (cells: readonly { identifier: string }[]): string[] =>
  cells.map((c) => c.identifier);
const sorted = (xs: readonly string[]): string[] => [...xs].sort();

/** Check 6: a test that runs against an unconfirmed release names it, and says "unconfirmed", in its own title. */
function namesUnconfirmedReleases(names: () => ReleaseFileFixture[]): void {
  beforeEach(() => {
    const title = expect.getState().currentTestName ?? "";
    for (const file of names()) {
      if (file.confirmed) continue;
      expect(
        title,
        `this test runs against ${file.name}, which is unconfirmed: its title must name it`,
      ).toContain(file.name);
      expect(title).toContain("unconfirmed");
    }
  });
}

/** An empty simulated return in the release, holding one copy of each repeating group (RT-22's reference return). */
function referenceExport(release: Release): Uint8Array {
  let n = 0;
  const sim = createSimulator({
    releaseList: toReleaseList(release),
    releaseName: release.name,
    newGuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  });
  const ret = sim.createReturn({
    businessNumber: "100000001RC0001",
    yearEnd: "2025-12-31",
    returnName: "Reference Return (Test)",
    corporationName: "Reference Return (Test)",
    clientCode: "C000",
  });
  for (const group of release.repeatingGroups) sim.addCopy(ret, group.path);
  return sim.exportCsv(ret, "all-input");
}

function readBack(
  bytes: Uint8Array,
): { id: string; description: string | null }[] {
  const parsed = parseTaxprepCsv(bytes);
  if (!parsed.ok)
    throw new Error(
      `F03 refused the simulator's export: ${JSON.stringify(parsed.faults)}`,
    );
  return parsed.file.rows.map((r) => ({
    id: r.id.text,
    description: r.description,
  }));
}

// ---------------------------------------------------------------------------------------------------------------
describe("S02 the placeholder releases SIM-2025.1 and SIM-2025.2 (both unconfirmed)", () => {
  namesUnconfirmedReleases(() => [
    readReleaseFile(SIM1),
    readReleaseFile(SIM2),
  ]);

  test("RT-22 SIM-2025.1 and SIM-2025.2 load, each named as its file, product year 2025 (unconfirmed releases SIM-2025.1, SIM-2025.2)", () => {
    const one = mustLoad(SIM1);
    const two = mustLoad(SIM2);
    expect(one.name).toBe(SIM1);
    expect(two.name).toBe(SIM2);
    expect(one.productYear).toBe(2025);
    expect(two.productYear).toBe(2025);
    expect(one.inputCells.length).toBeGreaterThan(0);
    expect(two.inputCells.length).toBeGreaterThan(0);
  });

  test("RT-22 check 6: every placeholder release says confirmed false, in its file and once loaded (unconfirmed releases SIM-2025.1, SIM-2025.2)", () => {
    const names = committedReleaseNames();
    expect(names).toEqual(expect.arrayContaining([SIM1, SIM2]));
    for (const name of [SIM1, SIM2])
      expect(readReleaseFile(name).source.kind).toBe("placeholder");
    let placeholders = 0;
    for (const name of names) {
      const file = readReleaseFile(name);
      if (file.source.kind !== "placeholder") continue;
      placeholders += 1;
      expect(file.confirmed, `${name} is a placeholder`).toBe(false);
      expect(mustLoad(name).confirmed, `${name} loaded`).toBe(false);
    }
    expect(placeholders).toBeGreaterThanOrEqual(2);
  });

  test("RT-22 check 1: diffReleases(SIM-2025.1, SIM-2025.2) returns exactly the one removed, one renamed and one added identifier (unconfirmed releases SIM-2025.1, SIM-2025.2)", () => {
    const f1 = readReleaseFile(SIM1);
    const f2 = readReleaseFile(SIM2);
    const table = f2.renamed ?? [];
    expect(table).toHaveLength(1);
    const rename = table[0] as { from: string; to: string };
    const in1 = new Set(ids(f1.inputCells));
    const in2 = new Set(ids(f2.inputCells));
    expect(in1.has(rename.from)).toBe(true);
    expect(in2.has(rename.from)).toBe(false);
    expect(in2.has(rename.to)).toBe(true);
    expect(in1.has(rename.to)).toBe(false);
    const removed = [...in1].filter((x) => !in2.has(x) && x !== rename.from);
    const added = [...in2].filter((x) => !in1.has(x) && x !== rename.to);
    expect(removed).toHaveLength(1);
    expect(added).toHaveLength(1);

    const diff = diffReleases(mustLoad(SIM1), mustLoad(SIM2));
    expect(diff.removed).toEqual(removed);
    expect(diff.added).toEqual(added);
    expect(diff.renamed).toEqual([{ from: rename.from, to: rename.to }]);
  });

  test("RT-22 a rename table in the older release is not read: diffReleases(SIM-2025.2, SIM-2025.1) shows the rename back as one removed and one added (unconfirmed releases SIM-2025.1, SIM-2025.2)", () => {
    const f1 = readReleaseFile(SIM1);
    expect(f1.renamed ?? []).toEqual([]);
    const f2 = readReleaseFile(SIM2);
    const rename = (f2.renamed ?? [])[0] as { from: string; to: string };
    const diff = diffReleases(mustLoad(SIM2), mustLoad(SIM1));
    expect(diff.renamed).toEqual([]);
    expect(diff.removed).toContain(rename.to);
    expect(diff.added).toContain(rename.from);
    expect(diff.removed).toHaveLength(2);
    expect(diff.added).toHaveLength(2);
  });

  test("RT-22 a release compared with itself has no difference (unconfirmed releases SIM-2025.1, SIM-2025.2)", () => {
    for (const name of [SIM1, SIM2]) {
      expect(diffReleases(mustLoad(name), mustLoad(name))).toEqual({
        added: [],
        removed: [],
        renamed: [],
      });
    }
  });

  test("RT-22 check 2: blockedBy with the removed and the renamed identifier returns both, the renamed one with its replacement (unconfirmed releases SIM-2025.1, SIM-2025.2)", () => {
    const one = mustLoad(SIM1);
    const two = mustLoad(SIM2);
    const diff = diffReleases(one, two);
    const removed = diff.removed[0] as string;
    const rename = diff.renamed[0] as { from: string; to: string };
    const blocked = blockedBy([removed, rename.from], one, two);
    expect(
      [...blocked].sort((a, b) => a.identifier.localeCompare(b.identifier)),
    ).toEqual(
      [
        { identifier: removed, replacement: null },
        { identifier: rename.from, replacement: rename.to },
      ].sort((a, b) => a.identifier.localeCompare(b.identifier)),
    );
  });

  test("RT-22 check 2: blockedBy with a used list touching neither the removed nor the renamed identifier returns none (unconfirmed releases SIM-2025.1, SIM-2025.2)", () => {
    const one = mustLoad(SIM1);
    const two = mustLoad(SIM2);
    const diff = diffReleases(one, two);
    const touched = new Set([
      ...diff.removed,
      ...diff.renamed.map((r) => r.from),
    ]);
    const used = ids(one.inputCells).filter((x) => !touched.has(x));
    expect(used.length).toBeGreaterThan(0);
    expect(blockedBy(used, one, two)).toEqual([]);
    expect(blockedBy([], one, two)).toEqual([]);
  });

  test("RT-21 check 3: every identifier the sample clients import.csv files use is an input cell of SIM-2025.1 (unconfirmed release SIM-2025.1)", () => {
    const one = mustLoad(SIM1);
    const listed = new Set(ids(one.inputCells));
    const files = sampleImportFiles();
    expect(files.length).toBeGreaterThanOrEqual(10);
    let seen = 0;
    for (const { client, bytes } of files) {
      const parsed = parseTaxprepCsv(bytes);
      if (!parsed.ok)
        throw new Error(
          `test data: F03 refused ${client}'s import.csv: ${JSON.stringify(parsed.faults)}`,
        );
      for (const row of parsed.file.rows) {
        seen += 1;
        expect(
          listed.has(row.id.text),
          `${client}: ${row.id.text} is listed in SIM-2025.1`,
        ).toBe(true);
        expect(
          one.isInput(row.id.text),
          `${client}: ${row.id.text} is an input cell`,
        ).toBe(true);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  test("RT-21 SIM-2025.1 keeps every GIFI code of taxprep-cells.json as an amount input cell with the description Taxprep exported, never an invented one (unconfirmed release SIM-2025.1)", () => {
    const one = mustLoad(SIM1);
    const byId = new Map(one.inputCells.map((c) => [c.identifier, c]));
    const trial = trialDescriptions();
    const table = gifiByCode();
    expect(Object.keys(table).length).toBe(300);
    for (const [code, identifier] of Object.entries(table)) {
      const cell = byId.get(identifier);
      expect(cell, `GIFI ${code} (${identifier}) is listed`).toBeDefined();
      if (cell === undefined) continue;
      expect(cell.kind, identifier).toBe("amount");
      expect(
        cell.description.startsWith(`GIFI code ${code} - `),
        `${identifier}: ${cell.description}`,
      ).toBe(true);
      expect(
        [...(trial.get(identifier) ?? [])],
        `${identifier} description is one the trial exported`,
      ).toContain(cell.description);
    }
    for (const cell of one.inputCells) {
      if (cell.description === "") continue;
      expect(
        [...(trial.get(cell.identifier) ?? [])],
        `${cell.identifier}: no invented description`,
      ).toContain(cell.description);
    }
  });

  test("RT-4 check 7: isInput is true for every input cell and false for every calculated cell of SIM-2025.1 and SIM-2025.2 (unconfirmed releases SIM-2025.1, SIM-2025.2)", () => {
    for (const name of [SIM1, SIM2]) {
      const r = mustLoad(name);
      for (const id of ids(r.inputCells))
        expect(r.isInput(id), `${name}: ${id}`).toBe(true);
      for (const id of ids(r.calculatedCells))
        expect(r.isInput(id), `${name}: calculated ${id}`).toBe(false);
    }
    const two = mustLoad(SIM2);
    for (const id of diffReleases(mustLoad(SIM1), two).removed)
      expect(two.isInput(id), `${SIM2}: removed ${id}`).toBe(false);
  });

  test("RT-7 RT-22 each repeating group of SIM-2025.1 and SIM-2025.2 keeps its natural-key cell and copy limit and is listed under copy [1] (unconfirmed releases SIM-2025.1, SIM-2025.2)", () => {
    for (const name of [SIM1, SIM2]) {
      const r = mustLoad(name);
      const listed = new Set([...ids(r.inputCells), ...ids(r.calculatedCells)]);
      const paths = new Set(r.repeatingGroups.map((g) => g.path));
      for (const g of r.repeatingGroups) {
        expect(
          Number.isInteger(g.copyLimit) && g.copyLimit >= 1,
          `${name}: ${g.path} copy limit`,
        ).toBe(true);
        expect(
          listed.has(`${g.path}[1].${g.naturalKey}`),
          `${name}: ${g.path} natural key under copy [1]`,
        ).toBe(true);
        if (NATURAL_KEYS[g.path] !== undefined)
          expect(g.naturalKey).toBe(NATURAL_KEYS[g.path]);
      }
      for (const id of listed) {
        const parsed = parseCellId(id);
        if (!parsed.ok) throw new Error(parsed.reason);
        if (parsed.id.copyPath !== null && paths.has(parsed.id.copyPath))
          expect(parsed.id.copyIndex, id).toBe(1);
      }
    }
  });

  test('RT-22 check 5: the "all input cells" export of a reference return in SIM-2025.1, read back through F03, gives the release file\'s identifiers (unconfirmed release SIM-2025.1)', () => {
    const one = mustLoad(SIM1);
    const rows = readBack(referenceExport(one));
    const exported = rows.map((r) => r.id);
    expect(new Set(exported)).toEqual(new Set(ids(one.inputCells)));
    expect(exported).toHaveLength(one.inputCells.length);
    expect(exported).toEqual(ids(one.inputCells));
    const description = new Map(
      one.inputCells.map((c) => [c.identifier, c.description]),
    );
    for (const r of rows)
      expect(r.description ?? "", r.id).toBe(description.get(r.id));
  });

  test("RT-22 check 5: the same holds for SIM-2025.2, so a captured list and a release file compare the same way (unconfirmed release SIM-2025.2)", () => {
    const two = mustLoad(SIM2);
    const exported = readBack(referenceExport(two)).map((r) => r.id);
    expect(exported).toEqual(ids(two.inputCells));
    const one = mustLoad(SIM1);
    expect(sorted(exported)).not.toEqual(sorted(ids(one.inputCells)));
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe("S02 small test releases TEST-S8, TEST-S8B, TEST-S8C, TEST-S8D and TEST-S8E (all unconfirmed)", () => {
  let tmp: TempDir;
  const base = s8Release("TEST-S8");
  const changed = s8Changed("TEST-S8B", true);
  const noTable = s8Changed("TEST-S8C", false);
  const moved: ReleaseFileFixture = {
    ...s8Release("TEST-S8D"),
    inputCells: s8Release().inputCells.filter(
      (c) => c.identifier !== "GFGBA.Ttwgba64",
    ),
    calculatedCells: [
      ...s8Release().calculatedCells,
      {
        identifier: "GFGBA.Ttwgba64",
        description: "GIFI code 1002 - Deposits (Test)",
        kind: "amount",
      },
    ],
  };
  namesUnconfirmedReleases(() => [base, changed, noTable, moved, described]);

  const dup = s8Release("TEST-DUP");
  dup.inputCells.push({
    identifier: "GFGBA.Ttwgba64",
    description: "again (Test)",
    kind: "amount",
  });
  const both = s8Release("TEST-BOTH");
  both.calculatedCells.push({
    identifier: s8(1, "Ttw08cA5"),
    description: "twice (Test)",
    kind: "amount",
  });
  const grammar = s8Release("TEST-GRAMMAR");
  grammar.inputCells.push({
    identifier: "FDONE.SLIPA[0].TtwoneA2",
    description: "bad index (Test)",
    kind: "text",
  });
  const grammarCalc = s8Release("TEST-GRAMMAR2");
  grammarCalc.calculatedCells.push({
    identifier: "FDONE.ttwone66",
    description: "lower case (Test)",
    kind: "amount",
  });
  const noConfirmed: Record<string, unknown> = {
    ...s8Release("TEST-NOCONFIRMED"),
  };
  delete noConfirmed.confirmed;
  const described: ReleaseFileFixture = {
    ...s8Release("TEST-S8E"),
    inputCells: s8Release().inputCells.map((c) =>
      c.identifier === "GFGBA.Ttwgba64"
        ? { ...c, description: "GIFI code 1002 - Deposits, reworded (Test)" }
        : c,
    ),
  };

  beforeAll(() => {
    tmp = tempReleaseDir(
      [
        base,
        changed,
        noTable,
        moved,
        described,
        dup,
        both,
        grammar,
        grammarCalc,
      ],
      {
        "TEST-NOCONFIRMED": noConfirmed,
        "TEST-NOTJSON": "{ this is not json",
      },
    );
  });
  afterAll(() => {
    tmp.cleanup();
  });

  test("RT-4 check 7: isInput is true for CCACat.FD08C[3].FED.Ttw08cA1 when the release lists CCACat.FD08C[1].FED.Ttw08cA1 (unconfirmed release TEST-S8)", () => {
    const r = mustLoad("TEST-S8", tmp.dir);
    expect(ids(r.inputCells)).toContain("CCACat.FD08C[1].FED.Ttw08cA1");
    expect(r.isInput("CCACat.FD08C[3].FED.Ttw08cA1")).toBe(true);
    expect(r.isInput("CCACat.FD08C[1].FED.Ttw08cA1")).toBe(true);
    expect(r.isInput("CCACat.FD08C[2].FED.Ttw08cA5")).toBe(true);
    expect(r.isInput("CCACat.FD08C[50].FED.Ttw08cA2")).toBe(true);
  });

  test("RT-4 check 7: isInput is false for every calculated identifier, under any copy index, in TEST-S8 (unconfirmed release TEST-S8)", () => {
    const r = mustLoad("TEST-S8", tmp.dir);
    for (const id of ids(r.calculatedCells))
      expect(r.isInput(id), id).toBe(false);
    expect(r.isInput("CCACat.FD08C[3].FED.Ttw08cA21")).toBe(false);
    expect(r.isInput("CCACat.FD08C[1].FED.Ttw08cA21")).toBe(false);
  });

  test("RT-4 isInput refuses what the release does not list as input: an unknown cell, a copy index on a form that does not repeat, a malformed identifier (unconfirmed release TEST-S8)", () => {
    const r = mustLoad("TEST-S8", tmp.dir);
    expect(r.isInput("FDONE.Ttwone5")).toBe(false);
    expect(r.isInput("CCACat.FD08C[3].FED.Ttw08cA99")).toBe(false);
    expect(r.isInput("GFGBA[2].Ttwgba64")).toBe(false);
    expect(r.isInput("IDENT[1].Ident7")).toBe(false);
    expect(r.isInput("GFBGII[2].GFGII.Ttwgii4")).toBe(false);
    expect(r.isInput("CCACat.FD08C[0].FED.Ttw08cA1")).toBe(false);
    expect(r.isInput("CCACat.FD08C.FED.Ttw08cA1")).toBe(false);
    expect(r.isInput("")).toBe(false);
    expect(r.isInput("gfgba.ttwgba64")).toBe(false);
    expect(r.isInput("GFGBA.Ttwgba64")).toBe(true);
    expect(r.isInput("IDENT.Ident7")).toBe(true);
  });

  test("RT-23 check 4: a release file with a duplicate identifier is refused on load with the identifier named (unconfirmed release TEST-DUP)", () => {
    const r = loadRelease("TEST-DUP", { dir: tmp.dir });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("GFGBA.Ttwgba64");
  });

  test("RT-23 check 4: a release file with an identifier on both the input and the calculated list is refused on load with the identifier named (unconfirmed release TEST-BOTH)", () => {
    const r = loadRelease("TEST-BOTH", { dir: tmp.dir });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("CCACat.FD08C[1].FED.Ttw08cA5");
  });

  test("RT-23 check 4: a release file with an identifier F03's grammar refuses is refused on load with the identifier named, on either list (unconfirmed releases TEST-GRAMMAR, TEST-GRAMMAR2)", () => {
    const one = loadRelease("TEST-GRAMMAR", { dir: tmp.dir });
    expect(one.ok).toBe(false);
    if (!one.ok) expect(one.reason).toContain("FDONE.SLIPA[0].TtwoneA2");
    const two = loadRelease("TEST-GRAMMAR2", { dir: tmp.dir });
    expect(two.ok).toBe(false);
    if (!two.ok) expect(two.reason).toContain("FDONE.ttwone66");
  });

  test("RT-23 check 4, no false alarm: the clean test releases load (unconfirmed releases TEST-S8, TEST-S8B, TEST-S8C)", () => {
    for (const name of [
      "TEST-S8",
      "TEST-S8B",
      "TEST-S8C",
      "TEST-S8D",
      "TEST-S8E",
    ]) {
      const r = loadRelease(name, { dir: tmp.dir });
      expect(r.ok, name).toBe(true);
      if (r.ok) expect(r.release.name).toBe(name);
    }
    const r = mustLoad("TEST-S8", tmp.dir);
    expect(r.confirmed).toBe(false);
    expect(r.source.kind).toBe("placeholder");
    expect(ids(r.inputCells)).toEqual(ids(base.inputCells));
    expect(ids(r.calculatedCells)).toEqual(ids(base.calculatedCells));
    expect(r.inputCells.map((c) => c.kind)).toEqual(
      base.inputCells.map((c) => c.kind),
    );
    expect(r.inputCells.map((c) => c.description)).toEqual(
      base.inputCells.map((c) => c.description),
    );
    expect(r.repeatingGroups).toEqual([
      { path: CCA, naturalKey: "FED.Ttw08cA1", copyLimit: 50 },
    ]);
  });

  test("RT-23 a release file with no confirmed flag, a file that is not JSON, or a release that has no file is refused on load with a reason (unconfirmed release TEST-NOCONFIRMED)", () => {
    const missingFlag = loadRelease("TEST-NOCONFIRMED", { dir: tmp.dir });
    expect(missingFlag.ok).toBe(false);
    if (!missingFlag.ok) expect(missingFlag.reason).toMatch(/confirmed/);
    const notJson = loadRelease("TEST-NOTJSON", { dir: tmp.dir });
    expect(notJson.ok).toBe(false);
    if (!notJson.ok) expect(notJson.reason.length).toBeGreaterThan(0);
    const none = loadRelease("TEST-NOSUCH", { dir: tmp.dir });
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.reason).toContain("TEST-NOSUCH");
  });

  test("RT-22 diffReleases(TEST-S8, TEST-S8B) finds the removed, renamed and added cells from the newer file's rename table (unconfirmed releases TEST-S8, TEST-S8B)", () => {
    const diff = diffReleases(
      mustLoad("TEST-S8", tmp.dir),
      mustLoad("TEST-S8B", tmp.dir),
    );
    expect(diff).toEqual({
      added: [s8(1, "Ttw08cA9")],
      removed: [s8(1, "Ttw08cA5")],
      renamed: [{ from: s8(1, "Ttw08cA10"), to: s8(1, "Ttw08cA11") }],
    });
  });

  test("RT-22 without a rename table a rename shows as one removed and one added: diffReleases(TEST-S8, TEST-S8C) (unconfirmed releases TEST-S8, TEST-S8C)", () => {
    const diff = diffReleases(
      mustLoad("TEST-S8", tmp.dir),
      mustLoad("TEST-S8C", tmp.dir),
    );
    expect(diff.renamed).toEqual([]);
    expect(sorted(diff.removed)).toEqual(
      sorted([s8(1, "Ttw08cA5"), s8(1, "Ttw08cA10")]),
    );
    expect(sorted(diff.added)).toEqual(
      sorted([s8(1, "Ttw08cA9"), s8(1, "Ttw08cA11")]),
    );
  });

  test("RT-22 a description that changes while the identifier stays is not a difference (unconfirmed releases TEST-S8, TEST-S8E)", () => {
    const r = mustLoad("TEST-S8E", tmp.dir);
    expect(
      r.inputCells.find((c) => c.identifier === "GFGBA.Ttwgba64")?.description,
    ).toBe("GIFI code 1002 - Deposits, reworded (Test)");
    expect(diffReleases(mustLoad("TEST-S8", tmp.dir), r)).toEqual({
      added: [],
      removed: [],
      renamed: [],
    });
    expect(
      blockedBy(["GFGBA.Ttwgba64"], mustLoad("TEST-S8", tmp.dir), r),
    ).toEqual([]);
  });

  test("RT-22 RT-4 blockedBy names a used identifier under any copy of a repeating group, with the replacement under the same copy (unconfirmed releases TEST-S8, TEST-S8B)", () => {
    const from = mustLoad("TEST-S8", tmp.dir);
    const to = mustLoad("TEST-S8B", tmp.dir);
    const used = [
      s8(3, "Ttw08cA5"),
      s8(2, "Ttw08cA10"),
      s8(2, "Ttw08cA1"),
      "GFGBA.Ttwgba64",
    ];
    const blocked = [...blockedBy(used, from, to)].sort((a, b) =>
      a.identifier.localeCompare(b.identifier),
    );
    expect(blocked).toEqual(
      [
        { identifier: s8(3, "Ttw08cA5"), replacement: null },
        { identifier: s8(2, "Ttw08cA10"), replacement: s8(2, "Ttw08cA11") },
      ].sort((a, b) => a.identifier.localeCompare(b.identifier)),
    );
  });

  test("RT-22 RT-4 blockedBy: a used input cell that the newer release lists only as calculated is blocked, since the writer refuses it (unconfirmed releases TEST-S8, TEST-S8D)", () => {
    const from = mustLoad("TEST-S8", tmp.dir);
    const to = mustLoad("TEST-S8D", tmp.dir);
    expect(to.isInput("GFGBA.Ttwgba64")).toBe(false);
    expect(diffReleases(from, to).removed).toEqual(["GFGBA.Ttwgba64"]);
    expect(blockedBy(["GFGBA.Ttwgba64", "IDENT.Ident7"], from, to)).toEqual([
      { identifier: "GFGBA.Ttwgba64", replacement: null },
    ]);
  });

  test("RT-22 property: with no rename table, diffReleases gives exactly the identifiers only in the newer list (added) and only in the older list (removed), and blockedBy of the older list is the removed ones (unconfirmed generated releases TEST-PROP-A, TEST-PROP-B)", () => {
    const pool = Array.from(
      { length: 14 },
      (_, i) => `GFGBA.Ttwgba${String(60 + i)}`,
    );
    const cell = (identifier: string) => ({
      identifier,
      description: "",
      kind: "amount" as const,
    });
    fc.assert(
      fc.property(fc.subarray(pool), fc.subarray(pool), (a, b) => {
        const fa: ReleaseFileFixture = {
          ...s8Release("TEST-PROP-A"),
          inputCells: a.map(cell),
          calculatedCells: [],
          repeatingGroups: [],
        };
        const fb: ReleaseFileFixture = {
          ...s8Release("TEST-PROP-B"),
          inputCells: b.map(cell),
          calculatedCells: [],
          repeatingGroups: [],
        };
        const t = tempReleaseDir([fa, fb]);
        try {
          const ra = mustLoad("TEST-PROP-A", t.dir);
          const rb = mustLoad("TEST-PROP-B", t.dir);
          const diff = diffReleases(ra, rb);
          const onlyA = a.filter((x) => !b.includes(x));
          const onlyB = b.filter((x) => !a.includes(x));
          expect(sorted(diff.removed)).toEqual(sorted(onlyA));
          expect(sorted(diff.added)).toEqual(sorted(onlyB));
          expect(diff.renamed).toEqual([]);
          expect(sorted(blockedBy(a, ra, rb).map((x) => x.identifier))).toEqual(
            sorted(onlyA),
          );
          expect(
            blockedBy(a, ra, rb).every((x) => x.replacement === null),
          ).toBe(true);
          expect(blockedBy(b, ra, rb)).toEqual([]);
        } finally {
          t.cleanup();
        }
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  test('RT-22 check 5: the "all input cells" export of a reference return in TEST-S8 (one copy of each repeating group) lists exactly its input cells, in its order, with its descriptions (unconfirmed release TEST-S8)', () => {
    const r = mustLoad("TEST-S8", tmp.dir);
    const rows = readBack(referenceExport(r));
    expect(rows.map((x) => x.id)).toEqual(ids(base.inputCells));
    expect(rows.map((x) => x.description ?? "")).toEqual(
      base.inputCells.map((c) => c.description),
    );
    const list = toReleaseList(r);
    expect(list.map((c) => c.identifier)).toEqual(ids(base.inputCells));
    expect(list.map((c) => c.kind)).toEqual(base.inputCells.map((c) => c.kind));
    expect(
      list.filter((c) => c.repeating === true).map((c) => c.identifier),
    ).toEqual(ids(base.inputCells).filter((x) => x.startsWith(`${CCA}[1].`)));
  });

  test("RT-22 check 5: with two copies of the repeating group, the export lists its cells under [1] and [2], so a release is compared on a reference return holding one copy (unconfirmed release TEST-S8)", () => {
    const r = mustLoad("TEST-S8", tmp.dir);
    let n = 0;
    const sim = createSimulator({
      releaseList: toReleaseList(r),
      releaseName: r.name,
      newGuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    });
    const ret = sim.createReturn({
      businessNumber: "100000002RC0001",
      yearEnd: "2025-12-31",
      returnName: "Two Copies (Test)",
      corporationName: "Two Copies (Test)",
      clientCode: "C001",
    });
    sim.addCopy(ret, CCA);
    sim.addCopy(ret, CCA);
    const exported = readBack(sim.exportCsv(ret, "all-input")).map((x) => x.id);
    const parsed = parseCellId(s8(1, "Ttw08cA1"));
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(exported).toContain(withCopyIndex(parsed.id, 2).text);
    for (const id of exported) expect(r.isInput(id), id).toBe(true);
  });
});
