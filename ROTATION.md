# JWT Key Rotation Runbook

## Overview
LawGPT supports zero-downtime JWT key rotation via the `JWT_KEYS` environment variable.
During rotation, old tokens remain valid until they expire, while new tokens use the new key.

---

## Rotation Procedure

### 1. Generate a new key
```bash
# Generate 64-byte random secret (base64)
openssl rand -base64 64
```

### 2. Add new key to JWT_KEYS
current `JWT_KEYS` value:
```json
[
  { "kid": "key-2025-01", "secret": "OLD_SECRET_HERE", "active": true }
]
```

Updated value with new key as active, old key retained for verification:
```json
[
  { "kid": "key-2025-01", "secret": "OLD_SECRET_HERE", "active": false },
  { "kid": "key-2025-07", "secret": "NEW_SECRET_HERE", "active": true }
]
```

### 3. Deploy the new environment variable
Deploy to your hosting provider (Railway/Render/Kubernetes) with the new `JWT_KEYS` value.
The API restarts with the new key as active.

> All existing tokens (signed with `key-2025-01`) continue to work — the key store
> tries matching `kid` first, then falls back to trying all registered keys.

### 4. Wait for old tokens to expire
Access tokens expire in **15 minutes**. Refresh tokens expire in **7 days**.
After 7 days, all old tokens are expired.

### 5. Remove old key
After 7+ days, safely remove the old inactive key:
```json
[
  { "kid": "key-2025-07", "secret": "NEW_SECRET_HERE", "active": true }
]
```

### 6. Verify
Check logs for any `JWT verification failed` errors — if none, rotation is complete.

---

## Rotation Schedule Recommendation
| Environment | Frequency |
|---|---|
| Production | Every 6 months minimum |
| Staging | Every 12 months |
| After breach | Immediately (emergency rotation) |

---

## Emergency Rotation (Breach Response)
1. Generate a new key immediately
2. Set `JWT_KEYS` with **only** the new key (`active: true`, old key NOT included)
3. Deploy immediately — all existing tokens are immediately invalidated
4. Users will be logged out and must re-authenticate

> This causes a brief logout for all active users but prevents attacker access.

---

# Backup & Disaster Recovery Plan

## RTO / RPO Targets

| Scenario | RTO (Recovery Time) | RPO (Data Loss) |
|---|---|---|
| Stateless API pod crash | < 30 seconds | 0 (stateless) |
| Redis failure | < 60 seconds | Rate limits reset (acceptable) |
| MongoDB replica failover | < 60 seconds | < 5 seconds (replica lag) |
| Full MongoDB cluster failure | < 4 hours | < 24 hours (daily backup) |
| Data corruption | < 8 hours | < 24 hours |
| Full region failure | < 24 hours | < 24 hours |

## MongoDB Atlas Backup Configuration
- Enable: **Continuous Cloud Backup** (Point-in-Time Recovery)
- Retention: 7 days
- Snapshot frequency: Every 6 hours
- Download snapshots weekly and store off-site (S3 / Backblaze)

## Backup Verification Script
```bash
# Monthly restore test (run against staging)
# 1. Download Atlas snapshot
# 2. Restore to local MongoDB
mongorestore --uri "mongodb://localhost:27017" --archive=lawgpt-backup.archive

# 3. Verify document count
mongo localhost/lawgpt --eval "printjson(db.stats())"

# 4. Run smoke tests against restored data
npm run test:db
```

## M0 Atlas Warning
> ⚠️ MongoDB Atlas M0 (free tier) is NOT suitable for production:
> - Max 500 connections
> - 512 MB storage limit
> - No backup support
> - No guaranteed uptime SLA
> - Upgrade minimum to **M10** before production launch

## Redis DR
- Use Upstash Redis with automated backups enabled
- Redis is ephemeral state (rate limits, cache) — loss is acceptable
- On Redis failure, app falls back to in-memory (degraded performance, not outage)
