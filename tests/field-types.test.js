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
    if (type === "string" || type === "integerString") return typeof value === "string";
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
    for (const [key, member] of Object.entries(INTERFACES[name])) {
      const declared = jsonTypes(member.type);
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

  it("rejects getCredits without an integer string in Credits, with status 200", async () => {
    for (const answer of ["{}", '{"Credits":null}']) {
      expect(await run("getCredits", answer)).toEqual(fieldError("Credits"));
    }
    for (const credits of [true, 5, -1, "abc", "5.0", "", " 5", "1e3", {}, []]) {
      expect([credits, await run("getCredits", { Credits: credits })]).toEqual([credits, fieldError("Credits")]);
    }
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

  // Documented example responses (zerobounce.net/docs, as the other SDKs'
  // fixtures carry them) and the API's own null and empty values.
  const ACCEPT = {
    getCredits: [{ Credits: "123456" }, { Credits: "-1" }, { Credits: "0" }],
    validateEmail: [
      {
        address: "valid@example.com", status: "valid", sub_status: "", free_email: false, did_you_mean: null,
        account: null, domain: null, domain_age_days: "9692", smtp_provider: "example", catchall_domain: false,
        mx_found: "true", mx_record: "mx.example.com", firstname: "zero", lastname: "bounce", gender: "male",
        country: "United States", region: "Florida", city: "West Palm Beach", zipcode: "33401",
        processed_at: "2023-03-23 13:30:28.105",
      },
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
    sendFile: [{ success: true, message: "File Accepted", file_name: "emails2.txt", file_id: "e90e9b1d-8dc7-40eb-a7d9-999d52086a56" }],
    getFileStatus: [
      {
        success: true, file_id: "e90e9b1d", file_name: "emails2.txt", upload_date: "2023-04-26T17:52:23Z",
        file_status: "Processing", complete_percentage: "100%", error_reason: null, return_url: "https://mock.value.com/",
      },
      {
        success: true, file_id: "e90e9b1d", file_name: "emails2.txt", upload_date: "2023-04-26T17:52:23Z",
        file_status: "Deleted", complete_percentage: "0%", error_reason: "mock value", return_url: null,
      },
    ],
    deleteFile: [{ success: true, message: "File Deleted", file_name: "emails2.txt", file_id: "e90e9b1d" }],
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
  };

  it("still parses every documented example response, with nulls and fields it does not know", async () => {
    for (const [name, answers] of Object.entries(ACCEPT)) {
      for (const answer of answers) {
        expect([name, answer, await run(name, answer)]).toEqual([name, answer, { resolved: expect.anything() }]);
      }
    }
  });
});
