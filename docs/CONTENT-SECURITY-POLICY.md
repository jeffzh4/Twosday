# Content Security Policy

## Purpose

Twosday uses a restrictive Content Security Policy (CSP) to reduce the impact of script-injection and content-injection defects. The policy is sent by Vercel for every production response.

## Production policy

```text
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
script-src 'self' https://www.gstatic.com https://www.google.com https://www.recaptcha.net https://apis.google.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob:;
connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://www.google.com https://www.recaptcha.net https://accounts.google.com;
frame-src https://accounts.google.com https://*.firebaseapp.com https://www.google.com https://www.recaptcha.net;
worker-src 'self' blob:;
manifest-src 'self';
upgrade-insecure-requests
```

The deployed source of truth is [`vercel.json`](../vercel.json). This document explains its intent; it does not replace deployment configuration.

## Allowed services

| Directive | Reason |
| --- | --- |
| `script-src` | Firebase browser SDKs, Google sign-in support, and reCAPTCHA Enterprise. |
| `style-src` / `font-src` | Twosday styles plus the existing Google Fonts stylesheet and font files. Inline styles remain temporarily allowed because the current UI uses controlled inline style attributes. Inline scripts are not allowed. |
| `connect-src` | Firebase Authentication, Cloud Firestore, Firebase App Check, and reCAPTCHA network requests. |
| `frame-src` | Google sign-in and reCAPTCHA frames only. |
| `worker-src` | The first-party service worker and browser-managed worker blobs. |

## Change control

1. Add a source only when a shipped feature cannot function without it.
2. Prefer a precise origin over a wildcard. Wildcards in the Firebase rules are limited to Google-managed Firebase API hosts required by the SDK.
3. Do not add `'unsafe-inline'` to `script-src`, `'unsafe-eval'`, or broad `https:` source expressions.
4. Test authentication, calendar sync, public share links, App Check, and the PWA after every CSP change.
5. Record the service, directive, owner, and removal condition for any new exception in the pull request or commit description.

## Incident response

If a CSP regression blocks production functionality, revert the smallest affected source change first. Do not weaken the policy broadly to restore service. Document the failing endpoint, reproduce it locally, and add the narrowest compatible source.

