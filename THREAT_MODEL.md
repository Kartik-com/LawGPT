# LawGPT — Threat Model (STRIDE Analysis)

## Application Overview
- **Type:** Full-stack SaaS web application (legal case/document management)
- **Architecture:** Node.js/Express REST API + React SPA
- **Auth:** JWT (httpOnly cookies) + Refresh token rotation
- **Data:** MongoDB Atlas, Redis (optional), Cloudinary
- **Entry Points:** HTTPS web browser, REST API

---

## STRIDE Analysis

| Category | Threat | Entry Point | Current Mitigation | Residual Risk |
|---|---|---|---|---|
| **Spoofing** | Credential theft | Login endpoint | bcrypt (10 rounds), rate limiting (15 req/15 min) | Phishing attacks (mitigate with 2FA) |
| **Spoofing** | JWT forgery | Any API call | RS256 → HS256 with strong secret (64-byte), 15-min expiry | Secret rotation not automated |
| **Spoofing** | Session hijacking | Cookie | httpOnly + Secure + SameSite=lax | Cookie theft via XSS (blocked by CSP) |
| **Tampering** | NoSQL injection | All inputs | express-mongo-sanitize | Complex aggregation pipelines not sanitized |
| **Tampering** | CSRF | Mutating endpoints | Double-submit cookie (X-CSRF-Token) | SPA token auto-rotation needed |
| **Tampering** | Request body inflation | API body | 1MB limit | Legitimate large payloads rejected (acceptable) |
| **Repudiation** | Action denial | All mutations | AuditLog model (90-day retention) | Logs not tamper-proof (write to external SIEM for full non-repudiation) |
| **Information Disclosure** | Sensitive data in responses | User endpoints | Field projection (no passwordHash/token in responses) | Error messages may leak stack traces in dev |
| **Information Disclosure** | Cloudinary URL guessing | Document API | Private Cloudinary URLs (signed) | Unsigned URLs in old uploads |
| **Information Disclosure** | MongoDB metadata | Query errors | Generic error messages in production | Internal model names still exposed in some errors |
| **Denial of Service** | Brute-force auth | Login/register/forgot | 15 req/15 min rate limit (Redis-backed) | Distributed attacks across IPs not blocked |
| **Denial of Service** | Large file upload | Document upload | 10MB limit, file type filter | Concurrent upload storm |
| **Denial of Service** | DB query flooding | All list endpoints | Pagination (max 100/page), global rate limit | Complex queries (search) can still be slow |
| **Elevation of Privilege** | Role escalation | Admin endpoints | requireRole() RBAC middleware | No separation of admin/user DB credentials |
| **Elevation of Privilege** | Mass assignment | User update | Selective field update (not `...req.body`) | Incomplete validation on some PATCH routes |

---

## Attack Surface Map

```
Internet
  │
  ▼
CDN / Load Balancer (Railway / Render)
  │
  ├── [HTTPS 443] → nginx → React SPA (static)
  │                          └── calls API via fetch()
  │
  └── [HTTPS 443] → Express API
        ├── /api/v1/auth/*         ← Rate limited (15/15min), Zod validated
        ├── /api/v1/documents/*    ← Auth required, 10MB limit, type filter
        ├── /api/v1/cases/*        ← Auth + RBAC required
        ├── /api/v1/health         ← Public (no sensitive data)
        └── /api/v1/metrics        ← Should be restricted to internal access in prod
              │
              ▼
        MongoDB Atlas (VPC peered or IP allowlist)
        Redis (TLS, password auth)
        Cloudinary (API key + secret)
        SendGrid (API key)
```

---

## Priority Mitigations

| Priority | Action | Effort |
|---|---|---|
| 🔴 HIGH | Add 2FA requirement for admin roles | Medium |
| 🔴 HIGH | Restrict `/api/v1/metrics` to internal IPs via nginx | Low |
| 🔴 HIGH | Automate JWT secret rotation (quarterly) | Medium |
| 🟠 MEDIUM | Add `Content-Security-Policy-Report-Only` in staging | Low |
| 🟠 MEDIUM | Sign all Cloudinary URLs | Medium |
| 🟠 MEDIUM | Send audit logs to external SIEM (Datadog, Splunk) | High |
| 🟡 LOW | Add `Expect-CT` header | Low |
| 🟡 LOW | Implement progressive rate limiting (IP reputation) | High |

---

## Compliance Notes
- **GDPR:** User data deletable via soft-delete + account purge. Audit logs auto-expire at 90 days.
- **SOC2:** Audit logging, RBAC, encryption at rest (MongoDB Atlas), TLS in transit.
- **OWASP Top 10:** A01 (RBAC ✅), A02 (bcrypt ✅), A03 (Zod + sanitize ✅), A04 (rate limiting ✅), A05 (Helmet headers ✅), A06 (Dependabot ✅), A07 (refresh token rotation ✅).
