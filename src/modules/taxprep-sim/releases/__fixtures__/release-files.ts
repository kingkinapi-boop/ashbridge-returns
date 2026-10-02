// Test fixtures for S02 (release identifier lists). Not product code: typed release files written to a throwaway
// folder, plus raw reads of the committed release files and the trial's exports, so the tests can compute what the
// product should say without going through the product.
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SEED = 20261002;

/** The repo root (this file is src/modules/taxprep-sim/releases/__fixtures__/release-files.ts). */
export const REPO_ROOT = fileURLToPath(
  new URL("../../../../../", import.meta.url),
);
export const RELEASES_DIR = path.join(REPO_ROOT, "data", "taxprep", "releases");
export const SAMPLE_CLIENTS_DIR = path.join(
  REPO_ROOT,
  "reference",
  "sample-clients",
);

export type KindFixture = "amount" | "text" | "date" | "yesNo" | "rate";
export type CellFixture = {
  identifier: string;
  description: string;
  kind: KindFixture;
};
export type GroupFixture = {
  path: string;
  naturalKey: string;
  copyLimit: number;
};

/**
 * The shape of `data/taxprep/releases/<name>.json` (S02 Build): the release name (the file name without `.json`),
 * the product year, whether it is confirmed, its source (a placeholder, or a trial capture with its date), the input
 * cells ("Select all input cells") and the calculated cells (the extra cells "Select all" gives), each in Taxprep's
 * export order, the repeating groups (path, natural-key cell relative to the copy, copy limit; RT-7) and the rename
 * table (from, to) the newer release keeps.
 */
export type ReleaseFileFixture = {
  name: string;
  productYear: number;
  confirmed: boolean;
  source: {
    kind: "placeholder" | "trial-capture";
    date?: string;
    note?: string;
  };
  inputCells: CellFixture[];
  calculatedCells: CellFixture[];
  repeatingGroups: GroupFixture[];
  renamed?: { from: string; to: string }[];
};

export const CCA = "CCACat.FD08C";
export const s8 = (n: number, cell: string): string =>
  `${CCA}[${String(n)}].FED.${cell}`;

/** A small release with one repeating group (Schedule 8, one copy per CCA class), made up for the tests. */
export function s8Release(name = "TEST-S8"): ReleaseFileFixture {
  return {
    name,
    productYear: 2025,
    confirmed: false,
    source: { kind: "placeholder", note: "S02 test fixture (Test)" },
    inputCells: [
      {
        identifier: "IDENT.Ident7",
        description: "Line 001 - Business number (Test)",
        kind: "text",
      },
      {
        identifier: "GFGBA.Ttwgba64",
        description: "GIFI code 1002 - Deposits (Test)",
        kind: "amount",
      },
      {
        identifier: s8(1, "Ttw08cA1"),
        description: "CCA class number (Test)",
        kind: "text",
      },
      {
        identifier: s8(1, "Ttw08cA2"),
        description: "CCA rate (Test)",
        kind: "rate",
      },
      {
        identifier: s8(1, "Ttw08cA5"),
        description: "UCC at start of year (Test)",
        kind: "amount",
      },
      {
        identifier: s8(1, "Ttw08cA10"),
        description: "Additions not subject to 1100(2) (Test)",
        kind: "amount",
      },
    ],
    calculatedCells: [
      {
        identifier: s8(1, "Ttw08cA21"),
        description: "Maximum CCA (Test)",
        kind: "amount",
      },
      {
        identifier: "FDONE.Ttwone66",
        description: "Net income for tax (Test)",
        kind: "amount",
      },
      {
        identifier: "GFBGII[1].GFGII.Ttwgii4",
        description: "Total revenue (Test)",
        kind: "amount",
      },
    ],
    repeatingGroups: [{ path: CCA, naturalKey: "FED.Ttw08cA1", copyLimit: 50 }],
  };
}

/**
 * TEST-S8 changed the way SIM-2025.2 changes SIM-2025.1: A5 removed, A10 renamed to A11 (in the rename table),
 * A9 added. With `withTable: false` the rename table is left out, so the rename is only a removal and an addition.
 */
export function s8Changed(
  name = "TEST-S8B",
  withTable = true,
): ReleaseFileFixture {
  const base = s8Release(name);
  const inputCells = base.inputCells
    .filter((c) => c.identifier !== s8(1, "Ttw08cA5"))
    .map((c) =>
      c.identifier === s8(1, "Ttw08cA10")
        ? {
            ...c,
            identifier: s8(1, "Ttw08cA11"),
            description: "Additions (Test)",
          }
        : c,
    );
  inputCells.push({
    identifier: s8(1, "Ttw08cA9"),
    description: "Additions subject to 1100(2) (Test)",
    kind: "amount",
  });
  const file: ReleaseFileFixture = { ...base, inputCells };
  if (withTable)
    file.renamed = [{ from: s8(1, "Ttw08cA10"), to: s8(1, "Ttw08cA11") }];
  return file;
}

export type TempDir = { dir: string; cleanup: () => void };

/** A throwaway folder holding the given release files (typed) and raw files (any JSON value, or any text). */
export function tempReleaseDir(
  files: ReleaseFileFixture[],
  raw: Record<string, unknown> = {},
): TempDir {
  const dir = mkdtempSync(path.join(os.tmpdir(), "s02-releases-"));
  for (const f of files)
    writeFileSync(
      path.join(dir, `${f.name}.json`),
      JSON.stringify(f, null, 2),
      "utf8",
    );
  for (const [name, value] of Object.entries(raw)) {
    writeFileSync(
      path.join(dir, `${name}.json`),
      typeof value === "string" ? value : JSON.stringify(value),
      "utf8",
    );
  }
  return {
    dir,
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** A committed release file read as plain JSON (no validation): what the test expects, computed apart from the product. */
export function readReleaseFile(name: string): ReleaseFileFixture {
  return JSON.parse(
    readFileSync(path.join(RELEASES_DIR, `${name}.json`), "utf8"),
  ) as ReleaseFileFixture;
}

/** Every committed release name (file names under data/taxprep/releases/ without `.json`); [] when the folder is missing. */
export function committedReleaseNames(): string[] {
  try {
    return readdirSync(RELEASES_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -".json".length))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Every sample client's `taxprep/import.csv` (folder name, bytes). Git may hand the file over with LF line ends (W00
 * makes the CSVs CRLF), so the line ends are set to Taxprep's CR LF here, as S00's harness does; nothing else changes.
 */
export function sampleImportFiles(): { client: string; bytes: Buffer }[] {
  const out: { client: string; bytes: Buffer }[] = [];
  for (const entry of readdirSync(SAMPLE_CLIENTS_DIR, {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(
      SAMPLE_CLIENTS_DIR,
      entry.name,
      "taxprep",
      "import.csv",
    );
    try {
      out.push({
        client: entry.name,
        bytes: Buffer.from(
          readFileSync(file, "latin1").replace(/\r?\n/g, "\r\n"),
          "latin1",
        ),
      });
    } catch {
      // a folder with no import file (lib/, clients/) is not a sample client's return
    }
  }
  return out.sort((a, b) => a.client.localeCompare(b.client));
}

/** The GIFI code to identifier table of `reference/sample-clients/lib/taxprep-cells.json`. */
export function gifiByCode(): Record<string, string> {
  const file = JSON.parse(
    readFileSync(
      path.join(SAMPLE_CLIENTS_DIR, "lib", "taxprep-cells.json"),
      "utf8",
    ),
  ) as { gifi: { byCode: Record<string, string> } };
  return file.gifi.byCode;
}

/**
 * Taxprep's own description text for each identifier, from every trial export under reference/taxprep/<day>/exports/
 * (test data read line by line: `identifier,"current","last","description"`). An identifier may carry more than one
 * text when two exports differ; the tests accept any text the trial recorded and never an invented one.
 */
export function trialDescriptions(): Map<string, Set<string>> {
  const root = path.join(REPO_ROOT, "reference", "taxprep");
  const out = new Map<string, Set<string>>();
  const line = /^([^,"[\]]+(?:\[\d+\][^,"]*)?),"[^"]*","[^"]*","(.*)"\r?$/;
  for (const day of readdirSync(root, { withFileTypes: true })) {
    if (!day.isDirectory()) continue;
    let files: string[];
    try {
      files = readdirSync(path.join(root, day.name, "exports")).filter((f) =>
        f.endsWith(".csv"),
      );
    } catch {
      continue;
    }
    for (const f of files) {
      const bytes = readFileSync(path.join(root, day.name, "exports", f));
      // Some trial copies are Windows-1252 and some were saved as UTF-8: both readings are kept.
      const lines = [
        ...bytes.toString("latin1").split("\n"),
        ...bytes.toString("utf8").split("\n"),
      ];
      for (const text of lines) {
        const m = line.exec(text);
        if (m === null) continue;
        const id = m[1] as string;
        const set = out.get(id) ?? new Set<string>();
        set.add(m[2] as string);
        out.set(id, set);
      }
    }
  }
  return out;
}
