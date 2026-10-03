// W00 round 2 acceptance tests: the SEC-11 made-up data guard over every field and every file kind
// (findings W00 r1 RC5, S6). Spec-writer owned: builders never edit this file.
//
// The guard (testworld/model, check 'made-up-data', see clients.acceptance.test.ts for LoadIssue) looks at every
// file of a client folder, not a hand-picked field list:
//   - every person or company name field in answer-key.json and onboarding.json (the corporation, owners,
//     share holders, lenders, the spouse, related entities, parties, Schedule 9 and Schedule 50 names, slip
//     employees and recipients, dividend recipients) ends in "(Test)"; reason contains "(Test)";
//   - every nine-digit number anywhere in any file (JSON strings, CSV cells, profile.md), written plain, spaced,
//     hyphenated or followed by a program suffix such as RT0001, fails its check digit; reason contains "check digit";
//   - every e-mail address anywhere is in a reserved test domain (example.com, example.org, example.net, .test,
//     .example, .invalid, localhost); reason contains "e-mail";
//   - every phone number anywhere, in any common format (416-555-2368, (416) 555-2368, (416)555-2368, 4165552368,
//     416.555.2368, +1 416 555 2368, 867-5309), is in 555-0100 to 555-0199; reason contains "phone";
//   - a bank or QBO description (or the answer key's copy of it) that holds the name of one of the client's
//     people (a person party, an owner, share holder or spouse, without its " (Test)") carries the word TEST, as
//     the sample-clients README says; reason contains "TEST".
// Each refusal names where it was found: the record or the reason holds the planted value or the file name.
// Before this spec the widened scan was run over all fifteen folders: none fails (reported to the Lead: none).
import { afterAll, describe, expect, test } from 'vitest';
import { basename } from 'node:path';
import { loadClient } from '../index';
import { TestWorldLoadError } from '../model/index';
import {
  CLIENT_IDS,
  SAMPLE_ROOT,
  copySamples,
  editText,
  checkDigitPassing,
  luhnValid,
  readJsonAt,
  removeCopies,
  setJsonAt,
  type FixtureClientId,
  type JsonPath,
} from '../__fixtures__/sample-copy';

afterAll(() => {
  removeCopies();
});

type Issue = { client: string; check: string; record: string; reason: string };

async function refusal(id: FixtureClientId, root: string): Promise<Issue[]> {
  let caught: unknown;
  try {
    await Promise.resolve(loadClient(id, { root }));
  } catch (e) {
    caught = e;
  }
  expect(caught, `${id} should have been refused`).toBeInstanceOf(TestWorldLoadError);
  const err = caught as { message: string; issues: unknown };
  expect(err.message).toContain(id);
  return err.issues as Issue[];
}

/** The loader refuses the client with a made-up-data issue whose reason matches and that names one of the hints. */
async function expectGuard(id: FixtureClientId, root: string, reason: RegExp, hints: string[]): Promise<void> {
  const issues = await refusal(id, root);
  const guard = issues.filter((i) => i.check === 'made-up-data');
  const hit = guard.some((i) => reason.test(i.reason) && hints.some((h) => `${i.record} ${i.reason}`.includes(h)));
  expect(hit, `${id}: no made-up-data issue matching ${String(reason)} naming ${hints.join(' or ')}; got ${JSON.stringify(issues)}`).toBe(true);
  for (const i of guard) expect(i.reason.trim().length).toBeGreaterThan(0);
}

const PERSON = 'Jordan Realperson';
const COMPANY = 'Realco Holdings Ltd.';
const VALID = checkDigitPassing('04645428');
const spaced = `${VALID.slice(0, 3)} ${VALID.slice(3, 6)} ${VALID.slice(6)}`;
const hyphened = `${VALID.slice(0, 3)}-${VALID.slice(3, 6)}-${VALID.slice(6)}`;

// Every name field kind the sample clients use, in both JSON files.
const NAME_FIELDS: [FixtureClientId, string, JsonPath, string][] = [
  ['C01', 'answer-key.json', ['name'], COMPANY],
  ['C01', 'answer-key.json', ['parties', 1, 'name'], COMPANY],
  ['C01', 'answer-key.json', ['parties', 0, 'name'], PERSON],
  ['C01', 'answer-key.json', ['t2Inputs', 'schedule50', 0, 'name'], PERSON],
  ['C01', 'answer-key.json', ['t2Inputs', 'slips', 'T5', 0, 'recipient'], PERSON],
  ['C01', 'answer-key.json', ['t2Inputs', 'schedule3', 'dividendsPaid', 0, 'recipient'], PERSON],
  ['C03', 'answer-key.json', ['t2Inputs', 'slips', 'T4', 0, 'employee'], PERSON],
  ['C05', 'answer-key.json', ['t2Inputs', 'schedule9', 'relatedCorporations', 0, 'name'], COMPANY],
  ['C06', 'answer-key.json', ['t2Inputs', 'schedule50', 0, 'name'], COMPANY],
  ['C01', 'onboarding.json', ['corporation', 'legal_name'], COMPANY],
  ['C01', 'onboarding.json', ['owners', 0, 'name'], PERSON],
  ['C05', 'onboarding.json', ['related_entities', 0, 'entity_name'], COMPANY],
  ['C09', 'onboarding.json', ['shares', 'holders', 0, 'name'], PERSON],
  ['C09', 'onboarding.json', ['shareholder_loans', 0, 'lender'], PERSON],
  ['C10', 'onboarding.json', ['spouse', 'name'], PERSON],
];

// Every number field kind, plus the shapes a real number can be written in.
const NUMBER_FIELDS: [FixtureClientId, string, JsonPath, string][] = [
  ['C01', 'answer-key.json', ['t2Inputs', 'schedule50', 0, 'sin'], VALID],
  ['C01', 'answer-key.json', ['t2Inputs', 'slips', 'T5', 0, 'sin'], VALID],
  ['C03', 'answer-key.json', ['t2Inputs', 'slips', 'T4', 0, 'sin'], VALID],
  ['C05', 'answer-key.json', ['t2Inputs', 'schedule9', 'relatedCorporations', 0, 'businessNumber'], VALID],
  ['C06', 'answer-key.json', ['t2Inputs', 'schedule50', 0, 'businessNumber'], VALID],
  ['C01', 'onboarding.json', ['owners', 0, 'sin'], VALID],
  ['C01', 'onboarding.json', ['corporation', 'business_number'], VALID],
  ['C01', 'onboarding.json', ['corporation', 'business_number'], spaced],
  ['C01', 'onboarding.json', ['corporation', 'business_number'], hyphened],
  ['C01', 'onboarding.json', ['corporation', 'business_number'], `${VALID}RT0001`],
  ['C01', 'onboarding.json', ['cra_program_accounts', 1, 'account_number'], `${VALID}RT0001`],
  ['C01', 'onboarding.json', ['cra_program_accounts', 0, 'account_number'], `${spaced} RC0001`],
];

const CHQ_CSV = 'accounts/lakeview-chequing-4821.csv';
const QBO_CSV = 'qbo/lakeview-chequing-4821.csv';
const DESCRIPTION = 'PRE-AUTH DEBIT BRIGHTPATH BOOKKEEPING TEST INC';

/** Appends text to one value in a file, by file kind (no commas, so a CSV keeps its columns). */
const TEXT_FILES: [string, (root: string, add: string) => void][] = [
  [
    'onboarding.json',
    (root, add) => {
      const note = readJsonAt(root, 'C01', 'onboarding.json', ['client_notes', 0]) as string;
      setJsonAt(root, 'C01', 'onboarding.json', ['client_notes', 0], `${note} ${add}`);
    },
  ],
  [
    'answer-key.json',
    (root, add) => {
      const detail = readJsonAt(root, 'C01', 'answer-key.json', ['flags', 0, 'detail']) as string;
      setJsonAt(root, 'C01', 'answer-key.json', ['flags', 0, 'detail'], `${detail} ${add}`);
    },
  ],
  [
    'profile.md',
    (root, add) => {
      editText(root, 'C01', 'profile.md', (t) => `${t}\nContact: ${add}\n`);
    },
  ],
  [
    CHQ_CSV,
    (root, add) => {
      editText(root, 'C01', CHQ_CSV, (t) => t.replace(DESCRIPTION, `${DESCRIPTION} ${add}`));
    },
  ],
  [
    QBO_CSV,
    (root, add) => {
      editText(root, 'C01', QBO_CSV, (t) => t.replace(DESCRIPTION, `${DESCRIPTION} ${add}`));
    },
  ],
];

describe('W00 round 2: SEC-11 the guard covers every name field', () => {
  test.each(NAME_FIELDS)('SEC-11 %s %s %j without "(Test)" ("%s") is refused with the reason', async (id, file, path, value) => {
    const root = copySamples();
    expect(String(readJsonAt(root, id, file, path))).toMatch(/\(Test\)$/);
    setJsonAt(root, id, file, path, value);
    await expectGuard(id, root, /\(Test\)/, [value]);
  });
});

describe('W00 round 2: SEC-11 the guard covers every business number and SIN, however it is written', () => {
  test('SEC-11 fixture: the planted number passes its check digit and every sample number fails it', () => {
    expect(luhnValid(VALID)).toBe(true);
    for (const [id, file, path] of NUMBER_FIELDS) {
      const v = String(readJsonAt(SAMPLE_ROOT, id, file, path));
      const digits = v.replace(/\D/g, '').slice(0, 9);
      if (digits.length === 9) expect(luhnValid(digits), `${id} ${path.join('.')}`).toBe(false);
    }
  });

  test.each(NUMBER_FIELDS)('SEC-11 %s %s %j set to "%s" (passes its check digit) is refused with the reason', async (id, file, path, value) => {
    const root = copySamples();
    setJsonAt(root, id, file, path, value);
    await expectGuard(id, root, /check digit/i, [value, VALID, spaced]);
  });

  test.each(TEXT_FILES)('SEC-11 a SIN that passes its check digit in free text (%s) is refused', async (file, plant) => {
    const root = copySamples();
    plant(root, `SIN ${spaced}`);
    await expectGuard('C01', root, /check digit/i, [spaced, VALID, basename(file)]);
  });
});

describe('W00 round 2: SEC-11 e-mail and phone numbers are scanned in every file kind', () => {
  test.each(TEXT_FILES)('SEC-11 an e-mail address outside a reserved test domain in %s is refused', async (file, plant) => {
    const root = copySamples();
    plant(root, 'jordan.realperson@gmail.com');
    await expectGuard('C01', root, /e-?mail/i, ['jordan.realperson@gmail.com', basename(file)]);
  });

  test.each(TEXT_FILES)('SEC-11 a phone number outside 555-01xx in %s is refused', async (file, plant) => {
    const root = copySamples();
    plant(root, '(416)555-2368');
    await expectGuard('C01', root, /phone/i, ['(416)555-2368', '555-2368', basename(file)]);
  });

  test.each(['416-555-2368', '(416) 555-2368', '(416)555-2368', '4165552368', '416.555.2368', '+1 416 555 2368', '867-5309'])(
    'SEC-11 a phone number written "%s" is refused',
    async (phone) => {
      const root = copySamples();
      const plant = TEXT_FILES[0]?.[1];
      if (plant === undefined) throw new Error('fixture: no onboarding plant');
      plant(root, `Call ${phone} after six.`);
      await expectGuard('C01', root, /phone/i, [phone, phone.replace(/\D/g, ''), 'onboarding.json']);
    },
  );

  test('SEC-11 no false alarm: reserved e-mail domains and 555-01xx phones in every file kind are accepted', async () => {
    const root = copySamples();
    const safe = 'ops@example.org; desk@maple.test; 416-555-0142; (416) 555-0199; (416)555-0100; 4165550123; +1 416 555 0150';
    for (const [, plant] of TEXT_FILES) plant(root, safe.replace(/;/g, ''));
    const c: unknown = await Promise.resolve(loadClient('C01', { root }));
    expect((c as { id: string }).id).toBe('C01');
  });
});

describe('W00 round 2: SEC-11 a person named in a bank description carries TEST', () => {
  test.each([CHQ_CSV, QBO_CSV, 'answer-key.json'])('SEC-11 "PRIYA NAIR" without TEST in %s is refused with the reason', async (file) => {
    const root = copySamples();
    editText(root, 'C01', file, (t) => {
      expect(t).toContain('PRIYA NAIR TEST');
      return t.split('PRIYA NAIR TEST').join('PRIYA NAIR');
    });
    await expectGuard('C01', root, /TEST/, ['PRIYA NAIR', basename(file)]);
  });

  test.each(CLIENT_IDS)('SEC-11 %s passes the widened guard as committed', async (id) => {
    const c: unknown = await Promise.resolve(loadClient(id));
    expect((c as { id: string }).id).toBe(id);
  });
});
