# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

`@zerobounce/zero-bounce-sdk` is the ZeroBounce JavaScript SDK. Callers construct `ZeroBounceSDK`, call `init` with an API key, and `await` the method. HTTP goes through global `fetch` inside `createRequest` in `src/utils.js`. Releases are git tags. The Publish workflow ships that tag to npm.

## Layout

- `src/zero-bounce.js`: public client.
- `src/utils.js`: URLs, timeouts, and HTTP errors.
- `src/index.js`: default export used by the webpack build.
- `zeroBounceSDK.d.ts`: published TypeScript types. `npm run dts-check` typechecks this file. `tests/ts-consumer.ts` typechecks a consumer (`npm run test:types`).
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

- **Only endpoints documented at https://www.zerobounce.net/docs/.** Do not add a method for an endpoint that the public docs do not describe, even if it exists on the server. Check before concluding something is undocumented: the S3 bulk endpoints live under https://www.zerobounce.net/docs/api-integrations/amazon-s3-bulk-api, not the main API reference.
- **One `ZeroBounceSDK` per API key.** The key is stored on the instance. Do not reuse one instance across users or requests. Construct a separate object per key. The offline concurrency test does this.
- **Column indexes are 1-based and are not converted.** Optional name, gender, and IP columns use `0` or `false` to mean "leave this field out". Required `email_address_column` and `domain_column` are sent as given, including `0`. `0` is not "missing".
- **Optional parameters are omitted when unset.** `timeout`, `activityData`, `verifyPlus`, `allowPhase2`, `downloadType`, `ip_address`, and email-finder name fields are not sent until the caller sets them. Explicit `false` is sent as the string `false` on query, form, and multipart bodies, and as a JSON boolean on `validateBatch`.
- **Do not use boolean `false` as the "omit this column" sentinel inside `_sendBulkRootMultipartFile`.** `false` is a real `has_header_row` value and must be appended as `"false"`. Optional columns that are unset are `null`, and `null` is omitted. `optionalColumn` turns `0` and `false` into `null` for those optional columns only.
- **`allow_phase_2` is validation bulk only** (`sendFile`, `sendFileStream`, `validateS3file`), and only when `allowPhase2` is set. Scoring `sendFile` ignores it. `activity_data` on get-file is validation `getFile` only.
- **List evaluator and the Inbox Placement Tester have their own base URLs**, set on the instance by `init`'s third argument: `https://bulkapi.zerobounce.net/v2/listevaluator` and `https://bulkapi.zerobounce.net/api/ipt`. They are not built from the bulk base. `sendEvaluatedFile` stays on the bulk `/v2` base.
- **The Inbox Placement Tester takes the API key as the `api_key` query parameter and JSON bodies with camelCase fields.** Only fields the caller set are sent. Its error bodies use `detail`.
- **`validateBatch` uses `api.zerobounce.net`**, not `bulkapi.zerobounce.net`. Bulk email finder and domain search use the bulk host root (`/email-finder/…`, `/domain-search/…`) with no `/v2`. List evaluator and validation/scoring file methods use `https://bulkapi.zerobounce.net/v2`.
- **Failures reject the promise.** The message must be short: no raw HTML, no megabyte body, no `SyntaxError` / `Unexpected token` text, and no `Error: Error:` or `[Error]:` prefix. An account-level `validateBatch` error (`email_address` `all`) rejects. A per-address error stays on the resolved result. A top-level `error` string for an invalid API key or no credits rejects. `{ error: "invalid email" }` from `scoreEmail` stays on the result. A bulk JSON body such as `{ success: "False", message: […] }` is returned when it is not one of those account-level `error` strings.
- **`getFile` in a browser** downloads the CSV and resolves to the filename. **In Node** it resolves to the CSV text. A JSON error body (for example `success: false`) is returned as the parsed object. HTML, an empty body, and HTTP status 400 or higher reject.
- **`init` requires an `https://` base URL** and a non-blank API key. Requests time out after 120 seconds. `fetch` is called with `redirect: "error"`.
- **Tests replace global `fetch`.** Do not call the live API from `npm test`. `tests/real-api-prod.mjs` is opt-in (`npm run test:real-api`) and is not part of `npm test`.
- Match the surrounding style. Do not reformat unrelated code. Do not commit `dist/`, `node_modules/`, `coverage/`, or `.env`.

## Changelog

`CHANGELOG.md` follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

- Add every user-visible change to `## [Unreleased]` in the same commit as the change.
- Group entries under these headings, in this order, omitting empty ones: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
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
