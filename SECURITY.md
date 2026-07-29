# Security Policy

## Supported deployment

Security fixes are maintained on the current `main` branch and the production deployment at `https://www.twosday.dev`.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Until a dedicated security mailbox is published, contact the repository owner privately through the GitHub profile associated with this repository. Include:

- A concise description of the issue and affected URL or feature.
- Steps to reproduce it safely.
- Potential impact, if known.
- Any suggested mitigation.

Twosday will validate the report, prioritize a fix, and coordinate disclosure after remediation.

## Security boundaries

- Firebase Authentication verifies account credentials.
- Firestore Rules restrict account, calendar, note, and presence data to the authenticated account owner.
- Public event links are unguessable, direct-read tokens. They expose only the copied event fields selected for sharing, cannot be enumerated, and expire at the Firestore authorization layer.
- Firebase App Check uses reCAPTCHA Enterprise for production web traffic. Enforcement is enabled only after production metrics confirm healthy token coverage.
- Vercel applies transport, framing, referrer, permissions, and content-security headers to production responses.

## Security maintenance

Before a public launch, configure `security@twosday.dev` or another monitored reporting channel, enable GitHub private vulnerability reporting, review Firebase quotas and API restrictions, and follow [Security Operations](docs/SECURITY-OPERATIONS.md).
