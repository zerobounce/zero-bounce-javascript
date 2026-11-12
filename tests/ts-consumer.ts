/**
 * TypeScript consumer test: exercises all public types and method signatures.
 * Run: npx tsc --noEmit -p tsconfig.test.json
 */

import ZeroBounceSDK, {
  ZeroBounceWarmup,
  ZBApiError,
  type InboxPlacementProvidersResponse,
  type InboxPlacementTestCreated,
  type InboxPlacementTestResult,
  type InboxPlacementTestDeleted,
  type InboxPlacementWebhookResponse,
  type ListEvaluatorSubmitResponse,
  type SendEvaluatedFileOptions,
  type ValidateEmailOptions,
  type ValidateBatchOptions,
  type ValidateBatchEmailItem,
  type SendFileOptions,
  type SendFileStreamOptions,
  type SendScoringFileOptions,
  type SendScoringFileStreamOptions,
  type FindEmailByDomainOptions,
  type FindEmailByCompanyNameOptions,
  type GetFileOptions,
  type ApiURL,
  type ZBValidateStatusType,
  type ZBValidateSubStatusType,
  type GetCreditsResponse,
  type EmailValidationResult,
  type ValidateBatchResponse,
  type ApiUsageResponse,
  type EmailActivityResponse,
  type EmailScoringResult,
  type EmailScoringError,
  type ScoreEmailOptions,
  type SendFileResponse,
  type ValidationFileStatusResponse,
  type ScoringFileStatusResponse,
  type GetFileJsonErrorPayload,
  type BulkFileDeletedResponse,
  type EmailFinderResponse,
  type DomainFormatResponse,
  type SendScoringFileResponse,
  type SendEmailFinderFileOptions,
  type SendEmailFinderFileStreamOptions,
  type BulkRootFileJobOptions,
  type ValidateS3FileOptions,
  type ScoreS3FileOptions,
  type ExportS3FileOptions,
  type S3BulkJobResponse,
} from "@zerobounce/zero-bounce-sdk";

// --- Class and static members ---
const SDK = ZeroBounceSDK;
const urlDefault: ApiURL = ZeroBounceSDK.ApiURL.DEFAULT_API_URL;
const urlUSA: ApiURL = ZeroBounceSDK.ApiURL.USA_API_URL;
const urlEU: ApiURL = ZeroBounceSDK.ApiURL.EU_API_URL;

const statusValid: string = ZeroBounceSDK.ZBValidateStatus.VALID;
const statusInvalid: string = ZeroBounceSDK.ZBValidateStatus.INVALID;
const subStatus: string = ZeroBounceSDK.ZBValidateSubStatus.GREYLISTED;
const downloadCombined: string = ZeroBounceSDK.ZBDownloadType.COMBINED;

// --- Typed options (compile-time only; no runtime API calls in this file) ---
const validateOpts: ValidateEmailOptions = {
  ip_address: "127.0.0.1",
  timeout: 10,
  activityData: true,
  verifyPlus: false,
  method: "POST",
};

const batchOpts: ValidateBatchOptions = {
  timeout: 30,
  activityData: true,
  verifyPlus: true,
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

// first_name is optional on both: /guessformat answers with the format.
const findByDomainNoName: FindEmailByDomainOptions = { domain: "example.com" };
const findByCompanyNoName: FindEmailByCompanyNameOptions = { company_name: "Acme Inc" };

// A bulk email finder file takes first_name_column or full_name_column.
const finderFileOpts: SendEmailFinderFileStreamOptions = {
  domain_column: 1,
  first_name_column: 2,
};
const finderFullNameOpts: SendEmailFinderFileStreamOptions = {
  domain_column: 1,
  full_name_column: 2,
};

// The S3 / SFTP jobs all take the same documented set of fields.
const s3JobOpts: BulkRootFileJobOptions = {
  file_name: "emails/list.csv",
  has_header_row: true,
  remove_duplicates: false,
  return_url: "https://example.com/done",
};
const validateS3Opts: ValidateS3FileOptions = s3JobOpts;
const scoreS3Opts: ScoreS3FileOptions = s3JobOpts;
const exportS3Opts: ExportS3FileOptions = { file_id: "job-1" };

// --- Method signatures (types only; we don't call the API) ---
const zb: ZeroBounceSDK = new ZeroBounceSDK();

zb.init("fake-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
// Every overridable base URL, including the finder and domain-search hosts.
zb.init("fake-key", ZeroBounceSDK.ApiURL.DEFAULT_API_URL, {
  listEvaluatorBaseURL: "https://bulkapi.zerobounce.net/v2/listevaluator",
  inboxPlacementBaseURL: "https://bulkapi.zerobounce.net/api/ipt",
  emailFinderBaseURL: "https://bulkapi.zerobounce.net/email-finder",
  domainSearchBaseURL: "https://bulkapi.zerobounce.net/domain-search",
});

// Return types are Promise<...>; we only check they're assignable
const creditsPromise: Promise<GetCreditsResponse | undefined> = zb.getCredits();
const validatePromise: Promise<EmailValidationResult | undefined> =
  zb.validateEmail("test@example.com");
const validateWithOpts: Promise<EmailValidationResult | undefined> =
  zb.validateEmail("test@example.com", validateOpts);
const validateLegacyIp: Promise<EmailValidationResult | undefined> =
  zb.validateEmail("test@example.com", "127.0.0.1");

const usagePromise: Promise<ApiUsageResponse | undefined> =
  zb.getApiUsage("2024-01-01", "2024-12-31");

const batchPromise: Promise<ValidateBatchResponse | undefined> =
  zb.validateBatch(batchItems, batchOpts);

const activityPromise: Promise<EmailActivityResponse | undefined> =
  zb.getEmailActivity("test@example.com");

const scoreOpts: ScoreEmailOptions = { method: "POST" };
const scorePromise: Promise<EmailScoringResult | EmailScoringError | undefined> =
  zb.scoreEmail("test@example.com");
const scorePostPromise: Promise<EmailScoringResult | EmailScoringError | undefined> =
  zb.scoreEmail("test@example.com", scoreOpts);

const findDomainPromise: Promise<EmailFinderResponse | undefined> =
  zb.findEmailByDomain(findByDomainOpts);
const findCompanyPromise: Promise<EmailFinderResponse | undefined> =
  zb.findEmailByCompanyName(findByCompanyOpts);

const formatDomainPromise: Promise<DomainFormatResponse | undefined> =
  zb.findEmailFormatByDomain({ domain: "example.com" });
const formatCompanyPromise: Promise<DomainFormatResponse | undefined> =
  zb.findEmailFormatByCompanyName({ company_name: "Acme" });

const fileStatusPromise: Promise<ValidationFileStatusResponse | undefined> =
  zb.getFileStatus("file-id");
const scoringFileStatusPromise: Promise<ScoringFileStatusResponse | undefined> =
  zb.getScoringFileStatus("file-id");

const getFilePromise: Promise<string | Blob | GetFileJsonErrorPayload | undefined> =
  zb.getFile("file-id");
const getFileOpts: GetFileOptions = {
  downloadType: ZeroBounceSDK.ZBDownloadType.COMBINED,
  activityData: true,
};
const getFileWithOptsPromise: Promise<string | Blob | GetFileJsonErrorPayload | undefined> =
  zb.getFile("file-id", getFileOpts);
const getScoringFilePromise: Promise<
  string | Blob | GetFileJsonErrorPayload | undefined
> = zb.getScoringFile("file-id");
const getScoringWithOptsPromise: Promise<string | Blob | GetFileJsonErrorPayload | undefined> =
  zb.getScoringFile("file-id", { downloadType: ZeroBounceSDK.ZBDownloadType.PHASE_2 });

const deleteFilePromise: Promise<BulkFileDeletedResponse | undefined> =
  zb.deleteFile("file-id");
const deleteScoringPromise: Promise<BulkFileDeletedResponse | undefined> =
  zb.deleteScoringFile("file-id");

// Deprecated still callable
const guessPromise: Promise<EmailFinderResponse | DomainFormatResponse | undefined> =
  zb.guessFormat({ domain: "example.com", first_name: "John" });

// Type-only: optional SendFile* options (no File in test env)
const sendFileOpts: SendFileOptions = {
  file: new File([], "test.csv"),
  email_address_column: 1,
  return_url: "https://example.com/callback",
  has_header_row: true,
  remove_duplicate: false,
  allowPhase2: true,
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

const blob = new Blob(["email\nx@y.com"], { type: "text/csv" });

const sendFilePromise: Promise<SendFileResponse | undefined> = zb.sendFile(sendFileOpts);
const sendFileStreamPromise: Promise<SendFileResponse | undefined> = zb.sendFileStream(
  blob,
  "emails.csv",
  sendFileStreamOpts
);
const sendScoringFilePromise: Promise<SendScoringFileResponse | undefined> =
  zb.sendScoringFile(sendScoringOpts);
const sendScoringFileStreamPromise: Promise<SendScoringFileResponse | undefined> =
  zb.sendScoringFileStream(blob, "scoring.csv", sendScoringStreamOpts);

/** Compile-time check: bulk sendfile success vs error discriminant. */
function assertSendFileDiscriminant(r: SendFileResponse): void {
  if (r.success === true) {
    const _id: string = r.file_id;
    const _name: string = r.file_name;
    void _id;
    void _name;
  } else {
    const _msg: string | string[] = r.message;
    void _msg;
  }
}

assertSendFileDiscriminant({
  success: true,
  message: "File Accepted",
  file_name: "a.csv",
  file_id: "id",
});
assertSendFileDiscriminant({ success: "False", message: ["api_key is invalid"] });

// Optional third param: sendFileStream / sendScoringFileStream accept 2 args (options omitted)
zb.sendFileStream(blob, "emails.csv");
zb.sendFileStream(blob, "emails.csv", sendFileStreamOpts);
zb.sendScoringFileStream(blob, "scoring.csv");
zb.sendScoringFileStream(blob, "scoring.csv", sendScoringStreamOpts);

const finderFileSendOpts: SendEmailFinderFileOptions = {
  file: blob as unknown as File,
  domain_column: 1,
  full_name_column: 2,
};
zb.sendEmailFinderFile(finderFileSendOpts);
zb.sendEmailFinderFileStream(blob, "finder.csv", finderFileOpts);

const validateS3Promise: Promise<S3BulkJobResponse | undefined> =
  zb.validateS3file(validateS3Opts);
const scoreS3Promise: Promise<S3BulkJobResponse | undefined> = zb.scoreS3file(scoreS3Opts);
const exportS3Promise: Promise<S3BulkJobResponse | undefined> = zb.exportS3file(exportS3Opts);
const validateSFTPPromise: Promise<S3BulkJobResponse | undefined> =
  zb.validateSFTPfile(s3JobOpts);
zb.findEmailByDomain(findByDomainNoName);
zb.findEmailByCompanyName(findByCompanyNoName);

// Since 3.0.0 a method rejects instead of resolving undefined, so results are
// usable without a guard (the getfile family alone may resolve undefined, from
// the legacy msSaveOrOpenBlob download path).
async function resultsNeedNoUndefinedGuard(): Promise<void> {
  const credits: GetCreditsResponse = await zb.getCredits();
  const validated: EmailValidationResult = await zb.validateEmail("a@example.com");
  const message: string | null | undefined = validated.message;
  const finder: EmailFinderResponse = await zb.findEmailByDomain(findByDomainOpts);
  const s3: S3BulkJobResponse = await zb.validateS3file(validateS3Opts);
  void credits;
  void message;
  void finder;
  void s3;
}

// Inbox Placement Tester results are typed where the docs give a body.
async function inboxPlacement(): Promise<void> {
  const providers: InboxPlacementProvidersResponse = await zb.getInboxPlacementProviders();
  const providerId: number = providers.emailProviders.items[0].id;
  const created: InboxPlacementTestCreated = await zb.createInboxPlacementTest({
    name: "October campaign",
    providerIds: [providerId],
  });
  const seeds: string[] = created.emailAddressList;
  const result: InboxPlacementTestResult = await zb.getInboxPlacementTest(created.id);
  const status: "running" | "finished" = result.status;
  // 4.0.1 declared Promise<InboxPlacementTestDeleted>; a patch release must keep
  // this compiling under strictNullChecks (no `| null`).
  const deleted: InboxPlacementTestDeleted = await zb.deleteInboxPlacementTest(created.id);
  const deletedStatus: string = deleted.status;
  void deletedStatus;
  const webhook: InboxPlacementWebhookResponse = await zb.getInboxPlacementWebhook();
  const webhookUrl: string = webhook.webhookUrl;
  void seeds;
  void status;
  void deleted;
  void webhookUrl;
}

// sendEvaluatedFile takes the list evaluator's file_id, not a File.
const evaluatedById: Promise<ListEvaluatorSubmitResponse> = zb.sendEvaluatedFile("eval-file-1");
const evaluatedOpts: SendEvaluatedFileOptions = { file_id: "eval-file-1" };
const evaluatedByObject: Promise<ListEvaluatorSubmitResponse> = zb.sendEvaluatedFile(evaluatedOpts);

// Named runtime exports: the Warmup client and the API error class.
const warmup = new ZeroBounceWarmup("fake-warmup-key");
const sameWarmup: typeof ZeroBounceWarmup = ZeroBounceSDK.Warmup;
const warmupAccounts: Promise<unknown> = warmup.listSendingAccounts();
function statusOf(error: unknown): number | null {
  return error instanceof ZBApiError ? error.statusCode : null;
}

// Ensure types are used (avoid unused variable warnings in strict mode)
function assertTypes(): void {
  void creditsPromise;
  void validatePromise;
  void validateWithOpts;
  void validateLegacyIp;
  void usagePromise;
  void batchPromise;
  void activityPromise;
  void scorePromise;
  void scorePostPromise;
  void findDomainPromise;
  void findCompanyPromise;
  void formatDomainPromise;
  void formatCompanyPromise;
  void fileStatusPromise;
  void scoringFileStatusPromise;
  void getFilePromise;
  void getFileWithOptsPromise;
  void getScoringFilePromise;
  void getScoringWithOptsPromise;
  void downloadCombined;
  void getFileOpts;
  void deleteFilePromise;
  void deleteScoringPromise;
  void guessPromise;
  void sendFileOpts;
  void sendFileStreamOpts;
  void sendScoringOpts;
  void sendScoringStreamOpts;
  void sendFilePromise;
  void sendFileStreamPromise;
  void sendScoringFilePromise;
  void sendScoringFileStreamPromise;
  void blob;
  void SDK;
  void urlDefault;
  void urlUSA;
  void urlEU;
  void statusValid;
  void statusInvalid;
  void subStatus;
  void finderFullNameOpts;
  void finderFileSendOpts;
  void validateS3Promise;
  void scoreS3Promise;
  void exportS3Promise;
  void validateSFTPPromise;
  void resultsNeedNoUndefinedGuard;
  void inboxPlacement;
  void evaluatedById;
  void evaluatedByObject;
  void sameWarmup;
  void warmupAccounts;
  void statusOf;
}

assertTypes();
