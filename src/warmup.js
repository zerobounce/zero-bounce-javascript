/**
 * Client for the ZeroBounce Warmup API (https://www.zerobounce.net/docs/warmup-api).
 *
 * The Warmup API is separate from the email validation API: its own host, its
 * own team-scoped key, and an `API-Key` header instead of an `api_key`
 * parameter. Use `ZeroBounceWarmup` with a Warmup API key; `ZeroBounceSDK`
 * stays for the validation API key.
 */
import {
  apiError,
  checkApiKey,
  pathSegment,
  redactSecrets,
  requireHttpsUrl,
} from "./utils.js";

const DEFAULT_BASE_URL = "https://warmup-api.zerobounce.net";
const BASE_PATH = "/api/v1/warmup";
const HTTP_TIMEOUT_MS = 120000;

const ONBOARDING_MODELS = ["self_managed", "zb_managed"];
const EMAIL_TYPES = ["transactional", "newsletter", "marketing"];
/** 0 Default, 1 Slow Pace, 2 Repair, 3 Boost, 4 Protect. */
const STANDARD_RULE_IDS = [0, 4];
/** 4 Paused, 5 Disabled. */
const STATUS_IDS = [0, 8];
/** Required by the schema, always replaced with the key's own team. */
const ANY_TEAM_ID = 1;

const SEARCH_FROM = /^[A-Za-z0-9.\-_@+]*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function clientError(message) {
  return new Error(`ZeroBounce: ${message}`);
}

function required(value, name) {
  if (value == null || !String(value).trim()) {
    throw clientError(`${name} parameter is missing.`);
  }
  return value;
}

function inRange(value, [low, high], name) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < low || value > high) {
    throw clientError(`${name} parameter is invalid. Must be ${low} to ${high}.`);
  }
  return value;
}

function isoDate(value, name) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== "string" || !ISO_DATE.test(value)) {
    throw clientError(`${name} parameter is invalid. Expected YYYY-MM-DD.`);
  }
  return value;
}

function fetchTimeoutSignal() {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(HTTP_TIMEOUT_MS);
  }
  return undefined;
}

/**
 * Drops trailing slashes without a regular expression: `/\/+$/` backtracks
 * quadratically on a string of many slashes, which CodeQL flags as a
 * polynomial ReDoS when the value comes from a caller.
 */
function trimTrailingSlashes(value) {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47 /* "/" */) end -= 1;
  return value.slice(0, end);
}

export class ZeroBounceWarmup {
  static DEFAULT_BASE_URL = DEFAULT_BASE_URL;

  /**
   * @param apiKey - your Warmup API key, sent in the `API-Key` header
   * @param baseURL - the base URL ZeroBounce gave you; defaults to
   *   https://warmup-api.zerobounce.net
   */
  constructor(apiKey, baseURL = DEFAULT_BASE_URL) {
    checkApiKey(apiKey, "Warmup api key");
    const base = requireHttpsUrl(baseURL || DEFAULT_BASE_URL, "baseURL");
    this._api_key = apiKey;
    this._root = `${trimTrailingSlashes(base)}${BASE_PATH}`;
  }

  // -- transport --------------------------------------------------------------

  async _send(method, path, { params = null, jsonBody = null, secrets = [] } = {}) {
    const query =
      params && Object.keys(params).length ? `?${new URLSearchParams(params)}` : "";
    const url = `${this._root}${path}${query}`;
    requireHttpsUrl(url, "request URL");
    const all = [this._api_key, ...secrets];

    const headers = {
      "API-Key": this._api_key,
      Accept: "application/json",
    };
    if (jsonBody != null) headers["Content-Type"] = "application/json";

    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: jsonBody != null ? JSON.stringify(jsonBody) : undefined,
        signal: fetchTimeoutSignal(),
        redirect: "error",
      });
    } catch (error) {
      // Raised on its own: the original can carry the key or the SMTP password.
      const name = error && error.name ? error.name : "Error";
      const message = error && error.message ? error.message : String(error);
      throw new Error(redactSecrets(`${name}: ${message}`, all));
    }

    const status = typeof response.status === "number" ? response.status : 200;
    if (status >= 300 && status < 400) {
      throw apiError(
        "ZeroBounce returned a redirect, which this client does not follow.",
        status
      );
    }
    const body = typeof response.text === "function" ? await response.text() : "";
    if (status > 299) {
      throw apiError(redactSecrets(warmupMessage(body, status), all), status);
    }
    return { status, body, response };
  }

  /** The JSON payload of a 200, or null for a documented empty success (204, empty 200). */
  async _json(method, path, options = {}) {
    const { status, body } = await this._send(method, path, options);
    if (status === 204 || !String(body).trim()) return null;
    try {
      return JSON.parse(body);
    } catch {
      throw apiError(
        redactSecrets(warmupMessage(body, status), [this._api_key, ...(options.secrets || [])]),
        status
      );
    }
  }

  /** A CSV download, returned as text. */
  async _csv(path, params = null) {
    const { status, body, response } = await this._send("GET", path, { params });
    const contentType =
      response && response.headers && typeof response.headers.get === "function"
        ? String(response.headers.get("content-type") || "").toLowerCase()
        : "";
    if (!String(body).trim() || contentType.includes("application/json")) {
      throw apiError(redactSecrets(warmupMessage(body, status), [this._api_key]), status);
    }
    return body;
  }

  // -- sending accounts -------------------------------------------------------

  /** Every sending account of the key's team. GET /sending-accounts */
  listSendingAccounts() {
    return this._json("GET", "/sending-accounts");
  }

  /** One sending account. GET /sending-account */
  getSendingAccount(fromAddress) {
    return this._json("GET", "/sending-account", {
      params: { from_address: required(fromAddress, "from_address") },
    });
  }

  /**
   * Add a from-address to warmup. POST /sending-accounts
   *
   * `self_managed` runs your own mailbox and needs `engagementRuleId` 0-4.
   * `zb_managed` has ZeroBounce provision it and takes `emailContent` and
   * `managedSending` instead; a 200 means accepted, and the mailbox is
   * provisioned afterwards.
   */
  addSendingAccount({
    fromAddress,
    onboardingModel,
    engagementRuleId = null,
    ignoreConflict = null,
    emailContent = null,
    managedSending = null,
  } = {}) {
    required(fromAddress, "from_address");
    if (!ONBOARDING_MODELS.includes(onboardingModel)) {
      throw clientError("onboarding_model parameter is invalid. Must be self_managed or zb_managed.");
    }
    const body = { from_address: fromAddress, onboarding_model: onboardingModel };
    if (onboardingModel === "self_managed") {
      if (engagementRuleId == null) {
        throw clientError("engagement_rule_id parameter is missing. Required for self_managed.");
      }
      body.engagement_rule_id = inRange(engagementRuleId, STANDARD_RULE_IDS, "engagement_rule_id");
      if (emailContent != null || managedSending != null) {
        throw clientError("email_content and managed_sending are for zb_managed.");
      }
    }
    if (ignoreConflict != null) body.ignore_conflict = Boolean(ignoreConflict);
    if (emailContent != null) {
      const content = { ...emailContent };
      const types = content.types_of_emails;
      if (types != null && (!Array.isArray(types) || types.some((t) => !EMAIL_TYPES.includes(t)))) {
        throw clientError(
          "types_of_emails parameter is invalid. transactional, newsletter and/or marketing."
        );
      }
      body.email_content = content;
    }
    if (managedSending != null) {
      const sending = { ...managedSending };
      const offset = sending.timezone_offset;
      if (offset != null && (typeof offset !== "number" || offset < -11 || offset > 14)) {
        throw clientError("timezone_offset parameter is invalid. Must be -11 to 14.");
      }
      if (sending.warmup_start_date != null) {
        sending.warmup_start_date = isoDate(sending.warmup_start_date, "warmup_start_date");
      }
      body.managed_sending = sending;
    }
    return this._json("POST", "/sending-accounts", { jsonBody: body });
  }

  /**
   * Change an account's engagement rule, status and auto-enable flag.
   * PUT /sending-accounts
   *
   * `statusId` is 0 to 8 (4 Paused, 5 Disabled). `autoEnable` true is accepted
   * only for an account that is not active.
   */
  updateSendingAccount({ fromAddress, engagementRuleId, statusId, autoEnable } = {}) {
    required(fromAddress, "from_address");
    if (typeof autoEnable !== "boolean") {
      throw clientError("auto_enable parameter is missing. Must be true or false.");
    }
    return this._json("PUT", "/sending-accounts", {
      jsonBody: {
        team_id: ANY_TEAM_ID,
        from_address: fromAddress,
        engagement_rule_id: inRange(engagementRuleId, STANDARD_RULE_IDS, "engagement_rule_id"),
        status_id: inRange(statusId, STATUS_IDS, "status_id"),
        auto_enable: autoEnable,
      },
    });
  }

  /** Remove a sending account. DELETE /sending-accounts. Destructive. */
  deleteSendingAccount(fromAddress) {
    return this._json("DELETE", "/sending-accounts", {
      params: { from_address: required(fromAddress, "from_address") },
    });
  }

  /**
   * Move an account and its history to a new from-address.
   * PUT /smtp-credentials — despite the path, no SMTP credentials are stored.
   */
  changeFromAddress(oldFromAddress, newFromAddress) {
    return this._json("PUT", "/smtp-credentials", {
      jsonBody: {
        team_id: ANY_TEAM_ID,
        old_from_address: required(oldFromAddress, "old_from_address"),
        new_from_address: required(newFromAddress, "new_from_address"),
      },
    });
  }

  /**
   * Registered from-addresses. GET /from-addresses
   *
   * `searchFrom` takes letters, digits and `. - _ @ +` only. `offset` and
   * `limit` go on the wire as strings and default to 0 and 100 on the API.
   */
  listFromAddresses({ searchFrom = null, offset = null, limit = null } = {}) {
    const params = {};
    if (searchFrom != null) {
      if (!SEARCH_FROM.test(searchFrom)) {
        throw clientError("search_from parameter is invalid. Letters, digits and . - _ @ + only.");
      }
      params.search_from = searchFrom;
    }
    for (const [name, value] of [["offset", offset], ["limit", limit]]) {
      if (value != null) {
        if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
          throw clientError(`${name} parameter is invalid. Must be a non-negative integer.`);
        }
        params[name] = String(value);
      }
    }
    return this._json("GET", "/from-addresses", { params });
  }

  // -- engagement rules -------------------------------------------------------

  /** The rule catalogue: -1 Custom, 0 Default, 1 Slow Pace, 2 Repair, 3 Boost, 4 Protect. */
  getEngagementRules() {
    return this._json("GET", "/engagement-rules");
  }

  /** Set a standard rule (0 to 4) on an address. PUT /engagement-rule */
  setEngagementRule(cFrom, ruleId) {
    required(cFrom, "c_from");
    return this._json("PUT", "/engagement-rule", {
      params: { c_from: cFrom },
      jsonBody: { rule_id: inRange(ruleId, STANDARD_RULE_IDS, "rule_id") },
    });
  }

  /** An address's custom rule, with can_update and remaining_seconds. */
  getCustomEngagement(cFrom) {
    return this._json("GET", `/custom-engagement/${pathSegment(cFrom, "c_from")}`);
  }

  /** Create a custom rule. POST /custom-engagement. Starts a 7 day update cooldown. */
  createCustomEngagement({ cFrom, replyPct, importantPct, clickPct } = {}) {
    return this._json("POST", "/custom-engagement", {
      jsonBody: engagementBody(cFrom, replyPct, importantPct, clickPct),
    });
  }

  /**
   * Update a custom rule. PUT /custom-engagement.
   * During the 7 day cooldown this raises with statusCode 429.
   */
  updateCustomEngagement({ cFrom, replyPct, importantPct, clickPct } = {}) {
    return this._json("PUT", "/custom-engagement", {
      jsonBody: engagementBody(cFrom, replyPct, importantPct, clickPct),
    });
  }

  /** Delete a custom rule and fall back to standard rule 1-4. DELETE /custom-engagement */
  deleteCustomEngagement(cFrom, engagementRuleId) {
    return this._json("DELETE", "/custom-engagement", {
      jsonBody: {
        c_from: required(cFrom, "c_from"),
        engagement_rule_id: inRange(engagementRuleId, [1, 4], "engagement_rule_id"),
      },
    });
  }

  // -- statistics, seeds and utilities ----------------------------------------

  /** The seed list. GET /seeds */
  getSeeds() {
    return this._json("GET", "/seeds");
  }

  /** The seed list as CSV (columns seed,provider). GET /seeds/download */
  downloadSeeds() {
    return this._csv("/seeds/download");
  }

  /** Number of seeds. GET /seed-count */
  getSeedCount() {
    return this._json("GET", "/seed-count");
  }

  /** Today's warmup progress. GET /progress-today */
  getProgressToday() {
    return this._json("GET", "/progress-today");
  }

  /** Messages sent today. GET /sent-today */
  getSentToday() {
    return this._json("GET", "/sent-today");
  }

  /** Current daily volume. GET /emails-per-day */
  getEmailsPerDay() {
    return this._json("GET", "/emails-per-day");
  }

  /** Statistics for an address. An address with no history returns zeros. */
  getStatistics(fromAddress) {
    return this._json("GET", "/statistics", {
      params: { from_address: required(fromAddress, "from_address") },
    });
  }

  /** Daily statistics between two dates, inclusive. GET /statistics-per-day */
  getStatisticsPerDay({ fromAddress, startDate, endDate } = {}) {
    required(fromAddress, "from_address");
    const start = isoDate(startDate, "start_date");
    const end = isoDate(endDate, "end_date");
    if (start > end) {
      throw clientError("start_date parameter is invalid. It is later than end_date.");
    }
    return this._json("GET", "/statistics-per-day", {
      params: { from_address: fromAddress, start_date: start, end_date: end },
    });
  }

  /** Detailed statistics for an address. GET /statistics-detailed */
  getStatisticsDetailed(cFrom) {
    return this._json("GET", "/statistics-detailed", {
      params: { c_from: required(cFrom, "c_from") },
    });
  }

  /** An address's statistics as CSV. GET /statistics/download */
  downloadStatistics(cFrom) {
    return this._csv("/statistics/download", { c_from: required(cFrom, "c_from") });
  }

  /** Statistics for one from-address. GET /from-address-statistics */
  getFromAddressStatistics(fromAddress) {
    return this._json("GET", "/from-address-statistics", {
      params: { from_address: required(fromAddress, "from_address") },
    });
  }

  /**
   * SPF, DKIM and DMARC status of a from-address's domain. GET /check-domain-dmarc
   *
   * LIVE: pass an email address. The live API answers "Please provide a valid
   * email address" for a bare domain, although the docs describe a domain.
   */
  checkDomainDmarc(fromAddress, dkimSelector = null) {
    required(fromAddress, "from_address");
    if (!String(fromAddress).includes("@")) {
      throw clientError(
        "from_address parameter is invalid. Pass an email address, e.g. sender@example.com."
      );
    }
    const params = { from_address: fromAddress };
    if (dkimSelector != null) params.dkim_selector = required(dkimSelector, "dkim_selector");
    return this._json("GET", "/check-domain-dmarc", { params });
  }

  /**
   * Check that SMTP credentials connect and hand off a message.
   * POST /test-smtp-configuration
   *
   * Nothing is stored, and the test message goes to a ZeroBounce test
   * recipient, not `fromAddress`.
   *
   * LIVE: the API answers any failed SMTP login with HTTP 500 — an API bug.
   * The username and password are masked in every error from this method.
   */
  testSmtpConfiguration({ fromAddress, username, password, server, port } = {}) {
    if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw clientError("port parameter is invalid. Must be 1 to 65535.");
    }
    const body = {
      from_address: required(fromAddress, "from_address"),
      username: required(username, "username"),
      password: required(password, "password"),
      server: required(server, "server"),
      port,
    };
    return this._json("POST", "/test-smtp-configuration", {
      jsonBody: body,
      secrets: [password, username],
    });
  }
}

function engagementBody(cFrom, replyPct, importantPct, clickPct) {
  required(cFrom, "c_from");
  inRange(replyPct, [5, 45], "reply_pct");
  inRange(importantPct, [5, 40], "important_pct");
  inRange(clickPct, [0, 70], "click_pct");
  if (clickPct > importantPct * 1.75) {
    throw clientError("click_pct parameter is invalid. At most important_pct x 1.75.");
  }
  return { c_from: cFrom, reply_pct: replyPct, important_pct: importantPct, click_pct: clickPct };
}

/** A Warmup error body as a short message. Mirrors the validation client's rules. */
function warmupMessage(body, status) {
  const trimmed = String(body || "").trim();
  if (!trimmed) return `Empty response from ZeroBounce (HTTP ${status})`;
  const head = trimmed.slice(0, 2000).toLowerCase();
  if (head.includes("<!doctype html") || head.includes("<html")) {
    return "ZeroBounce returned an HTML error page instead of an API response.";
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return "ZeroBounce returned a response that is not valid JSON.";
    }
    if (Array.isArray(parsed)) {
      const first = parsed.find((item) => typeof item === "string" && item.trim());
      if (first) return first.trim();
    } else if (parsed && typeof parsed === "object") {
      for (const key of ["message", "error", "error_message", "detail"]) {
        const value = parsed[key];
        if (typeof value === "string" && value.trim()) return value.trim();
        if (Array.isArray(value) && value.length) {
          const strings = value.filter((item) => typeof item === "string" && item.trim());
          if (strings.length) return strings.join("; ");
          const firstItem = value[0];
          if (firstItem && typeof firstItem === "object" && firstItem.msg) {
            const loc = Array.isArray(firstItem.loc) ? firstItem.loc.slice(1).join(".") : "";
            return loc ? `${loc}: ${firstItem.msg}` : String(firstItem.msg);
          }
        }
      }
    }
    return `ZeroBounce returned an error (HTTP ${status}).`;
  }
  if (trimmed.length > 1000) return "ZeroBounce returned a response that is not valid JSON.";
  return trimmed;
}

export default ZeroBounceWarmup;
