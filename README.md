# Rubick AI — Retail SaaS Multi-Platform Catalog Intelligence Engine

> **Assignment Submission** — Full-stack prototype with system design, problem-solving, and leadership documentation.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Quick Start (Docker)](#quick-start-docker)
4. [Service Breakdown](#service-breakdown)
5. [API Reference](#api-reference)
6. [Key Design Decisions](#key-design-decisions)
7. [Documents](#documents)

---

## Project Overview

This repository contains a complete implementation of a **multi-platform catalog intelligence engine** that:

- **Crawls and normalises** product data from Amazon, Flipkart, and Myntra
- **Deduplicates** the same product across platforms using a 6-stage pipeline (rule-based → fuzzy → embedding → human review)
- **Enriches** product attributes (color, material, size, category) via a rule-based engine with optional LLM fallback
- **Tracks price history** with monthly-partitioned PostgreSQL tables and Redis caching
- **Streams live price updates** to the frontend via Server-Sent Events (SSE)
- **Visualises** everything in a React dashboard with search, comparison, and crawl monitoring

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend (Vite)                 │
│   ProductExplorer │ ProductDetail │ Compare │ Monitor    │
└──────────────────────────┬──────────────────────────────┘
                           │ REST + SSE
┌──────────────────────────▼──────────────────────────────┐
│              Fastify Backend API (Node.js)               │
│  /api/products  /api/prices  /api/dedup  /health        │
│  Rate-limiting · Redis cache · Cursor pagination         │
└──────────┬────────────────────────────┬─────────────────┘
           │ SQL                        │ HTTP
┌──────────▼──────────┐    ┌────────────▼────────────────┐
│  PostgreSQL 15       │    │   Python ML Service          │
│  - products          │    │   (FastAPI + rapidfuzz)      │
│  - price_history     │    │   /dedup/check               │
│    (partitioned)     │    │   /enrich                    │
│  - product_mappings  │    │   6-stage dedup pipeline     │
└─────────────────────┘    └─────────────────────────────┘
           │
┌──────────▼──────────┐
│  Redis 7             │
│  - Response cache    │
│  - Rate limit store  │
│  - Pub/Sub (SSE)     │
└─────────────────────┘
```

---

## Quick Start (Docker)

### Prerequisites
- Docker Desktop (or Docker Engine + Compose)
- Git

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/zuha-khalid-au3/rubick-ai-assignment.git
cd rubick-ai-assignment

# 2. Copy environment variables
cp .env.example .env
# (Optional) Add your OPENAI_API_KEY for LLM-fallback enrichment

# 3. Start all services
docker compose up --build

# 4. Run database migrations (in a new terminal)
docker compose exec backend node scripts/migrate.js

# 5. Seed with 50 sample products + 6 months price history
docker compose exec backend node scripts/seed.js

# 6. Open the app
open http://localhost:5173
```

### Service URLs

| Service | URL |
|---|---|
| React Frontend | http://localhost:5173 |
| Fastify Backend API | http://localhost:3001 |
| Python ML Service | http://localhost:8000 |
| API Health Check | http://localhost:3001/health |
| ML Health Check | http://localhost:8000/health |

---

## Service Breakdown

### Backend (Node.js + Fastify)

| File | Purpose |
|---|---|
| `src/index.js` | App entry point, SSE endpoint, plugin registration |
| `src/routes/products.js` | Cursor-based pagination, fuzzy search, compare endpoint |
| `src/routes/prices.js` | Price history, latest prices, SSE simulation |
| `src/routes/dedup.js` | Proxy to ML service for dedup and enrichment |
| `src/services/redis.js` | Redis client, TTL constants, jitter helper |
| `src/services/db.js` | PostgreSQL connection pool |
| `scripts/migrate.js` | Schema creation with partitioned tables and indexes |
| `scripts/seed.js` | 50 real Indian e-commerce products + price history |

### ML Service (Python + FastAPI)

| File | Purpose |
|---|---|
| `src/routes/dedup.py` | 6-stage deduplication pipeline |
| `src/routes/enrichment.py` | Rule-based enrichment + optional LLM fallback |
| `src/routes/health.py` | Health check endpoint |

### Frontend (React + Vite + Tailwind)

| Page | Route | Features |
|---|---|---|
| Product Explorer | `/` | Fuzzy search, category filter, cursor pagination |
| Product Detail | `/products/:id` | Price history chart (Recharts), live SSE updates |
| Comparison Board | `/compare` | Side-by-side price comparison, dedup demo |
| Crawl Monitor | `/monitor` | System health, crawl jobs, SSE simulation |

---

## API Reference

### Products

```
GET  /api/products?q=nike&category=Footwear&limit=20&cursor=<base64>
GET  /api/products/:id
GET  /api/products/compare?ids=id1,id2,id3
```

### Prices

```
GET  /api/prices/:productId/history?days=90
GET  /api/prices/latest
POST /api/prices/simulate   { productId, platform, newPrice }
```

### Deduplication

```
POST /api/dedup/check   { title1, title2, brand?, category? }
GET  /api/dedup/mappings
POST /api/dedup/enrich  { productId }
```

### Streaming

```
GET  /api/stream/prices   (SSE — text/event-stream)
```

---

## Key Design Decisions

### V1 Strategy: Ship Fast, Scale Smart

The architecture follows a deliberate **V1 → V2** progression:

- **V1 (now):** Monolithic Fastify API, single PostgreSQL instance, Redis cache, rule-based ML — deployable in minutes, zero vendor lock-in
- **V2 (when needed):** Kafka for crawl events, read replicas, Elasticsearch for search, microservice split

### Caching Strategy

Redis cache with **TTL jitter** (±10%) prevents thundering herd on cache expiry. TTLs are tuned by data volatility: prices expire in 60s, product listings in 5 minutes, categories in 1 hour.

### Deduplication Pipeline

Six stages with early exit to minimise compute cost:

1. **Pre-filter** — brand/category mismatch → immediate reject
2. **Size normalisation** — EU↔US shoe sizes, clothing size labels
3. **Title cleaning** — stopword removal, abbreviation expansion
4. **Fuzzy match** — `rapidfuzz.token_sort_ratio` ≥ 85% → confirmed match
5. **Embedding similarity** — `sentence-transformers/all-MiniLM-L6-v2` for borderline 65–84% cases
6. **Human review queue** — 55–65% confidence → flagged for manual review

### LLM Cost Control

Rule-based enrichment handles ~80% of products at zero cost. LLM (GPT-4o-mini) is invoked **only** when rule coverage falls below 80%, reducing token spend by ~60% versus LLM-first approaches.

---

## Documents

| Document | Description |
|---|---|
| [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md) | Part 1: Full system design with schemas, scaling strategy |
| [`docs/PROBLEM_SOLVING.md`](docs/PROBLEM_SOLVING.md) | Part 3: Dedup pipeline, scraping, 10x scale answers |
| [`docs/LEADERSHIP.md`](docs/LEADERSHIP.md) | Part 4: Team structure, code quality, ownership principles |
