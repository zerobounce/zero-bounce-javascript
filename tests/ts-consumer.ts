/**
 * TypeScript consumer test: exercises all public types and method signatures.
 * Run: npx tsc --noEmit -p tsconfig.test.json
 */

import ZeroBounceSDK, {
  type ValidateEmailOptions,
  type ValidateBatchEmailItem,
  type SendFileOptions,
  type SendFileStreamOptions,
  type SendScoringFileOptions,
  type SendScoringFileStreamOptions,
  type FindEmailByDomainOptions,
  type FindEmailByCompanyNameOptions,
  type ApiURL,
  type ZBValidateStatusType,
  type ZBValidateSubStatusType,
} from "@zerobounce/zero-bounce-sdk";

// --- Class and static members ---
const SDK = ZeroBounceSDK;
const urlDefault: ApiURL = ZeroBounceSDK.ApiURL.DEFAULT_API_URL;
const urlUSA: ApiURL = ZeroBounceSDK.ApiURL.USA_API_URL;
const urlEU: ApiURL = ZeroBounceSDK.ApiURL.EU_API_URL;

const statusValid: string = ZeroBounceSDK.ZBValidateStatus.VALID;
const statusInvalid: string = ZeroBounceSDK.ZBValidateStatus.INVALID;
const subStatus: string = ZeroBounceSDK.ZBValidateSubStatus.GREYLISTED;

// --- Typed options (compile-time only; no runtime API calls in this file) ---
const validateOpts: ValidateEmailOptions = {
  ip_address: "127.0.0.1",
  timeout: 10,
};

const batchItems: ValidateBatchEmailItem[] = [
  { email_address: "a@example.com" },
  { email_address: "b@example.com" },
];

const findByDomainOpts: FindEmailByDomainOptions = {
  domain: "example.com",
  first_name: "John",
  last_name: "Doe",
};

const findByCompanyOpts: FindEmailByCompanyNameOptions = {
  company_name: "Acme Inc",
  first_name: "Jane",
};

// --- Method signatures (types only; we don't call the API) ---
const zb: ZeroBounceSDK = new ZeroBounceSDK();

zb.init("fake-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);

// Return types are Promise<...>; we only check they're assignable
const creditsPromise: Promise<{ Credits?: string } | undefined> = zb.getCredits();
const validatePromise: Promise<Record<string, unknown> | undefined> =
  zb.validateEmail("test@example.com");
const validateWithOpts: Promise<Record<string, unknown> | undefined> =
  zb.validateEmail("test@example.com", validateOpts);
const validateLegacyIp: Promise<Record<string, unknown> | undefined> =
  zb.validateEmail("test@example.com", "127.0.0.1");

const usagePromise: Promise<Record<string, unknown> | undefined> =
  zb.getApiUsage("2024-01-01", "2024-12-31");

const batchPromise: Promise<Record<string, unknown> | undefined> =
  zb.validateBatch(batchItems);

const activityPromise: Promise<Record<string, unknown> | undefined> =
  zb.getEmailActivity("test@example.com");

const findDomainPromise: Promise<Record<string, unknown> | undefined> =
  zb.findEmailByDomain(findByDomainOpts);
const findCompanyPromise: Promise<Record<string, unknown> | undefined> =
  zb.findEmailByCompanyName(findByCompanyOpts);

const formatDomainPromise: Promise<Record<string, unknown> | undefined> =
  zb.findEmailFormatByDomain({ domain: "example.com" });
const formatCompanyPromise: Promise<Record<string, unknown> | undefined> =
  zb.findEmailFormatByCompanyName({ company_name: "Acme" });

const fileStatusPromise: Promise<Record<string, unknown> | undefined> =
  zb.getFileStatus("file-id");
const scoringFileStatusPromise: Promise<Record<string, unknown> | undefined> =
  zb.getScoringFileStatus("file-id");

const getFilePromise: Promise<string | Blob | Record<string, unknown> | undefined> =
  zb.getFile("file-id");
const getScoringFilePromise: Promise<
  string | Blob | Record<string, unknown> | undefined
> = zb.getScoringFile("file-id");

const deleteFilePromise: Promise<Record<string, unknown> | undefined> =
  zb.deleteFile("file-id");
const deleteScoringPromise: Promise<Record<string, unknown> | undefined> =
  zb.deleteScoringFile("file-id");

// Deprecated still callable
const guessPromise: Promise<Record<string, unknown> | undefined> =
  zb.guessFormat({ domain: "example.com", first_name: "John" });

// Type-only: optional SendFile* options (no File in test env)
const sendFileOpts: SendFileOptions = {
  file: new File([], "test.csv"),
  email_address_column: 1,
  return_url: "https://example.com/callback",
  has_header_row: true,
  remove_duplicate: false,
};

const sendFileStreamOpts: SendFileStreamOptions = {
  email_address_column: 1,
  has_header_row: true,
};

const sendScoringOpts: SendScoringFileOptions = {
  file: new File([], "scoring.csv"),
  email_address_column: 1,
};

const sendScoringStreamOpts: SendScoringFileStreamOptions = {
  email_address_column: 1,
};

// Optional third param: sendFileStream / sendScoringFileStream accept 2 args (options omitted)
const blob = new Blob(["email\nx@y.com"], { type: "text/csv" });
zb.sendFileStream(blob, "emails.csv");
zb.sendFileStream(blob, "emails.csv", sendFileStreamOpts);
zb.sendScoringFileStream(blob, "scoring.csv");
zb.sendScoringFileStream(blob, "scoring.csv", sendScoringStreamOpts);

// Ensure types are used (avoid unused variable warnings in strict mode)
function assertTypes(): void {
  void creditsPromise;
  void validatePromise;
  void validateWithOpts;
  void validateLegacyIp;
  void usagePromise;
  void batchPromise;
  void activityPromise;
  void findDomainPromise;
  void findCompanyPromise;
  void formatDomainPromise;
  void formatCompanyPromise;
  void fileStatusPromise;
  void scoringFileStatusPromise;
  void getFilePromise;
  void getScoringFilePromise;
  void deleteFilePromise;
  void deleteScoringPromise;
  void guessPromise;
  void sendFileOpts;
  void sendFileStreamOpts;
  void sendScoringOpts;
  void sendScoringStreamOpts;
  void blob;
  void SDK;
  void urlDefault;
  void urlUSA;
  void urlEU;
  void statusValid;
  void statusInvalid;
  void subStatus;
}

assertTypes();
