# LawGPT — Infrastructure Architecture Guide

## Cloud Architecture Recommendation

```
┌────────────────────────────────────────────────────────┐
│                     Production Stack                     │
├──────────────┬──────────────┬───────────────────────────┤
│  Frontend    │  API Server  │  Workers                  │
│  (nginx)     │  (Node 20)   │  (BullMQ)                 │
│              │              │                           │
│  Railway /   │  Railway /   │  Railway Worker           │
│  Vercel /    │  Render /    │  (separate service)       │
│  Cloudflare  │  Fly.io      │                           │
└──────┬───────┴──────┬───────┴────────────┬──────────────┘
       │              │                    │
       ▼              ▼                    ▼
  Static CDN    MongoDB Atlas       Redis (Upstash)
  (auto)         M10+               (Production)
                 VPC Peered         TLS + AUTH
```

---

## Service Configuration Recommendations

### MongoDB Atlas
- **Tier:** M10 (1 vCPU, 2GB RAM) for up to 1000 users; M20+ for 10k+
- **Region:** Same region as API server
- **Features:** Enable: Backups (daily), Peering, Atlas Search (for future)
- **IP Allowlist:** API server IPs only (no 0.0.0.0/0)
- **Indexes:** Created automatically on startup via `src/config/indexes.js`

### Redis
- **Development:** Not required (in-memory fallback)
- **Staging:** Redis Cloud free tier OR `redis://localhost:6379`
- **Production:** [Upstash Redis](https://upstash.com) (serverless, pay-per-use) OR Railway Redis plugin
  - Enable TLS: Yes (`rediss://`)
  - Max memory policy: `allkeys-lru` (evict LRU when full)
  - Max memory: 128MB starter, scale to 512MB at 10k users

### Cloudinary
- **Plan:** Free tier up to 25GB storage; upgrade to Basic ($89/mo) at scale
- **Settings:** Auto-optimize uploads (strip metadata, lossy webp)

---

## Environment Variables Matrix

| Variable | dev | staging | production | Required |
|---|---|---|---|---|
| `PORT` | 5000 | 5000 | 5000 | Yes |
| `NODE_ENV` | development | staging | production | Yes |
| `MONGODB_URI` | local/atlas | atlas | atlas | Yes |
| `JWT_SECRET` | any 64-char | rotate quarterly | rotate quarterly | Yes |
| `JWT_REFRESH_SECRET` | any 64-char | rotate quarterly | rotate quarterly | Yes |
| `CORS_ORIGIN` | localhost:5173 | staging URL | prod URL | Yes |
| `REDIS_URL` | _(not set)_ | `redis://localhost` | Upstash TLS URL | Recommended |
| `CLOUDINARY_*` | test credentials | shared | prod bucket | Yes |
| `SENDGRID_API_KEY` | _(not set)_ | test key | prod key | For email |
| `SENTRY_DSN` | _(not set)_ | staging DSN | prod DSN | Recommended |
| `LOG_LEVEL` | debug | info | warn | Yes |
| `SHUTDOWN_TIMEOUT` | 2000 | 5000 | 10000 | Optional |

---

## Blue-Green Deployment Strategy

```
Traffic: 100% → Green (running)

1. Deploy new version to Blue
2. Health check Blue: GET /api/v1/health → 200 OK
3. Smoke test Blue in isolated env
4. Switch traffic 10% → Blue (canary)
5. Monitor error rate for 5 min
6. If OK: 100% → Blue
7. Green becomes new standby
```

### Zero-Downtime Requirements (all met)
- ✅ Express trust proxy configured
- ✅ Graceful shutdown (SIGTERM → drain → close)
- ✅ Health check endpoint stable (`/api/v1/health`)
- ✅ Stateless API (no in-memory session state)
- ✅ Redis handles distributed state (rate limits, cache)

---

## Railway Deployment (`railway.toml`)

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "./Dockerfile"

[deploy]
startCommand = "node -r dotenv/config index.js"
healthcheckPath = "/api/v1/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 5

[environments.production]
NODE_ENV = "production"
```

---

## Prometheus + Grafana Observability

### Prometheus Scrape Config
```yaml
scrape_configs:
  - job_name: 'lawgpt-api'
    static_configs:
      - targets: ['api:5000']
    metrics_path: '/api/v1/metrics'
    scrape_interval: 15s
```

### Recommended Grafana Dashboards
1. **Node.js Overview** — Dashboard ID: 11159
2. **HTTP Request Metrics** — Custom from `http_request_duration_seconds`
3. **Rate Limit Alerts** — Track `rate_limit_triggered_total`

### Alert Rules
```yaml
# P99 response time > 2s
- alert: HighResponseTime
  expr: histogram_quantile(0.99, http_request_duration_seconds_bucket) > 2
  for: 5m

# Error rate > 1%
- alert: HighErrorRate
  expr: sum(rate(http_request_duration_seconds_count{status_code=~"5.."}[5m])) / sum(rate(http_request_duration_seconds_count[5m])) > 0.01
  for: 5m
```
