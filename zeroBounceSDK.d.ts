/**
 * Type declarations for @zerobounce/zero-bounce-sdk
 * ZeroBounce Email Validation & Email Finder API SDK
 */

/** Validation status values (use ZeroBounceSDK.ZBValidateStatus in code). */
export type ZBValidateStatusType = Readonly<{
  NONE: "";
  VALID: "valid";
  INVALID: "invalid";
  CATCH_ALL: "catch-all";
  UNKNOWN: "unknown";
  SPAMTRAP: "spamtrap";
  ABUSE: "abuse";
  DO_NOT_MAIL: "do_not_mail";
}>;

/** Validation sub-status values (use ZeroBounceSDK.ZBValidateSubStatus in code). */
export type ZBValidateSubStatusType = Readonly<{
  NONE: "";
  ANTISPAM_SYSTEM: "antispam_system";
  GREYLISTED: "greylisted";
  MAIL_SERVER_TEMPORARY_ERROR: "mail_server_temporary_error";
  FORCIBLE_DISCONNECT: "forcible_disconnect";
  MAIL_SERVER_DID_NOT_RESPOND: "mail_server_did_not_respond";
  TIMEOUT_EXCEEDED: "timeout_exceeded";
  FAILED_SMTP_CONNECTION: "failed_smtp_connection";
  MAILBOX_QUOTA_EXCEEDED: "mailbox_quota_exceeded";
  EXCEPTION_OCCURRED: "exception_occurred";
  POSSIBLE_TRAP: "possible_trap";
  ROLE_BASED: "role_based";
  GLOBAL_SUPPRESSION: "global_suppression";
  MAILBOX_NOT_FOUND: "mailbox_not_found";
  NO_DNS_ENTRIES: "no_dns_entries";
  FAILED_SYNTAX_CHECK: "failed_syntax_check";
  POSSIBLE_TYPO: "possible_typo";
  UNROUTABLE_IP_ADDRESS: "unroutable_ip_address";
  LEADING_PERIOD_REMOVED: "leading_period_removed";
  DOES_NOT_ACCEPT_MAIL: "does_not_accept_mail";
  ALIAS_ADDRESS: "alias_address";
  ROLE_BASED_CATCH_ALL: "role_based_catch_all";
  DISPOSABLE: "disposable";
  TOXIC: "toxic";
  ALTERNATE: "alternate";
  MX_FORWARD: "mx_forward";
  BLOCKED: "blocked";
  ALLOWED: "allowed";
  ACCEPT_ALL: "accept_all";
  ROLE_BASED_ACCEPT_ALL: "role_based_accept_all";
  GOLD: "gold";
}>;

/** `status` field on validate / validateBatch results (matches {@link ZBValidateStatusType} values). */
export type ValidationStatus = ZBValidateStatusType[keyof ZBValidateStatusType];

/** `sub_status` field on validate / validateBatch results (matches {@link ZBValidateSubStatusType} values). */
export type ValidationSubStatus = ZBValidateSubStatusType[keyof ZBValidateSubStatusType];

/**
 * Single-email validation payload from GET /validate.
 * The API may omit optional fields on partial responses.
 */
export interface EmailValidationResult {
  address?: string;
  status: ValidationStatus;
  sub_status: ValidationSubStatus | "";
  free_email?: boolean;
  did_you_mean?: string | null;
  account?: string | null;
  domain?: string | null;
  domain_age_days?: string | null;
  smtp_provider?: string | null;
  /** API often returns `"true"` / `"false"` strings; compare accordingly. */
  mx_found?: string | boolean | null;
  mx_record?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  gender?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  zipcode?: string | null;
  processed_at?: string | null;
}

/** POST /validatebatch response body. */
export interface ValidateBatchResponse {
  email_batch: EmailValidationResult[];
  errors: unknown[];
}

/** GET /getapiusage response (counts per status / sub_status over the date range). */
export interface ApiUsageResponse {
  total: number;
  status_valid: number;
  status_invalid: number;
  status_catch_all: number;
  status_do_not_mail: number;
  status_spamtrap: number;
  status_unknown: number;
  sub_status_toxic: number;
  sub_status_disposable: number;
  sub_status_role_based: number;
  sub_status_possible_trap: number;
  sub_status_global_suppression: number;
  sub_status_timeout_exceeded: number;
  sub_status_mail_server_temporary_error: number;
  sub_status_mail_server_did_not_respond: number;
  sub_status_greylisted: number;
  sub_status_antispam_system: number;
  sub_status_does_not_accept_mail: number;
  sub_status_exception_occurred: number;
  sub_status_failed_syntax_check: number;
  sub_status_mailbox_not_found: number;
  sub_status_unroutable_ip_address: number;
  sub_status_possible_typo: number;
  sub_status_no_dns_entries: number;
  sub_status_role_based_catch_all: number;
  sub_status_mailbox_quota_exceeded: number;
  sub_status_forcible_disconnect: number;
  sub_status_failed_smtp_connection: number;
  sub_status_accept_all: number;
  sub_status_mx_forward: number;
  sub_status_alternate: number;
  sub_status_allowed: number;
  sub_status_blocked: number;
  sub_status_gold: number;
  sub_status_role_based_accept_all: number;
  start_date: string;
  end_date: string;
}

/** GET /activity response. */
export interface EmailActivityResponse {
  found: boolean;
  active_in_days?: string;
}

/** Bulk sendfile success (validation or scoring). */
export interface BulkSendFileSuccessResponse {
  success: true;
  message: string;
  file_name: string;
  file_id: string;
}

/** Bulk sendfile failure (e.g. invalid api_key) — `success` is often the string `"False"`. */
export interface BulkSendFileErrorResponse {
  success: false | "False" | "false";
  message: string | string[];
}

export type SendFileResponse = BulkSendFileSuccessResponse | BulkSendFileErrorResponse;

export type SendScoringFileResponse = SendFileResponse;

/** GET /filestatus (validation bulk). */
export interface ValidationFileStatusResponse {
  success: boolean;
  file_id: string;
  file_name: string;
  upload_date: string;
  file_status: string;
  file_phase_2_status?: string;
  complete_percentage: string;
  error_reason: string | null;
  return_url: string | null;
}

/** GET /scoring/filestatus. */
export interface ScoringFileStatusResponse {
  success: boolean;
  file_id: string;
  file_name: string;
  upload_date: string;
  file_status: string;
  complete_percentage: string;
  return_url: string | null;
}

/**
 * When GET getfile returns JSON treated as an error body (HTTP 200 or parsed failure), or non-OK HTTP with JSON body.
 * See SDK `getFileJsonIndicatesFailure` (utils) for which JSON bodies are treated as errors vs CSV.
 */
export interface GetFileJsonErrorPayload {
  success?: boolean | string;
  message?: string | string[];
  error?: string;
  error_message?: string;
}

/** GET /deletefile or GET /scoring/deletefile success body. */
export interface BulkFileDeletedResponse {
  success: boolean;
  message: string;
  file_name: string;
  file_id: string;
}

/** Email Finder (guessformat with name + domain/company). */
export interface EmailFinderResponse {
  email: string;
  email_confidence: string;
  domain: string;
  company_name: string;
  did_you_mean: string;
  failure_reason: string;
}

/** Domain Search (guessformat with domain or company only). */
export interface DomainFormatResponse {
  domain: string;
  company_name: string;
  format: string;
  confidence: string;
  did_you_mean: string;
  failure_reason: string;
  other_domain_formats: unknown[];
}

/** GET /getcredits */
export interface GetCreditsResponse {
  Credits?: string;
}

/** Options for validateEmail (ip_address or timeout). */
export interface ValidateEmailOptions {
  /** IP address the email signed up from (optional). */
  ip_address?: string;
  /** Validation timeout in seconds, 3–60. If exceeded, API may return unknown/greylisted. */
  timeout?: number;
}

/** Single item for validateBatch (email_batch array). */
export interface ValidateBatchEmailItem {
  email_address: string;
}

/** Bulk `getfile` query values for `download_type` (validation and scoring). */
export type ZBDownloadTypeValues = Readonly<{
  PHASE_1: "phase_1";
  PHASE_2: "phase_2";
  COMBINED: "combined";
}>;

/** Optional query parameters for bulk `getfile`. */
export interface GetFileOptions {
  /** Maps to `download_type` (e.g. `ZeroBounceSDK.ZBDownloadType.COMBINED`). */
  downloadType?: string;
  /** Maps to `activity_data`; validation `getFile` only — omitted for `getScoringFile`. */
  activityData?: boolean;
}

/** Options for sendFile. */
export interface SendFileOptions {
  /** The CSV or TXT file to submit. */
  file: File;
  /** Column index of the email address (1-based). */
  email_address_column: number;
  /** Callback URL when validation is completed. */
  return_url?: string | false;
  /** Column index of the first name. */
  first_name_column?: number | false;
  /** Column index of the last name. */
  last_name_column?: number | false;
  /** Column index of the gender. */
  gender_column?: number | false;
  /** Column index of the IP address. */
  ip_address_column?: number | false;
  /** Whether the first row is a header row. */
  has_header_row?: boolean;
  /** Whether to remove duplicate emails. */
  remove_duplicate?: boolean;
  /**
   * When set, sends `allow_phase_2` (validation bulk only).
   * See [v2 send file](https://www.zerobounce.net/docs/email-validation-api-quickstart/v2-send-file).
   */
  allowPhase2?: boolean | null;
}

/** Options for sendFileStream. */
export interface SendFileStreamOptions {
  email_address_column: number;
  return_url?: string | false;
  first_name_column?: number | false;
  last_name_column?: number | false;
  gender_column?: number | false;
  ip_address_column?: number | false;
  has_header_row?: boolean;
  remove_duplicate?: boolean;
  allowPhase2?: boolean | null;
}

/** Options for sendScoringFile. */
export interface SendScoringFileOptions {
  file: File;
  email_address_column: number;
  return_url?: string | false;
  has_header_row?: boolean;
  remove_duplicate?: boolean;
}

/** Options for sendScoringFileStream. */
export interface SendScoringFileStreamOptions {
  email_address_column: number;
  return_url?: string | false;
  has_header_row?: boolean;
  remove_duplicate?: boolean;
}

/** Options for findEmailByDomain / Email Finder. */
export interface FindEmailByDomainOptions {
  domain: string;
  first_name: string;
  middle_name?: string | null;
  last_name?: string | null;
}

/** Options for findEmailByCompanyName / Email Finder. */
export interface FindEmailByCompanyNameOptions {
  company_name: string;
  first_name: string;
  middle_name?: string | null;
  last_name?: string | null;
}

/** API base URL string. */
export type ApiURL =
  | "https://api.zerobounce.net/v2"
  | "https://api-us.zerobounce.net/v2"
  | "https://api-eu.zerobounce.net/v2";

/**
 * ZeroBounce SDK for email validation, batch validation, and Email Finder APIs.
 */
export class ZeroBounceSDK {
  static ApiURL: Readonly<{
    DEFAULT_API_URL: "https://api.zerobounce.net/v2";
    USA_API_URL: "https://api-us.zerobounce.net/v2";
    EU_API_URL: "https://api-eu.zerobounce.net/v2";
  }>;

  /** Validation status values returned by the API (validate, validateBatch). */
  static ZBValidateStatus: ZBValidateStatusType;
  /** Validation sub-status values returned by the API (validate, validateBatch). */
  static ZBValidateSubStatus: ZBValidateSubStatusType;

  /** Bulk `getfile` `download_type` query values (`phase_1`, `phase_2`, `combined`). */
  static ZBDownloadType: ZBDownloadTypeValues;

  /**
   * Initialize the SDK with your API key and optional base URL.
   * @param apiKey - Your private API key
   * @param apiBaseURL - Preferred API base (e.g. ZeroBounceSDK.ApiURL.DEFAULT_API_URL)
   */
  init(apiKey: string, apiBaseURL?: ApiURL): void;

  /**
   * Get remaining credits for your account.
   */
  getCredits(): Promise<GetCreditsResponse | undefined>;

  /**
   * Validate a single email address.
   * @param email - Email to validate
   * @param options - Optional ip_address and/or timeout (3–60 seconds), or ip_address string for backwards compatibility
   */
  validateEmail(
    email: string,
    options?: ValidateEmailOptions | string | null
  ): Promise<EmailValidationResult | undefined>;

  /**
   * Get API usage for a date range.
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   */
  getApiUsage(
    startDate: string,
    endDate: string
  ): Promise<ApiUsageResponse | undefined>;

  /**
   * Validate a batch of emails.
   * @param emailBatch - Array of objects with email_address
   */
  validateBatch(
    emailBatch: ValidateBatchEmailItem[]
  ): Promise<ValidateBatchResponse | undefined>;

  /**
   * Get activity data for an email address.
   * @param email - Valid email address
   */
  getEmailActivity(email: string): Promise<EmailActivityResponse | undefined>;

  /**
   * Submit a file for bulk email validation.
   */
  sendFile(options: SendFileOptions): Promise<SendFileResponse | undefined>;

  /**
   * Submit file data (File, Blob, or stream) for bulk validation.
   * @param fileStreamOrBlob - File, Blob, or buffer
   * @param fileName - Name for the upload (e.g. "emails.csv")
   * @param options - Same options as sendFile (email_address_column, etc.); optional (defaults applied when omitted).
   */
  sendFileStream(
    fileStreamOrBlob: File | Blob,
    fileName: string,
    options?: SendFileStreamOptions
  ): Promise<SendFileResponse | undefined>;

  /**
   * Submit a file for bulk scoring.
   */
  sendScoringFile(
    options: SendScoringFileOptions
  ): Promise<SendScoringFileResponse | undefined>;

  /**
   * Submit file data for bulk scoring.
   * @param options - Optional; defaults applied when omitted.
   */
  sendScoringFileStream(
    fileStreamOrBlob: File | Blob,
    fileName: string,
    options?: SendScoringFileStreamOptions
  ): Promise<SendScoringFileResponse | undefined>;

  /**
   * Get status of a previously submitted validation file.
   * @param fileId - ID of the submitted file
   */
  getFileStatus(fileId: string): Promise<ValidationFileStatusResponse | undefined>;

  /**
   * Get status of a previously submitted scoring file.
   * @param fileId - ID of the submitted file
   */
  getScoringFileStatus(
    fileId: string
  ): Promise<ScoringFileStatusResponse | undefined>;

  /**
   * Download result file for a completed validation.
   * In the browser may trigger a download and return the filename; on API error (including JSON with HTTP 200) returns a parsed object.
   * @param fileId - ID of the submitted file
   * @param options - Optional `downloadType` and `activityData` (see v2 get file API).
   */
  getFile(
    fileId: string,
    options?: GetFileOptions | null
  ): Promise<string | Blob | GetFileJsonErrorPayload | undefined>;

  /**
   * Download result file for a completed scoring job.
   * `activityData` in options is not sent to the API.
   * @param fileId - ID of the submitted file
   * @param options - Optional `downloadType` only.
   */
  getScoringFile(
    fileId: string,
    options?: GetFileOptions | null
  ): Promise<string | Blob | GetFileJsonErrorPayload | undefined>;

  /**
   * Delete a submitted validation file.
   * @param fileId - ID of the submitted file
   */
  deleteFile(fileId: string): Promise<BulkFileDeletedResponse | undefined>;

  /**
   * Delete a submitted scoring file.
   * @param fileId - ID of the submitted file
   */
  deleteScoringFile(
    fileId: string
  ): Promise<BulkFileDeletedResponse | undefined>;

  /**
   * Email Finder: find email by domain and name.
   */
  findEmailByDomain(
    options: FindEmailByDomainOptions
  ): Promise<EmailFinderResponse | undefined>;

  /**
   * Email Finder: find email by company name and name.
   */
  findEmailByCompanyName(
    options: FindEmailByCompanyNameOptions
  ): Promise<EmailFinderResponse | undefined>;

  /**
   * Domain Search: get email format by domain.
   */
  findEmailFormatByDomain(options: { domain: string }): Promise<DomainFormatResponse | undefined>;

  /**
   * Domain Search: get email format by company name.
   */
  findEmailFormatByCompanyName(options: {
    company_name: string;
  }): Promise<DomainFormatResponse | undefined>;

  /**
   * @deprecated Use findEmailByDomain for Email Finder or findEmailFormatByDomain for Domain Search.
   */
  guessFormat(options: {
    domain: string;
    first_name?: string | null;
    middle_name?: string | null;
    last_name?: string | null;
  }): Promise<EmailFinderResponse | DomainFormatResponse | undefined>;
}

export default ZeroBounceSDK;
