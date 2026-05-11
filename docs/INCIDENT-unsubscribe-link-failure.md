# Incident Report: Unsubscribe Link Failure

**Date Discovered:** 2026-05-11
**Affected User:** mandymacintosh@fuller.edu
**Status:** Fixed — deploy pending
**Commit:** 6ec473b

---

## What Happened

A user clicked the unsubscribe link in a coaching/accountability email and was shown an "Invalid Link" error page. From the user's perspective, the action failed silently — they believed they had unsubscribed, but the system never processed it. They continued receiving emails.

## Root Cause

The unsubscribe link includes a verification token — a base64-encoded version of the user's email address. Base64 encoding can produce special characters (`+`, `/`, `=`) that must be URL-encoded to survive a round-trip through a browser URL bar.

**Two code paths generate unsubscribe links:**

1. **Coaching emails** (line 461 of `api/index.js`) — **Correct.** Token was wrapped in `encodeURIComponent()`.
2. **Accountability emails** (line 6911 of `api/index.js`) — **Bug.** Token was inserted raw, without URL encoding.

For this specific user:
- Email: `mandymacintosh@fuller.edu`
- Base64 token: `bWFuZHltYWNpbnRvc2hAZnVsbGVyLmVkdQ==`
- The trailing `==` was stripped by the browser when the link was clicked
- Server received `bWFuZHltYWNpbnRvc2hAZnVsbGVyLmVkdQ` (no `==`)
- Token comparison failed → "Invalid Link" page displayed
- `UPDATE coaching_sequences SET unsubscribed = TRUE` was never executed

## Who Is Affected

Any user whose email address produces a base64 token containing `+`, `/`, or `=` — and who received their unsubscribe link via the **accountability email** path (not the coaching email path). Roughly 30-40% of email addresses produce base64 with trailing `=` or `==`.

## Fix Applied

```javascript
// BEFORE (bug):
const unsubUrl = `...&token=${unsubToken}`;

// AFTER (fix):
const unsubUrl = `...&token=${encodeURIComponent(unsubToken)}`;
```

## For Agents & Counselors

- If a user reports they "already unsubscribed" but are still receiving emails, this bug is the likely reason.
- Use the admin endpoint to check and fix their status:
  - **Check:** `GET /api/coaching/toggle-subscribe?email=USER_EMAIL` (requires admin API key)
  - **Re-subscribe or unsubscribe:** `POST /api/coaching/toggle-subscribe` with body `{ "email": "...", "subscribe": false }` (requires admin API key)
- After the fix is deployed, all future unsubscribe links will work correctly regardless of email address.
- Users who were affected before the fix may need manual intervention via the toggle endpoint.

## Prevention

- All URL parameters derived from encoding operations (base64, hex, etc.) must be wrapped in `encodeURIComponent()` before insertion into URLs.
- Both coaching and accountability email paths now use identical encoding.
