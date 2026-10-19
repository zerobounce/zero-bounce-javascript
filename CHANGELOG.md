# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `validateEmail` accepts `activityData`, `verifyPlus`, and `method: "POST"` (form-encoded `POST /v2/validate`). `timeout` is still optional and must be from 3 to 60 seconds.
- `validateBatch` accepts `timeout` (10–120 seconds), `activityData`, and `verifyPlus`.
- `scoreEmail` calls `GET /v2/scoring`. `scoreEmail(email, { method: "POST" })` sends a form-encoded `POST /v2/scoring`.
- Bulk email finder: `sendEmailFinderFile`, `sendEmailFinderFileStream`, `getEmailFinderFileStatus`, `getEmailFinderFile`, `deleteEmailFinderFile`.
- Bulk domain search: `sendDomainSearchFile`, `sendDomainSearchFileStream`, `getDomainSearchFileStatus`, `getDomainSearchFile`, `deleteDomainSearchFile`.
- List evaluator: `sendListEvaluatorFile`, `sendListEvaluatorFileStream`, `getListEvaluatorResult`, `sendEvaluatedFile`.
- Filters: `addFilter`, `listFilters` (GET, or POST when `method` is `"POST"`), `deleteFilter`.
- S3 bulk: `validateS3file`, `scoreS3file`, `exportS3file`, `listS3files`.

### Changed

- `init` rejects an `apiBaseURL` that is not `https://`.
- API requests abort after 120 seconds and do not follow redirects.
- Missing or invalid arguments reject the promise. They no longer log with `console.error` and return `undefined`.

### Fixed

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

[Unreleased]: https://github.com/zerobounce/zero-bounce-javascript/compare/v2.1.11...HEAD
[2.1.8]: https://github.com/zerobounce/zero-bounce-javascript/compare/v2.1.6...v2.1.8
[2.1.6]: https://github.com/zerobounce/zero-bounce-javascript/compare/v2.1.5...v2.1.6
[2.1.5]: https://github.com/zerobounce/zero-bounce-javascript/compare/v2.1.0...v2.1.5
[2.1.0]: https://github.com/zerobounce/zero-bounce-javascript/compare/v2.0.11...v2.1.0
[2.0.11]: https://github.com/zerobounce/zero-bounce-javascript/compare/v2.0.0...v2.0.11
[2.0.0]: https://github.com/zerobounce/zero-bounce-javascript/compare/v1.3.0...v2.0.0
[1.3.0]: https://github.com/zerobounce/zero-bounce-javascript/releases/tag/v1.3.0
