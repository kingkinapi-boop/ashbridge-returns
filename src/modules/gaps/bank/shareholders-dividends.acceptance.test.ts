// Spec for card G13 (question bank: shareholders, dividends). Choices the card leaves open (amber, see reports/G13-spec.md):
//  - The topic's client-askable facts are listed here by key: the shareholder and dividend facts only the client can
//    state (`onboarding.shareholder.*` x5, `onboarding.dividend.*` x3, `onboarding.owners.count`). Left out on purpose:
//    `shareholder.identity.sin` (sensitive, taken from the corporate file or a secure QA, never a bank question here),
//    the shareholder loan facts (G14), `onboarding.capital_dividend.received` and `onboarding.owner_bonus.paid` (later topics).
//  - "Every test-world gap on this topic" is read as: a fact of this list that no item resolves is a gap the gap pass
//    could not turn into a question (G00 does not exist yet).
//  - The file is `data/question-bank/shareholders-dividends.json`, topic `shareholders-dividends`, ids `Q-SHD-<nnn>`; the loader is G01's.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  loadFactCatalogue,
  type FactCatalogue,
} from "../../../contracts/facts";
import { loadBank, pick, type Bank } from "./index";

const ROOT = path.join(import.meta.dirname, "..", "..", "..", "..");
const BANK_DIR = path.join(ROOT, "data", "question-bank");
const FILE = path.join(BANK_DIR, "shareholders-dividends.json");

const loaded = loadFactCatalogue(
  JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", "facts", "catalogue.json"), "utf8"),
  ),
);
if (!loaded.ok)
  throw new Error(
    `the fact catalogue does not load: ${loaded.reasons.join("; ")}`,
  );
const catalogue: FactCatalogue = loaded.catalogue;

const SHD_FACTS = [
  "onboarding.shareholder.holder_name",
  "onboarding.shareholder.holder_kind",
  "onboarding.shareholder.percent_common",
  "onboarding.shareholder.share_class",
  "onboarding.shareholder.tax_residency",
  "onboarding.dividend.declared_on",
  "onboarding.dividend.amount",
  "onboarding.dividend.resolution_on_file",
  "onboarding.owners.count",
] as const;

function bank(): Bank {
  const r = loadBank(BANK_DIR, catalogue);
  if (!r.ok)
    throw new Error(
      `the question bank is refused: ${JSON.stringify(r.problems)}`,
    );
  return r.bank;
}
const shdItems = () =>
  bank().items.filter((i) => i.topic === "shareholders-dividends");

function* strings(v: unknown): Generator<string> {
  if (typeof v === "string") yield v;
  else if (Array.isArray(v)) for (const x of v) yield* strings(x);
  else if (typeof v === "object" && v !== null)
    for (const x of Object.values(v)) yield* strings(x);
}

describe("ARC-2 the shareholders-dividends file is a valid part of the bank", () => {
  test("ARC-2 data/question-bank/shareholders-dividends.json exists, holds items and the whole bank folder loads", () => {
    expect(fs.existsSync(FILE)).toBe(true);
    expect(shdItems().length).toBeGreaterThanOrEqual(SHD_FACTS.length);
  });

  test("ARC-2 every item in the file has topic shareholders-dividends and an id Q-SHD-<nnn>; every shareholder-dividend item is in the file", () => {
    const inFile = (
      JSON.parse(fs.readFileSync(FILE, "utf8")) as {
        items: { id: string; topic: string }[];
      }
    ).items;
    for (const i of inFile) {
      expect(i.topic, i.id).toBe("shareholders-dividends");
      expect(i.id, i.id).toMatch(/^Q-SHD-\d{3}$/);
    }
    expect(
      shdItems()
        .map((i) => i.id)
        .sort(),
    ).toEqual(inFile.map((i) => i.id).sort());
  });

  test("ARC-2 the file holds only the format's own keys: no wording field of any name", () => {
    const inFile = (
      JSON.parse(fs.readFileSync(FILE, "utf8")) as {
        items: Record<string, unknown>[];
      }
    ).items;
    const allowed = [
      "id",
      "type",
      "resolves",
      "slots",
      "answer",
      "label",
      "topic",
      "retired",
    ];
    for (const i of inFile)
      expect(Object.keys(i).sort(), String(i["id"])).toEqual(
        [...allowed].sort(),
      );
  });
});

describe("AI-12 every shareholder-dividend fact the client can state has a question", () => {
  test.each(SHD_FACTS)(
    "AI-12 %s is in the catalogue, client-askable, and pick finds a live item for it",
    (key) => {
      const fact = catalogue.get(key);
      expect(fact, key).toBeDefined();
      expect(
        fact?.suppliedBy.some((s) => s === "onboarding" || s === "qa"),
        key,
      ).toBe(true);
      expect(
        pick(bank(), key).length,
        `a shareholders-dividends gap on ${key} has no question`,
      ).toBeGreaterThan(0);
    },
  );

  test("AI-12 every shareholder-dividend item resolves a fact a client can state, never a document-supplied fact", () => {
    for (const i of shdItems()) {
      const fact = catalogue.get(i.resolves);
      expect(fact, `${i.id} resolves ${i.resolves}`).toBeDefined();
      expect(
        fact?.suppliedBy.some((s) => s === "onboarding" || s === "qa"),
        `${i.id} resolves ${i.resolves}`,
      ).toBe(true);
    }
  });

  test("AI-12 no shareholder-dividend item is retired in the first release: each fact keeps a live item", () => {
    for (const i of shdItems()) expect(i.retired, i.id).toBe(false);
  });
});

describe("ARC-2 each item fits the fact it resolves", () => {
  test("ARC-2 the resolution-on-file fact has a yes or no answer", () => {
    const items = pick(bank(), "onboarding.dividend.resolution_on_file");
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.answer.shape === "yes_no")).toBe(true);
  });

  test("ARC-2 the dividend amount is an ASK for an amount: a required money_cents slot and a money answer", () => {
    const items = pick(bank(), "onboarding.dividend.amount");
    expect(
      items.some(
        (i) =>
          i.type === "ASK" &&
          i.answer.shape === "money" &&
          i.slots.some((s) => s.type === "money_cents" && s.required),
      ),
    ).toBe(true);
  });

  test("ARC-2 the declared-on fact is an ASK for a date: a required date slot and a date answer", () => {
    const items = pick(bank(), "onboarding.dividend.declared_on");
    expect(
      items.some(
        (i) =>
          i.answer.shape === "date" &&
          i.slots.some((s) => s.type === "date" && s.required),
      ),
    ).toBe(true);
  });

  test("ARC-2 the share percent is a required percent slot, and the owner count a required count slot with a number answer", () => {
    expect(
      pick(bank(), "onboarding.shareholder.percent_common").some((i) =>
        i.slots.some((s) => s.type === "percent" && s.required),
      ),
    ).toBe(true);
    expect(
      pick(bank(), "onboarding.owners.count").some(
        (i) =>
          i.answer.shape === "number" &&
          i.slots.some((s) => s.type === "count" && s.required),
      ),
    ).toBe(true);
  });

  test("ARC-2 the holder kind, share class and tax residency are choices: a choice answer with option ids in snake case", () => {
    for (const k of [
      "onboarding.shareholder.holder_kind",
      "onboarding.shareholder.share_class",
      "onboarding.shareholder.tax_residency",
    ]) {
      const items = pick(bank(), k);
      expect(
        items.some(
          (i) =>
            i.answer.shape === "choice" && (i.answer.options?.length ?? 0) >= 2,
        ),
        k,
      ).toBe(true);
      for (const o of items.flatMap((i) => i.answer.options ?? []))
        expect(o, k).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  test("ARC-2 the holder name is asked as an ASK, because no yes or no or choice can carry a name", () => {
    expect(
      pick(bank(), "onboarding.shareholder.holder_name").some(
        (i) => i.type === "ASK",
      ),
    ).toBe(true);
  });

  test("ARC-2 a slot name is a word in snake case, the same slot name never twice in one item", () => {
    for (const i of shdItems()) {
      const names = i.slots.map((s) => s.name);
      for (const n of names) expect(n, i.id).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(new Set(names).size, i.id).toBe(names.length);
    }
  });

  test("ARC-2 no shareholder-dividend item resolves a fact another topic owns", () => {
    for (const i of shdItems())
      expect(
        (SHD_FACTS as readonly string[]).includes(i.resolves),
        `${i.id} resolves ${i.resolves}`,
      ).toBe(true);
  });
});

describe("RULE-19 END-7 the file holds no sentence for a client", () => {
  test('RULE-19 no string in the file ends in a full stop, question mark or exclamation mark, or speaks to "you"', () => {
    const text = JSON.parse(fs.readFileSync(FILE, "utf8")) as unknown;
    for (const s of strings(text)) {
      expect(s.trim(), s).not.toMatch(/[.?!]$/);
      expect(s, s).not.toMatch(/\b(you|your)\b/i);
    }
  });

  test("END-7 every label is a staff label of at most 60 characters", () => {
    for (const i of shdItems()) {
      expect(i.label.length, i.id).toBeLessThanOrEqual(60);
      expect(i.label.trim(), i.id).not.toBe("");
    }
  });

  test("END-7 no string in the file reads as a question or an instruction: no word that starts a question", () => {
    const text = JSON.parse(fs.readFileSync(FILE, "utf8")) as unknown;
    const opens =
      /^(what|when|where|why|how|did|do|does|is|are|please|tell|enter|select)\b/i;
    for (const s of strings(text)) expect(s, s).not.toMatch(opens);
  });
});
