# Loggist

Monitor your Claude Code costs and sessions at a glance. An OpenTelemetry-based monitoring dashboard.

> English | **[한국어](./README.ko.md)**

---

## Table of Contents

- [Why Loggist](#why-loggist)
- [Key Features](#key-features)
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Tech Stack](#tech-stack)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Architecture](#architecture)
- [License](#license)

---

## Why Loggist

When using Claude Code, questions like "How much am I spending this month?" or "Why was that session so expensive?" inevitably come up. Loggist provides **3 core capabilities** to answer these questions.

| Feature | Description |
|---------|-------------|
| **Session-based Cost Analysis** | "Why did this session cost $3?" — Trace API calls, tool usage, and token consumption per session with causal context |
| **Budget & Proactive Alerts** | Set daily/weekly/monthly budgets with alerts at 80%/100% thresholds. Works without opening the dashboard |
| **One-click Setup** | A single `docker compose up -d` configures the entire infrastructure automatically |

**Target Users:** Developers who use Claude Code daily (solo or small teams). Anyone who wonders "how much am I spending this month?"

---

## Key Features

**Cost Budget**
Set daily/weekly/monthly budgets, visualize current usage with gauge charts, and receive alerts at configurable thresholds (80%/100%).

**Dashboard Overview**
See total cost, token usage, and cache hit rate at a glance via KPI cards.

**Session Analysis**
Session list with drill-down view. Track per-session cost, token consumption, and tool usage with causal context.

**Real-time Timeline**
SSE (Server-Sent Events) based real-time event stream. Fan-out from Loki tail WebSocket to N clients.

**Log Search**
Filter panel with result table. Filter by time range, event type, and profile.

---

## Quick Start

### Step 1: Configure Claude Code OTEL

Add the following to `~/.claude/settings.json` (or profile-specific `~/.claude-b/settings.json`).

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4317",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "grpc",
    "OTEL_METRICS_INCLUDE_SESSION_ID": "true",
    "OTEL_LOG_USER_PROMPTS": "1",
    "OTEL_LOG_TOOL_DETAILS": "1"
  }
}
```

> **Warning**: Session-based analysis will not work unless `OTEL_METRICS_INCLUDE_SESSION_ID` is set to `"true"`.

### Step 2: Run Loggist

```bash
git clone https://github.com/<owner>/loggist.git
cd loggist
cp .env.example .env
# Edit LOGGIST_JWT_SECRET in .env
docker compose -f docker-compose.yml up -d
```

### Step 3: Access

Navigate to `http://localhost:3001`. On first access, you will be prompted to set a login password.

---

## Prerequisites

- Docker & Docker Compose
- Claude Code (version with OTEL telemetry support)

---

## Tech Stack

| Area | Technology |
|------|------------|
| Frontend | React 19, Vite 6, TanStack Query v5, zustand 5, Tailwind CSS v4, Radix UI |
| Backend | Hono 4, better-sqlite3, jose (JWT), ws |
| Infra | Docker Compose, OTel Collector, Prometheus, Loki |
| Dev Tools | TypeScript 5.7+, Vitest, Biome, tsup, pnpm |

---

## Development Setup

```bash
pnpm install
cp .env.example .env
# Edit LOGGIST_JWT_SECRET in .env

# Start infra (OTel Collector, Prometheus, Loki) + app dev server
docker compose up -d
pnpm dev
```

`docker compose up -d` automatically applies `docker-compose.override.yml`, which starts only the infrastructure services (the Loggist app container is disabled). `pnpm dev` launches Vite (HMR) + Hono server locally.

- Client: http://localhost:5173 (Vite proxies `/api` requests to the server)
- Server: http://localhost:3001

For production deployment, run everything in containers without the override:

```bash
docker compose -f docker-compose.yml up -d
```

### Environment Variables

Copy `.env.example` to `.env` and modify as needed.

| Variable | Default | Description |
|----------|---------|-------------|
| `LOGGIST_JWT_SECRET` | `your-secret-key-here` | JWT signing secret (must change) |
| `PROMETHEUS_URL` | `http://localhost:9090` | Prometheus address |
| `LOKI_URL` | `http://localhost:3100` | Loki address |

---

## Project Structure

```
loggist/
├── src/
│   ├── client/              # React SPA
│   │   ├── components/      # Shared UI components (layout, ui)
│   │   ├── hooks/           # Custom React hooks
│   │   ├── pages/           # Page components (budget, overview, sessions, ...)
│   │   ├── stores/          # zustand state stores
│   │   └── lib/             # Utilities
│   └── server/              # Hono server
│       ├── db/              # SQLite initialization and queries
│       ├── middleware/       # auth, rate-limit, security-headers
│       ├── realtime/        # Loki tail WebSocket + SSE fan-out
│       ├── routes/          # API routes (budget, sessions, metrics, logs, events)
│       ├── services/        # Prometheus/Loki clients
│       └── workers/         # Background workers (budget-checker)
├── config/                  # OTel Collector, Prometheus, Loki config files
├── tests/                   # Server-side tests (Vitest)
├── docker-compose.yml
└── .env.example
```

---

## Testing

```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
pnpm lint              # Biome lint
```

138 tests, 91%+ coverage (server-side).

---

## Architecture

```
Claude Code CLI
  │ gRPC (:4317)
  ▼
OTel Collector
  ├──→ Prometheus (:9090) ── Metrics
  └──→ Loki (:3100) ──────── Structured Logs
          │
          ▼
     Loggist (:3001)
     ├── REST API (Prometheus/Loki proxy)
     ├── SSE (Loki tail → client broadcast)
     ├── SQLite (budgets, alerts)
     └── React SPA
```

Prometheus and Loki are exposed only on the Docker internal network (`backend`) and cannot be accessed externally. Only the Loggist server belongs to both networks (`frontend`, `backend`), serving as a proxy.

---

## License

MIT License
