
WE DO NOT RECOMMEND USING THIS SDK ON A FRONT-END ENVIRONMENT AS THE API KEY WILL BE VISIBLE

#### INSTALLATION

```bash
npm install @zerobounce/zero-bounce-sdk
```

#### USAGE

Add the script

```HTML
<!-- dist/zeroBounceSDK.js from the npm package; it defines the global ZeroBounceSDK -->
<script src="node_modules/@zerobounce/zero-bounce-sdk/dist/zeroBounceSDK.js"></script>
```

```HTML
<script>
const zeroBounce = new ZeroBounceSDK();
</script>
```

OR

Add npm module

```javascript
const { ZeroBounceSDK } = require('@zerobounce/zero-bounce-sdk');
// or, as an ES module: import ZeroBounceSDK from '@zerobounce/zero-bounce-sdk';

const zeroBounce = new ZeroBounceSDK();
```

Initialize the sdk with your api key and your preferred api:

```javascript
zeroBounce.init("<YOUR_API_KEY>", ZeroBounceSDK.ApiURL.DEFAULT_API_URL);
```

NOTE: all the methods are asynchronous they have to be used with async / await or .then.catch

#### Examples

Then you can use any of the SDK methods, for example:

- ####### Check how many credits you have left on your account

```javascript
try {
  const response = await zeroBounce.getCredits();
} catch (error) {
  console.error(error);
}
```

- ####### Validate an email address

```javascript
const email = "<EMAIL_ADDRESS>"; // The email address you want to validate

// Using options object (recommended)
try {
  const response = await zeroBounce.validateEmail(email, {
    ip_address: "127.0.0.1", // The IP Address the email signed up from (Optional)
    timeout: 10, // Validation timeout in seconds, 3-60 (Optional)
  });
} catch (error) {
  console.error(error);
}

// Legacy syntax (still supported for backwards compatibility)
// const response = await zeroBounce.validateEmail(email, "127.0.0.1");
```

- ##### Validate with domain info and greylist processing

```javascript
// domainInfo adds domain_website_exists and domain_registrant_company_name.
// greylistProcessing re-runs a greylisted address instead of returning unknown.
// callbackUrl is only allowed together with greylistProcessing: true.
try {
  const response = await zeroBounce.validateEmail("<EMAIL_ADDRESS>", {
    domainInfo: true,
    greylistProcessing: true,
    callbackUrl: "https://example.com/zerobounce-callback",
  });
  // While the greylist retry is still running the API returns a message
  // instead of a result; call validateEmail again in about 30 minutes.
  console.log(response.message, response.domain_website_exists);
} catch (error) {
  console.error(error);
}
```

- ##### S3 and SFTP/FTP bulk jobs

```javascript
// All eight jobs take the same four fields and nothing else: file_name,
// has_header_row, remove_duplicates and return_url. The live API requires
// file_name and return_url on every one of them, including validateSFTPfile,
// although the docs mark them optional.

// Amazon S3: https://www.zerobounce.net/docs/api-integrations/amazon-s3-bulk-api
await zeroBounce.validateS3file({
  file_name: "lists/leads.csv",
  has_header_row: true,
  return_url: "https://example.com/zerobounce-done",
});
await zeroBounce.scoreS3file({
  file_name: "lists/leads.csv",
  has_header_row: true,
  return_url: "https://example.com/zerobounce-done",
});
await zeroBounce.emailFinderS3file({
  file_name: "lists/leads.csv",
  has_header_row: true,
  return_url: "https://example.com/zerobounce-done",
});
await zeroBounce.domainSearchS3file({
  file_name: "lists/leads.csv",
  has_header_row: true,
  remove_duplicates: true,
  return_url: "https://example.com/zerobounce-done",
});

// Without export_bucket the output bucket from your settings is used.
await zeroBounce.exportS3file({ file_id: "<FILE_ID>" });

// SFTP/FTP: https://www.zerobounce.net/docs/api-integrations/sftp_bulk_api
// The server, path and protocol come from your ZeroBounce settings.
const sftpJob = {
  file_name: "my_file.txt",
  has_header_row: true,
  return_url: "https://example.com/zerobounce-done",
};
await zeroBounce.validateSFTPfile(sftpJob);
await zeroBounce.scoreSFTPfile(sftpJob);
await zeroBounce.emailFinderSFTPfile(sftpJob);
await zeroBounce.domainSearchSFTPfile(sftpJob);

// Without export_path the path from your settings is used.
await zeroBounce.exportSFTPfile({ file_id: "<FILE_ID>", export_path: "/exports" });
```

- ##### Bulk email finder

```javascript
// domain_column is required, and so is a name to work from: send either
// first_name_column or full_name_column. As with every optional column, 0 and
// false mean "leave this column out", so neither counts as a name column.
await zeroBounce.sendEmailFinderFile({
  file: file, // a File, as for sendFile
  domain_column: 1,
  first_name_column: 2,
  has_header_row: true,
});
```

- ##### Inbox Placement Tester

```javascript
// Lives on https://bulkapi.zerobounce.net/api/ipt and spends inbox test credits.
try {
  const providers = await zeroBounce.getInboxPlacementProviders();
  const testTypes = await zeroBounce.getInboxPlacementTestTypes();

  // testType 1 (Email) needs senderEmail; 2 is Unique ID and 3 is Auto Alias.
  const created = await zeroBounce.createInboxPlacementTest({
    name: "October campaign",            // required, at most 64 characters
    testType: 1,
    senderEmail: "news@example.com",
    providers: [{ id: 1, maxSeeds: 5 }], // optional per-provider seed cap
    webhookUrl: "https://example.com/ipt-webhook",
  });

  // Send your campaign to created.emailAddressList, then read the results.
  const result = await zeroBounce.getInboxPlacementTest(created.id);

  const tests = await zeroBounce.listInboxPlacementTests({
    status: "finished",
    page: 1,
    pageSize: 25,
  });

  await zeroBounce.setInboxPlacementWebhook("https://example.com/ipt-webhook");
  const webhook = await zeroBounce.getInboxPlacementWebhook();
  await zeroBounce.deleteInboxPlacementTest(created.id);
} catch (error) {
  console.error(error);
}
```

- ##### Point an API at a different base URL

```javascript
// The list evaluator, the Inbox Placement Tester, the bulk email finder and
// bulk domain search each have their own base URL, separate from the main and
// bulk hosts. Every one of them must be https://. If the key or any URL is
// rejected, init throws and leaves the client exactly as it was.
zeroBounce.init("<YOUR_API_KEY>", ZeroBounceSDK.ApiURL.DEFAULT_API_URL, {
  listEvaluatorBaseURL: "https://bulkapi.zerobounce.net/v2/listevaluator",
  inboxPlacementBaseURL: "https://bulkapi.zerobounce.net/api/ipt",
  emailFinderBaseURL: "https://bulkapi.zerobounce.net/email-finder",
  domainSearchBaseURL: "https://bulkapi.zerobounce.net/domain-search",
});
```

- ####### Warmup API

```javascript
// The Warmup API (https://www.zerobounce.net/docs/warmup-api) is a separate
// product: it takes its own team-scoped Warmup API key, sent in an API-Key
// header, and lives on https://warmup-api.zerobounce.net. Use one
// ZeroBounceWarmup per Warmup key. It is a named export:
//   import { ZeroBounceWarmup } from '@zerobounce/zero-bounce-sdk';
//   const { ZeroBounceWarmup } = require('@zerobounce/zero-bounce-sdk');
// and, from the <script> build, ZeroBounceSDK.Warmup.
const warmup = new ZeroBounceWarmup("<YOUR_WARMUP_API_KEY>");

try {
  const accounts = await warmup.listSendingAccounts();

  // self_managed: your own mailbox, with an engagement rule from 0 to 4.
  await warmup.addSendingAccount({
    fromAddress: "sender@example.com",
    onboardingModel: "self_managed",
    engagementRuleId: 0,
  });

  // zb_managed: ZeroBounce provisions the mailbox. It takes emailContent and
  // managedSending, and rejects engagementRuleId.
  await warmup.addSendingAccount({
    fromAddress: "news@example.com",
    onboardingModel: "zb_managed",
    emailContent: { company_name: "Example Inc", types_of_emails: ["newsletter"] },
    managedSending: { timezone_offset: 2, warmup_start_date: "2026-12-01" },
  });

  const perDay = await warmup.getStatisticsPerDay({
    fromAddress: "sender@example.com",
    startDate: "2026-11-01",
    endDate: "2026-11-10",
  });
  const seedsCsv = await warmup.downloadSeeds(); // CSV text: seed,provider
} catch (error) {
  // A missing or invalid argument rejects before any request is sent. An API
  // failure rejects with a ZBApiError, whose statusCode is the HTTP status
  // (429 when rate limited).
  console.error(error);
}
```

The client also has `getSendingAccount`, `updateSendingAccount`, `deleteSendingAccount`, `changeFromAddress`, `listFromAddresses`, `getEngagementRules`, `setEngagementRule`, `getCustomEngagement`, `createCustomEngagement`, `updateCustomEngagement`, `deleteCustomEngagement`, `getSeeds`, `getSeedCount`, `getProgressToday`, `getSentToday`, `getEmailsPerDay`, `getStatistics`, `getStatisticsDetailed`, `downloadStatistics`, `getFromAddressStatistics`, `checkDomainDmarc` and `testSmtpConfiguration`. Their options are typed in `zeroBounceSDK.d.ts`.

- ####### Get api usage from a start date to an end date

```javascript
const startDate = "2018-01-01"; // The start date of when you want to view API usage
const endDate = "2023-12-12"; // The end date of when you want to view API usage

try {
  const response = await zeroBounce.getApiUsage(startDate, endDate);
} catch (error) {
  console.error(error);
}
```

- ####### Validate a list of emails

```javascript
const emailBatch = [
  { email_address: "<EMAIL_ADDRESS>" },
  { email_address: "<EMAIL_ADDRESS>" },
]; // an array containing a list of email objects {email_address: "example@example.com"}

try {
  const response = await zeroBounce.validateBatch(emailBatch);
} catch (error) {
  console.error(error);
}
```

- ####### Get data about an email activity

```javascript
const email = "<EMAIL_ADDRESS>"; // The email address you want to get the activity for

try {
  const response = await zeroBounce.getEmailActivity(email);
} catch (error) {
  console.error(error);
}
```

- ####### Send a csv file containing email addresses to be validated

```javascript
// Parameters
// ----------
// file: File
//     The csv or txt file to be submitted.
// email_address_column: number
//     The column index of the email address in the file. Index starts from 1.
// return_url: str or null (Optional)
//     The URL will be used to call back when the validation is completed.
// first_name_column: number or null (Optional)
//     The column index of the first name column.
// last_name_column: number or null (Optional)
//     The column index of the last name column.
// gender_column: number or null (Optional)
//     The column index of the gender column.
// ip_address_column: number or null (Optional)
//     The IP Address the email signed up from.
// has_header_row: Boolean (Optional)
//     If the first row from the submitted file is a header row.
// remove_duplicate: Boolean (Optional)
//     If you want the system to remove duplicate emails.
// allowPhase2: Boolean (Optional)
//     When set, sends allow_phase_2 (validation bulk only). See v2 send file API.
// `file` is a File, for example from an <input type="file"> in a browser.
// From a Blob or in-memory CSV, use sendFileStream(blob, "emails.csv", options).
const payload = {
  file: file,
  email_address_column: 1, // column indexes start from 1
  return_url: "https://example.com/zerobounce-done", // (Optional)
  first_name_column: 2, // (Optional)
  last_name_column: 3, // (Optional)
  gender_column: 4, // (Optional)
  ip_address_column: 5, // (Optional)
  has_header_row: true, // (Optional) true or false
  remove_duplicate: true, // (Optional) true or false
  allowPhase2: true, // (Optional)
};

try {
  const response = await zeroBounce.sendFile(payload);
} catch (error) {
  console.error(error);
}
```

Bulk validation uses `https://bulkapi.zerobounce.net/v2`. See [v2 send file](https://www.zerobounce.net/docs/email-validation-api-quickstart/v2-send-file), [v2 file status](https://www.zerobounce.net/docs/email-validation-api-quickstart/v2-file-status), and [v2 get file](https://www.zerobounce.net/docs/email-validation-api-quickstart/v2-get-file).

**Bulk API v2:** `ZeroBounceSDK.ZBDownloadType` provides `PHASE_1`, `PHASE_2`, and `COMBINED` for `getFile` / `getScoringFile`. File status responses may include `file_phase_2_status`. For `getFile`, pass an optional second argument `{ downloadType, activityData }` (validation only for `activityData`; `getScoringFile` does not send `activity_data`). If the API answers with JSON instead of a file (an error body, even on HTTP 200, or any `application/json` response), `getFile`, `getScoringFile`, `getEmailFinderFile` and `getDomainSearchFile` reject with a `ZBApiError` whose `statusCode` is the HTTP status; they do not resolve with the parsed object.

- ####### Send a csv file containing email addresses to get the scoring of the emails

```javascript
// Parameters
// ----------
// file: File
//     The csv or txt file to be submitted.
// email_address_column: number
//     The column index of the email address in the file. Index starts from 1.
// return_url: str or null (Optional)
//     The URL will be used to call back when the validation is completed.
// has_header_row: Boolean (Optional)
//     If the first row from the submitted file is a header row.
// remove_duplicate: Boolean (Optional)
//     If you want the system to remove duplicate emails.
// `file` is a File, for example from an <input type="file"> in a browser.
// From a Blob, use sendScoringFileStream(blob, "emails.csv", options).
const payload = {
  file: file,
  email_address_column: 1, // column indexes start from 1
  return_url: "https://example.com/zerobounce-done", // (Optional)
  has_header_row: true, // (Optional) true or false
  remove_duplicate: true, // (Optional) true or false
};

try {
  const response = await zeroBounce.sendScoringFile(payload);
} catch (error) {
  console.error(error);
}
```

- ####### The completion status of a previously sent file

```javascript
const fileId = "<FILE_ID>"; // The id of a previously sent file

try {
  const response = await zeroBounce.getFileStatus(fileId);
} catch (error) {
  console.error(error);
}
```

- ####### The completion status of a previously sent scoring file

```javascript
const fileId = "<FILE_ID>"; // The id of a previously sent file

try {
  const response = await zeroBounce.getScoringFileStatus(fileId);
} catch (error) {
  console.error(error);
}
```

- ####### Get the file with the validated data

```javascript
const fileId = "<FILE_ID>"; // The id of a previously sent file

try {
  const response = await zeroBounce.getFile(fileId);
} catch (error) {
  console.error(error);
}
```

Optional query parameters (see v2 get file API):

```javascript
await zeroBounce.getFile(fileId, {
  downloadType: ZeroBounceSDK.ZBDownloadType.COMBINED,
  activityData: true,
});
```

- ####### Get the file with the scoring data

```javascript
const fileId = "<FILE_ID>"; // The id of a previously sent file

try {
  const response = await zeroBounce.getScoringFile(fileId);
} catch (error) {
  console.error(error);
}
```

```javascript
await zeroBounce.getScoringFile(fileId, {
  downloadType: ZeroBounceSDK.ZBDownloadType.PHASE_2,
});
```

- ####### Delete the file with the validated data

```javascript
const fileId = "<FILE_ID>"; // The id of a previously sent file

try {
  const response = await zeroBounce.deleteFile(fileId);
} catch (error) {
  console.error(error);
}
```

- ####### Delete the file with the scoring data

```javascript
const fileId = "<FILE_ID>"; // The id of a previously sent file

try {
  const response = await zeroBounce.deleteScoringFile(fileId);
} catch (error) {
  console.error(error);
}
```

- ####### Email finder - Test a variety of patterns and combinations in real time until it identifies a valid business email.

```javascript
// Parameters
// ----------
// domain: String
//     The email domain for which to find the email format. 
// company_name: String
//     The company name for which to find the email format.
// first_name: String or null (Optional)
//     The first name of the person whose email format is being searched.
//     Left out, the API answers with the domain's or company's email format.
// middle_name: String or null (Optional)
//     The middle name of the person whose email format is being searched.
// last_name: String or null (Optional)
//     The last name of the person whose email format is being searched.

const domainPayload = {
  domain: "<DOMAIN>",
  first_name: "<FIRST_NAME>",
  middle_name: "<MIDDLE_NAME>",
  last_name: "<LAST_NAME>"
}

const companyNamePayload = {
  company_name: "<COMPANY_NAME>",
  first_name: "<FIRST_NAME>",
  middle_name: "<MIDDLE_NAME>",
  last_name: "<LAST_NAME>"
}

try {
  const domainResponse = await zeroBounce.findEmailByDomain(domainPayload);
  const companyNameResponse = await zeroBounce.findEmailByCompanyName(companyNamePayload);
} catch (error) {
  console.error(error);
}
```

- ####### Domain Search - Find the domain based on a given domain name or company name

```javascript
// Parameters
// ----------
// domain: String
//     The domain name for which to find the email format. 
// company_name: String
//     The company name for which to find the email format.

const domainPayload = {
  domain: "<DOMAIN>"
}

const companyNamePayload = {
  company_name: "<COMPANY_NAME>"
}

try {
  const domainResponse = await zeroBounce.findEmailFormatByDomain(domainPayload);
  const companyNameResponse = await zeroBounce.findEmailFormatByCompanyName(companyNamePayload);
} catch (error) {
  console.error(error);
}
```

**Any of the following email addresses can be used for testing the API, no credits are charged for these test email addresses:**

- disposable@example.com
- invalid@example.com
- valid@example.com
- toxic@example.com
- donotmail@example.com
- spamtrap@example.com
- abuse@example.com
- unknown@example.com
- catch_all@example.com
- antispam_system@example.com
- does_not_accept_mail@example.com
- exception_occurred@example.com
- failed_smtp_connection@example.com
- failed_syntax_check@example.com
- forcible_disconnect@example.com
- global_suppression@example.com
- greylisted@example.com
- leading_period_removed@example.com
- mail_server_did_not_respond@example.com
- mail_server_temporary_error@example.com
- mailbox_quota_exceeded@example.com
- mailbox_not_found@example.com
- no_dns_entries@example.com
- possible_trap@example.com
- possible_typo@example.com
- role_based@example.com
- timeout_exceeded@example.com
- unroutable_ip_address@example.com
- free_email@example.com

**You can use this IP to test the GEO Location in the API.**

- 99.110.204.1

#### Development

After checking out the repo run tests

```bash
npm test
```

You should see an output like this

```bash
Test Suites: 5 passed, 5 total
Tests:       157 passed, 157 total
Snapshots:   0 total
Ran all test suites.
```
