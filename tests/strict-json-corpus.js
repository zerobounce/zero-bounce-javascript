/**
 * The shared strict JSON corpus (check E7), read from tests/fixtures/strict-json-corpus.tsv.
 *
 * Source: zerobounce/sdk-docs, sdk-docs/skills/zerobounce-sdk/references/strict-json-corpus.tsv.
 * Keep the fixture byte-identical to that file: copy it over, never edit it here.
 * Each line is VERDICT<TAB>"JSON-encoded body"; "#" lines are comments.
 */
import { readFileSync } from "fs";
import { join } from "path";

export function strictJsonCorpus() {
  const text = readFileSync(join(__dirname, "fixtures", "strict-json-corpus.tsv"), "utf8");
  const reject = [];
  const accept = [];
  for (const line of text.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const tab = line.indexOf("\t");
    const verdict = line.slice(0, tab);
    const body = JSON.parse(line.slice(tab + 1));
    if (verdict === "REJECT") reject.push(body);
    else if (verdict === "ACCEPT") accept.push(body);
    else throw new Error(`Unknown verdict in strict-json-corpus.tsv: ${verdict}`);
  }
  return { reject, accept };
}

/**
 * A 200 answer that reads like a real fetch Response: text() decodes UTF-8
 * and drops a leading byte order mark, as the Fetch standard does, and
 * arrayBuffer() returns the bytes as sent.
 */
export function fetchLikeResponse(body, contentType = "application/json", status = 200) {
  const bytes = Buffer.from(body, "utf8");
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => (String(name).toLowerCase() === "content-type" ? contentType : null) },
    text: async () => bytes.toString("utf8").replace(/^\uFEFF/, ""),
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}
