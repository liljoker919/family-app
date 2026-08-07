# Security Policy

Hey Famly is a small, actively-maintained project. There's one supported version — whatever's currently deployed from `main`.

## Reporting a Vulnerability

If you find a security issue, please email **cnickerson@oakcitysoftwaresolutions.com** rather than opening a public issue. Include what you found, how to reproduce it, and its potential impact. We'll acknowledge within a few days and let you know once it's fixed.

## What's in place

- Tenant isolation enforced at the queryset level across every account-scoped model (see `core/mixins.py`)
- HTTPS enforced, secure cookies, CSRF protection
- Rate limiting on login/signup/invite endpoints and at the nginx layer
- Dependabot (weekly) plus `bandit` and `pip-audit` (every push/PR) for dependency and static-analysis scanning
- Least-privilege IAM credentials per external service (SES, backups), never shared or reused
- No advertising or third-party tracking cookies; analytics is self-hosted and cookieless

This isn't an exhaustive list — see the closed issues under the [Security Hardening milestone](https://github.com/liljoker919/family-app/milestones) for the specific audit and fixes behind it.
