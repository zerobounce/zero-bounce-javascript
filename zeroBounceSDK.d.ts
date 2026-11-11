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
  AI_AGENT_MAILBOX: "ai_agent_mailbox";
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
  /** Last activity bucket when activity_data was requested (e.g. 30, 365+). */
  active_in_days?: string | null;
  /** First date activity was detected for this email (YYYY-MM-DD). */
  active_first_seen?: string | null;
  smtp_provider?: string | null;
  /** [true/false or null] Is the domain a catch-all? */
  catchall_domain?: boolean | null;
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
  /** With domainInfo: whether the domain has a website ("True", "False" or "unchecked"). */
  domain_website_exists?: string | null;
  /** With domainInfo: WHOIS registrant company, "Registrant info not found" or "unchecked". */
  domain_registrant_company_name?: string | null;
  /**
   * The API's "Message" key, copied here by the SDK. Set while greylist
   * processing is still running, when it is the only field.
   */
  message?: string | null;
  /** The API's own spelling of {@link message}. */
  Message?: string;
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

/** Successful GET/POST /scoring response. */
export interface EmailScoringResult {
  email: string;
  score: number;
}

/** Unsuccessful /scoring response (invalid email, missing params, etc.). */
export interface EmailScoringError {
  error: string;
}

/** Options for scoreEmail. */
export interface ScoreEmailOptions {
  /** When `"POST"`, sends `api_key` and `email` as `application/x-www-form-urlencoded` (default GET). */
  method?: "GET" | "POST";
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
 * The JSON error body a getfile call resolved with in 3.1.0 and earlier.
 * @deprecated getfile and its variants now reject such a body with a
 * `ZBApiError` carrying the HTTP status; they no longer resolve with it.
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
  /** Maps to `activity_data` on GET /validate. */
  activityData?: boolean;
  /** Maps to `verify_plus` on GET /validate. */
  verifyPlus?: boolean;
  /** Maps to `domain_info`. Adds domain_website_exists and domain_registrant_company_name. */
  domainInfo?: boolean;
  /** Maps to `greylist_processing`. Reprocesses a greylisted address instead of returning unknown. */
  greylistProcessing?: boolean;
  /** Maps to `callback_url`. Only allowed with `greylistProcessing: true`. */
  callbackUrl?: string;
  /** Use form-encoded POST instead of GET (same parameters). */
  method?: "GET" | "POST";
}

/** Single item for validateBatch (email_batch array). */
export interface ValidateBatchEmailItem {
  email_address: string;
  ip_address?: string | null;
}

/** Options for validateBatch (timeout, activity_data, verify_plus). */
export interface ValidateBatchOptions {
  /** Validation timeout in seconds, 10–120 for the whole batch. */
  timeout?: number;
  /** Maps to `activity_data` on POST /validatebatch. */
  activityData?: boolean;
  /** Maps to `verify_plus` on POST /validatebatch. */
  verifyPlus?: boolean;
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

/**
 * Options for bulk email finder sendfile.
 *
 * Send `first_name_column` or `full_name_column`; `0` and `false` mean
 * "leave this column out" and so do not count as given.
 */
export interface SendEmailFinderFileOptions {
  file: File;
  domain_column: number;
  first_name_column?: number | false;
  last_name_column?: number | false;
  middle_name_column?: number | false;
  full_name_column?: number | false;
  has_header_row?: boolean;
}

/** As SendEmailFinderFileOptions, for a stream or Blob. */
export interface SendEmailFinderFileStreamOptions {
  domain_column: number;
  first_name_column?: number | false;
  last_name_column?: number | false;
  middle_name_column?: number | false;
  full_name_column?: number | false;
  has_header_row?: boolean;
}

/** Options for bulk domain search sendfile. */
export interface SendDomainSearchFileOptions {
  file: File;
  domain_column: number;
  has_header_row?: boolean;
}

export interface SendDomainSearchFileStreamOptions {
  domain_column: number;
  has_header_row?: boolean;
}

/** POST /v2/listevaluator/ success (201). */
export interface ListEvaluatorSubmitResponse {
  file_id?: string;
  message?: string;
  success?: boolean;
}

/** GET /v2/listevaluator/{file_id}/ while processing or complete. */
export interface ListEvaluatorResultResponse {
  file_status?: string;
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

export interface SendListEvaluatorFileOptions {
  file: File;
  email_address_column: number;
}

export interface SendListEvaluatorFileStreamOptions {
  email_address_column: number;
}

/**
 * Argument for sendEvaluatedFile: the list evaluator's `file_id`.
 * LIVE: the endpoint takes that id as a form field, not a file upload.
 */
export interface SendEvaluatedFileOptions {
  file_id: string;
}

export type FilterRule = "allow" | "block";
export type FilterTarget = "email" | "domain" | "mx" | "tld";

export interface FilterRuleParams {
  rule: FilterRule;
  target: FilterTarget;
  value: string;
}

export interface FilterListItem {
  rule: FilterRule;
  target: FilterTarget;
  value: string;
}

export interface FilterMessageResponse {
  Message?: string;
  Error?: string;
}

export interface ListFiltersOptions {
  /** When `"POST"`, uses form-encoded POST (supported from Sep 2026). */
  method?: "GET" | "POST";
}

/** Options for validateS3file: the shared S3 / SFTP job fields. */
export interface ValidateS3FileOptions extends BulkRootFileJobOptions {}

/** Options for scoreS3file: the shared S3 / SFTP job fields. */
export interface ScoreS3FileOptions extends BulkRootFileJobOptions {}

export interface ExportS3FileOptions {
  file_id: string;
  /** Defaults to the export bucket in your ZeroBounce settings. */
  export_bucket?: string;
}

/** Single entry from GET /listS3files. */
export interface S3ListFileEntry {
  name: string;
  size: number;
  last_modified: string;
}

export interface S3BulkJobResponse {
  success?: boolean;
  message?: string;
  file_id?: string;
  export_path?: string;
}

/** Per-provider seed cap for createInboxPlacementTest. */
export interface InboxPlacementProviderSelection {
  id: number;
  /** At least 1 when given. */
  maxSeeds?: number;
}

/** Options for createInboxPlacementTest (POST /api/ipt/test). */
export interface CreateInboxPlacementTestOptions {
  /** Unique test name, at most 64 characters. */
  name: string;
  /** 1 (Email, needs senderEmail), 2 (Unique ID) or 3 (Auto Alias). */
  testType?: 1 | 2 | 3;
  /** The From address to match. Required when testType is 1. */
  senderEmail?: string;
  providerIds?: number[];
  seedIds?: number[];
  providers?: InboxPlacementProviderSelection[];
  webhookUrl?: string;
}

/** Options for listInboxPlacementTests (GET /api/ipt/tests). */
export interface ListInboxPlacementTestsOptions {
  status?: "running" | "finished";
  /** ISO 8601 date or datetime. */
  createdAfter?: string;
  /** ISO 8601 date or datetime. */
  createdBefore?: string;
  /** From 1. */
  page?: number;
  /** 1 to 100. Sent as page_size. */
  pageSize?: number;
}

/** A seed provider from GET /api/ipt/providers. */
export interface InboxPlacementProvider {
  /** Use in createInboxPlacementTest's providerIds or providers. */
  id: number;
  name: string;
  location: string;
  seedCount: number;
  seedIds: number[];
  [key: string]: unknown;
}

/** GET /api/ipt/providers: mailbox providers and gateway (Mimecast, Proofpoint) providers. */
export interface InboxPlacementProvidersResponse {
  emailProviders: { items: InboxPlacementProvider[]; [key: string]: unknown };
  gatewayProviders: { items: InboxPlacementProvider[]; [key: string]: unknown };
  [key: string]: unknown;
}

/** POST /api/ipt/test success (201). */
export interface InboxPlacementTestCreated {
  /** Pass to getInboxPlacementTest and deleteInboxPlacementTest. */
  id: string;
  /** Put this in the campaign for a Unique ID test. */
  identifier: string;
  /** The test type by name, for example `"auto_alias"`. */
  testType: string;
  /** The seed addresses to send the campaign to. */
  emailAddressList: string[];
  [key: string]: unknown;
}

/** Placement counts of a test. */
export interface InboxPlacementCounts {
  inboxCount?: number;
  spamCount?: number;
  otherCount?: number;
  notDeliveredCount?: number;
  pendingCount?: number;
  percentages?: unknown;
  [key: string]: unknown;
}

/**
 * GET /api/ipt/test/{id}, and the body of the result webhook. The docs list
 * the counts both on the test and under `counts`, so both are optional here.
 */
export interface InboxPlacementTestResult extends InboxPlacementCounts {
  id: string;
  testName?: string;
  testType?: string;
  identifier?: string;
  status: "running" | "finished";
  counts?: InboxPlacementCounts;
  /** Aggregate placement results. */
  results?: unknown;
  /** Placement details for each seed mailbox. */
  seeds?: unknown[];
}

/** DELETE /api/ipt/test/{id} success. */
export interface InboxPlacementTestDeleted {
  id: string;
  /** `"deleted"`. */
  status: string;
  [key: string]: unknown;
}

/** GET /api/ipt/webhook: the URL saved on the API key, or `""`. */
export interface InboxPlacementWebhookResponse {
  webhookUrl: string;
  [key: string]: unknown;
}

/**
 * Shared options for the documented S3 and SFTP file jobs.
 *
 * The live API requires `file_name` and `return_url` on every one of them,
 * including validateSFTPfile, although the docs mark them optional.
 */
export interface BulkRootFileJobOptions {
  /** Full path as returned by listS3files. */
  file_name: string;
  has_header_row: boolean;
  remove_duplicates?: boolean;
  /** The API rejects a job without it. */
  return_url: string;
}

/** Options for exportSFTPfile. */
export interface ExportSFTPFileOptions {
  file_id: string;
  /** Defaults to the export path in your ZeroBounce settings. */
  export_path?: string;
}

/** Options for findEmailByDomain / Email Finder. */
export interface FindEmailByDomainOptions {
  domain: string;
  /** Optional: without it the API answers with the domain's format. */
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
}

/** Options for findEmailByCompanyName / Email Finder. */
export interface FindEmailByCompanyNameOptions {
  company_name: string;
  /** Optional: without it the API answers with the company's format. */
  first_name?: string | null;
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
   * The Warmup client, also exported as `ZeroBounceWarmup`. Reachable this way
   * from the browser `<script>` build, which has only the global ZeroBounceSDK.
   */
  static Warmup: typeof ZeroBounceWarmup;

  /**
   * Initialize the SDK with your API key and optional base URL.
   * @param apiKey - Your private API key
   * @param apiBaseURL - Preferred API base (e.g. ZeroBounceSDK.ApiURL.DEFAULT_API_URL)
   */
  init(
    apiKey: string,
    apiBaseURL?: ApiURL,
    options?: {
      /** Defaults to https://bulkapi.zerobounce.net/v2/listevaluator */
      listEvaluatorBaseURL?: string;
      /** Defaults to https://bulkapi.zerobounce.net/api/ipt */
      inboxPlacementBaseURL?: string;
      /** Defaults to https://bulkapi.zerobounce.net/email-finder */
      emailFinderBaseURL?: string;
      /** Defaults to https://bulkapi.zerobounce.net/domain-search */
      domainSearchBaseURL?: string;
    } | null
  ): void;

  /**
   * Get remaining credits for your account.
   */
  getCredits(): Promise<GetCreditsResponse>;

  /**
   * Validate a single email address.
   * @param email - Email to validate
   * @param options - Optional ip_address, timeout (3–60), activityData, verifyPlus, or ip_address string for backwards compatibility
   */
  validateEmail(
    email: string,
    options?: ValidateEmailOptions | string | null
  ): Promise<EmailValidationResult>;

  /**
   * Get API usage for a date range.
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   */
  getApiUsage(
    startDate: string,
    endDate: string
  ): Promise<ApiUsageResponse>;

  /**
   * Validate a batch of emails.
   * @param emailBatch - Array of objects with email_address (and optional ip_address)
   * @param options - Optional timeout (10–120), activityData, verifyPlus
   */
  validateBatch(
    emailBatch: ValidateBatchEmailItem[],
    options?: ValidateBatchOptions | null
  ): Promise<ValidateBatchResponse>;

  /**
   * Get activity data for an email address.
   * @param email - Valid email address
   */
  getEmailActivity(email: string): Promise<EmailActivityResponse>;

  /**
   * Real-time AI scoring for a single email (GET or POST /scoring).
   * @param email - Email to score
   * @param options - Optional `{ method: "POST" }` for form-encoded POST
   */
  scoreEmail(
    email: string,
    options?: ScoreEmailOptions | null
  ): Promise<EmailScoringResult | EmailScoringError>;

  /**
   * Submit a file for bulk email validation.
   */
  sendFile(options: SendFileOptions): Promise<SendFileResponse>;

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
  ): Promise<SendFileResponse>;

  /**
   * Submit a file for bulk scoring.
   */
  sendScoringFile(
    options: SendScoringFileOptions
  ): Promise<SendScoringFileResponse>;

  /**
   * Submit file data for bulk scoring.
   * @param options - Optional; defaults applied when omitted.
   */
  sendScoringFileStream(
    fileStreamOrBlob: File | Blob,
    fileName: string,
    options?: SendScoringFileStreamOptions
  ): Promise<SendScoringFileResponse>;

  /**
   * Get status of a previously submitted validation file.
   * @param fileId - ID of the submitted file
   */
  getFileStatus(fileId: string): Promise<ValidationFileStatusResponse>;

  /**
   * Get status of a previously submitted scoring file.
   * @param fileId - ID of the submitted file
   */
  getScoringFileStatus(
    fileId: string
  ): Promise<ScoringFileStatusResponse>;

  /**
   * Download result file for a completed validation.
   * In the browser, triggers a download and returns the filename.
   * In Node.js and other non-browser runtimes, returns the file body as a string.
   * Rejects with a `ZBApiError` carrying the HTTP status when the API answers
   * with JSON instead of a file (including an error body on HTTP 200).
   * @param fileId - ID of the submitted file
   * @param options - Optional `downloadType` and `activityData` (see v2 get file API).
   */
  getFile(
    fileId: string,
    options?: GetFileOptions | null
  ): Promise<string | Blob | undefined>;

  /**
   * Download result file for a completed scoring job.
   * In the browser, triggers a download and returns the filename.
   * In Node.js and other non-browser runtimes, returns the file body as a string.
   * `activityData` in options is not sent to the API.
   * @param fileId - ID of the submitted file
   * @param options - Optional `downloadType` only.
   */
  getScoringFile(
    fileId: string,
    options?: GetFileOptions | null
  ): Promise<string | Blob | undefined>;

  /**
   * Delete a submitted validation file.
   * @param fileId - ID of the submitted file
   */
  deleteFile(fileId: string): Promise<BulkFileDeletedResponse>;

  /**
   * Delete a submitted scoring file.
   * @param fileId - ID of the submitted file
   */
  deleteScoringFile(
    fileId: string
  ): Promise<BulkFileDeletedResponse>;

  sendEmailFinderFile(
    options: SendEmailFinderFileOptions
  ): Promise<SendFileResponse>;

  sendEmailFinderFileStream(
    fileStreamOrBlob: File | Blob,
    fileName: string,
    options?: SendEmailFinderFileStreamOptions
  ): Promise<SendFileResponse>;

  getEmailFinderFileStatus(
    fileId: string
  ): Promise<ValidationFileStatusResponse>;

  getEmailFinderFile(
    fileId: string
  ): Promise<string | Blob | undefined>;

  deleteEmailFinderFile(
    fileId: string
  ): Promise<BulkFileDeletedResponse>;

  sendDomainSearchFile(
    options: SendDomainSearchFileOptions
  ): Promise<SendFileResponse>;

  sendDomainSearchFileStream(
    fileStreamOrBlob: File | Blob,
    fileName: string,
    options?: SendDomainSearchFileStreamOptions
  ): Promise<SendFileResponse>;

  getDomainSearchFileStatus(
    fileId: string
  ): Promise<ValidationFileStatusResponse>;

  getDomainSearchFile(
    fileId: string
  ): Promise<string | Blob | undefined>;

  deleteDomainSearchFile(
    fileId: string
  ): Promise<BulkFileDeletedResponse>;

  sendListEvaluatorFile(
    options: SendListEvaluatorFileOptions
  ): Promise<ListEvaluatorSubmitResponse>;

  sendListEvaluatorFileStream(
    fileStreamOrBlob: File | Blob,
    fileName: string,
    options?: SendListEvaluatorFileStreamOptions
  ): Promise<ListEvaluatorSubmitResponse>;

  getListEvaluatorResult(
    fileId: string
  ): Promise<ListEvaluatorResultResponse>;

  /**
   * Submit a finished list evaluation for validation, by the `file_id` the list
   * evaluator returned (a string, or `{ file_id }`). POST /v2/send-evaluated-file/
   */
  sendEvaluatedFile(
    fileId: string | SendEvaluatedFileOptions
  ): Promise<ListEvaluatorSubmitResponse>;

  addFilter(
    options: FilterRuleParams
  ): Promise<FilterMessageResponse>;

  listFilters(
    options?: ListFiltersOptions | null
  ): Promise<FilterListItem[] | FilterMessageResponse>;

  deleteFilter(
    options: FilterRuleParams
  ): Promise<FilterMessageResponse>;

  listS3files(
    options?: { bucket?: string | null; search?: string | null } | null
  ): Promise<S3ListFileEntry[]>;

  validateS3file(
    options: ValidateS3FileOptions
  ): Promise<S3BulkJobResponse>;

  scoreS3file(
    options: ScoreS3FileOptions
  ): Promise<S3BulkJobResponse>;

  exportS3file(
    options: ExportS3FileOptions
  ): Promise<S3BulkJobResponse>;

  emailFinderS3file(
    options: BulkRootFileJobOptions
  ): Promise<S3BulkJobResponse>;

  domainSearchS3file(
    options: BulkRootFileJobOptions
  ): Promise<S3BulkJobResponse>;

  /** LIVE: file_name is required here too, although the docs mark it optional. */
  validateSFTPfile(
    options: BulkRootFileJobOptions
  ): Promise<S3BulkJobResponse>;

  scoreSFTPfile(
    options: BulkRootFileJobOptions
  ): Promise<S3BulkJobResponse>;

  emailFinderSFTPfile(
    options: BulkRootFileJobOptions
  ): Promise<S3BulkJobResponse>;

  domainSearchSFTPfile(
    options: BulkRootFileJobOptions
  ): Promise<S3BulkJobResponse>;

  exportSFTPfile(
    options: ExportSFTPFileOptions
  ): Promise<S3BulkJobResponse>;

  /** Inbox Placement Tester: seed providers. GET /api/ipt/providers */
  getInboxPlacementProviders(): Promise<InboxPlacementProvidersResponse>;

  /**
   * Inbox Placement Tester: supported test types and the default one.
   * GET /api/ipt/test-types. The docs give no body shape, so it is `unknown`.
   */
  getInboxPlacementTestTypes(): Promise<unknown>;

  /** Inbox Placement Tester: create a test. POST /api/ipt/test */
  createInboxPlacementTest(options: CreateInboxPlacementTestOptions): Promise<InboxPlacementTestCreated>;

  /** Inbox Placement Tester: a test and its results. GET /api/ipt/test/{id} */
  getInboxPlacementTest(testId: string | number): Promise<InboxPlacementTestResult>;

  /**
   * Inbox Placement Tester: list tests, newest first. GET /api/ipt/tests.
   * The docs give no body shape (it is paginated), so it is `unknown`.
   */
  listInboxPlacementTests(options?: ListInboxPlacementTestsOptions | null): Promise<unknown>;

  /** Inbox Placement Tester: delete a finished test. DELETE /api/ipt/test/{id} */
  deleteInboxPlacementTest(testId: string | number): Promise<InboxPlacementTestDeleted>;

  /** Inbox Placement Tester: the webhook saved on this API key. GET /api/ipt/webhook */
  getInboxPlacementWebhook(): Promise<InboxPlacementWebhookResponse>;

  /**
   * Inbox Placement Tester: save the result webhook. PUT /api/ipt/webhook.
   * The docs give no body shape, so it is `unknown`.
   */
  setInboxPlacementWebhook(webhookUrl: string): Promise<unknown>;

  /**
   * Email Finder: find email by domain and name.
   */
  findEmailByDomain(
    options: FindEmailByDomainOptions
  ): Promise<EmailFinderResponse>;

  /**
   * Email Finder: find email by company name and name.
   */
  findEmailByCompanyName(
    options: FindEmailByCompanyNameOptions
  ): Promise<EmailFinderResponse>;

  /**
   * Domain Search: get email format by domain.
   */
  findEmailFormatByDomain(options: { domain: string }): Promise<DomainFormatResponse>;

  /**
   * Domain Search: get email format by company name.
   */
  findEmailFormatByCompanyName(options: {
    company_name: string;
  }): Promise<DomainFormatResponse>;

  /**
   * @deprecated Use findEmailByDomain for Email Finder or findEmailFormatByDomain for Domain Search.
   */
  guessFormat(options: {
    domain: string;
    first_name?: string | null;
    middle_name?: string | null;
    last_name?: string | null;
  }): Promise<EmailFinderResponse | DomainFormatResponse>;
}

/** An error from the API, carrying the HTTP status of the failed response. */
export class ZBApiError extends Error {
  constructor(message: string, statusCode?: number);
  /** The HTTP status of the failed response; 0 when there was none. */
  statusCode: number;
}

/** `self_managed` runs your own mailbox; `zb_managed` has ZeroBounce provision one. */
export type WarmupOnboardingModel = "self_managed" | "zb_managed";

export type WarmupEmailType = "transactional" | "newsletter" | "marketing";

export interface WarmupEmailContent {
  company_name?: string;
  company_website?: string;
  company_description?: string;
  types_of_emails?: WarmupEmailType[];
  example_email?: string;
}

export interface WarmupManagedSending {
  weekdays_only?: boolean;
  timezone?: string;
  /** -11 to 14. */
  timezone_offset?: number;
  /** YYYY-MM-DD, or a Date. */
  warmup_start_date?: string | Date;
}

/**
 * The ZeroBounce Warmup API (https://www.zerobounce.net/docs/warmup-api).
 *
 * A separate product from email validation: its own team-scoped key, its own
 * host, and an `API-Key` header. One instance per Warmup key.
 */
export class ZeroBounceWarmup {
  static DEFAULT_BASE_URL: string;

  constructor(apiKey: string, baseURL?: string);

  listSendingAccounts(): Promise<unknown>;
  getSendingAccount(fromAddress: string): Promise<unknown>;
  addSendingAccount(options: {
    fromAddress: string;
    onboardingModel: WarmupOnboardingModel;
    /** 0 to 4. Required for self_managed, and rejected for zb_managed. */
    engagementRuleId?: number | null;
    ignoreConflict?: boolean | null;
    emailContent?: WarmupEmailContent | null;
    managedSending?: WarmupManagedSending | null;
  }): Promise<unknown>;
  updateSendingAccount(options: {
    fromAddress: string;
    /** 0 to 4. */
    engagementRuleId: number;
    /** 0 to 8 (4 Paused, 5 Disabled). */
    statusId: number;
    autoEnable: boolean;
  }): Promise<unknown>;
  deleteSendingAccount(fromAddress: string): Promise<null>;
  changeFromAddress(oldFromAddress: string, newFromAddress: string): Promise<unknown>;
  listFromAddresses(options?: {
    /** Letters, digits and `. - _ @ +` only. */
    searchFrom?: string | null;
    offset?: number | null;
    limit?: number | null;
  }): Promise<unknown>;

  getEngagementRules(): Promise<unknown>;
  setEngagementRule(cFrom: string, ruleId: number): Promise<unknown>;
  getCustomEngagement(cFrom: string): Promise<unknown>;
  createCustomEngagement(options: {
    cFrom: string;
    /** 5 to 45. */
    replyPct: number;
    /** 5 to 40. */
    importantPct: number;
    /** 0 to 70, and at most importantPct x 1.75. */
    clickPct: number;
  }): Promise<unknown>;
  updateCustomEngagement(options: {
    cFrom: string;
    replyPct: number;
    importantPct: number;
    clickPct: number;
  }): Promise<unknown>;
  deleteCustomEngagement(cFrom: string, engagementRuleId: number): Promise<unknown>;

  getSeeds(): Promise<unknown>;
  /** CSV text (columns `seed,provider`). */
  downloadSeeds(): Promise<string>;
  getSeedCount(): Promise<unknown>;
  getProgressToday(): Promise<unknown>;
  getSentToday(): Promise<unknown>;
  getEmailsPerDay(): Promise<unknown>;
  getStatistics(fromAddress: string): Promise<unknown>;
  getStatisticsPerDay(options: {
    fromAddress: string;
    startDate: string | Date;
    endDate: string | Date;
  }): Promise<unknown>;
  getStatisticsDetailed(cFrom: string): Promise<unknown>;
  /** CSV text. */
  downloadStatistics(cFrom: string): Promise<string>;
  getFromAddressStatistics(fromAddress: string): Promise<unknown>;
  /** Pass an email address: the live API rejects a bare domain. */
  checkDomainDmarc(fromAddress: string, dkimSelector?: string | null): Promise<unknown>;
  /** The live API answers a failed SMTP login with HTTP 500. */
  testSmtpConfiguration(options: {
    fromAddress: string;
    username: string;
    password: string;
    server: string;
    port: number;
  }): Promise<unknown>;
}

export default ZeroBounceSDK;
