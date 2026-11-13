# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- Redaction is closed under encoding. After the known spellings of every
  secret (the API key, the Warmup key, the SMTP username and password) are
  replaced with `***`, the rest of the message is decoded up to four layers
  deep in any order (the SDK's own request encoding plus three echo layers:
  URL `%XX` in upper or lower case, form `+` and `%XX`, JSON escapes including
  `\/` and `\uXXXX`); a `%XX` run that is not valid UTF-8 as a whole (a stray
  `%FF` in front of a percent-encoded secret) is decoded one UTF-8 sequence at
  a time, so a non-ASCII secret such as an SMTP password is still recognised
  in it; if any decoded view still contains a secret, the whole
  message is replaced with "ZeroBounce: the response text was omitted because
  it contained a credential." 4.0.1 and earlier matched a fixed list of
  spellings (raw, URL-encoded, `escape()`), so a body echoing the key
  URL-encoded twice passed it to the caller.
- `init` is all or nothing: the key and every base URL are checked before any
  of them is stored, so an `init` that throws leaves the client exactly as it
  was. In 4.0.1 and earlier, `init` stored the new key and main base URL
  before checking the optional base URLs: after
  `init("key-B", ApiURL.EU_API_URL, { domainSearchBaseURL: "http://..." })`
  threw, a caller that caught the error sent its next requests to the EU host
  with `key-B`, and a fresh client whose `init` threw on an `http://` base URL
  still held the key.
- `ZeroBounceWarmup` redacts a failure to read the response body (for example
  a connection closed mid-body) like every other error. In 4.0.1 and earlier
  that error was rethrown as it came from `fetch`, so a `fetch` implementation
  that quotes the request or the key in it passed the key to the caller.
- Error messages are also redacted for the JSON-escaped form of every secret
  (the API key, the Warmup key, and the SMTP username and password), with and
  without `/` escaped as `\/`. 4.0.1 and earlier removed the raw,
  URL-encoded and `escape()` forms only, so a secret containing `"` or `\`
  (or `/`, where the body escapes it as `\/`) stayed readable in a message
  built from a body that quotes a JSON request (for example a 400 echoing
  `validateBatch`'s body or `testSmtpConfiguration`'s password).
- Error messages are also redacted for the URL-encoded forms of every
  secret's JSON-escaped copy (spaces as `%20` and, as `URLSearchParams`
  writes them, as `+`), for the `URLSearchParams` form of the secret itself,
  and for a twice JSON-escaped copy (with or without `/` escaped as `\/` at
  either step, also URL- and form-encoded). Earlier, an SMTP password or key
  containing `"`, `\`, `'` or a space stayed readable in a message built
  from a body that echoes the request URL-encoded (for example a 500 quoting
  `testSmtpConfiguration`'s JSON body URL-encoded, or quoting it as a JSON
  string).
- `ZeroBounceWarmup` JSON methods reject a 2xx answer served as `text/html`
  (a proxy or challenge page) with a `ZBApiError`, even when its body parses
  as JSON. 4.0.1 and earlier returned such a body as the result.

- The API key is held in a private field of `ZeroBounceSDK` and
  `ZeroBounceWarmup`, not in a property. `console.log("%o", client)`,
  `util.inspect(client, { showHidden: true })` and every walk of the object's
  properties now show `api_key: '***'` or nothing, never the key. 4.0.1 kept
  the key in a non-enumerable `_api_key` property, which `%o` and
  `showHidden` printed. The default `util.inspect` output shows the key as
  `api_key: '***'` (or `null` before `init`).

### Added

- `InboxPlacementProviderGroup`, the type of `emailProviders` and
  `gatewayProviders` in `InboxPlacementProvidersResponse` (the same shape as
  before, now named).

### Changed

- `getCredits` returns `Credits` as the string its type declares when the API
  sends a JSON integer: `{"Credits":2375323}` resolves to
  `{ Credits: "2375323" }`. 4.0.1 returned the number as it came, although
  `GetCreditsResponse.Credits` is typed `string`. The string form the API
  sends (`"12345"`, `"-1"`) is returned unchanged.

### Fixed

- A field of a typed result that arrives with another JSON type than
  `zeroBounceSDK.d.ts` declares rejects with a `ZBApiError` with status 200
  ("ZeroBounce returned a response field of an unexpected type for this call
  (<field>)."), at any depth (for example `email_batch[0].status`), on every
  call whose result is an interface. `null` is still accepted for every field,
  and fields the declarations do not name are kept as they are. `getCredits`
  needs `Credits` as an integer, sent as a string (`"12345"`, `"-1"`, as the
  API sends it) or as a JSON integer (`{"Credits":2375323}`, zerobounce.net's
  own example); `"abc"`, `"5.0"`, `5.5` and `true` reject. `validateEmail` and
  every `validateBatch` row need `address` and `status` as strings, and a
  batch row that is not an object (`5`, `null`) rejects; validate's greylist
  answer, whose only field is `Message`, is still a result of `validateEmail`
  (a batch row with only `Message` rejects). 4.0.1 resolved such bodies as they came, for example
  `getCredits` with `{"Credits": true}` or `{}` and `validateEmail` with
  `{"status": 5}`. The calls typed `unknown` and the `ZeroBounceWarmup`
  methods are unchanged.
- A 2xx body that is strict JSON but not the shape the call declares rejects
  with a `ZBApiError` with status 200 ("ZeroBounce returned JSON of an
  unexpected shape for this call."): a number, string, boolean, `null` or array
  where an object is declared, and an object where `listS3files` declares an
  array. 4.0.1 resolved such a body as the result (for example `validateEmail`
  resolved to `0`). The calls typed `unknown` (`getInboxPlacementTestTypes`,
  `listInboxPlacementTests`, `setInboxPlacementWebhook` and the
  `ZeroBounceWarmup` JSON methods) still return any JSON; `listFilters`
  accepts an object or an array.
- A JSON body nested deeper than 512 arrays or objects rejects with a
  `ZBApiError` with status 200 ("ZeroBounce returned a response nested too
  deeply to read."), on every JSON call, Warmup included. 4.0.1 returned it,
  so printing or walking the result (`JSON.stringify`) overflowed the stack.
- JSON responses are strict RFC 8259 JSON on every JSON call, Warmup
  included (checked against the shared strict JSON corpus). A body starting
  with a UTF-8 byte order mark is rejected with status 200: 4.0.1 read
  bodies with `Response.text()`, which drops the mark, so such a body was
  accepted. `ZeroBounceWarmup` JSON methods return `null` only for a 204 or a
  200 with no body at all; 4.0.1 also returned `null` for a whitespace-only
  body (and, through `String.prototype.trim`, for one of U+00A0, U+2003 and
  similar), which now rejects with status 200.
- `deleteInboxPlacementTest` resolves to an empty object `{}` (no `id` or
  `status`) when the API answers with an empty 2xx (204 No Content or a 200
  with no body at all; a whitespace-only body is not JSON and rejects), as the
  C and C++ SDKs return `{}`. 4.0.1 rejected that success with
  "Empty response from ZeroBounce (HTTP 204)". Every other call still rejects
  an empty 2xx, and an empty error answer still rejects with its status. The
  declared return type is unchanged (`Promise<InboxPlacementTestDeleted>`).
- `ZeroBounceWarmup.downloadSeeds` and `downloadStatistics` reject a JSON
  answer whatever its content type: a JSON object or array body (also under
  `text/csv` or with no content type) and any JSON media type, such as
  `application/problem+json`, reject with a `ZBApiError` carrying the HTTP
  status. 4.0.1 rejected only an `application/json` content type and resolved
  the others as if they were the CSV text.
- `getFile`, `getScoringFile`, `getEmailFinderFile` and `getDomainSearchFile`
  reject any JSON body (a JSON array, or an object that is not shaped as an
  error) and any JSON media type such as `application/problem+json` with a
  `ZBApiError` carrying the HTTP status. 4.0.1 resolved a JSON array, or an
  `application/problem+json` body with a non-error shape, as the file text.
- `ZeroBounceWarmup.downloadSeeds` and `downloadStatistics` reject an HTML page
  (served as `text/html`, or an HTML body under any content type, such as a
  proxy or challenge page) with a `ZBApiError` carrying the HTTP status. 4.0.1
  resolved it as if it were the CSV text.
- `ZeroBounceWarmup.addSendingAccount` parses `managedSending.weekdays_only`
  strictly, like every other boolean: `true` / `false`, `"true"` / `"false"`
  (any case) or `1` / `0`, sent as a JSON boolean. 4.0.1 sent the value as
  given, so `"false"` reached the API as a string; anything else now rejects
  with "weekdays_only parameter is invalid. Must be true or false." before a
  request is sent.
- `ZeroBounceWarmup.addSendingAccount` rejects a `managedSending.timezone_offset`
  of `NaN` with "timezone_offset parameter is invalid. Must be -11 to 14.".
  4.0.1 accepted it and sent `null`. Fractional offsets in range (5.5, -9.5)
  are still accepted.
- `scoreEmail` and its POST variant reject a `score` that is not an integer
  within the safe range (`5.5`, `1e400`, `9007199254740993`, or a string such
  as `"5.9"`) with a `ZBApiError` carrying status 200. 4.0.1 returned `5.5`
  as the score, and `1e400` as `Infinity`.
- A `null` in a field the declarations make non-nullable reads as its empty
  value instead of `null`: `validateBatch`'s `email_batch` and `errors`
  become `[]`, a file status's `file_id` and `upload_date` become `""`, and
  `other_domain_formats` becomes `[]`. 4.0.1 returned `null`.
- `sendFile` and the other file-job send calls join a success answer's
  `message` list with `"\n"` into the one string the declaration gives, as
  `message: "File Accepted\nSecond line"`. 4.0.1 returned the array. Failure
  messages are unchanged.

## [4.0.1] - 2026-11-11

### Fixed

- `validateBatch` parses `activityData` and `verifyPlus` strictly, as 4.0.0
  already did for every other boolean option: `true` / `false`, `"true"` /
  `"false"` (any case) or `1` / `0`, sent as JSON booleans. 4.0.0 sent the
  value as given, so `"false"`, `"no"` or `0` reached the API unchanged;
  anything else now rejects with "parameter is invalid. Must be true or
  false." before a request is sent.

### Security

- A network error or an API error message never carries the API key, from any
  `ZeroBounceSDK` method. 4.0.0 removed the raw key from transport errors
  only for `sendEvaluatedFile` and the Inbox Placement Tester, so a `fetch`
  implementation that quotes the key in its own error (for example from
  `getCredits`) passed it through in the rejection message. `ZeroBounceWarmup`
  already redacted its key.

## [4.0.0] - 2026-11-12

### Breaking

Upgrading from 3.1.x: handle a rejection where a file download, a 2xx error
body or a non-boolean option used to resolve or be sent; see below.

- `getFile`, `getScoringFile`, `getEmailFinderFile` and `getDomainSearchFile`
  reject with a `ZBApiError` carrying the HTTP status when the API answers with
  JSON instead of a file: an error body such as
  `{"success": false, "message": "File not found"}` (rejects with
  "File not found", `statusCode` 200), or any `application/json` response.
  3.1.0 resolved an error body as the parsed object, and returned other
  `application/json` bodies as if they were the CSV text, as the Python and Go
  SDKs never did. TypeScript: the four methods return
  `Promise<string | Blob | undefined>`; `GetFileJsonErrorPayload` is
  deprecated and no longer part of their return types.
- A 2xx JSON body with no `success` field and a non-empty `error`,
  `error_message` or `Error` string rejects whatever the text says, with
  `statusCode` 200, as in the Python and Go SDKs. 3.1.0 rejected it only for
  invalid-key or out-of-credits wording, so for example `scoreEmail` resolved
  `{"error": "invalid email"}`; it now rejects with "invalid email".
  Unchanged: validate's greylist answer `{"Message": "..."}` is a result, and
  `getCredits` still resolves `{"Credits": "-1"}`.
- Every boolean option is parsed strictly, as the S3 / SFTP jobs' have been
  since 3.1.0: `true` / `false`, `"true"` / `"false"` (any case) or `1` / `0`,
  and anything else rejects with "parameter is invalid. Must be true or
  false." before a request is sent. This covers `validateEmail`'s
  `activityData`, `verifyPlus`, `domainInfo` and `greylistProcessing`;
  `has_header_row`, `remove_duplicate` and `allowPhase2` on `sendFile`,
  `sendFileStream`, `sendScoringFile` and `sendScoringFileStream`;
  `getFile`'s `activityData`; `has_header_row` on the four bulk email finder
  and domain search uploads; and Warmup `addSendingAccount`'s
  `ignoreConflict`. 3.1.0 used truthiness, so the string `"false"` was sent as
  `true` and any other non-empty value as `true`. Leaving an option out, or
  passing `null`, keeps its default as before. `greylistProcessing: "true"`
  together with `callbackUrl` is now accepted; 3.1.0 rejected it as
  "Requires greylistProcessing: true".

### Changed

- `npm run test:smoke` makes its live `getCredits` request only when
  `ZEROBOUNCE_API_KEY` is set, and fails unless the API answers with a credit
  balance of 0 or more. Without the variable it skips the request and says so.
  It used a dummy key, which Cloudflare now answers with `403 error code: 1020`,
  so it could not pass.
- `package.json` has a specific `description`, `keywords` and `author`
  ("ZeroBounce").

### Fixed

- Base URLs passed to `init` (`apiBaseURL`, `listEvaluatorBaseURL`,
  `inboxPlacementBaseURL`, `emailFinderBaseURL`, `domainSearchBaseURL`) have
  trailing slashes removed. In 3.1.0 `"https://api.zerobounce.net/v2/"` sent
  requests to `https://api.zerobounce.net/v2//validate`. `ZeroBounceWarmup`
  already did this.
- The API key no longer appears in `util.inspect`, `console.log` or
  `JSON.stringify` of a `ZeroBounceSDK` or `ZeroBounceWarmup` client: the
  `_api_key` property is not enumerable. It is still sent with every request.

## [3.1.0] - 2026-11-11

This minor release has breaking changes. Code that compiled or ran on 3.0.0 can
fail on 3.1.0 in the cases marked **Breaking** below:

- TypeScript: the S3 / SFTP job option types changed shape, so a call that
  compiled against 3.0.0 can now fail to compile.
- `validateS3file` and `scoreS3file` reject a call without `has_header_row`
  before sending it (and without `return_url`, which the API already refused),
  and the eight S3 / SFTP jobs reject a `has_header_row` or `remove_duplicates`
  that is not a boolean, `"true"` / `"false"` or `1` / `0`.
- Warmup `addSendingAccount` rejects `engagementRuleId` on a `zb_managed`
  account, which 3.0.0 dropped and sent without.
- Warmup methods reject the returned promise on a bad argument instead of
  throwing synchronously.

Calls that resolved on 3.0.0 with an invalid-key message in the body now reject
instead; see **Fixed**.

### Breaking

Upgrading from 3.0.x (each item is described in full below):

- `validateS3file` / `scoreS3file`: pass `file_name`, `has_header_row` and
  `return_url`, and drop the column options and `remove_duplicate`; use
  `remove_duplicates`.
- The eight S3 / SFTP jobs: give `has_header_row` and `remove_duplicates` as
  `true` / `false`, `"true"` / `"false"` or `1` / `0`.
- TypeScript: the S3 / SFTP option types changed (`BulkRootFileJobOptions`).
- Warmup: drop `engagementRuleId` for `zb_managed` accounts, and `await`
  every `ZeroBounceWarmup` call inside `try` (or use `.catch()`).
- The email finder, domain search and filters reject an invalid key
  (`statusCode` 200) where 3.0.0 resolved with the message in the body.

### Added

- Response types for the Inbox Placement Tester, from its documentation: `getInboxPlacementProviders` returns `InboxPlacementProvidersResponse`, `createInboxPlacementTest` returns `InboxPlacementTestCreated` (`id`, `identifier`, `testType`, `emailAddressList`), `getInboxPlacementTest` returns `InboxPlacementTestResult`, `deleteInboxPlacementTest` returns `InboxPlacementTestDeleted` and `getInboxPlacementWebhook` returns `InboxPlacementWebhookResponse`. `getInboxPlacementTestTypes`, `listInboxPlacementTests` and `setInboxPlacementWebhook` stay `Promise<unknown>`: the documentation gives no body for them. All eight were `Promise<unknown>` in 3.0.0.
- `zeroBounceSDK.d.ts` declares `init`'s `emailFinderBaseURL` and `domainSearchBaseURL` options, and `ZeroBounceSDK.Warmup`.
- The README and documentation describe the Warmup client, `ZeroBounceWarmup`. It shipped in 3.0.0 without a changelog entry.

### Changed

- **Breaking (TypeScript):** `ValidateS3FileOptions` and `ScoreS3FileOptions` are now `BulkRootFileJobOptions`: `file_name: string`, `has_header_row: boolean`, `return_url: string` and optional `remove_duplicates`. `email_address_column`, `first_name_column`, `last_name_column`, `gender_column`, `ip_address_column`, `allowPhase2` and `remove_duplicate` are gone from them, so an object literal carrying one no longer compiles (TS2353 under TypeScript 7). `has_header_row` and `return_url` are required, and `return_url` can no longer be `false`, so options without them, or with `return_url: false`, no longer compile either (TS2739, TS2741 or TS2322 under TypeScript 7). `BulkRootFileJobOptions`, used by the six other S3 / SFTP jobs, makes `file_name` and `return_url` required where 3.0.0 had them optional; at run time 3.0.0 already rejected those calls.
- **Breaking:** `validateS3file` and `scoreS3file` require `has_header_row` and reject a call without it, before any request; 3.0.0 sent the job without it. They also require `file_name` and `return_url`. The live API rejects a job without `return_url` ("Provided return URL is not permitted: None"). In 3.0.0 `validateS3file` sent `return_url` whenever it was given, and `scoreS3file` had no `return_url` parameter, so it never sent one.
- `validateS3file` and `scoreS3file` now send only the documented job fields, `file_name`, `has_header_row`, `remove_duplicates` and `return_url`, through the same path as the other six S3 / SFTP jobs. 3.1.0 stops sending `email_address_column`, `first_name_column`, `last_name_column`, `gender_column`, `ip_address_column`, `allow_phase_2` and the singular `remove_duplicate`, which 3.0.0 sent when they were set. `allowPhase2` remains available on `sendFile` and `sendFileStream`.
- **Breaking:** The eight S3 / SFTP jobs take `has_header_row` and `remove_duplicates` as `true` / `false`, the strings `"true"` / `"false"` in any case, or `1` / `0`, and reject anything else. The string `"false"` is sent as `false`.
- **Breaking:** Warmup `addSendingAccount` rejects `engagementRuleId` for a `zb_managed` account instead of dropping it and sending the request. The field belongs to `self_managed` only.
- **Breaking:** Every Warmup (`ZeroBounceWarmup`) method is async, so a missing or invalid argument rejects the returned promise, as on `ZeroBounceSDK`, instead of throwing before a promise exists. `await` inside `try`, and `.catch()`, both see it. Code that called a Warmup method inside `try` without `await` no longer catches the error there. Only the constructor still throws.
- `init`'s `emailFinderBaseURL` and `domainSearchBaseURL` options are now honoured. They were validated and stored but never read, so the bulk email finder and bulk domain search always went to `https://bulkapi.zerobounce.net`. Both default to the same hosts as before, so a client that does not set them is unaffected.
- `sendEmailFinderFile` and `sendEmailFinderFileStream` require `first_name_column` or `full_name_column`, as the bulk email finder documents. The call is now rejected locally instead of reaching the API, which already refused such a job with `["full_name_column or first_name_column indexes must be present."]`. As with every optional column, `0` and `false` mean "leave this column out" and so do not count as given.
- `findEmailByDomain` and `findEmailByCompanyName` accept a missing `first_name` instead of rejecting it, as the Email Finder documents it as optional. Without it the API answers with the domain's or company's email format. `domain` or `company_name` is still required.
- `exportS3file` accepts a missing `export_bucket` instead of rejecting it, matching `exportSFTPfile`'s `export_path`. Without it the output bucket from your ZeroBounce settings is used.
- Methods are typed `Promise<X>` rather than `Promise<X | undefined>`: since 3.0.0 they reject rather than resolve `undefined`. `getFile`, `getScoringFile`, `getEmailFinderFile` and `getDomainSearchFile` keep `| undefined`, which a legacy browser download (`msSaveOrOpenBlob`) resolves to.
- `package.json` declares `"engines": { "node": ">=18" }`, the minimum the README already stated: the SDK needs the global `fetch`, `FormData` and `Blob`, which Node 16 lacks. npm only warns about an older Node by default and still installs.

### Fixed

- The named exports `ZeroBounceWarmup`, `ZBApiError` and `ZeroBounceSDK`, declared in `zeroBounceSDK.d.ts`, exist at run time. `import { ZeroBounceWarmup } from "@zerobounce/zero-bounce-sdk"` failed with "does not provide an export named", and `require()` returned them as `undefined`, because the bundle kept only the default export. `import` now resolves to an ES module entry, `zeroBounceSDK.mjs`, with real named exports over the same bundle, so import and require share one `ZBApiError`. ES module TypeScript projects (`"module": "node16"` / `"nodenext"`) get matching types from `zeroBounceSDK.d.mts`, so `new ZeroBounceSDK()` type-checks there.
- `sendEvaluatedFile` is typed as taking the list evaluator's `file_id`, as a string or `{ file_id }`, which is what it sends. It was typed as taking `{ file: File }`, which carries no id and is rejected.
- An invalid or drained API key resolved instead of rejecting on the email finder, the domain search and the filters. The API answers them with an HTTP 200 and no `success` field: `{"Message": "Invalid API key or your account ran out of credits"}` from `findEmailByDomain`, `findEmailByCompanyName`, `findEmailFormatByDomain`, `findEmailFormatByCompanyName` and the deprecated `guessFormat`, and `{"Error": ...}` from `addFilter`, `deleteFilter` and `listFilters`. Each now rejects with that message and `statusCode` 200, as `validateEmail`, `getEmailActivity` and `getApiUsage` already did in 3.0.0, where the API spells the key `error`. The five finder and domain-search methods, `guessFormat` included, reject any body that holds nothing but a message (`Message`, `message`, `Error`, `error`, `error_message` or `detail`), since their result is never one. A bare `Message` still resolves where it is a result: a filter change answers with one, and a repeated `greylist_processing` validate answers `{"Message": "Greylist validation still in progress. Please try again later."}`. `getCredits` still resolves `{"Credits": "-1"}` for an invalid key, as documented.
- On every endpoint, an `Error` key holding an invalid-key or out-of-credits message rejects, as a lowercase `error` already did. When a failure (an HTTP error status, or `success: false`) carries its text under `Message` or `Error`, the rejection uses that text instead of "ZeroBounce returned an unexpected response."
- `validateEmail`'s result carries the API's `Message` on `message` too, as the types have described since 3.0.0. Until now it was only on `Message`, so `message` was always `undefined`.
- `validateBatch` sends its JSON body with `Content-Type: application/json`. It was handed to `fetch` as a plain string, which labelled the JSON `text/plain;charset=UTF-8`.
- `validateSFTPfile` no longer passes a third argument that the shared job helper never had, and its documentation no longer says `file_name` is optional. The live API requires it.

## [3.0.0] - 2026-10-25

This release is a major version because the error contract changed: every public
method that is given a missing or invalid argument now rejects, where 2.1.11
logged with `console.error` and resolved to `undefined`. Code that relied on the
old silent behaviour needs a `catch` before upgrading. See **Changed** below.

### Added

- `validateEmail` accepts `activityData`, `verifyPlus`, and `method: "POST"` (form-encoded `POST /v2/validate`). `timeout` is still optional and must be from 3 to 60 seconds.
- `validateBatch` accepts `timeout` (10–120 seconds), `activityData`, and `verifyPlus`.
- `scoreEmail` calls `GET /v2/scoring`. `scoreEmail(email, { method: "POST" })` sends a form-encoded `POST /v2/scoring`.
- Bulk email finder: `sendEmailFinderFile`, `sendEmailFinderFileStream`, `getEmailFinderFileStatus`, `getEmailFinderFile`, `deleteEmailFinderFile`.
- Bulk domain search: `sendDomainSearchFile`, `sendDomainSearchFileStream`, `getDomainSearchFileStatus`, `getDomainSearchFile`, `deleteDomainSearchFile`.
- List evaluator: `sendListEvaluatorFile`, `sendListEvaluatorFileStream`, `getListEvaluatorResult`, `sendEvaluatedFile`.
- Filters: `addFilter`, `listFilters` (GET, or POST when `method` is `"POST"`), `deleteFilter`.
- S3 bulk: `validateS3file`, `scoreS3file`, `exportS3file`, `listS3files`, `emailFinderS3file`, `domainSearchS3file`.
- SFTP/FTP bulk: `validateSFTPfile`, `scoreSFTPfile`, `emailFinderSFTPfile`, `domainSearchSFTPfile`, `exportSFTPfile`. The server, path and protocol come from your ZeroBounce settings. `validateSFTPfile`'s `file_name` is optional; `exportSFTPfile` takes `export_path` rather than `export_bucket`.
- `validateEmail` accepts `domainInfo` (adds `domain_website_exists` and `domain_registrant_company_name` to the response), `greylistProcessing`, and `callbackUrl`. `callbackUrl` needs `greylistProcessing: true` and is rejected without it.
- The validate response carries `message`, read from the API's `Message` key, which a greylist pickup returns while the retry is still running.
- Inbox Placement Tester on `https://bulkapi.zerobounce.net/api/ipt`: `getInboxPlacementProviders`, `getInboxPlacementTestTypes`, `createInboxPlacementTest`, `getInboxPlacementTest`, `listInboxPlacementTests`, `deleteInboxPlacementTest`, `getInboxPlacementWebhook`, `setInboxPlacementWebhook`.
- `init` takes a third argument to override the list evaluator and Inbox Placement Tester base URLs.

### Changed

- List evaluator requests use their own base URL (`https://bulkapi.zerobounce.net/v2/listevaluator`) instead of building the path from the bulk base, and the file id is URL-encoded as one path segment. `sendEvaluatedFile` stays on the bulk base.

- **BREAKING:** `init` rejects an `apiBaseURL` that is not `https://`.
- API requests abort after 120 seconds and do not follow redirects.
- **BREAKING:** Missing or invalid arguments reject the promise. They no longer log with `console.error` and return `undefined`.

### Fixed

- An error body whose JSON carries a `detail` string (the Inbox Placement Tester, Django REST framework) rejects with that text instead of a generic message.
- A 403 HTML "Access denied" page is a short error. `getFile` no longer puts the page in the error (about 1.4 MB from the live API). An HTML page with status 200 is an error as well, including `getFile`, `getEmailFinderFile`, and `getDomainSearchFile`, instead of a saved CSV or a JSON parse.
- Empty and non-JSON bodies are a short error. The message is no longer `SyntaxError: …` text, and a repeated `Error:` / `[Error]:` prefix is removed.
- `validateBatch` rejects an account-level failure (HTTP 200, error for address `all`, such as an invalid API key or no credits). An error for one address stays on the resolved result. A top-level `error` string for an invalid API key or no credits also rejects. A per-email scoring error such as `{ error: "invalid email" }` stays on the resolved result.
- `sendEmailFinderFile` and `sendDomainSearchFile` send `has_header_row` when it is set to false. `sendFile` and `sendScoringFile` send `has_header_row` and `remove_duplicate` as `true` or `false`.
- Required column indexes are sent as given, including `0`: `email_address_column` on `sendFile`, `sendFileStream`, `sendScoringFile`, `sendScoringFileStream`, and the list evaluator, and `domain_column` on bulk email finder and domain search. Optional name, gender, and IP columns of `0` are still left out.
- `findEmailByDomain`, `findEmailByCompanyName`, and `guessFormat` omit unset name fields. They no longer send the string `null`.
- `init("")` and a whitespace-only API key throw before any request.

### Security

- Redirects are disabled, so a response cannot send the client, or the API key in the query string, to another host.
- A custom API base URL cannot be `http://`.
- Rejected errors no longer include the raw HTML access-denied page.

## [2.1.11] - 2026-08-14

### Fixed

- `npm audit` advisories for `fast-uri` and `js-yaml`, and tsconfig updates for TypeScript 7.

## [2.1.10] - 2026-07-27

### Fixed

- `npm audit` advisories in the development dependencies.

## [2.1.9] - 2026-06-18

### Fixed

- `validatebatch` goes to `api.zerobounce.net`, not the bulk host.
- `npm audit` advisories in the development dependencies.

## [2.1.8] - 2026-06-18

### Fixed

- `validateBatch` posts to `api.zerobounce.net/v2/validatebatch` instead of `bulkapi.zerobounce.net`.

## [2.1.6] - 2026-06-11

### Fixed

- `getFile` and `getScoringFile` return the CSV text in Node.js. In a browser they still download `result.csv` or `result-scoring.csv`.

## [2.1.5] - 2026-06-10

### Added

- Validate responses include `catchall_domain`.

## [2.1.0] - 2026-04-05

### Added

- `sendFile` and `sendFileStream` take `allowPhase2`, sent as `allow_phase_2` on validation bulk only.
- `getFile` and `getScoringFile` take `downloadType` (`ZeroBounceSDK.ZBDownloadType`: `phase_1`, `phase_2`, `combined`). Validation `getFile` also takes `activityData`.
- TypeScript response types for validation, batch validation, and API usage.

## [2.0.11] - 2026-03-03

### Changed

- License the project under MIT.

## [2.0.0] - 2026-03-03

### Added

- TypeScript declarations in `zeroBounceSDK.d.ts`.
- `package.json` `exports` for Node.js.

## [1.3.0] - 2026-01-15

### Added

- First tagged release: `getCredits`, `validateEmail` (including `timeout`), `getApiUsage`, `validateBatch`, `getEmailActivity`, bulk validation and scoring file methods, `findEmailByDomain`, `findEmailByCompanyName`, `findEmailFormatByDomain`, and `findEmailFormatByCompanyName`.
- `init(apiKey, apiBaseURL)` selects the default, US, or EU API host.
- `ZBValidateSubStatus.ACCEPT_ALL`.

### Deprecated

- `guessFormat`. Use the email-finder or domain-search methods instead.

[Unreleased]: https://github.com/zerobounce/zero-bounce-javascript/compare/v4.0.1...HEAD
[4.0.1]: https://github.com/zerobounce/zero-bounce-javascript/compare/v4.0.0...v4.0.1
[4.0.0]: https://github.com/zerobounce/zero-bounce-javascript/compare/v3.1.0...v4.0.0
[3.1.0]: https://github.com/zerobounce/zero-bounce-javascript/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/zerobounce/zero-bounce-javascript/compare/v2.1.11...v3.0.0
[2.1.11]: https://github.com/zerobounce/zero-bounce-javascript/compare/v2.1.10...v2.1.11
[2.1.10]: https://github.com/zerobounce/zero-bounce-javascript/compare/v2.1.9...v2.1.10
[2.1.9]: https://github.com/zerobounce/zero-bounce-javascript/compare/v2.1.8...v2.1.9
[2.1.8]: https://github.com/zerobounce/zero-bounce-javascript/compare/v2.1.6...v2.1.8
[2.1.6]: https://github.com/zerobounce/zero-bounce-javascript/compare/v2.1.5...v2.1.6
[2.1.5]: https://github.com/zerobounce/zero-bounce-javascript/compare/v2.1.0...v2.1.5
[2.1.0]: https://github.com/zerobounce/zero-bounce-javascript/compare/v2.0.11...v2.1.0
[2.0.11]: https://github.com/zerobounce/zero-bounce-javascript/compare/v2.0.0...v2.0.11
[2.0.0]: https://github.com/zerobounce/zero-bounce-javascript/compare/v1.3.0...v2.0.0
[1.3.0]: https://github.com/zerobounce/zero-bounce-javascript/releases/tag/v1.3.0
