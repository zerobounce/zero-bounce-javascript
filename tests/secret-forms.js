/**
 * The forms a secret can take in an echoed body, composed for the tests from
 * the encoders a body can apply, independently of the SDK's own list:
 * {raw, JSON-escaped, JSON-escaped with "/" as "\/"} and each JSON escape
 * applied twice (every combination of the two), each {as is, URL-encoded with
 * %20, form-encoded with +}, plus escape() of the raw secret.
 */

/** A space, a quote, "/", "\\", "+", "%", "&", "=", "<", ">" and "'": every composed form differs. */
export const AWKWARD_SECRET_CHARS = ` "/\\+%&=<>'`;

const quotings = {
  "JSON-escaped": (text) => JSON.stringify(text).slice(1, -1),
  "JSON-escaped, / as \\/": (text) => JSON.stringify(text).slice(1, -1).replace(/\//g, "\\/"),
};

const encodings = {
  "": (text) => text,
  ", URL-encoded (%20)": (text) => encodeURIComponent(text),
  ", form-encoded (+)": (text) => new URLSearchParams({ s: text }).toString().slice(2),
};

export function composedSecretForms(secret) {
  const quoted = { raw: secret };
  for (const [first, once] of Object.entries(quotings)) {
    quoted[first] = once(secret);
    for (const [second, twice] of Object.entries(quotings)) {
      quoted[`${first}, then ${second}`] = twice(once(secret));
    }
  }
  const forms = { "escape()": escape(secret) };
  for (const [quoting, text] of Object.entries(quoted)) {
    for (const [encoding, encode] of Object.entries(encodings)) {
      forms[`${quoting}${encoding}`] = encode(text);
    }
  }
  return forms;
}

/**
 * Echo each form on its own through `messageFor` and require the message to
 * come back exactly as an echoed "***" does: a form the SDK misses leaks, or
 * leaves the tail of a longer form behind.
 */
export async function expectEveryFormRedacted(secret, messageFor) {
  for (const char of AWKWARD_SECRET_CHARS) expect(secret).toContain(char);
  const forms = composedSecretForms(secret);
  // 7 quotings x 3 encodings + escape(): all distinct, so dropping any one
  // generator from the SDK leaves at least one form unredacted.
  expect(Object.keys(forms).length).toBe(22);
  expect(new Set(Object.values(forms)).size).toBe(22);
  const expected = await messageFor("***");
  expect(expected).toContain("[***]");
  const got = {};
  for (const [name, echo] of Object.entries(forms)) got[name] = await messageFor(echo);
  expect(got).toEqual(Object.fromEntries(Object.keys(forms).map((name) => [name, expected])));
}
