# Security Policy

## Reporting a Vulnerability

If you think you've found a security issue, please report it privately instead of opening a public issue.

**Email:** integrations@zerobounce.net (use a subject like `[zero-bounce-javascript] Security`).

We'll look into reports as we can. If the issue is in the Zero Bounce API or service rather than this SDK, we may forward it to the right team.

## Supported Versions

We focus on the current release line for fixes. Using the latest release is recommended.

## Tips for Using This SDK

* Don't commit API keys or `.env` files—use environment variables or a secrets manager.
* Keep dependencies up to date and upgrade when new versions are released.
* Base URLs must be `https://`. `init` and the Warmup client also refuse a username, a password, a query string, or a fragment, and that error does not include the URL. Loopback `http://` is only for tests.

Thanks for helping keep things secure.
