/**
 * Field types are part of the shape (standard.md §3, check E7): on a typed
 * call, a field of another JSON type than zeroBounceSDK.d.ts declares is an
 * API error with status 200, never a value the caller reads as the declared
 * type. getCredits' Credits and validate's address and status must be there.
 *
 * Complete by construction: the field table in src/response-fields.js is
 * compared with the declarations, and every public method whose declared
 * result is an interface is swept field by field, nested fields included.
 */
import fs from "fs";
import path from "path";
import { ZeroBounceSDK } from "../src/zero-bounce.js";
import { RESPONSE_FIELDS, REQUIRED_FIELDS, UNEXPECTED_FIELD_TYPE_MESSAGE } from "../src/response-fields.js";
import { fetchLikeResponse } from "./strict-json-corpus.js";

const DTS = fs.readFileSync(path.join(__dirname, "..", "zeroBounceSDK.d.ts"), "utf8");

const withoutComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/** Splits at a separator outside (), [], {} and <>. */
function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if ("([{<".includes(char)) depth += 1;
    if (")]}>".includes(char)) depth -= 1;
    if (char === separator && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** The body of the block whose "{" is at or after `from`. */
function blockAt(text, from) {
  const open = text.indexOf("{", from);
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  throw new Error("unbalanced braces in zeroBounceSDK.d.ts");
}

const SOURCE = withoutComments(DTS);

/** Every exported interface: its members, with those of the interfaces it extends. */
const INTERFACES = (() => {
  const raw = {};
  for (const match of SOURCE.matchAll(/export interface (\w+)(?:\s+extends\s+([\w\s,]+?))?\s*\{/g)) {
    const members = {};
    for (const member of splitTopLevel(blockAt(SOURCE, match.index), ";")) {
      if (member.startsWith("[")) continue; // an index signature: not a declared field
      const field = member.match(/^(\w+)(\?)?\s*:\s*([\s\S]+)$/);
      if (!field) throw new Error(`cannot read member "${member}" of ${match[1]}`);
      members[field[1]] = { optional: Boolean(field[2]), type: field[3].trim() };
    }
    raw[match[1]] = { members, parents: match[2] ? match[2].split(",").map((name) => name.trim()) : [] };
  }
  const resolved = {};
  const resolve = (name) => {
    if (!resolved[name]) {
      const own = raw[name];
      resolved[name] = Object.assign({}, ...own.parents.map(resolve), own.members);
    }
    return resolved[name];
  };
  return Object.fromEntries(Object.keys(raw).map((name) => [name, resolve(name)]));
})();

/** Single-line type aliases, and the X[keyof X] status enums (all string literals). */
const ALIASES = (() => {
  const aliases = {};
  for (const match of SOURCE.matchAll(/export type (\w+)\s*=\s*([^;{]+);/g)) {
    const keyOf = match[2].trim().match(/^(\w+)\[keyof \1\]$/);
    aliases[match[1]] = keyOf ? "string" : match[2].trim();
  }
  return aliases;
})();

/** The JSON types a declared TypeScript type allows, as response-fields.js writes them. */
function jsonTypes(type) {
  const out = new Set();
  for (const part of splitTopLevel(type, "|")) {
    if (part === "null" || part === "undefined") continue;
    if (part === "string" || /^"[^"]*"$/.test(part)) out.add("string");
    else if (part === "number" || /^-?\d/.test(part)) out.add("number");
    else if (["boolean", "true", "false"].includes(part)) out.add("boolean");
    else if (part === "unknown" || part === "any") out.add("any");
    else if (part === "Blob") out.add("file");
    else if (part.endsWith("[]")) {
      const inner = part.slice(0, -2);
      if (inner === "unknown") out.add("array");
      else {
        const element = jsonTypes(inner);
        if (element.length !== 1) throw new Error(`array of a union: ${part}`);
        out.add(`${element[0]}[]`);
      }
    } else if (ALIASES[part]) jsonTypes(ALIASES[part]).forEach((item) => out.add(item));
    else if (INTERFACES[part]) out.add(part);
    else throw new Error(`zeroBounceSDK.d.ts: give the type "${part}" a name (an interface) or map it here`);
  }
  return [...out].sort();
}

/** Each ZeroBounceSDK method's declared result, from the class in zeroBounceSDK.d.ts. */
const METHOD_RESULTS = (() => {
  const start = SOURCE.indexOf("export class ZeroBounceSDK {");
  const body = blockAt(SOURCE, start);
  const starts = [...body.matchAll(/^ {2}(\w+)\s*\(/gm)];
  const results = {};
  starts.forEach((match, i) => {
    const slice = body.slice(match.index, i + 1 < starts.length ? starts[i + 1].index : body.length).trim();
    const declared = slice.match(/\)\s*:\s*([^;]+);$/);
    if (!declared) throw new Error(`cannot read the result of ${match[1]}`);
    const promise = declared[1].trim().match(/^Promise<([\s\S]+)>$/);
    if (promise) results[match[1]] = promise[1].trim();
  });
  return results;
})();

/** The interfaces (and arrays of them) a method's result declares, or [] for unknown / string. */
function typedResult(name) {
  return jsonTypes(METHOD_RESULTS[name]).filter((type) => INTERFACES[type.replace(/\[\]$/, "")]);
}

/** The interfaces reachable from a set of declared types. */
function reachable(types, seen = new Set()) {
  for (const type of types) {
    const name = type.replace(/\[\]$/, "");
    if (!INTERFACES[name] || seen.has(name)) continue;
    seen.add(name);
    for (const member of Object.values(INTERFACES[name])) reachable(jsonTypes(member.type), seen);
  }
  return seen;
}

const KEY = "field-types-key";
const file = () => new Blob(["email\n"], { type: "text/csv" });
const job = { file_name: "f.csv", has_header_row: true, return_url: "https://example.com/done" };

/** A valid call of every public method whose result is an interface. */
const CALLS = {
  getCredits: (s) => s.getCredits(),
  validateEmail: (s) => s.validateEmail("a@example.com"),
  getApiUsage: (s) => s.getApiUsage("2020-01-01", "2020-01-31"),
  validateBatch: (s) => s.validateBatch([{ email_address: "a@example.com" }]),
  getEmailActivity: (s) => s.getEmailActivity("a@example.com"),
  scoreEmail: (s) => s.scoreEmail("a@example.com"),
  sendFile: (s) => s.sendFile({ file: file(), email_address_column: 1 }),
  sendFileStream: (s) => s.sendFileStream(file(), "a.csv", { email_address_column: 1 }),
  sendScoringFile: (s) => s.sendScoringFile({ file: file(), email_address_column: 1 }),
  sendScoringFileStream: (s) => s.sendScoringFileStream(file(), "a.csv", { email_address_column: 1 }),
  getFileStatus: (s) => s.getFileStatus("f1"),
  getScoringFileStatus: (s) => s.getScoringFileStatus("f1"),
  deleteFile: (s) => s.deleteFile("f1"),
  deleteScoringFile: (s) => s.deleteScoringFile("f1"),
  sendEmailFinderFile: (s) => s.sendEmailFinderFile({ file: file(), domain_column: 1, first_name_column: 2 }),
  sendEmailFinderFileStream: (s) => s.sendEmailFinderFileStream(file(), "a.csv", { domain_column: 1, full_name_column: 2 }),
  getEmailFinderFileStatus: (s) => s.getEmailFinderFileStatus("f1"),
  deleteEmailFinderFile: (s) => s.deleteEmailFinderFile("f1"),
  sendDomainSearchFile: (s) => s.sendDomainSearchFile({ file: file(), domain_column: 1 }),
  sendDomainSearchFileStream: (s) => s.sendDomainSearchFileStream(file(), "a.csv", { domain_column: 1 }),
  getDomainSearchFileStatus: (s) => s.getDomainSearchFileStatus("f1"),
  deleteDomainSearchFile: (s) => s.deleteDomainSearchFile("f1"),
  sendListEvaluatorFile: (s) => s.sendListEvaluatorFile({ file: file(), email_address_column: 1 }),
  sendListEvaluatorFileStream: (s) => s.sendListEvaluatorFileStream(file(), "a.csv", { email_address_column: 1 }),
  getListEvaluatorResult: (s) => s.getListEvaluatorResult("f1"),
  sendEvaluatedFile: (s) => s.sendEvaluatedFile("f1"),
  addFilter: (s) => s.addFilter({ rule: "allow", target: "domain", value: "example.com" }),
  listFilters: (s) => s.listFilters(),
  deleteFilter: (s) => s.deleteFilter({ rule: "allow", target: "domain", value: "example.com" }),
  listS3files: (s) => s.listS3files(),
  validateS3file: (s) => s.validateS3file(job),
  scoreS3file: (s) => s.scoreS3file(job),
  exportS3file: (s) => s.exportS3file({ file_id: "f1" }),
  emailFinderS3file: (s) => s.emailFinderS3file(job),
  domainSearchS3file: (s) => s.domainSearchS3file(job),
  validateSFTPfile: (s) => s.validateSFTPfile(job),
  scoreSFTPfile: (s) => s.scoreSFTPfile(job),
  emailFinderSFTPfile: (s) => s.emailFinderSFTPfile(job),
  domainSearchSFTPfile: (s) => s.domainSearchSFTPfile(job),
  exportSFTPfile: (s) => s.exportSFTPfile({ file_id: "f1" }),
  getInboxPlacementProviders: (s) => s.getInboxPlacementProviders(),
  createInboxPlacementTest: (s) => s.createInboxPlacementTest({ name: "t" }),
  getInboxPlacementTest: (s) => s.getInboxPlacementTest("t1"),
  deleteInboxPlacementTest: (s) => s.deleteInboxPlacementTest("t1"),
  getInboxPlacementWebhook: (s) => s.getInboxPlacementWebhook(),
  findEmailByDomain: (s) => s.findEmailByDomain({ domain: "example.com", first_name: "Ada" }),
  findEmailByCompanyName: (s) => s.findEmailByCompanyName({ company_name: "Ada Inc", first_name: "Ada" }),
  findEmailFormatByDomain: (s) => s.findEmailFormatByDomain({ domain: "example.com" }),
  findEmailFormatByCompanyName: (s) => s.findEmailFormatByCompanyName({ company_name: "Ada Inc" }),
  guessFormat: (s) => s.guessFormat({ domain: "example.com" }),
  // The same calls sent as form posts take another request path.
  "validateEmail (POST)": (s) => s.validateEmail("a@example.com", { method: "POST" }),
  "scoreEmail (POST)": (s) => s.scoreEmail("a@example.com", { method: "POST" }),
  "listFilters (POST)": (s) => s.listFilters({ method: "POST" }),
};

/** The public method a CALLS entry calls. */
const methodOf = (entry) => entry.replace(/ \(POST\)$/, "");

/**
 * The JSON types a field allows: its declaration, with "string" read as
 * "integerString" where response-fields.js narrows it to an integer (sent
 * as a string or a JSON integer; the field-table test pins that mapping).
 */
function fieldTypes(name, key) {
  const declared = jsonTypes(INTERFACES[name][key].type);
  return [].concat((RESPONSE_FIELDS[name] || {})[key]).includes("integerString")
    ? declared.map((type) => (type === "string" ? "integerString" : type))
    : declared;
}

/** A valid value of a field type: required fields only, filled in. */
const VALID_REQUIRED = { Credits: "7", address: "a@example.com", status: "valid" };
function minimal(name) {
  return Object.fromEntries((REQUIRED_FIELDS[name] || []).map((key) => [key, VALID_REQUIRED[key]]));
}

/** A JSON value none of the declared types allows, or undefined for "any". */
function wrongValue(types) {
  if (types.includes("any")) return undefined;
  const fits = (value, type) => {
    if (type.endsWith("[]") || type === "array") return Array.isArray(value);
    if (type === "string") return typeof value === "string";
    if (type === "integerString") return typeof value === "string" || Number.isSafeInteger(value);
    if (type === "number" || type === "boolean") return typeof value === type;
    return value !== null && typeof value === "object" && !Array.isArray(value);
  };
  return [5, "x", true, {}, []].find((value) => !types.some((type) => fits(value, type)));
}

/**
 * Every [body, path] where one field, at any depth, has the wrong type: the
 * field itself, and for an array of values one element of it.
 */
function wrongBodies(types) {
  const cases = [];
  const objectNames = types.filter((type) => INTERFACES[type]);
  const arrayNames = types.filter((type) => type.endsWith("[]") && INTERFACES[type.slice(0, -2)]);
  const forInterface = (name, wrap, prefix, depth) => {
    for (const key of Object.keys(INTERFACES[name])) {
      const declared = fieldTypes(name, key);
      const at = `${prefix}${key}`;
      const wrong = wrongValue(declared);
      if (wrong !== undefined) cases.push([wrap({ ...minimal(name), [key]: wrong }), at]);
      if (depth >= 3) continue;
      for (const type of declared) {
        if (INTERFACES[type]) {
          forInterface(type, (inner) => wrap({ ...minimal(name), [key]: inner }), `${at}.`, depth + 1);
        } else if (type.endsWith("[]") && INTERFACES[type.slice(0, -2)]) {
          forInterface(type.slice(0, -2), (inner) => wrap({ ...minimal(name), [key]: [inner] }), `${at}[0].`, depth + 1);
        } else if (type.endsWith("[]")) {
          const element = wrongValue([type.slice(0, -2)]);
          cases.push([wrap({ ...minimal(name), [key]: [element] }), `${at}[0]`]);
        }
      }
    }
  };
  for (const name of objectNames) forInterface(name, (body) => body, "", 1);
  for (const type of arrayNames) forInterface(type.slice(0, -2), (body) => [body], "[0].", 1);
  return cases;
}

function client() {
  const sdk = new ZeroBounceSDK();
  sdk.init(KEY);
  return sdk;
}

async function outcome(promise) {
  try {
    return { resolved: await promise };
  } catch (error) {
    return { name: error.name, status: error.statusCode, message: error.message };
  }
}

const fieldError = (at) => ({
  name: "ZBApiError",
  status: 200,
  message: at ? `${UNEXPECTED_FIELD_TYPE_MESSAGE} (${at}).` : `${UNEXPECTED_FIELD_TYPE_MESSAGE}.`,
});

describe("field types (E7)", () => {
  const previousFetch = global.fetch;
  let body = "{}";

  beforeEach(() => {
    global.fetch = async () => fetchLikeResponse(body);
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = previousFetch;
    jest.restoreAllMocks();
  });

  const run = (name, answer) => {
    body = typeof answer === "string" ? answer : JSON.stringify(answer);
    return outcome(CALLS[name](client()));
  };

  it("declares in response-fields.js exactly the fields and JSON types of every interface a call answers", () => {
    const answered = reachable(Object.keys(METHOD_RESULTS).flatMap(typedResult));
    expect(Object.keys(RESPONSE_FIELDS).sort()).toEqual([...answered].sort());
    for (const name of answered) {
      const declared = Object.fromEntries(
        Object.entries(INTERFACES[name]).map(([key, member]) => [key, jsonTypes(member.type)])
      );
      const table = Object.fromEntries(
        Object.entries(RESPONSE_FIELDS[name]).map(([key, types]) => [
          key,
          [].concat(types).map((type) => (type === "integerString" ? "string" : type)).sort(),
        ])
      );
      expect([name, table]).toEqual([name, declared]);
    }
    for (const [name, keys] of Object.entries(REQUIRED_FIELDS)) {
      for (const key of keys) expect([name, key, Boolean(INTERFACES[name][key])]).toEqual([name, key, true]);
    }
  });

  it("has a call for every public method whose result is an interface, and no other", () => {
    const methods = Object.getOwnPropertyNames(ZeroBounceSDK.prototype).filter(
      (name) => name !== "constructor" && name !== "init" && !name.startsWith("_")
    );
    const typed = methods.filter((name) => typedResult(name).length > 0).sort();
    expect([...new Set(Object.keys(CALLS).map(methodOf))].sort()).toEqual(typed);
    // The rest are downloads (string) or declared unknown (raw JSON, exempt).
    for (const name of methods.filter((method) => !typed.includes(method))) {
      expect([name, jsonTypes(METHOD_RESULTS[name]).filter((type) => !["any", "string", "file"].includes(type))]).toEqual([name, []]);
    }
  });

  it("rejects every field of every typed result, at any depth, that arrives with another JSON type, with status 200", async () => {
    const wrong = [];
    let count = 0;
    for (const name of Object.keys(CALLS)) {
      for (const [answer, at] of wrongBodies(typedResult(methodOf(name)))) {
        count += 1;
        const got = await run(name, answer);
        if (JSON.stringify(got) !== JSON.stringify(fieldError(at))) {
          wrong.push(`${name} ${JSON.stringify(answer)}: ${JSON.stringify(got)}`);
        }
      }
    }
    expect(wrong).toEqual([]);
    expect(count).toBeGreaterThan(300);
  });

  it("rejects getCredits without an integer, as a string or a JSON integer, in Credits, with status 200", async () => {
    for (const answer of ["{}", '{"Credits":null}', '{"Credits":5.5}', '{"Credits":1e400}', '{"Credits":9007199254740993}']) {
      expect([answer, await run("getCredits", answer)]).toEqual([answer, fieldError("Credits")]);
    }
    for (const credits of [true, 5.5, "abc", "5.0", "", " 5", "+5", "1e3", {}, [], [5]]) {
      expect([credits, await run("getCredits", { Credits: credits })]).toEqual([credits, fieldError("Credits")]);
    }
  });

  it("accepts Credits as a JSON integer, as zerobounce.net's example sends it, and returns it as the declared string", async () => {
    for (const [answer, credits] of [
      ['{"Credits":2375323}', "2375323"],
      ['{"Credits":-1}', "-1"],
      ['{"Credits":0}', "0"],
      ['{"Credits":"-1"}', "-1"],
      ['{"Credits":"12345"}', "12345"],
    ]) {
      expect([answer, await run("getCredits", answer)]).toEqual([answer, { resolved: { Credits: credits } }]);
    }
  });

  it("rejects a validatebatch row without a string address and status, or that is not an object, with status 200", async () => {
    const batch = (row) => ({ email_batch: [row], errors: [] });
    expect(await run("validateBatch", batch({ status: "valid" }))).toEqual(fieldError("email_batch[0].address"));
    expect(await run("validateBatch", batch({ address: "a@b.c" }))).toEqual(fieldError("email_batch[0].status"));
    expect(await run("validateBatch", { email_batch: [{ status: "valid" }] })).toEqual(fieldError("email_batch[0].address"));
    expect(await run("validateBatch", { email_batch: [{ address: "a@b.c" }] })).toEqual(fieldError("email_batch[0].status"));
    // Validate's greylist answer is a whole body, never a batch row.
    expect(await run("validateBatch", batch({ Message: "Greylisted" }))).toEqual(fieldError("email_batch[0].address"));
    for (const row of [5, "x", true, null, [], ["a@b.c", "valid"]]) {
      expect([row, await run("validateBatch", batch(row))]).toEqual([row, fieldError("email_batch[0]")]);
    }
    const second = { email_batch: [{ address: "a@b.c", status: "valid" }, { address: "d@e.f" }], errors: [] };
    expect(await run("validateBatch", second)).toEqual(fieldError("email_batch[1].status"));
  });

  it("rejects validate without a string address and status, with status 200", async () => {
    expect(await run("validateEmail", { address: true, status: "valid" })).toEqual(fieldError("address"));
    expect(await run("validateEmail", { address: "a@b.c", status: 5 })).toEqual(fieldError("status"));
    expect(await run("validateEmail", { status: "valid" })).toEqual(fieldError("address"));
    expect(await run("validateEmail", { address: "a@b.c" })).toEqual(fieldError("status"));
    expect(await run("validateEmail", { address: "a@b.c", status: null })).toEqual(fieldError("status"));
    // Only a body with neither is the greylist answer.
    expect(await run("validateEmail", { address: "a@b.c", Message: "Greylisted" })).toEqual(fieldError("status"));
    expect(await run("validateEmail", { status: "unknown", Message: "Greylisted" })).toEqual(fieldError("address"));
    expect(await run("validateEmail", { address: "a@b.c", status: "valid", sub_status: 3 })).toEqual(fieldError("sub_status"));
    expect(await run("validateBatch", { email_batch: [{ address: "a@b.c", status: 5 }], errors: [] })).toEqual(
      fieldError("email_batch[0].status")
    );
  });

  // Documented example responses, copied verbatim from zerobounce.net/docs
  // (the success samples of each response page), as the raw text the page shows.
  const DOCUMENTED = {
    getCredits: [`{"Credits":2375323}`],
    validateEmail: [
      `{
      "address": "john.doe@zerobounce.net",
      "status": "valid",
      "sub_status": "",
      "free_email": false,
      "catchall_domain": true,
      "did_you_mean": null,
      "account": "johndoe",
      "domain": "zerobounce.net",
      "domain_age_days": "3431",
      "active_in_days": "30",
      "active_first_seen": "2026-02-25",
      "smtp_provider": "g-suite",
      "mx_found": "true",
      "mx_record": "aspmx.l.google.com",
      "firstname": "dan",
      "lastname": "cotet",
      "gender": "male",
      "country": null,
      "region": null,
      "city": null,
      "zipcode": null,
      "processed_at": "2026-06-18 07:05:00.033"
  }`,
    ],
    sendFile: [
      `{
      "success": true,
      "message": "File Accepted",
      "file_name": "Your file name.csv",
      "file_id": "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff"
    }`,
    ],
    getFileStatus: [
      `{
    "success": true,
    "file_id": "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff",
    "file_name": "Your file name.csv",
    "upload_date": "2023-04-28T15:25:41Z",
    "file_status": "Complete",
    "file_phase_2_status": "N/A",
    "complete_percentage": "100%",
    "return_url": "Your return URL if provided when calling sendfile API"
  }`,
      `{
    "success": true,
    "file_id": "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff",
    "file_name": "Your file name.csv",
    "upload_date": "2023-04-28T15:25:41Z",
    "file_status": "Complete",
    "file_phase_2_status": "Complete",
    "complete_percentage": "100%",
    "return_url": "Your return URL if provided when calling sendfile API"
  }`,
    ],
    deleteFile: [
      `{
    "success": true,
    "message": "File Deleted",
    "file_name": "test2",
    "file_id": "b222a0fd-90d5-416c-8f1a-9cc3851fc823"
  }`,
    ],
    sendScoringFile: [
      `{
          "success": true,
          "message": "File Accepted",
          "file_name": "Your file name.csv",
          "file_id": "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff"
      }`,
    ],
    getScoringFileStatus: [
      `{
          "success": true,
          "file_id": "aaaaaaaa-zzzz-xxxx-yyyy-5003727fffff",
          "file_name": "Your file name.csv",
          "upload_date": "2023-04-28T15:25:41Z",
          "file_status": "Complete",
          "complete_percentage": "100%",
          "return_url": "Your return URL if provided when calling sendfile API"
      }`,
    ],
    deleteScoringFile: [
      `{
        "success": true,
        "message": "File Deleted",
        "file_name": "test2",
        "file_id": "b222a0fd-90d5-416c-8f1a-9cc3851fc823"
    }`,
    ],
  };

  // Not documented examples: the API's own null, empty and string values,
  // values added later, and the shapes of the calls the docs give no success
  // sample for (this repo's fixtures).
  const FIXTURES = {
    getCredits: [{ Credits: "123456" }, { Credits: "-1" }, { Credits: "0" }],
    validateEmail: [
      {
        address: "invalid@example.com", status: "invalid", sub_status: "failed_syntax_check", free_email: false,
        did_you_mean: null, account: "", domain: null, domain_age_days: "", smtp_provider: "", mx_found: "false",
        mx_record: null, firstname: "", lastname: "", gender: "", country: null, region: null, city: null,
        zipcode: null, processed_at: "2023-04-05 08:55:40.661",
      },
      { address: "a@example.com", status: "a_status_added_later", mx_found: true, active_in_days: "365+" },
      { Message: "Greylist validation still in progress. Please try again later." },
    ],
    validateBatch: [
      {
        email_batch: [{ address: "valid@example.com", status: "valid", sub_status: "", free_email: false, mx_found: "true" }],
        errors: [{ error: "Mock error message", email_address: "invalid@example.com" }],
      },
      { email_batch: [], errors: [] },
    ],
    getApiUsage: [{ total: 10, status_valid: 10, sub_status_toxic: 0, start_date: "1/12/2010", end_date: "12/1/2030" }],
    getEmailActivity: [{ found: true, active_in_days: "180" }, { found: false, active_in_days: null }],
    scoreEmail: [{ email: "valid@example.com", score: 10 }],
    getFileStatus: [
      {
        success: true, file_id: "e90e9b1d", file_name: "emails2.txt", upload_date: "2023-04-26T17:52:23Z",
        file_status: "Deleted", complete_percentage: "0%", error_reason: "mock value", return_url: null,
      },
    ],
    findEmailByDomain: [
      { email: "john.doe@example.com", email_confidence: "high", domain: "", company_name: "Example", did_you_mean: "", failure_reason: "" },
    ],
    findEmailFormatByDomain: [
      {
        domain: "example.com", company_name: "", format: "first.last", confidence: "high", did_you_mean: "", failure_reason: "",
        other_domain_formats: [{ format: "first_last", confidence: "high" }],
      },
    ],
    listFilters: [[{ rule: "allow", target: "domain", value: "example.com" }], [], { Message: "No filters." }],
    listS3files: [[{ name: "in/list.csv", size: 120, last_modified: "2026-01-01T00:00:00Z" }]],
    getInboxPlacementProviders: [
      {
        emailProviders: { items: [{ id: 1, name: "Gmail", location: "US", seedCount: 2, seedIds: [1, 2] }] },
        gatewayProviders: { items: [] },
      },
    ],
    createInboxPlacementTest: [{ id: "t1", identifier: "zb-1", testType: "seed", emailAddressList: ["seed1@example.com"] }],
    getInboxPlacementTest: [
      {
        id: "t1", testName: "t", testType: "seed", identifier: "zb-1", status: "Completed",
        inboxCount: 1, spamCount: 0, otherCount: 0, notDeliveredCount: 0, pendingCount: 0, percentages: {},
        counts: { inboxCount: 1, spamCount: 0, otherCount: 0, notDeliveredCount: 0, pendingCount: 0, percentages: {} },
        results: [], seeds: [],
      },
    ],
  };

  const ACCEPT = Object.fromEntries(
    [...new Set([...Object.keys(DOCUMENTED), ...Object.keys(FIXTURES)])].map((name) => [
      name,
      [...(DOCUMENTED[name] || []), ...(FIXTURES[name] || [])],
    ])
  );

  it("still parses every documented example response, with nulls and fields it does not know", async () => {
    for (const [name, answers] of Object.entries(ACCEPT)) {
      for (const answer of answers) {
        expect([name, answer, await run(name, answer)]).toEqual([name, answer, { resolved: expect.anything() }]);
      }
    }
  });

  /** Whether a JSON value is one of the declared types (as src/response-fields.js reads them). */
  function allows(types, value) {
    return types.some((type) => {
      if (type === "any") return true;
      if (value === null) return false;
      if (type.endsWith("[]") || type === "array") return Array.isArray(value);
      if (type === "string") return typeof value === "string";
      if (type === "integerString") return (typeof value === "string" && /^-?[0-9]+$/.test(value)) || Number.isSafeInteger(value);
      if (type === "number" || type === "boolean") return typeof value === type;
      return value !== null && typeof value === "object" && !Array.isArray(value);
    });
  }

  const WRONG_JSON_VALUES = [5, 1.5, "x", true, null, {}, [], ["x"], [5, "x"]];

  /**
   * Every nested value of an answer (a field, an array element, a field of a
   * nested object or row) with the types declared at it, and a setter that
   * returns a copy of the answer with that value replaced.
   */
  function nestedSlots(answer, types) {
    const slots = [];
    const visit = (value, declared, at, replace, container) => {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        const names = declared.filter((type) => INTERFACES[type]);
        const required = new Set(names.flatMap((name) => REQUIRED_FIELDS[name] || []));
        for (const key of Object.keys(value)) {
          const types = [...new Set(names.flatMap((name) => (INTERFACES[name][key] ? fieldTypes(name, key) : [])))];
          if (!types.length) continue; // a field the declarations do not name is kept as it is
          const path = at ? `${at}.${key}` : key;
          const set = (next) => replace({ ...value, [key]: next });
          slots.push({ path, types, required: required.has(key), set, container: `${names.join("|")}.${key}` });
          visit(value[key], types, path, set);
        }
      } else if (Array.isArray(value)) {
        const elementTypes = declared.filter((type) => type.endsWith("[]")).map((type) => type.slice(0, -2));
        if (!elementTypes.length) return; // unknown[]: any element
        value.forEach((element, i) => {
          const path = `${at}[${i}]`;
          const set = (next) => replace(value.map((item, j) => (j === i ? next : item)));
          slots.push({ path, types: elementTypes, required: true, set, container: `${elementTypes.join("|")}[]` });
          visit(element, elementTypes, path, set);
        });
      }
    };
    visit(answer, types, "", (next) => next);
    return slots;
  }

  it("rejects each wrong JSON type at every nested path of every example, with status 200 and that path", async () => {
    const wrong = [];
    const covered = new Set();
    let count = 0;
    for (const [name, answers] of Object.entries(ACCEPT)) {
      for (const raw of answers) {
        const answer = typeof raw === "string" ? JSON.parse(raw) : raw;
        // Validate's greylist answer has no address or status to keep; its
        // Message is checked in "rejects validate without ...".
        if (name === "validateEmail" && answer.address === undefined) continue;
        for (const slot of nestedSlots(answer, typedResult(name))) {
          covered.add(slot.container);
          for (const value of WRONG_JSON_VALUES) {
            if (allows(slot.types, value) || (value === null && !slot.required)) continue;
            count += 1;
            const got = await run(name, slot.set(value));
            if (JSON.stringify(got) !== JSON.stringify(fieldError(slot.path))) {
              wrong.push(`${name} ${slot.path}=${JSON.stringify(value)}: ${JSON.stringify(got)}`);
            }
          }
        }
      }
    }
    expect(wrong).toEqual([]);
    // Complete by construction: every typed array and every nested object a
    // typed result declares is reached by some example.
    const nested = [];
    for (const name of reachable(Object.keys(METHOD_RESULTS).flatMap(typedResult))) {
      for (const [key, member] of Object.entries(INTERFACES[name])) {
        const types = jsonTypes(member.type);
        if (types.some((type) => type.endsWith("[]") || INTERFACES[type])) nested.push(`${name}.${key}`);
      }
    }
    const reached = (entry) => [...covered].some((container) => {
      const [names, key] = [container.slice(0, container.lastIndexOf(".")), container.slice(container.lastIndexOf(".") + 1)];
      return names.split("|").includes(entry.split(".")[0]) && key === entry.split(".")[1];
    });
    // BulkSendFileErrorResponse.message (string[]) only arrives with success:false, which rejects first.
    expect(nested.filter((entry) => !reached(entry) && entry !== "BulkSendFileErrorResponse.message")).toEqual([]);
    expect(count).toBeGreaterThan(500);
  });
});
