/**
 * Production smoke test against live ZeroBounce APIs.
 *
 * Requires Node 18+ (global fetch, Blob, FormData).
 * Loads `ZEROBOUNCE_API_KEY` from the process environment, or from a `.env` file
 * at the package root or current working directory (does not override existing env).
 *
 * Run from package root:
 *   npm run test:real-api
 * or:
 *   ZEROBOUNCE_API_KEY=your_key node tests/real-api-prod.mjs
 *
 * Consumes API credits (validate, batch, activity, bulk file processing).
 */

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(import.meta.url);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Minimal dotenv: KEY=value lines, optional quotes, # comments.
 * Only sets process.env[key] when it is currently undefined (shell wins).
 */
function loadDotEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (let line of text.split(/\r?\n/)) {
    const hash = line.indexOf("#");
    if (hash >= 0) line = line.slice(0, hash);
    line = line.trim();
    if (!line) continue;
    const exportPrefix = /^export\s+/i;
    if (exportPrefix.test(line)) line = line.replace(exportPrefix, "").trim();
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const dotEnvPaths = [
  resolve(packageRoot, ".env"),
  resolve(process.cwd(), ".env"),
];
const seenPaths = new Set();
for (const p of dotEnvPaths) {
  if (seenPaths.has(p)) continue;
  seenPaths.add(p);
  loadDotEnvFile(p);
}

function installDomShim() {
  if (globalThis.window?.document?.createElement) return;
  const body = {
    children: [],
    appendChild(el) {
      this.children.push(el);
    },
    removeChild(el) {
      const i = this.children.indexOf(el);
      if (i >= 0) this.children.splice(i, 1);
    },
  };
  let blobSeq = 0;
  globalThis.window = {
    navigator: {},
    URL: {
      createObjectURL() {
        return `blob:zb-smoke-${++blobSeq}`;
      },
      revokeObjectURL() {},
    },
  };
  globalThis.document = {
    body,
    createElement() {
      return {
        href: "",
        download: "",
        click() {},
      };
    },
  };
}

installDomShim();

const ZeroBounceSDK = require("../dist/zeroBounceSDK.js");

function logStep(name, data) {
  console.log(`\n── ${name} ──`);
  console.log(typeof data === "string" ? data : JSON.stringify(data, null, 2));
}

async function main() {
  const apiKey = process.env.ZEROBOUNCE_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      "Missing ZEROBOUNCE_API_KEY. Example:\n  ZEROBOUNCE_API_KEY=... node tests/real-api-prod.mjs"
    );
    process.exit(1);
  }

  const zb = new ZeroBounceSDK();
  zb.init(apiKey, ZeroBounceSDK.ApiURL.DEFAULT_API_URL);

  // 1) Credits
  const credits = await zb.getCredits();
  logStep("getCredits", credits);
  if (!credits || credits.Credits == null) {
    throw new Error("getCredits: unexpected response (check API key)");
  }

  // 2) Single validate
  const validated = await zb.validateEmail("support@zerobounce.net", {
    timeout: 10,
  });
  logStep("validateEmail", validated);
  if (!validated?.status) {
    throw new Error("validateEmail: missing status in response");
  }

  // 3) Batch validate
  const batch = await zb.validateBatch([
    { email_address: "support@zerobounce.net" },
    { email_address: "invalid@invalid.invalid" },
  ]);
  logStep("validateBatch", batch);
  if (!Array.isArray(batch?.email_batch) || batch.email_batch.length < 1) {
    throw new Error("validateBatch: unexpected email_batch");
  }

  // 4) API usage (last 7 days)
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const usage = await zb.getApiUsage(fmt(start), fmt(end));
  logStep("getApiUsage", usage);
  if (usage && typeof usage.total !== "number") {
    throw new Error("getApiUsage: expected numeric total");
  }

  // 5) Activity (optional endpoint)
  const activity = await zb.getEmailActivity("support@zerobounce.net");
  logStep("getEmailActivity", activity);
  if (activity && typeof activity.found !== "boolean") {
    throw new Error("getEmailActivity: expected boolean found");
  }

  // 6) Bulk: send → poll status → get file → delete
  const csv = "email\nsupport@zerobounce.net\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const sent = await zb.sendFileStream(blob, "zb-smoke.csv", {
    email_address_column: 1,
    has_header_row: true,
    remove_duplicate: false,
  });
  logStep("sendFileStream", sent);
  if (sent?.success !== true || !sent.file_id) {
    throw new Error(
      `sendFileStream: expected success + file_id, got ${JSON.stringify(sent)}`
    );
  }

  const fileId = sent.file_id;
  let status = null;
  for (let i = 0; i < 36; i++) {
    status = await zb.getFileStatus(fileId);
    logStep(`getFileStatus (poll ${i + 1})`, status);
    if (status?.file_status === "Complete") break;
    if (status?.file_status === "Failed") {
      throw new Error(`Bulk job failed: ${JSON.stringify(status)}`);
    }
    await delay(5000);
  }
  if (status?.file_status !== "Complete") {
    throw new Error("getFileStatus: timed out waiting for Complete");
  }

  // Default bulk job is phase 1 only unless sendFile* sets allowPhase2; COMBINED needs phase 2.
  const fileResult = await zb.getFile(fileId, {
    downloadType: ZeroBounceSDK.ZBDownloadType.PHASE_1,
    activityData: false,
  });
  logStep("getFile", typeof fileResult === "string" ? fileResult : fileResult);
  if (typeof fileResult !== "string" && !(fileResult instanceof Blob)) {
    if (fileResult && typeof fileResult === "object" && fileResult.success === false) {
      throw new Error(`getFile returned error payload: ${JSON.stringify(fileResult)}`);
    }
    throw new Error("getFile: expected filename string or Blob from SDK");
  }

  const deleted = await zb.deleteFile(fileId);
  logStep("deleteFile", deleted);
  if (!deleted?.success) {
    throw new Error(`deleteFile: unexpected response ${JSON.stringify(deleted)}`);
  }

  console.log("\n✓ Production smoke completed successfully.");
}

main().catch((err) => {
  console.error("\n✗ Production smoke failed:", err.message || err);
  process.exit(1);
});
