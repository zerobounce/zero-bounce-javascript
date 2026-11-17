# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

`@zerobounce/zero-bounce-sdk` is the ZeroBounce JavaScript SDK. Callers construct `ZeroBounceSDK`, call `init` with an API key, and `await` the method. HTTP goes through global `fetch` inside `createRequest` in `src/utils.js`. Releases are git tags. The Publish workflow ships that tag to npm.

## Layout

- `src/zero-bounce.js`: public client. The API key is a private `#apiKey` field.
- `src/warmup.js`: Warmup client. It does not use `createRequest`. Its key is a private `#apiKey` field.
- `src/response-fields.js`: declared response field types.
- `src/utils.js`: URLs, timeouts, and HTTP errors.
- `src/index.js`: default export used by the webpack build. The UMD bundle keeps only the default, so the named exports (`ZeroBounceWarmup`, `ZBApiError`, `ZeroBounceSDK`) are also set as properties on it.
- `zeroBounceSDK.mjs` and `zeroBounceSDK.d.mts`: the `import` entry and its types, re-exporting the bundle with real named exports. `tests/dist-exports.test.js` builds `dist/` and loads the package both ways.
- `zeroBounceSDK.d.ts`: published TypeScript types. `npm run dts-check` typechecks it and `zeroBounceSDK.d.mts` (`tsconfig.json`, with `skipLibCheck` off; with it on, nothing in a `.d.ts` is checked). `tests/ts-consumer.ts` typechecks a consumer (`npm run test:types`).
- `tests/offline-api.test.js`: offline suite. A fake `fetch` records every request and answers without the network.
- `tests/zero-bounce.test.js` and `tests/getfile-node.test.js`: existing Jest cases.
- `package.json` and `package-lock.json`: the version fields. There is no runtime version constant and no custom User-Agent.

## Commands

```bash
npm ci
npm test                  # jest && tsc --noEmit -p tsconfig.test.json
npm run dts-check         # tsc --noEmit on zeroBounceSDK.d.ts
npm run test:coverage     # jest --coverage
npm run build             # webpack production bundle; also runs from prepublishOnly
```

There is no separate lint command. CI (`.github/workflows/sdk_ci.yml`) runs `npm test`, coverage, and `npm run dts-check`. The publish workflow's test gate is `npm test`, which is stricter than coverage alone because it includes the TypeScript consumer check.

## Conventions

- **Exactly the documented set of fields, no more and no fewer.** The eight S3 / SFTP file jobs go through `_bulkRootFileJob` and send `file_name`, `has_header_row`, `remove_duplicates` and `return_url` only. The live API requires `file_name` and `return_url` on every one of them, including `validateSFTPfile`, although the docs mark them optional.
- **Only endpoints documented at https://www.zerobounce.net/docs/.** Do not add a method for an endpoint that the public docs do not describe, even if it exists on the server. Check before concluding something is undocumented: the S3 bulk endpoints live under https://www.zerobounce.net/docs/api-integrations/amazon-s3-bulk-api, not the main API reference.
- **One `ZeroBounceSDK` per API key.** The key is a private `#apiKey` field, not a public property. Do not reuse one instance across users or requests. Construct a separate object per key. The offline concurrency test does this. The Warmup client stores its key the same way.
- **Column indexes are 1-based and are not converted.** Optional name, gender, and IP columns use `0` or `false` to mean "leave this field out". Required `email_address_column` and `domain_column` are sent as given, including `0`. `0` is not "missing".
- **Optional parameters are omitted when unset.** `timeout`, `activityData`, `verifyPlus`, `allowPhase2`, `downloadType`, `ip_address`, and email-finder name fields are not sent until the caller sets them. Explicit `false` is sent as the string `false` on query, form, and multipart bodies, and as a JSON boolean on `validateBatch`.
- **Do not use boolean `false` as the "omit this column" sentinel inside `_sendBulkRootMultipartFile`.** `false` is a real `has_header_row` value and must be appended as `"false"`. Optional columns that are unset are `null`, and `null` is omitted. `optionalColumn` turns `0` and `false` into `null` for those optional columns only.
- **`allow_phase_2` is validation bulk only** (`sendFile`, `sendFileStream`), and only when `allowPhase2` is set. Scoring `sendFile` ignores it. The S3 and SFTP file jobs send only the documented set and so never send it. `activity_data` on get-file is validation `getFile` only.
- **List evaluator, the Inbox Placement Tester, the bulk email finder and bulk domain search have their own base URLs**, set on the instance by `init`'s third argument: `https://bulkapi.zerobounce.net/v2/listevaluator`, `https://bulkapi.zerobounce.net/api/ipt`, `https://bulkapi.zerobounce.net/email-finder` and `https://bulkapi.zerobounce.net/domain-search`. They are not built from the bulk base, and each is passed to `createRequest` as `baseURL` with a path relative to it. `sendEvaluatedFile` stays on the bulk `/v2` base.
- **The Inbox Placement Tester takes the API key in an `Authorization: Bearer` header, not as an `api_key` query parameter, and JSON bodies with camelCase fields.** Only fields the caller set are sent. Its error bodies use `detail`.
- **`validateBatch` uses `api.zerobounce.net`**, not `bulkapi.zerobounce.net`, and sends its body as `jsonBody` so `createRequest` sets `Content-Type: application/json`. Bulk email finder and domain search use the bulk host root (`/email-finder/…`, `/domain-search/…`) with no `/v2`. List evaluator and validation/scoring file methods use `https://bulkapi.zerobounce.net/v2`.
- **Failures reject the promise.** The message must be short: no raw HTML, no megabyte body, no `SyntaxError` / `Unexpected token` text, and no `Error: Error:` or `[Error]:` prefix. An account-level `validateBatch` error (`email_address` `all`) rejects. A per-address error stays on the resolved result. A top-level `error` string for an invalid API key or no credits rejects. `scoreEmail`'s `{ error: "invalid email" }` rejects too. A bulk JSON body such as `{ success: "False", message: […] }` rejects with status 200 (a `success` of `false`, `"false"` or `0` decides failure).
- **`getFile` in a browser** downloads the CSV and resolves to the filename. **In Node** it resolves to the CSV text. A JSON body (including an error such as `success: false`) rejects with a `ZBApiError` carrying the HTTP status. HTML, an empty body, and HTTP status 400 or higher reject.
- **`init` is all or nothing.** The key and every base URL are checked before any of them is stored, so an `init` that throws leaves the client unchanged. A base URL must be `https://` and must not contain a username, a password, a query string, or a fragment. That error does not include the URL. Loopback `http://` is only for tests. Requests time out after 120 seconds. `fetch` is called with `redirect: "manual"`; a 3xx answer rejects with its own status and is never followed.
- **No error carries the key.** `createRequest` redacts every error it raises (transport and API alike) against the key it finds in the request itself: `params.api_key`, an `api_key` form field, `jsonBody.api_key` or the Bearer token. Its `secrets` option is only for other values, such as SFTP credentials. Every boolean option, including `validateBatch`'s `activityData` and `verifyPlus`, goes through `strictBoolean`.
- **`npm test` is offline, and a guard enforces it.** Tests replace global `fetch`; `tests/jest.setup.js` makes any `fetch`, `XMLHttpRequest` or `http`/`https` request to a host other than 127.0.0.1, localhost or [::1] fail the test with "Network guard: ... refused". A test that sends a real request therefore cannot pass; stub `fetch` and assert with `await expect(...).rejects...` so a call that does not throw fails the test. Do not call the live API from `npm test`. `tests/real-api-prod.mjs` is opt-in (`npm run test:real-api`) and is not part of `npm test`. Neither is `tests/smoke-dist.js` (`npm run test:smoke`), which makes one live `getCredits` request when `ZEROBOUNCE_API_KEY` is set and skips it otherwise.
- Match the surrounding style. Do not reformat unrelated code. Do not commit `dist/`, `node_modules/`, `coverage/`, or `.env`.

## Changelog

`CHANGELOG.md` follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

- Add every user-visible change to `## [Unreleased]` in the same commit as the change.
- Group entries under these headings, in this order, omitting empty ones: `Breaking` (what a caller of the last published version sees rejected or changed; mark a visible difference "**Behaviour change:**"), `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- Write for SDK users: name the method, option, or behaviour, and say what changed. Leave out CI-only changes, internal refactors, and fixes to code that was never released.
- At 2.y.z, a breaking change bumps the major version, a new method or option bumps the minor version, and fixes alone bump the patch version.

## Releasing

Publishing and pushing tags need a maintainer's explicit approval. Do not bump the version, tag, or publish unless they asked.

1. Move `[Unreleased]` entries under `## [x.y.z] - YYYY-MM-DD`, leave an empty `[Unreleased]` section, and update the compare links at the bottom of `CHANGELOG.md`.
2. Set the same version in all of these. The publish workflow fails if `package.json` differs from the tag:
   - `package.json` `"version"`
   - `package-lock.json` top-level `"version"`
   - `package-lock.json` `packages[""].version`
3. `npm test`, `npm run dts-check`, and `npm run test:coverage`.
4. Tag `vx.y.z` on that commit and run the Publish workflow with that tag. It publishes `@zerobounce/zero-bounce-sdk` to npm and creates the GitHub release. There is no runtime version constant to update.
