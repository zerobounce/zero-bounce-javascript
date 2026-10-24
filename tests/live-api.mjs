/**
 * Opt-in live API suite: calls every SDK method against the real API to check
 * payloads and response shapes.
 *
 * Jest does not match this file (.mjs), so `npm test` and CI never run it. Run
 * it explicitly:
 *
 *   export ZEROBOUNCE_API_KEY=...          # validation API (skipped without it)
 *   export ZEROBOUNCE_WARMUP_API_KEY=...   # Warmup API (skipped without it)
 *   npm run test:live
 *
 * By default only free calls run: sandbox addresses (no credits), reads, and
 * requests expected to fail (unknown file IDs, S3/SFTP without an integration)
 * that still prove the API accepts the payload. The free tier checks that the
 * credit balance did not change. Two flags opt in to more:
 *
 *   ZEROBOUNCE_LIVE_SPEND=1     spends credits: scoring, activity, email
 *                               finder, and bulk round trips (every job is
 *                               deleted again)
 *   ZEROBOUNCE_LIVE_CHANGES=1   reversible account changes, each undone in
 *                               cleanup even when a test fails: a test filter,
 *                               and a self-managed Warmup sending account
 *
 * Never called, because the API cannot undo them: creating an Inbox Placement
 * test (it cannot be deleted while running), setting the Inbox Placement
 * webhook (it cannot be cleared), and ZB-managed Warmup onboarding (it starts
 * mailbox provisioning).
 *
 * No key is ever written to a file or printed. Keys come from the environment.
 */
import { ZeroBounceSDK, ZeroBounceWarmup } from "../src/index.js";

const API_KEY = (process.env.ZEROBOUNCE_API_KEY || "").trim();
const WARMUP_KEY = (process.env.ZEROBOUNCE_WARMUP_API_KEY || "").trim();
const SPEND = process.env.ZEROBOUNCE_LIVE_SPEND === "1";
const CHANGES = process.env.ZEROBOUNCE_LIVE_CHANGES === "1";

/** Well-formed but matching no file: a malformed ID can be Cloudflare-blocked instead of answered. */
const UNKNOWN_ID = "0d1b7a4e-1111-2222-3333-444455556666";
const CALLBACK = "https://example.com/zerobounce-sdk-live-test";
const SANDBOX = "valid@example.com";

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

function redact(text) {
  let value = String(text);
  for (const secret of [API_KEY, WARMUP_KEY]) {
    if (secret) value = value.split(secret).join("***");
  }
  return value;
}

async function test(name, fn, { when = true, reason = "" } = {}) {
  if (!when) {
    skipped += 1;
    console.log(`  - SKIP ${name}${reason ? ` (${reason})` : ""}`);
    return;
  }
  try {
    await fn();
    passed += 1;
    console.log(`  + ${name}`);
  } catch (error) {
    failed += 1;
    const message = redact(error && error.message ? error.message : String(error));
    failures.push(`${name}: ${message}`);
    console.log(`  X ${name}\n      ${message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Run `call`, expecting it to fail, and hand back the (redacted) message. */
async function expectFailure(call, what) {
  try {
    await call();
  } catch (error) {
    return redact(error.message || String(error));
  }
  throw new Error(`${what} unexpectedly succeeded`);
}

function sdk() {
  const client = new ZeroBounceSDK();
  client.init(API_KEY);
  return client;
}

async function creditBalance(client) {
  const response = await client.getCredits();
  return Number(response && response.Credits);
}

async function main() {
  console.log("ZeroBounce live API suite");
  console.log(`  validation key: ${API_KEY ? "set" : "MISSING"}`);
  console.log(`  warmup key:     ${WARMUP_KEY ? "set" : "MISSING"}`);
  console.log(`  flags:          SPEND=${SPEND ? 1 : 0} CHANGES=${CHANGES ? 1 : 0}\n`);

  if (API_KEY) await validationFree();
  if (API_KEY && SPEND) await validationSpend();
  if (API_KEY && CHANGES) await validationChanges();
  if (WARMUP_KEY) await warmupFree();
  if (WARMUP_KEY && CHANGES) await warmupChanges();

  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const line of failures) console.log(`  - ${line}`);
  }
  process.exit(failed ? 1 : 0);
}

// -- validation API, free -----------------------------------------------------

async function validationFree() {
  console.log("Validation API (free calls)");
  const client = sdk();
  const before = await creditBalance(client);

  await test("getCredits returns a balance", async () => {
    assert(Number.isFinite(before), `Credits was ${before}`);
  });

  await test("getApiUsage parses the documented date formats", async () => {
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);
    const usage = await client.getApiUsage(start, end);
    assert(usage && typeof usage.total === "number", "no total in response");
  });

  await test("validateEmail on a sandbox address spends nothing", async () => {
    const response = await client.validateEmail(SANDBOX);
    assert(response && response.address === SANDBOX, "address did not echo");
    assert(typeof response.status === "string", "no status");
  });

  await test("validateEmail works over POST as well as GET", async () => {
    // No billable add-on here: activity_data, verify_plus and domain_info are
    // charged even on a sandbox address, so they live in the SPEND tier.
    const response = await client.validateEmail(SANDBOX, { usePost: true, timeout: 30 });
    assert(response && typeof response === "object", "no response");
  });

  await test("LIVE: validateBatch accepts timeout as a string", async () => {
    // Sent as a JSON number the API rejects the whole batch with the
    // account-level "Invalid API Key or your account ran out of credits".
    const response = await client.validateBatch([{ email_address: SANDBOX }], {
      timeout: 30,
      activityData: false,
      verifyPlus: false,
    });
    assert(Array.isArray(response.email_batch), "no email_batch");
    assert(
      !(response.errors || []).some((e) => String(e.email_address).toLowerCase() === "all"),
      `account-level error: ${JSON.stringify(response.errors)}`
    );
  });

  await test("an unknown file id is a short, clean error", async () => {
    const message = await expectFailure(() => client.getFileStatus(UNKNOWN_ID), "getFileStatus");
    assert(message.length < 500, `message too long: ${message.length}`);
    assert(!message.includes("<html"), "HTML leaked into the message");
  });

  await test("listS3files answers (empty without an S3 integration)", async () => {
    try {
      const files = await client.listS3files();
      assert(files !== undefined, "no response");
    } catch (error) {
      // No S3 integration configured is an expected, documented failure.
      assert(error.message.length < 500, "message too long");
    }
  });

  await test("LIVE: S3/SFTP jobs reject a payload without return_url before sending", async () => {
    const message = await expectFailure(
      () => client.emailFinderS3file({ file_name: "f.csv", has_header_row: true }),
      "emailFinderS3file without return_url"
    );
    assert(/return_url/.test(message), `unexpected message: ${message}`);
  });

  await test("LIVE: a complete S3 job payload is accepted by the API", async () => {
    // Without an S3 integration this fails on the integration, not the payload.
    try {
      await client.emailFinderS3file({
        file_name: "f.csv",
        has_header_row: true,
        return_url: CALLBACK,
      });
    } catch (error) {
      const message = redact(error.message);
      assert(
        !/return URL is not permitted|This field is required/i.test(message),
        `payload rejected: ${message}`
      );
    }
  });

  await test("filters list", async () => {
    const response = await client.listFilters();
    assert(response !== undefined, "no response");
  });

  await test("LIVE: the Inbox Placement Tester accepts a Bearer key", async () => {
    const providers = await client.getInboxPlacementProviders();
    assert(providers && typeof providers === "object", "no providers payload");
  });

  await test("inbox placement test types", async () => {
    const types = await client.getInboxPlacementTestTypes();
    assert(types && typeof types === "object", "no test types");
  });

  await test("inbox placement list and webhook read", async () => {
    await client.listInboxPlacementTests({ page: 1, pageSize: 10 });
    await client.getInboxPlacementWebhook();
  });

  await test("list evaluator result for an unknown id fails cleanly", async () => {
    const message = await expectFailure(
      () => client.getListEvaluatorResult(UNKNOWN_ID),
      "getListEvaluatorResult"
    );
    assert(message.length < 500, "message too long");
  });

  await test("the free calls did not change the credit balance", async () => {
    const after = await creditBalance(sdk());
    assert(after === before, `credits went from ${before} to ${after}`);
  });
}

// -- validation API, spends credits -------------------------------------------

async function validationSpend() {
  console.log("\nValidation API (ZEROBOUNCE_LIVE_SPEND=1)");
  const client = sdk();

  await test("validateEmail accepts every documented option", async () => {
    // LIVE: activity_data, verify_plus and domain_info are billable add-ons and
    // are charged even for a sandbox address, so this is not a free call.
    const response = await client.validateEmail(SANDBOX, {
      timeout: 30,
      activityData: true,
      verifyPlus: true,
      domainInfo: true,
      greylistProcessing: true,
      callbackUrl: CALLBACK,
    });
    assert(response && typeof response === "object", "no response");
  });

  await test("scoreEmail", async () => {
    const response = await client.scoreEmail(SANDBOX);
    assert(response && response.email !== undefined, "no email in response");
  });

  await test("scoreEmail over POST", async () => {
    const response = await client.scoreEmail(SANDBOX, { usePost: true });
    assert(response && typeof response === "object", "no response");
  });

  await test("getEmailActivity", async () => {
    const response = await client.getEmailActivity(SANDBOX);
    assert(response && response.found !== undefined, "no found flag");
  });

  await test("email finder", async () => {
    const response = await client.findEmailByDomain({
      domain: "example.com",
      first_name: "John",
      last_name: "Doe",
    });
    assert(response && typeof response === "object", "no response");
  });

  await test("domain search", async () => {
    const response = await client.findEmailFormatByDomain({ domain: "example.com" });
    assert(response && typeof response === "object", "no response");
  });

  let fileId = null;
  await test("bulk validation round trip: upload, status, delete", async () => {
    const csv = "email\nvalid@example.com\ninvalid@example.com\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const sent = await client.sendFileStream(blob, "zb-sdk-live.csv", {
      email_address_column: 1,
      has_header_row: true,
    });
    assert(sent && sent.file_id, `no file_id: ${JSON.stringify(sent)}`);
    fileId = sent.file_id;
    const status = await client.getFileStatus(fileId);
    assert(status && status.file_id === fileId, "status did not echo the file id");
  });

  await test(
    "the uploaded validation job is deleted again",
    async () => {
      // LIVE: a just-accepted job answers "File cannot be found" for a short
      // while, so the delete is retried rather than leaving the job behind.
      let lastError = null;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        try {
          await client.deleteFile(fileId);
          return;
        } catch (error) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }
      }
      throw new Error(
        `could not delete ${fileId} after retrying: ${redact(lastError && lastError.message)}`
      );
    },
    { when: Boolean(fileId), reason: "upload did not produce a file id" }
  );
}

// -- validation API, reversible account changes -------------------------------

async function validationChanges() {
  console.log("\nValidation API (ZEROBOUNCE_LIVE_CHANGES=1)");
  const client = sdk();
  const value = `zb-sdk-live-${Date.now()}.example.com`;
  let added = false;

  try {
    await test("addFilter creates a reversible allow rule", async () => {
      const response = await client.addFilter({ rule: "allow", target: "domain", value });
      added = true;
      assert(response !== undefined, "no response");
    });
  } finally {
    await test(
      "the test filter is removed again",
      async () => {
        await client.deleteFilter({ rule: "allow", target: "domain", value });
      },
      { when: added, reason: "filter was not created" }
    );
  }
}

// -- Warmup API ---------------------------------------------------------------

function warmup() {
  return new ZeroBounceWarmup(WARMUP_KEY);
}

async function warmupFree() {
  console.log("\nWarmup API (reads)");
  const client = warmup();

  const reads = [
    ["listSendingAccounts", () => client.listSendingAccounts()],
    ["listFromAddresses", () => client.listFromAddresses()],
    ["getEngagementRules", () => client.getEngagementRules()],
    ["getSeeds", () => client.getSeeds()],
    ["getSeedCount", () => client.getSeedCount()],
    ["getProgressToday", () => client.getProgressToday()],
    ["getSentToday", () => client.getSentToday()],
    ["getEmailsPerDay", () => client.getEmailsPerDay()],
  ];
  for (const [name, call] of reads) {
    await test(name, async () => {
      const response = await call();
      assert(response !== undefined, "no response");
    });
  }

  await test("downloadSeeds returns CSV text", async () => {
    const csv = await client.downloadSeeds();
    assert(typeof csv === "string" && csv.length > 0, "no CSV body");
    assert(!csv.trim().startsWith("{"), "got JSON instead of CSV");
  });

  await test("LIVE: checkDomainDmarc rejects a bare domain before sending", async () => {
    const message = await expectFailure(
      () => client.checkDomainDmarc("example.com"),
      "checkDomainDmarc with a domain"
    );
    assert(/email address/i.test(message), `unexpected message: ${message}`);
  });

  await test("LIVE: checkDomainDmarc accepts an email address", async () => {
    const response = await client.checkDomainDmarc("sender@example.com");
    assert(response && typeof response === "object", "no response");
  });

  // The statistics endpoints need a from-address this team actually has; the
  // API answers "Sending account ... was not found" for anything else.
  let known = null;
  try {
    const accounts = await client.listSendingAccounts();
    const list = Array.isArray(accounts) ? accounts : accounts && accounts.data;
    const first = Array.isArray(list) ? list[0] : null;
    known = first && (first.from_address || first.c_from || first.fromAddress);
  } catch {
    known = null;
  }

  await test(
    "statistics for a registered from-address",
    async () => {
      const response = await client.getStatistics(known);
      assert(response !== undefined, "no response");
    },
    { when: Boolean(known), reason: "this team has no sending account" }
  );

  await test(
    "statistics per day over a short range",
    async () => {
      const end = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const response = await client.getStatisticsPerDay({
        fromAddress: known,
        startDate: start,
        endDate: end,
      });
      assert(response !== undefined, "no response");
    },
    { when: Boolean(known), reason: "this team has no sending account" }
  );

  await test(
    "detailed statistics and the CSV download for that address",
    async () => {
      await client.getStatisticsDetailed(known);
      const csv = await client.downloadStatistics(known);
      assert(typeof csv === "string", "no CSV body");
    },
    { when: Boolean(known), reason: "this team has no sending account" }
  );

  await test(
    "from-address statistics",
    async () => {
      const response = await client.getFromAddressStatistics(known);
      assert(response !== undefined, "no response");
    },
    { when: Boolean(known), reason: "this team has no sending account" }
  );

  await test("an unknown Warmup resource fails with a status code", async () => {
    try {
      await client.getCustomEngagement("no-such-address@example.com");
    } catch (error) {
      assert(typeof error.statusCode === "number", "no statusCode on the error");
      assert(!String(error.message).includes(WARMUP_KEY), "the key leaked into the message");
    }
  });
}

async function warmupChanges() {
  console.log("\nWarmup API (ZEROBOUNCE_LIVE_CHANGES=1)");
  const client = warmup();
  const address = `zb-sdk-live-${Date.now()}@example.com`;
  let added = false;

  try {
    await test("a self-managed sending account can be added", async () => {
      await client.addSendingAccount({
        fromAddress: address,
        onboardingModel: "self_managed",
        engagementRuleId: 0,
        ignoreConflict: true,
      });
      added = true;
    });
  } finally {
    await test(
      "the test sending account is removed again",
      async () => {
        await client.deleteSendingAccount(address);
      },
      { when: added, reason: "account was not created" }
    );
  }
}

main().catch((error) => {
  console.error(redact(error && error.stack ? error.stack : String(error)));
  process.exit(1);
});
