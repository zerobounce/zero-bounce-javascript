/**
 * The JSON type of every field the typed calls declare in zeroBounceSDK.d.ts
 * (standard.md: field types are part of the shape). A field that arrives with
 * another JSON type makes the answer an API error with status 200, never a
 * value the caller reads as the declared type. tests/field-types.test.js keeps
 * this table equal to the declarations.
 *
 * A type is "string", "number", "boolean", "array", "object", "any", the name
 * of another entry, or such a name or primitive followed by "[]" (an array of
 * it). "integerString" is an integer sent as a JSON string, such as "-1" or
 * "12345", or as a JSON integer, such as 2375323 (zerobounce.net's own
 * getcredits example); "5.0", 5.5 and true are not. "integer" is a JSON
 * integer within the safe range (no fraction, no exponent that overflows).
 * A list is a union. null is accepted for every field except a required one.
 */
export const RESPONSE_FIELDS = {
  GetCreditsResponse: { Credits: "integerString" },
  EmailValidationResult: {
    address: "string",
    status: "string",
    sub_status: "string",
    free_email: "boolean",
    did_you_mean: "string",
    account: "string",
    domain: "string",
    domain_age_days: "string",
    active_in_days: "string",
    active_first_seen: "string",
    smtp_provider: "string",
    catchall_domain: "boolean",
    mx_found: ["string", "boolean"],
    mx_record: "string",
    firstname: "string",
    lastname: "string",
    gender: "string",
    country: "string",
    region: "string",
    city: "string",
    zipcode: "string",
    processed_at: "string",
    domain_website_exists: "string",
    domain_registrant_company_name: "string",
    message: "string",
    Message: "string",
  },
  ValidateBatchResponse: { email_batch: "EmailValidationResult[]", errors: "array" },
  ApiUsageResponse: {
    total: "number",
    status_valid: "number",
    status_invalid: "number",
    status_catch_all: "number",
    status_do_not_mail: "number",
    status_spamtrap: "number",
    status_unknown: "number",
    sub_status_toxic: "number",
    sub_status_disposable: "number",
    sub_status_role_based: "number",
    sub_status_possible_trap: "number",
    sub_status_global_suppression: "number",
    sub_status_timeout_exceeded: "number",
    sub_status_mail_server_temporary_error: "number",
    sub_status_mail_server_did_not_respond: "number",
    sub_status_greylisted: "number",
    sub_status_antispam_system: "number",
    sub_status_does_not_accept_mail: "number",
    sub_status_exception_occurred: "number",
    sub_status_failed_syntax_check: "number",
    sub_status_mailbox_not_found: "number",
    sub_status_unroutable_ip_address: "number",
    sub_status_possible_typo: "number",
    sub_status_no_dns_entries: "number",
    sub_status_role_based_catch_all: "number",
    sub_status_mailbox_quota_exceeded: "number",
    sub_status_forcible_disconnect: "number",
    sub_status_failed_smtp_connection: "number",
    sub_status_accept_all: "number",
    sub_status_mx_forward: "number",
    sub_status_alternate: "number",
    sub_status_allowed: "number",
    sub_status_blocked: "number",
    sub_status_gold: "number",
    sub_status_role_based_accept_all: "number",
    start_date: "string",
    end_date: "string",
  },
  EmailActivityResponse: { found: "boolean", active_in_days: "string" },
  EmailScoringResult: { email: "string", score: "integer" },
  EmailScoringError: { error: "string" },
  BulkSendFileSuccessResponse: {
    success: "boolean",
    message: "string",
    file_name: "string",
    file_id: "string",
  },
  BulkSendFileErrorResponse: { success: ["boolean", "string"], message: ["string", "string[]"] },
  ValidationFileStatusResponse: {
    success: "boolean",
    file_id: "string",
    file_name: "string",
    upload_date: "string",
    file_status: "string",
    file_phase_2_status: "string",
    complete_percentage: "string",
    error_reason: "string",
    return_url: "string",
    message: "string",
  },
  ScoringFileStatusResponse: {
    success: "boolean",
    file_id: "string",
    file_name: "string",
    upload_date: "string",
    file_status: "string",
    complete_percentage: "string",
    return_url: "string",
    message: "string",
  },
  BulkFileDeletedResponse: {
    success: "boolean",
    message: "string",
    file_name: "string",
    file_id: "string",
  },
  EmailFinderResponse: {
    email: "string",
    email_confidence: "string",
    domain: "string",
    company_name: "string",
    did_you_mean: "string",
    failure_reason: "string",
  },
  DomainFormatResponse: {
    domain: "string",
    company_name: "string",
    format: "string",
    confidence: "string",
    did_you_mean: "string",
    failure_reason: "string",
    other_domain_formats: "array",
  },
  ListEvaluatorSubmitResponse: { file_id: "string", message: "string", success: "boolean" },
  ListEvaluatorResultResponse: { file_status: "string", success: "boolean", message: "string" },
  FilterListItem: { rule: "string", target: "string", value: "string" },
  FilterMessageResponse: { Message: "string", Error: "string" },
  S3ListFileEntry: { name: "string", size: "number", last_modified: "string" },
  S3BulkJobResponse: {
    success: "boolean",
    message: "string",
    file_id: "string",
    export_path: "string",
  },
  InboxPlacementProvider: {
    id: "number",
    name: "string",
    location: "string",
    seedCount: "number",
    seedIds: "number[]",
  },
  InboxPlacementProviderGroup: { items: "InboxPlacementProvider[]" },
  InboxPlacementProvidersResponse: {
    emailProviders: "InboxPlacementProviderGroup",
    gatewayProviders: "InboxPlacementProviderGroup",
  },
  InboxPlacementTestCreated: {
    id: "string",
    identifier: "string",
    testType: "string",
    emailAddressList: "string[]",
  },
  InboxPlacementCounts: {
    inboxCount: "number",
    spamCount: "number",
    otherCount: "number",
    notDeliveredCount: "number",
    pendingCount: "number",
    percentages: "any",
  },
  InboxPlacementTestResult: {
    inboxCount: "number",
    spamCount: "number",
    otherCount: "number",
    notDeliveredCount: "number",
    pendingCount: "number",
    percentages: "any",
    id: "string",
    testName: "string",
    testType: "string",
    identifier: "string",
    status: "string",
    counts: "InboxPlacementCounts",
    results: "any",
    seeds: "array",
  },
  InboxPlacementTestDeleted: { id: "string", status: "string" },
  InboxPlacementWebhookResponse: { webhookUrl: "string" },
};

/**
 * Fields a call cannot answer without: present and not null (standard.md).
 * Validate's greylist answer, whose only field is a Message string, is a
 * result without them; a validatebatch row is not (every row needs both).
 */
export const REQUIRED_FIELDS = {
  GetCreditsResponse: ["Credits"],
  EmailValidationResult: ["address", "status"],
};

export const UNEXPECTED_FIELD_TYPE_MESSAGE =
  "ZeroBounce returned a response field of an unexpected type for this call";

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function isGreylistMessage(object) {
  return (
    object.address == null &&
    object.status == null &&
    ["Message", "message"].some((key) => typeof object[key] === "string" && object[key].trim() !== "")
  );
}

/** One descriptor's interface names, for a union that mixes objects. */
function interfaceNames(types) {
  return types.filter((type) => Object.prototype.hasOwnProperty.call(RESPONSE_FIELDS, type));
}

/**
 * The path of the first field of the value that does not have its declared
 * type, "" when the whole value is the wrong kind, or null when it all fits.
 * The interfaces of a union that are objects are checked as one: a field any
 * of them declares must have one of the types they give it.
 */
function mismatch(value, types, path) {
  for (const type of types) {
    if (type === "any") return null;
    if (type === "string" && typeof value === "string") return null;
    if (type === "integerString" && typeof value === "string" && /^-?[0-9]+$/.test(value)) return null;
    if (type === "integerString" && Number.isSafeInteger(value)) return null;
    if (type === "number" && typeof value === "number") return null;
    if (type === "integer" && Number.isSafeInteger(value)) return null;
    if (type === "boolean" && typeof value === "boolean") return null;
    if (type === "object" && isPlainObject(value)) return null;
    if (type === "array" && Array.isArray(value)) return null;
  }
  if (Array.isArray(value)) {
    const elementTypes = types.filter((type) => type.endsWith("[]")).map((type) => type.slice(0, -2));
    if (!elementTypes.length) return path;
    for (let i = 0; i < value.length; i += 1) {
      const found = mismatch(value[i], elementTypes, `${path}[${i}]`);
      if (found !== null) return found;
    }
    return null;
  }
  const names = interfaceNames(types);
  if (!isPlainObject(value) || !names.length) return path;
  const prefix = path ? `${path}.` : "";
  const required = new Set(names.flatMap((name) => REQUIRED_FIELDS[name] || []));
  // Only validate's own answer (the whole body) can be the greylist message.
  if (!(path === "" && names.includes("EmailValidationResult") && isGreylistMessage(value))) {
    for (const key of required) {
      if (value[key] == null) return `${prefix}${key}`;
    }
  }
  const fieldTypes = {};
  for (const name of names) {
    for (const [key, type] of Object.entries(RESPONSE_FIELDS[name])) {
      fieldTypes[key] = [...(fieldTypes[key] || []), ...[].concat(type)];
    }
  }
  for (const [key, declared] of Object.entries(fieldTypes)) {
    if (!Object.prototype.hasOwnProperty.call(value, key) || value[key] === null) continue;
    const found = mismatch(value[key], declared, `${prefix}${key}`);
    if (found !== null) return found;
  }
  return null;
}

/**
 * The path of the first field of a parsed body that does not have the type
 * the call declares (the result types named in `types`), or null.
 */
export function responseFieldMismatch(parsed, types) {
  return mismatch(parsed, [].concat(types), "");
}

/**
 * The file-job answers whose public `message` is one string. A list of strings
 * there is joined with "\n" (standard.md §3). Their message is declared as a
 * string or a list, so the list is joined before the field types are checked.
 */
const FILE_JOB_MESSAGE_RESULTS = [
  "BulkSendFileSuccessResponse",
  "BulkFileDeletedResponse",
  "ValidationFileStatusResponse",
  "ScoringFileStatusResponse",
];

/**
 * Joins a file job's list of message strings into the one string the public
 * type declares, for the result types named in `types`. Any other value (a
 * list holding a non-string, a number) is left for the field-type check.
 */
export function joinFileJobMessage(parsed, types) {
  if (!isPlainObject(parsed) || !Array.isArray(parsed.message)) return parsed;
  if (!parsed.message.every((line) => typeof line === "string")) return parsed;
  if (![].concat(types ?? []).some((name) => FILE_JOB_MESSAGE_RESULTS.includes(name))) return parsed;
  parsed.message = parsed.message.join("\n");
  return parsed;
}
