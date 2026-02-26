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

  /**
   * Initialize the SDK with your API key and optional base URL.
   * @param apiKey - Your private API key
   * @param apiBaseURL - Preferred API base (e.g. ZeroBounceSDK.ApiURL.DEFAULT_API_URL)
   */
  init(apiKey: string, apiBaseURL?: ApiURL): void;

  /**
   * Get remaining credits for your account.
   */
  getCredits(): Promise<{ Credits?: string } | undefined>;

  /**
   * Validate a single email address.
   * @param email - Email to validate
   * @param options - Optional ip_address and/or timeout (3–60 seconds), or ip_address string for backwards compatibility
   */
  validateEmail(
    email: string,
    options?: ValidateEmailOptions | string | null
  ): Promise<Record<string, unknown> | undefined>;

  /**
   * Get API usage for a date range.
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   */
  getApiUsage(
    startDate: string,
    endDate: string
  ): Promise<Record<string, unknown> | undefined>;

  /**
   * Validate a batch of emails.
   * @param emailBatch - Array of objects with email_address
   */
  validateBatch(
    emailBatch: ValidateBatchEmailItem[]
  ): Promise<Record<string, unknown> | undefined>;

  /**
   * Get activity data for an email address.
   * @param email - Valid email address
   */
  getEmailActivity(email: string): Promise<Record<string, unknown> | undefined>;

  /**
   * Submit a file for bulk email validation.
   */
  sendFile(options: SendFileOptions): Promise<Record<string, unknown> | undefined>;

  /**
   * Submit file data (File, Blob, or stream) for bulk validation.
   * @param fileStreamOrBlob - File, Blob, or buffer
   * @param fileName - Name for the upload (e.g. "emails.csv")
   * @param options - Same options as sendFile (email_address_column, etc.)
   */
  sendFileStream(
    fileStreamOrBlob: File | Blob,
    fileName: string,
    options: SendFileStreamOptions
  ): Promise<Record<string, unknown> | undefined>;

  /**
   * Submit a file for bulk scoring.
   */
  sendScoringFile(
    options: SendScoringFileOptions
  ): Promise<Record<string, unknown> | undefined>;

  /**
   * Submit file data for bulk scoring.
   */
  sendScoringFileStream(
    fileStreamOrBlob: File | Blob,
    fileName: string,
    options: SendScoringFileStreamOptions
  ): Promise<Record<string, unknown> | undefined>;

  /**
   * Get status of a previously submitted validation file.
   * @param fileId - ID of the submitted file
   */
  getFileStatus(fileId: string): Promise<Record<string, unknown> | undefined>;

  /**
   * Get status of a previously submitted scoring file.
   * @param fileId - ID of the submitted file
   */
  getScoringFileStatus(
    fileId: string
  ): Promise<Record<string, unknown> | undefined>;

  /**
   * Download result file for a completed validation.
   * @param fileId - ID of the submitted file
   */
  getFile(fileId: string): Promise<Blob | Record<string, unknown> | undefined>;

  /**
   * Download result file for a completed scoring job.
   * @param fileId - ID of the submitted file
   */
  getScoringFile(
    fileId: string
  ): Promise<Blob | Record<string, unknown> | undefined>;

  /**
   * Delete a submitted validation file.
   * @param fileId - ID of the submitted file
   */
  deleteFile(fileId: string): Promise<Record<string, unknown> | undefined>;

  /**
   * Delete a submitted scoring file.
   * @param fileId - ID of the submitted file
   */
  deleteScoringFile(
    fileId: string
  ): Promise<Record<string, unknown> | undefined>;

  /**
   * Email Finder: find email by domain and name.
   */
  findEmailByDomain(
    options: FindEmailByDomainOptions
  ): Promise<Record<string, unknown> | undefined>;

  /**
   * Email Finder: find email by company name and name.
   */
  findEmailByCompanyName(
    options: FindEmailByCompanyNameOptions
  ): Promise<Record<string, unknown> | undefined>;

  /**
   * Domain Search: get email format by domain.
   */
  findEmailFormatByDomain(options: { domain: string }): Promise<Record<string, unknown> | undefined>;

  /**
   * Domain Search: get email format by company name.
   */
  findEmailFormatByCompanyName(options: {
    company_name: string;
  }): Promise<Record<string, unknown> | undefined>;

  /**
   * @deprecated Use findEmailByDomain for Email Finder or findEmailFormatByDomain for Domain Search.
   */
  guessFormat(options: {
    domain: string;
    first_name?: string | null;
    middle_name?: string | null;
    last_name?: string | null;
  }): Promise<Record<string, unknown> | undefined>;
}

export default ZeroBounceSDK;
