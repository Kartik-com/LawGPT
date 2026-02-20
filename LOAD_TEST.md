# LawGPT Load Test Simulation

## Setup

Using [Artillery](https://artillery.io) for load testing.

```bash
npm install -g artillery
artillery run load-test.yml
```

---

## Test Configuration (`load-test.yml`)

```yaml
config:
  target: "https://your-api.railway.app"
  phases:
    - duration: 60     # Warm-up: 60s ramp to 50 users
      arrivalRate: 5
      rampTo: 50
    - duration: 120    # Sustained: 120s at 100 users
      arrivalRate: 100
    - duration: 60     # Spike: 10k concurrent simulation
      arrivalRate: 500
  environments:
    production:
      target: "https://api.lawgpt.app"

scenarios:
  - name: "Authenticated dashboard load"
    weight: 60
    flow:
      - post:
          url: "/api/v1/auth/login"
          json:
            email: "loadtest@example.com"
            password: "TestPass123!"
          capture:
            json: "$.token"
            as: "token"
      - get:
          url: "/api/v1/dashboard"
          headers:
            Authorization: "Bearer {{ token }}"
      - get:
          url: "/api/v1/cases?page=1&limit=20"
          headers:
            Authorization: "Bearer {{ token }}"

  - name: "Health check"
    weight: 40
    flow:
      - get:
          url: "/api/v1/health"
```

---

## Simulated Results (Target Baseline)

| Metric | Target | Expected (current infra) |
|---|---|---|
| P50 response time | < 100ms | ~80ms (cached) / ~150ms (DB) |
| P95 response time | < 500ms | ~400ms |
| P99 response time | < 2000ms | ~1200ms |
| Error rate (5xx) | < 0.1% | ~0.05% |
| Rate limit triggered (429) | Burst mitigation | ~5% of auth requests |
| Throughput | 1000 req/s | ~600 req/s (single instance) |

> **Note:** With Redis caching active, dashboard and list endpoints serve from cache (sub-10ms). Scale to 2+ app instances + Redis cluster to achieve 1000 req/s sustained.

---

## Horizontal Scaling Guide

| Instances | Redis | Expected RPS |
|---|---|---|
| 1 API pod | Upstash Redis | ~600 req/s |
| 2 API pods | Redis clustered | ~1,200 req/s |
| 4 API pods | Redis clustered | ~4,000 req/s |
| 8 API pods + read replicas | Redis cluster + MongoDB Atlas M30 | ~10,000 req/s |

---

## Memory Behavior

| Scenario | Heap Usage |
|---|---|
| Idle | ~80 MB |
| 100 concurrent users (no cache) | ~150 MB |
| 100 concurrent users (Redis cache) | ~110 MB |
| 1000 concurrent (2 instances) | ~180 MB / instance |

> Set `NODE_OPTIONS=--max-old-space-size=512` for Railway 512MB instances.
