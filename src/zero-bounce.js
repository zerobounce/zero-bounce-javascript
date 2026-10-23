import { createRequest, notInitialized, parameterIsMissing, parameterIsInvalid, requireHttpsUrl } from "./utils.js";

/**
 * Validation status values returned by the API (validate, validateBatch).
 * Use for comparison: response.status === ZeroBounceSDK.ZBValidateStatus.VALID
 * Unknown/future API values are not listed; compare against response.status as string.
 */
export const ZBValidateStatus = Object.freeze({
  NONE: "",
  VALID: "valid",
  INVALID: "invalid",
  CATCH_ALL: "catch-all",
  UNKNOWN: "unknown",
  SPAMTRAP: "spamtrap",
  ABUSE: "abuse",
  DO_NOT_MAIL: "do_not_mail"
});

/**
 * Validation sub-status values returned by the API (validate, validateBatch).
 * Use for comparison: response.sub_status === ZeroBounceSDK.ZBValidateSubStatus.ACCEPT_ALL
 * Unknown/future API values are not listed; compare against response.sub_status as string.
 */
export const ZBValidateSubStatus = Object.freeze({
  NONE: "",
  ANTISPAM_SYSTEM: "antispam_system",
  GREYLISTED: "greylisted",
  MAIL_SERVER_TEMPORARY_ERROR: "mail_server_temporary_error",
  FORCIBLE_DISCONNECT: "forcible_disconnect",
  MAIL_SERVER_DID_NOT_RESPOND: "mail_server_did_not_respond",
  TIMEOUT_EXCEEDED: "timeout_exceeded",
  FAILED_SMTP_CONNECTION: "failed_smtp_connection",
  MAILBOX_QUOTA_EXCEEDED: "mailbox_quota_exceeded",
  EXCEPTION_OCCURRED: "exception_occurred",
  POSSIBLE_TRAP: "possible_trap",
  ROLE_BASED: "role_based",
  GLOBAL_SUPPRESSION: "global_suppression",
  MAILBOX_NOT_FOUND: "mailbox_not_found",
  NO_DNS_ENTRIES: "no_dns_entries",
  FAILED_SYNTAX_CHECK: "failed_syntax_check",
  POSSIBLE_TYPO: "possible_typo",
  UNROUTABLE_IP_ADDRESS: "unroutable_ip_address",
  LEADING_PERIOD_REMOVED: "leading_period_removed",
  DOES_NOT_ACCEPT_MAIL: "does_not_accept_mail",
  ALIAS_ADDRESS: "alias_address",
  ROLE_BASED_CATCH_ALL: "role_based_catch_all",
  DISPOSABLE: "disposable",
  TOXIC: "toxic",
  ALTERNATE: "alternate",
  MX_FORWARD: "mx_forward",
  BLOCKED: "blocked",
  ALLOWED: "allowed",
  ACCEPT_ALL: "accept_all",
  ROLE_BASED_ACCEPT_ALL: "role_based_accept_all",
  GOLD: "gold"
});

/**
 * Bulk {@code getfile} query parameter {@code download_type} (validation and scoring).
 * Use: {@code response.download_type === ZeroBounceSDK.ZBDownloadType.PHASE_1}
 */
export const ZBDownloadType = Object.freeze({
  PHASE_1: "phase_1",
  PHASE_2: "phase_2",
  COMBINED: "combined"
});

function isMissing(value) {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function booleanText(value) {
  return value ? "true" : "false";
}

function optionalColumn(value) {
  return value ? value : null;
}

export class ZeroBounceSDK {
  static ApiURL = Object.freeze({
    DEFAULT_API_URL: "https://api.zerobounce.net/v2",
    USA_API_URL: "https://api-us.zerobounce.net/v2",
    EU_API_URL: "https://api-eu.zerobounce.net/v2"
  });

  /** @deprecated Use top-level ZBValidateStatus for consistency */
  static ZBValidateStatus = ZBValidateStatus;
  /** @deprecated Use top-level ZBValidateSubStatus for consistency */
  static ZBValidateSubStatus = ZBValidateSubStatus;

  static ZBDownloadType = ZBDownloadType;

  /** Base URLs for APIs that do not sit under the main or bulk /v2 path. */
  static ListEvaluatorURL = Object.freeze({
    DEFAULT_URL: "https://bulkapi.zerobounce.net/v2/listevaluator",
  });

  static InboxPlacementURL = Object.freeze({
    DEFAULT_URL: "https://bulkapi.zerobounce.net/api/ipt",
  });

  constructor() {
    this._initialized = false;
    this._api_key = null;
    this._api_base_url = ZeroBounceSDK.ApiURL.DEFAULT_API_URL;
    this._list_evaluator_base_url = ZeroBounceSDK.ListEvaluatorURL.DEFAULT_URL;
    this._inbox_placement_base_url = ZeroBounceSDK.InboxPlacementURL.DEFAULT_URL;
  }

  /**
   * @param apiKey - your private API key
   * @param apiBaseURL - your preferred API, possible values being ApiURL.DEFAULT_API_URL, ApiURL.USAAPIURL, ApiURL.EUAPIURL
   * */
  init(apiKey, apiBaseURL = ZeroBounceSDK.ApiURL.DEFAULT_API_URL, options = null) {
    if (apiKey == null || String(apiKey).trim() === "") {
      throw new Error("ZeroBounce: Api key parameter is missing. Please provide a valid API key.");
    }
    this._api_key = apiKey;
    this._api_base_url = requireHttpsUrl(apiBaseURL);
    const { listEvaluatorBaseURL, inboxPlacementBaseURL } = options || {};
    this._list_evaluator_base_url = requireHttpsUrl(
      listEvaluatorBaseURL ?? ZeroBounceSDK.ListEvaluatorURL.DEFAULT_URL
    );
    this._inbox_placement_base_url = requireHttpsUrl(
      inboxPlacementBaseURL ?? ZeroBounceSDK.InboxPlacementURL.DEFAULT_URL
    );
    this._initialized = true;
  }

  async getCredits() {
    if (!this._initialized) {
      notInitialized();
      return;
    }
    const params = {
      api_key: this._api_key,
    };
    return createRequest({ requestType: "GET", params, path: "/getcredits", apiBaseURL: this._api_base_url });
  }

  /**
   * @param email - email to be validated
   * @param options - options object or ip_address string for backwards compatibility
   * @param options.ip_address - IP address (optional)
   * @param options.timeout - validation timeout in seconds, 3-60 (optional). If met, the API will return unknown/greylisted.
   * @param options.activityData - when true/false, sends activity_data query param (optional)
   * @param options.verifyPlus - when true/false, sends verify_plus query param (optional)
   * @param options.method - `"POST"` for form-encoded POST (default GET)
   * */
  async validateEmail(email, options = null) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (isMissing(email)) {
      parameterIsMissing("Email");
      return;
    }

    let ip_address;
    let timeout;
    let activityData;
    let verifyPlus;
    let domainInfo;
    let greylistProcessing;
    let callbackUrl;
    if (typeof options === "string") {
      ip_address = options;
    } else if (options && typeof options === "object") {
      ip_address = options.ip_address;
      timeout = options.timeout;
      activityData = options.activityData;
      verifyPlus = options.verifyPlus;
      domainInfo = options.domainInfo;
      greylistProcessing = options.greylistProcessing;
      callbackUrl = options.callbackUrl;
    }

    if (timeout != null && (timeout < 3 || timeout > 60)) {
      parameterIsInvalid("timeout", "Must be between 3 and 60 seconds.");
      return;
    }

    if (callbackUrl != null && greylistProcessing !== true) {
      parameterIsInvalid("callbackUrl", "Requires greylistProcessing: true.");
      return;
    }

    if (callbackUrl != null && String(callbackUrl).trim() === "") {
      parameterIsMissing("callbackUrl");
      return;
    }

    const params = {
      api_key: this._api_key,
      email,
    };
    if (ip_address != null) params.ip_address = ip_address;
    if (timeout != null) params.timeout = timeout;
    if (activityData != null) params.activity_data = activityData ? "true" : "false";
    if (verifyPlus != null) params.verify_plus = verifyPlus ? "true" : "false";
    if (domainInfo != null) params.domain_info = domainInfo ? "true" : "false";
    if (greylistProcessing != null) {
      params.greylist_processing = greylistProcessing ? "true" : "false";
    }
    if (callbackUrl != null) params.callback_url = callbackUrl;

    const usePost =
      options && typeof options === "object" && options.method === "POST";

    if (usePost) {
      return createRequest({
        requestType: "POST",
        path: "/validate",
        body: new URLSearchParams(params),
        params: {},
        apiBaseURL: this._api_base_url,
      });
    }

    return createRequest({ requestType: "GET", params, path: "/validate", apiBaseURL: this._api_base_url });
  }

  /**
   * @param startDate - The start date
   * @param endDate - The end date
   * */
  async getApiUsage(startDate, endDate) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (isMissing(startDate)) {
      parameterIsMissing("Start date", "Format: YYYY-MM-DD");
      return;
    } else if (isMissing(endDate)) {
      parameterIsMissing("End date", "Format: YYYY-MM-DD");
      return;
    }

    const params = {
      api_key: this._api_key,
      start_date: startDate,
      end_date: endDate,
    };
    return createRequest({
      requestType: "GET",
      params,
      path: "/getapiusage", 
      apiBaseURL: this._api_base_url
    });
  }

  /**
   * @param emailBatch: an array containing a list of email objects {email_address: "example@example.com"}
   * @param options - optional timeout (10-120 seconds), activityData, verifyPlus
   * */

  async validateBatch(emailBatch, options = null) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (emailBatch == null) {
      parameterIsMissing("Email list");
      return;
    }

    let timeout;
    let activityData;
    let verifyPlus;
    if (options && typeof options === "object") {
      timeout = options.timeout;
      activityData = options.activityData;
      verifyPlus = options.verifyPlus;
    }

    if (timeout != null && (timeout < 10 || timeout > 120)) {
      parameterIsInvalid("timeout", "Must be between 10 and 120 seconds.");
      return;
    }

    const body = {
      api_key: this._api_key,
      email_batch: emailBatch,
    };
    if (timeout != null) body.timeout = timeout;
    if (activityData != null) body.activity_data = activityData;
    if (verifyPlus != null) body.verify_plus = verifyPlus;
    return createRequest({
      requestType: "POST",
      path: "/validatebatch",
      body: JSON.stringify(body),
      apiBaseURL: this._api_base_url
    });
  }

  /**
   * @param email - a valid email address
   * */
  async getEmailActivity(email) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (isMissing(email)) {
      parameterIsMissing("Email");
      return;
    }
    const params = {
      api_key: this._api_key,
      email,
    };
    return createRequest({
      requestType: "GET",
      params,
      path: "/activity", 
      apiBaseURL: this._api_base_url
    });
  }

  /**
   * Real-time AI scoring for a single email (GET or POST /scoring).
   * @param email - email to score
   * @param options - optional `{ method: "POST" }` to use form-encoded POST (default GET)
   * */
  async scoreEmail(email, options = null) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (isMissing(email)) {
      parameterIsMissing("Email");
      return;
    }

    const params = {
      api_key: this._api_key,
      email,
    };

    const usePost =
      options && typeof options === "object" && options.method === "POST";

    if (usePost) {
      return createRequest({
        requestType: "POST",
        path: "/scoring",
        body: new URLSearchParams(params),
        params: {},
        apiBaseURL: this._api_base_url,
      });
    }

    return createRequest({
      requestType: "GET",
      params,
      path: "/scoring",
      apiBaseURL: this._api_base_url,
    });
  }

  /**
   * @param file: File - The csv or txt file to be submitted.
   * @param email_address_column: number - The column index of the email address in the file. Index starts from 1.
   * @param return_url: str or null - The URL will be used to call back when the validation is completed.
   * @param first_name_column: number or null - The column index of the first name column.
   * @param last_name_column: number or null - The column index of the last name column.
   * @param gender_column: number or null - The column index of the gender column.
   * @param ip_address_column: number or null - The IP Address the email signed up from.
   * @param has_header_row: Boolean - If the first row from the submitted file is a header row.
   * @param remove_duplicate: Boolean - If you want the system to remove duplicate emails.
   * @param allowPhase2: Boolean|null - Optional. When set, sends {@code allow_phase_2} (validation bulk only; see v2 send file API).
   * */
  async sendFile({
    file,
    email_address_column,
    first_name_column = false,
    return_url = false,
    last_name_column = false,
    gender_column = false,
    ip_address_column = false,
    has_header_row = false,
    remove_duplicate = false,
    allowPhase2 = null,
  }) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!file) {
      parameterIsMissing("file");
      return;
    } else if (isMissing(email_address_column)) {
      parameterIsMissing("email_address_column");
      return;
    }

    const body = new FormData();
    if (return_url) {
      body.append("return_url", return_url);
    }
    if (first_name_column) {
      body.append("first_name_column", first_name_column);
    }
    if (last_name_column) {
      body.append("last_name_column", last_name_column);
    }
    if (gender_column) {
      body.append("gender_column", gender_column);
    }
    if (ip_address_column) {
      body.append("ip_address_column", ip_address_column);
    }

    body.append("email_address_column", email_address_column);
    body.append("file", file);
    body.append("has_header_row", booleanText(has_header_row));
    body.append("remove_duplicate", booleanText(remove_duplicate));
    body.append("api_key", this._api_key);
    if (allowPhase2 != null) {
      body.append("allow_phase_2", booleanText(allowPhase2));
    }

    return createRequest({
      requestType: "POST",
      path: "/sendfile",
      body,
      batch: true, 
      apiBaseURL: this._api_base_url
    });
  }

  /**
   * Send a file for bulk email validation from a stream or Blob (e.g. in-memory CSV).
   * @param fileStreamOrBlob: File|Blob - The file data (File, Blob, or in Node a stream/buffer).
   * @param fileName: string - The file name to use for the upload (e.g. "emails.csv").
   * @param options: object - Same options as sendFile (email_address_column, return_url, etc.).
   * */
  async sendFileStream(fileStreamOrBlob, fileName, {
    email_address_column,
    first_name_column = false,
    return_url = false,
    last_name_column = false,
    gender_column = false,
    ip_address_column = false,
    has_header_row = false,
    remove_duplicate = false,
    allowPhase2 = null,
  } = {}) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!fileStreamOrBlob) {
      parameterIsMissing("fileStreamOrBlob");
      return;
    } else if (isMissing(fileName)) {
      parameterIsMissing("fileName");
      return;
    } else if (isMissing(email_address_column)) {
      parameterIsMissing("email_address_column");
      return;
    }

    const body = new FormData();
    if (return_url) body.append("return_url", return_url);
    if (first_name_column) body.append("first_name_column", first_name_column);
    if (last_name_column) body.append("last_name_column", last_name_column);
    if (gender_column) body.append("gender_column", gender_column);
    if (ip_address_column) body.append("ip_address_column", ip_address_column);
    body.append("email_address_column", email_address_column);
    body.append("file", fileStreamOrBlob, fileName);
    body.append("has_header_row", booleanText(has_header_row));
    body.append("remove_duplicate", booleanText(remove_duplicate));
    body.append("api_key", this._api_key);
    if (allowPhase2 != null) {
      body.append("allow_phase_2", booleanText(allowPhase2));
    }

    return createRequest({
      requestType: "POST",
      path: "/sendfile",
      body,
      batch: true,
      apiBaseURL: this._api_base_url
    });
  }

  /**
   * @param file: File - The csv or txt file to be submitted.
   * @param email_address_column: number - The column index of the email address in the file. Index starts from 1.
   * @param return_url: str or null - The URL will be used to call back when the validation is completed.
   * @param has_header_row: Boolean - If the first row from the submitted file is a header row.
   * @param remove_duplicate: Boolean - If you want the system to remove duplicate emails.
   * */
  async sendScoringFile({
    file,
    email_address_column,
    return_url = false,
    has_header_row = false,
    remove_duplicate = false,
  }) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!file) {
      parameterIsMissing("file: File");
      return;
    } else if (isMissing(email_address_column)) {
      parameterIsMissing("email_address_column: number");
      return;
    }

    const body = new FormData();

    if (return_url) {
      body.append("return_url", return_url);
    }

    body.append("file", file);
    body.append("email_address_column", email_address_column);
    body.append("has_header_row", booleanText(has_header_row));
    body.append("api_key", this._api_key);
    body.append("remove_duplicate", booleanText(remove_duplicate));

    return createRequest({
      requestType: "POST",
      path: "/scoring/sendfile",
      body,
      batch: true, 
      apiBaseURL: this._api_base_url
    });
  }

  /**
   * Send a file for bulk email scoring from a stream or Blob.
   * @param fileStreamOrBlob: File|Blob
   * @param fileName: string - e.g. "emails.csv"
   * @param options: object - email_address_column, return_url, has_header_row, remove_duplicate
   * */
  async sendScoringFileStream(fileStreamOrBlob, fileName, {
    email_address_column,
    return_url = false,
    has_header_row = false,
    remove_duplicate = false,
  } = {}) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!fileStreamOrBlob) {
      parameterIsMissing("fileStreamOrBlob");
      return;
    } else if (isMissing(fileName)) {
      parameterIsMissing("fileName");
      return;
    } else if (isMissing(email_address_column)) {
      parameterIsMissing("email_address_column");
      return;
    }

    const body = new FormData();
    if (return_url) body.append("return_url", return_url);
    body.append("file", fileStreamOrBlob, fileName);
    body.append("email_address_column", email_address_column);
    body.append("has_header_row", booleanText(has_header_row));
    body.append("api_key", this._api_key);
    body.append("remove_duplicate", booleanText(remove_duplicate));

    return createRequest({
      requestType: "POST",
      path: "/scoring/sendfile",
      body,
      batch: true,
      apiBaseURL: this._api_base_url
    });
  }

  async _getStatusUtil(fileId, path, { bulkRoot = false } = {}) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (isMissing(fileId)) {
      parameterIsMissing("File id");
      return;
    }

    const params = {
      api_key: this._api_key,
      file_id: fileId,
    };
    return createRequest({
      requestType: "GET",
      params,
      path,
      batch: true,
      bulkBase: bulkRoot ? "root" : "v2",
      apiBaseURL: this._api_base_url
    });
  }

  async _sendBulkRootFormPost(path, fields) {
    const params = {
      api_key: this._api_key,
      ...fields,
    };
    return createRequest({
      requestType: "POST",
      path,
      body: new URLSearchParams(params),
      params: {},
      batch: true,
      bulkBase: "root",
      apiBaseURL: this._api_base_url,
    });
  }

  /**
   * @param fileId - the id of a previously submmitted and accepted file
   * */
  async getFileStatus(fileId) {
    return this._getStatusUtil(fileId, "/filestatus");
  }

  /**
   * @param fileId - the id of a previously submmitted and accepted file
   * */
  async getScoringFileStatus(fileId) {
    return this._getStatusUtil(fileId, "/scoring/filestatus");
  }

  async _getFileUtil(fileId, path, scoring = false, getFileOptions = null, { bulkRoot = false } = {}) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (isMissing(fileId)) {
      parameterIsMissing("File id");
      return;
    }
    const params = {
      api_key: this._api_key,
      file_id: fileId,
    };
    if (getFileOptions != null && typeof getFileOptions === "object") {
      if (getFileOptions.downloadType != null) {
        params.download_type = getFileOptions.downloadType;
      }
      if (!scoring && getFileOptions.activityData != null) {
        params.activity_data = getFileOptions.activityData ? "true" : "false";
      }
    }
    return createRequest({
      requestType: "GET",
      params,
      path,
      batch: true,
      bulkBase: bulkRoot ? "root" : "v2",
      returnText: true,
      scoring, 
      apiBaseURL: this._api_base_url
    });
  }

  /**
   * @param fileId - the id of a previously submmitted and accepted file
   * @param getFileOptions - optional {@code downloadType} ({@link ZBDownloadType} values) and {@code activityData} (validation only)
   * */
  async getFile(fileId, getFileOptions = null) {
    return this._getFileUtil(fileId, "/getfile", false, getFileOptions);
  }

  /**
   * @param fileId - the id of a previously submmitted and accepted file
   * @param getFileOptions - optional {@code downloadType}; {@code activityData} is not sent for scoring getfile
   * */
  async getScoringFile(fileId, getFileOptions = null) {
    return this._getFileUtil(fileId, "/scoring/getfile", true, getFileOptions);
  }

  async _deleteFileUtil(fileId, path, scoring = false, { bulkRoot = false } = {}) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (isMissing(fileId)) {
      parameterIsMissing("File id");
      return;
    }
    const params = {
      api_key: this._api_key,
      file_id: fileId,
    };
    return createRequest({
      requestType: "GET",
      params,
      path,
      batch: true,
      bulkBase: bulkRoot ? "root" : "v2",
      scoring, 
      apiBaseURL: this._api_base_url
    });
  }

  async _sendBulkRootMultipartFile(path, { file, fileName = null, fields = {} }) {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (value == null) continue;
      body.append(key, typeof value === "boolean" ? booleanText(value) : value);
    }
    if (fileName != null) {
      body.append("file", file, fileName);
    } else {
      body.append("file", file);
    }
    body.append("api_key", this._api_key);
    return createRequest({
      requestType: "POST",
      path,
      body,
      batch: true,
      bulkBase: "root",
      apiBaseURL: this._api_base_url,
    });
  }

  /**
   * @param fileId - the id of a previously submmitted and accepted file
   * */
  async deleteFile(fileId) {
    return this._deleteFileUtil(fileId, "/deletefile");
  }

  /**
   * @param fileId - the id of a previously submmitted and accepted file
   * */
  async deleteScoringFile(fileId) {
    return this._deleteFileUtil(fileId, "/scoring/deletefile", true);
  }

  // BULK EMAIL FINDER (bulkapi.zerobounce.net/email-finder/*)

  async sendEmailFinderFile({
    file,
    domain_column,
    first_name_column = false,
    last_name_column = false,
    middle_name_column = false,
    full_name_column = false,
    has_header_row = false,
  }) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!file) {
      parameterIsMissing("file");
      return;
    } else if (isMissing(domain_column)) {
      parameterIsMissing("domain_column");
      return;
    }
    return this._sendBulkRootMultipartFile("/email-finder/sendfile", {
      file,
      fields: {
        domain_column,
        first_name_column: optionalColumn(first_name_column),
        last_name_column: optionalColumn(last_name_column),
        middle_name_column: optionalColumn(middle_name_column),
        full_name_column: optionalColumn(full_name_column),
        has_header_row: Boolean(has_header_row),
      },
    });
  }

  async sendEmailFinderFileStream(fileStreamOrBlob, fileName, {
    domain_column,
    first_name_column = false,
    last_name_column = false,
    middle_name_column = false,
    full_name_column = false,
    has_header_row = false,
  } = {}) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!fileStreamOrBlob) {
      parameterIsMissing("fileStreamOrBlob");
      return;
    } else if (isMissing(fileName)) {
      parameterIsMissing("fileName");
      return;
    } else if (isMissing(domain_column)) {
      parameterIsMissing("domain_column");
      return;
    }
    return this._sendBulkRootMultipartFile("/email-finder/sendfile", {
      file: fileStreamOrBlob,
      fileName,
      fields: {
        domain_column,
        first_name_column: optionalColumn(first_name_column),
        last_name_column: optionalColumn(last_name_column),
        middle_name_column: optionalColumn(middle_name_column),
        full_name_column: optionalColumn(full_name_column),
        has_header_row: Boolean(has_header_row),
      },
    });
  }

  async getEmailFinderFileStatus(fileId) {
    return this._getStatusUtil(fileId, "/email-finder/filestatus", { bulkRoot: true });
  }

  async getEmailFinderFile(fileId) {
    return this._getFileUtil(fileId, "/email-finder/getfile", false, null, { bulkRoot: true });
  }

  async deleteEmailFinderFile(fileId) {
    return this._deleteFileUtil(fileId, "/email-finder/deletefile", false, { bulkRoot: true });
  }

  // BULK DOMAIN SEARCH (bulkapi.zerobounce.net/domain-search/*)

  async sendDomainSearchFile({
    file,
    domain_column,
    has_header_row = false,
  }) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!file) {
      parameterIsMissing("file");
      return;
    } else if (isMissing(domain_column)) {
      parameterIsMissing("domain_column");
      return;
    }
    return this._sendBulkRootMultipartFile("/domain-search/sendfile", {
      file,
      fields: { domain_column, has_header_row: Boolean(has_header_row) },
    });
  }

  async sendDomainSearchFileStream(fileStreamOrBlob, fileName, {
    domain_column,
    has_header_row = false,
  } = {}) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!fileStreamOrBlob) {
      parameterIsMissing("fileStreamOrBlob");
      return;
    } else if (isMissing(fileName)) {
      parameterIsMissing("fileName");
      return;
    } else if (isMissing(domain_column)) {
      parameterIsMissing("domain_column");
      return;
    }
    return this._sendBulkRootMultipartFile("/domain-search/sendfile", {
      file: fileStreamOrBlob,
      fileName,
      fields: { domain_column, has_header_row: Boolean(has_header_row) },
    });
  }

  async getDomainSearchFileStatus(fileId) {
    return this._getStatusUtil(fileId, "/domain-search/filestatus", { bulkRoot: true });
  }

  async getDomainSearchFile(fileId) {
    return this._getFileUtil(fileId, "/domain-search/getfile", false, null, { bulkRoot: true });
  }

  async deleteDomainSearchFile(fileId) {
    return this._deleteFileUtil(fileId, "/domain-search/deletefile", false, { bulkRoot: true });
  }

  // LIST EVALUATOR (bulkapi.zerobounce.net/v2/listevaluator/)

  async sendListEvaluatorFile({ file, email_address_column }) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!file) {
      parameterIsMissing("file");
      return;
    } else if (isMissing(email_address_column)) {
      parameterIsMissing("email_address_column");
      return;
    }
    const body = new FormData();
    body.append("file", file);
    body.append("email_address_column", email_address_column);
    body.append("api_key", this._api_key);
    return createRequest({
      requestType: "POST",
      path: "/",
      body,
      apiBaseURL: this._list_evaluator_base_url,
    });
  }

  async sendListEvaluatorFileStream(fileStreamOrBlob, fileName, { email_address_column } = {}) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!fileStreamOrBlob) {
      parameterIsMissing("fileStreamOrBlob");
      return;
    } else if (isMissing(fileName)) {
      parameterIsMissing("fileName");
      return;
    } else if (isMissing(email_address_column)) {
      parameterIsMissing("email_address_column");
      return;
    }
    const body = new FormData();
    body.append("file", fileStreamOrBlob, fileName);
    body.append("email_address_column", email_address_column);
    body.append("api_key", this._api_key);
    return createRequest({
      requestType: "POST",
      path: "/",
      body,
      apiBaseURL: this._list_evaluator_base_url,
    });
  }

  async getListEvaluatorResult(fileId) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (isMissing(fileId)) {
      parameterIsMissing("File id");
      return;
    }
    const params = { api_key: this._api_key };
    return createRequest({
      requestType: "GET",
      params,
      path: `/${encodeURIComponent(fileId)}/`,
      apiBaseURL: this._list_evaluator_base_url,
    });
  }

  async sendEvaluatedFile({ file }) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (!file) {
      parameterIsMissing("file");
      return;
    }
    const body = new FormData();
    body.append("file", file);
    body.append("api_key", this._api_key);
    return createRequest({
      requestType: "POST",
      path: "/send-evaluated-file/",
      body,
      batch: true,
      apiBaseURL: this._api_base_url,
    });
  }

  // CUSTOM FILTERS (main API /v2/filters/*)

  async addFilter({ rule, target, value }) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (isMissing(rule)) {
      parameterIsMissing("rule");
      return;
    } else if (isMissing(target)) {
      parameterIsMissing("target");
      return;
    } else if (isMissing(value)) {
      parameterIsMissing("value");
      return;
    }
    const params = {
      api_key: this._api_key,
      rule,
      target,
      value,
    };
    return createRequest({
      requestType: "POST",
      path: "/filters/add",
      body: new URLSearchParams(params),
      params: {},
      apiBaseURL: this._api_base_url,
    });
  }

  async listFilters(options = null) {
    if (!this._initialized) {
      notInitialized();
      return;
    }
    const params = { api_key: this._api_key };
    const usePost =
      options && typeof options === "object" && options.method === "POST";
    if (usePost) {
      return createRequest({
        requestType: "POST",
        path: "/filters/list",
        body: new URLSearchParams(params),
        params: {},
        apiBaseURL: this._api_base_url,
      });
    }
    return createRequest({
      requestType: "GET",
      params,
      path: "/filters/list",
      apiBaseURL: this._api_base_url,
    });
  }

  async deleteFilter({ rule, target, value }) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (isMissing(rule)) {
      parameterIsMissing("rule");
      return;
    } else if (isMissing(target)) {
      parameterIsMissing("target");
      return;
    } else if (isMissing(value)) {
      parameterIsMissing("value");
      return;
    }
    const params = {
      api_key: this._api_key,
      rule,
      target,
      value,
    };
    return createRequest({
      requestType: "POST",
      path: "/filters/delete",
      body: new URLSearchParams(params),
      params: {},
      apiBaseURL: this._api_base_url,
    });
  }


  // AMAZON S3 BULK HELPERS (bulkapi root)

  async listS3files({ bucket = null, search = null } = {}) {
    if (!this._initialized) {
      notInitialized();
      return;
    }
    const params = { api_key: this._api_key };
    if (bucket != null) params.bucket = bucket;
    if (search != null) params.search = search;
    return createRequest({
      requestType: "GET",
      params,
      path: "/listS3files",
      batch: true,
      bulkBase: "root",
      apiBaseURL: this._api_base_url,
    });
  }

  async validateS3file({
    file_name,
    has_header_row,
    remove_duplicates,
    email_address_column = null,
    return_url = false,
    first_name_column = false,
    last_name_column = false,
    gender_column = false,
    ip_address_column = false,
    remove_duplicate = null,
    allowPhase2 = null,
  }) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (isMissing(file_name)) {
      parameterIsMissing("file_name");
      return;
    }
    const fields = { file_name };
    if (has_header_row != null) fields.has_header_row = has_header_row;
    if (remove_duplicates != null) fields.remove_duplicates = remove_duplicates;
    if (remove_duplicate != null) fields.remove_duplicate = remove_duplicate;
    if (email_address_column != null) fields.email_address_column = email_address_column;
    if (return_url) fields.return_url = return_url;
    if (first_name_column) fields.first_name_column = first_name_column;
    if (last_name_column) fields.last_name_column = last_name_column;
    if (gender_column) fields.gender_column = gender_column;
    if (ip_address_column) fields.ip_address_column = ip_address_column;
    if (allowPhase2 != null) fields.allow_phase_2 = String(allowPhase2);
    return this._sendBulkRootFormPost("/validateS3file", fields);
  }

  async scoreS3file({
    file_name,
    has_header_row,
    remove_duplicates,
    email_address_column = null,
    remove_duplicate = null,
  }) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (isMissing(file_name)) {
      parameterIsMissing("file_name");
      return;
    }
    const fields = { file_name };
    if (has_header_row != null) fields.has_header_row = has_header_row;
    if (remove_duplicates != null) fields.remove_duplicates = remove_duplicates;
    if (remove_duplicate != null) fields.remove_duplicate = remove_duplicate;
    if (email_address_column != null) fields.email_address_column = email_address_column;
    return this._sendBulkRootFormPost("/scoreS3file", fields);
  }

  async exportS3file({ file_id, export_bucket }) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (isMissing(file_id)) {
      parameterIsMissing("file_id");
      return;
    } else if (isMissing(export_bucket)) {
      parameterIsMissing("export_bucket");
      return;
    }
    return this._sendBulkRootFormPost("/exportS3file", {
      file_id,
      export_bucket,
    });
  }


  /**
   * Shared shape for the documented S3 and SFTP file jobs on the bulkapi root.
   * Only fields the caller set are sent; booleans go as the strings true/false.
   *
   * @param fileNameRequired - false for validateSFTPfile, whose file_name is optional
   * */
  async _bulkRootFileJob(path, { file_name, has_header_row, remove_duplicates, return_url }, fileNameRequired = true) {
    if (!this._initialized) {
      notInitialized();
      return;
    }
    if (fileNameRequired && isMissing(file_name)) {
      parameterIsMissing("file_name");
      return;
    }
    if (file_name != null && String(file_name).trim() === "") {
      parameterIsMissing("file_name");
      return;
    }
    if (has_header_row == null) {
      parameterIsMissing("has_header_row");
      return;
    }

    const fields = { has_header_row: booleanText(has_header_row) };
    if (file_name != null) fields.file_name = file_name;
    if (remove_duplicates != null) fields.remove_duplicates = booleanText(remove_duplicates);
    if (return_url != null) fields.return_url = return_url;
    return this._sendBulkRootFormPost(path, fields);
  }

  /** Run the email finder on a file in your Amazon S3 bucket. POST /emailFinderS3file */
  async emailFinderS3file(options) {
    return this._bulkRootFileJob("/emailFinderS3file", options || {});
  }

  /** Run domain search on a file in your Amazon S3 bucket. POST /domainSearchS3file */
  async domainSearchS3file(options) {
    return this._bulkRootFileJob("/domainSearchS3file", options || {});
  }

  // SFTP / FTP BULK (bulkapi root)
  // The server, path and protocol come from your ZeroBounce settings.

  /**
   * Validate a file from your SFTP/FTP server. POST /validateSFTPfile
   *
   * The docs list file_name as optional here; leave it out to use the input
   * bucket configured in your settings.
   * */
  async validateSFTPfile(options) {
    return this._bulkRootFileJob("/validateSFTPfile", options || {}, false);
  }

  /** Score a file from your SFTP/FTP server. POST /scoreSFTPfile */
  async scoreSFTPfile(options) {
    return this._bulkRootFileJob("/scoreSFTPfile", options || {});
  }

  /** Run the email finder on a file from your SFTP/FTP server. POST /emailFinderSFTPfile */
  async emailFinderSFTPfile(options) {
    return this._bulkRootFileJob("/emailFinderSFTPfile", options || {});
  }

  /** Run domain search on a file from your SFTP/FTP server. POST /domainSearchSFTPfile */
  async domainSearchSFTPfile(options) {
    return this._bulkRootFileJob("/domainSearchSFTPfile", options || {});
  }

  /**
   * Export a validated or scored file back to your SFTP/FTP server. POST /exportSFTPfile
   *
   * Without export_path the path from your ZeroBounce settings is used.
   * */
  async exportSFTPfile({ file_id, export_path = null } = {}) {
    if (!this._initialized) {
      notInitialized();
      return;
    }
    if (isMissing(file_id)) {
      parameterIsMissing("file_id");
      return;
    }
    if (export_path != null && String(export_path).trim() === "") {
      parameterIsMissing("export_path");
      return;
    }
    const fields = { file_id };
    if (export_path != null) fields.export_path = export_path;
    return this._sendBulkRootFormPost("/exportSFTPfile", fields);
  }

  // INBOX PLACEMENT TESTER (bulkapi.zerobounce.net/api/ipt)
  // The API key goes on the query string and bodies are JSON with camelCase fields.

  _iptRequest(requestType, path, { params = null, jsonBody = null } = {}) {
    return createRequest({
      requestType,
      path,
      params: { api_key: this._api_key, ...(params || {}) },
      jsonBody,
      apiBaseURL: this._inbox_placement_base_url,
    });
  }

  /** Seed providers available for new tests. GET /providers */
  async getInboxPlacementProviders() {
    if (!this._initialized) {
      notInitialized();
      return;
    }
    return this._iptRequest("GET", "/providers");
  }

  /** Supported test types and the default one. GET /test-types */
  async getInboxPlacementTestTypes() {
    if (!this._initialized) {
      notInitialized();
      return;
    }
    return this._iptRequest("GET", "/test-types");
  }

  /**
   * Create an inbox placement test. POST /test
   *
   * @param options.name - unique test name, at most 64 characters (required)
   * @param options.testType - 1 (Email, needs senderEmail), 2 (Unique ID) or 3 (Auto Alias)
   * @param options.senderEmail - the From address to match; required when testType is 1
   * @param options.providerIds - use every active seed of these providers
   * @param options.seedIds - use these seed mailboxes
   * @param options.providers - [{ id, maxSeeds }] to cap seeds per provider (maxSeeds >= 1)
   * @param options.webhookUrl - where the finished result is posted
   * */
  async createInboxPlacementTest({
    name,
    testType = null,
    senderEmail = null,
    providerIds = null,
    seedIds = null,
    providers = null,
    webhookUrl = null,
  } = {}) {
    if (!this._initialized) {
      notInitialized();
      return;
    }
    if (isMissing(name)) {
      parameterIsMissing("name");
      return;
    }
    if (String(name).length > 64) {
      parameterIsInvalid("name", "Must be at most 64 characters.");
      return;
    }
    if (testType != null && ![1, 2, 3].includes(testType)) {
      parameterIsInvalid("testType", "Must be 1, 2 or 3.");
      return;
    }
    if (testType === 1 && isMissing(senderEmail)) {
      parameterIsMissing("senderEmail", "Required when testType is 1.");
      return;
    }
    for (const provider of providers || []) {
      if (!provider || typeof provider !== "object" || provider.id == null) {
        parameterIsInvalid("providers", "Each entry needs an id.");
        return;
      }
      if (provider.maxSeeds != null && provider.maxSeeds < 1) {
        parameterIsInvalid("providers", "maxSeeds must be at least 1.");
        return;
      }
    }

    const body = { name };
    if (testType != null) body.testType = testType;
    if (senderEmail != null) body.senderEmail = senderEmail;
    if (providerIds != null) body.providerIds = providerIds;
    if (seedIds != null) body.seedIds = seedIds;
    if (providers != null) body.providers = providers;
    if (webhookUrl != null) body.webhookUrl = webhookUrl;
    return this._iptRequest("POST", "/test", { jsonBody: body });
  }

  /** A test and its placement results. GET /test/{id} */
  async getInboxPlacementTest(testId) {
    if (!this._initialized) {
      notInitialized();
      return;
    }
    if (isMissing(testId)) {
      parameterIsMissing("testId");
      return;
    }
    return this._iptRequest("GET", `/test/${encodeURIComponent(String(testId).trim())}`);
  }

  /**
   * List tests, newest first. GET /tests
   *
   * @param options.status - "running" or "finished"
   * @param options.createdAfter - ISO 8601 date or datetime
   * @param options.createdBefore - ISO 8601 date or datetime
   * @param options.page - page number, from 1
   * @param options.pageSize - tests per page, 1 to 100
   * */
  async listInboxPlacementTests({
    status = null,
    createdAfter = null,
    createdBefore = null,
    page = null,
    pageSize = null,
  } = {}) {
    if (!this._initialized) {
      notInitialized();
      return;
    }
    if (status != null && !["running", "finished"].includes(status)) {
      parameterIsInvalid("status", "Must be running or finished.");
      return;
    }
    if (page != null && page < 1) {
      parameterIsInvalid("page", "Must be at least 1.");
      return;
    }
    if (pageSize != null && (pageSize < 1 || pageSize > 100)) {
      parameterIsInvalid("pageSize", "Must be between 1 and 100.");
      return;
    }

    const params = {};
    if (status != null) params.status = status;
    if (createdAfter != null) params.createdAfter = createdAfter;
    if (createdBefore != null) params.createdBefore = createdBefore;
    if (page != null) params.page = page;
    if (pageSize != null) params.page_size = pageSize;
    return this._iptRequest("GET", "/tests", { params });
  }

  /** Delete a finished test. DELETE /test/{id} */
  async deleteInboxPlacementTest(testId) {
    if (!this._initialized) {
      notInitialized();
      return;
    }
    if (isMissing(testId)) {
      parameterIsMissing("testId");
      return;
    }
    return this._iptRequest("DELETE", `/test/${encodeURIComponent(String(testId).trim())}`);
  }

  /** The webhook URL saved on this API key. GET /webhook */
  async getInboxPlacementWebhook() {
    if (!this._initialized) {
      notInitialized();
      return;
    }
    return this._iptRequest("GET", "/webhook");
  }

  /** Save the URL finished results are posted to. PUT /webhook */
  async setInboxPlacementWebhook(webhookUrl) {
    if (!this._initialized) {
      notInitialized();
      return;
    }
    if (isMissing(webhookUrl)) {
      parameterIsMissing("webhookUrl");
      return;
    }
    return this._iptRequest("PUT", "/webhook", { jsonBody: { webhookUrl } });
  }

  // EMAIL FINDER

  /**
   * @param domain str - domain of the email address
   * @param first_name str - first name
   * @param middle_name str or null - middle name
   * @param last_name str or null - last name
   * */
  async findEmailByDomain({
    domain, 
    first_name, 
    middle_name = null, 
    last_name = null
  }) {
    return this._findEmail({
      domain: domain,
      first_name: first_name,
      middle_name: middle_name,
      last_name: last_name
    });
  }

  /**
   * @param company_name str - company name of the email address
   * @param first_name str - first name
   * @param middle_name str or null - middle name
   * @param last_name str or null - last name
   * */
  async findEmailByCompanyName({
    company_name, 
    first_name, 
    middle_name = null, 
    last_name = null
  }) {
    return this._findEmail({
      company_name: company_name,
      first_name: first_name,
      middle_name: middle_name,
      last_name: last_name
    });
  }

  async _findEmail({
    domain = null,
    company_name = null,
    first_name,
    middle_name = null,
    last_name = null
  }) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (isMissing(domain) && isMissing(company_name)) {
      parameterIsMissing("domain");
      parameterIsMissing("company_name");
      return;
    } else if (isMissing(first_name)) {
      parameterIsMissing("first_name");
      return;
    }

    const params = {
      api_key: this._api_key,
      first_name: first_name,
    };
    if (!isMissing(middle_name)) params.middle_name = middle_name;
    if (!isMissing(last_name)) params.last_name = last_name;

    if (domain != null) {
      params["domain"] = domain;
    } else if (company_name != null) {
      params["company_name"] = company_name;
    }

    return createRequest({
      requestType: "GET",
      params,
      path: "/guessformat", 
      apiBaseURL: this._api_base_url
    });
  }


  // DOMAIN SEARCH

  /**
   * @param domain str - domain name
   * */
  async findEmailFormatByDomain({
    domain
  }) {
    return this._findEmailFormat({
      domain: domain
    });
  }

  /**
   * @param company_name str - company name
   * */
  async findEmailFormatByCompanyName({
    company_name
  }) {
    return this._findEmailFormat({
      company_name: company_name
    });
  }

  async _findEmailFormat({
    domain = null,
    company_name = null
  }) {
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (isMissing(domain) && isMissing(company_name)) {
      parameterIsMissing("domain");
      parameterIsMissing("company_name");
      return;
    }

    const params = {
      api_key: this._api_key
    };

    if (domain != null) {
      params["domain"] = domain;
    } else if (company_name != null) {
      params["company_name"] = company_name;
    }

    return createRequest({
      requestType: "GET",
      params,
      path: "/guessformat", 
      apiBaseURL: this._api_base_url
    });
  }


  /**
   * @deprecated Use findEmail for Email Finder API, or findEmailFormat for Domain Search API.
   * @param domain str - domain of the email address
   * @param first_name str or null - first name
   * @param middle_name str or null - middle name
   * @param last_name str or null - last name
   * */
  async guessFormat ({
    domain, 
    first_name = null, 
    middle_name = null, 
    last_name = null
  }) {
    console.warn("guessFormat() is deprecated. Use findEmail for Email Finder API, or findEmailFormat for Domain Search API.");
    if (!this._initialized) {
      notInitialized();
      return;
    } else if (isMissing(domain)) {
      parameterIsMissing("domain");
      return;
    }

    const params = {
      api_key: this._api_key,
      domain: domain,
    };
    if (!isMissing(first_name)) params.first_name = first_name;
    if (!isMissing(middle_name)) params.middle_name = middle_name;
    if (!isMissing(last_name)) params.last_name = last_name;

    return createRequest({
      requestType: "GET",
      params,
      path: "/guessformat", 
      apiBaseURL: this._api_base_url
    });
  }
}
