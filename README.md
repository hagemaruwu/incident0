# IncidentZero: Intelligent SRE Telemetry & Root-Cause Correlation Engine

> **DBMS Experiential Learning — Level 3 Capstone Project**  
> **Course Instructor:** Dr. Nagasundari S, Department of Computer Science & Engineering, PES University  
> **Team:**  
> - **Aditya Raj** (PES2UG24CS033) — Database Core Architecture, HNSW Vector Engine & REST API  
> - **Alakh Gupta** (PES2UG24CS051) — Database Triggers, Analytics Pipeline, Service Topology & UI  

---

## 1. System Overview

IncidentZero is an enterprise Site Reliability Engineering (SRE) incident response platform that eliminates manual war-room coordination by using a database-native telemetry triage and root-cause correlation engine.

Instead of separating relational metadata from embeddings with a distributed dual-write setup, IncidentZero unifies relational operations and high-dimensional vector search inside **PostgreSQL 16 with pgvector 0.8.7**.

```
                           ┌───────────────────────────────┐
                           │   Next.js 15 Web Interface   │
                           │  (War Room, Triage, Topology) │
                           └───────────────┬───────────────┘
                                           │ Parameterized SQL ($1..$n)
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PostgreSQL 16 Container                                │
│                                                                                        │
│  ┌─────────────────────────┐  ┌───────────────────────────┐  ┌──────────────────────┐  │
│  │   8 Relational Tables   │  │   Procedural PL/pgSQL     │  │  pgvector Extension  │  │
│  │  (Strict 3NF, Domain    │  │  (sp_triage_incident with │  │  (768-d HNSW Index:  │  │
│  │   CHECKs, Foreign Keys) │  │   64-bit Advisory Locks)  │  │   m=16, ef_build=64) │  │
│  └───────────┬─────────────┘  └─────────────┬─────────────┘  └──────────┬───────────┘  │
│              │                              │                           │              │
│              ▼                              ▼                           ▼              │
│  ┌─────────────────────────┐  ┌───────────────────────────┐  ┌──────────────────────┐  │
│  │  BEFORE/AFTER Triggers  │  │  Recursive CTE Graph DAG  │  │  Concurrent MV       │  │
│  │  (State Machine & CDC)  │  │  (Blast-Radius Prediction)│  │  (30-Day MTTR/SLAs)  │  │
│  └─────────────────────────┘  └───────────────────────────┘  └──────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Highlights

1. **Atomic Triage & Deduplication (`sp_triage_incident`)**:
   - Computes an MD5 fingerprint from the service ID and normalized error trace.
   - Takes a 64-bit transaction-level advisory lock (`pg_advisory_xact_lock`) to serialize incoming alert storms in shared memory without locking non-existent rows.
   - Deduplicates identical active errors into `error_logs` while assigning atomic sequence values (`nextval`) to novel incidents.
   - Automatically cascades service health to `OUTAGE` (P1) or `DEGRADED` (P2).

2. **HNSW Vector Cosine Distance Search (`fn_find_correlated_root_causes`)**:
   - Indexes 768-dimensional error embeddings using Hierarchical Navigable Small World graphs (`m=16, ef_construction=64, vector_cosine_ops`).
   - Uses subquery KNN ordering (`ORDER BY embedding <=> q LIMIT k`) to guarantee $O(\log N)$ index scan execution (1.4ms) and sorts final deduplicated matches by cosine similarity.

3. **Cascading Failure Blast-Radius (`fn_compute_blast_radius`)**:
   - Climbs the microservice dependency tree using a recursive Common Table Expression (`WITH RECURSIVE`).
   - Compounds failure propagation probabilities across hops while enforcing cycle exclusion via `WHERE NOT (ds.service_id = ANY(traversal_path))`.
   - Collapses diamond dependencies using `DISTINCT ON (service_id)` to enforce worst-case contagion dominance.

4. **Automated State Machine & CDC Audit Triggers**:
   - `trg_incident_timestamps`: BEFORE trigger auto-stamping `updated_at`, `mitigated_at`, `resolved_at`, and clearing stale resolution timestamps upon incident reopening.
   - `trg_incident_status_history`: AFTER trigger appending state transitions to the timeline and automatically restoring service status to `OPERATIONAL` when all active incidents are resolved.
   - `trg_audit_incidents` & `trg_audit_services`: Change Data Capture (CDC) triggers logging JSON old/new row diffs into `audit_logs`.

5. **Concurrent Materialized View (`mv_service_incident_summary`)**:
   - Pre-computes 30-day MTTR, P95 resolution latency, and SLA availability percentages off the hot transactional path.
   - Backed by a `UNIQUE INDEX` enabling non-blocking `REFRESH MATERIALIZED VIEW CONCURRENTLY`.

---

## 3. Database Schema (8 Tables in 3NF)

| Table | Primary Key | Description |
|---|---|---|
| `users` | `user_id SERIAL` | SRE engineers and commanders (RBAC: `COMMANDER`, `SRE_LEAD`, `OBSERVER`) |
| `services` | `service_id SERIAL` | Microservice catalog with SLAs, tiers (`TIER_0` to `TIER_3`), and status |
| `service_dependencies` | `dependency_id SERIAL` | Directed acyclic graph edges with coupling types and propagation probabilities |
| `incidents` | `incident_id SERIAL` | Incident lifecycle records (`OPEN`, `INVESTIGATING`, `MITIGATED`, `RESOLVED`, `CLOSED`) |
| `incident_status_history` | `history_id BIGSERIAL` | Append-only state transition audit trail populated by database triggers |
| `error_logs` | `log_id BIGSERIAL` | Telemetry logs holding stack traces, MD5 fingerprints, JSON metadata, and `VECTOR(768)` |
| `root_causes` | `root_cause_id SERIAL` | Post-mortem resolutions with `prevention_action_items` (JSONB) linked to incidents |
| `audit_logs` | `audit_id BIGSERIAL` | Change Data Capture (CDC) log capturing table operations, JSON diffs, and actor IDs |

---

## 4. Quickstart & Setup

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (tested on Node 20 / 22)
- npm

### 1. Launch PostgreSQL 16 + pgvector
```bash
docker compose up -d
```

### 2. Verify Database Connection
```bash
docker exec -i incidentzero_db psql -U postgres -d incidentzero -c "SELECT version();"
```

### 3. Run Automated Regression Test
```bash
npm test
# Runs isolated smoke test wrapped in BEGIN ... ROLLBACK:
# ✔ sp_triage_incident: creates incident and deduplicates identical telemetry inside ROLLBACK (47ms)
```

### 4. Start Next.js Development Server
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser.

---

## 5. Web Interface Routes

- **`/` (Live SRE War Room)**: Real-time telemetry dashboard with live KPI counters, severity filters, and inline status transition dropdowns.
- **`/incidents/new` (AI Triage Studio)**: Split-screen incident declaration with 400ms debounced vector search and 1-click verified playbook attachment.
- **`/incidents/[id]` (Incident Dossier)**: Interactive post-mortem viewer displaying error logs, stack fingerprints, and the database trigger audit timeline.
- **`/services` (Service Topology)**: Microservice catalog and recursive blast-radius cascading failure graph visualizer.
- **`/evaluation` (Professor Evaluation Lab)**: Interactive rubric verification suite executing 7 complex queries (Multi-JOINs, HAVING, Analytic Window functions, Correlated subqueries, HNSW vector search, Recursive CTE, and Materialized Views) with EXPLAIN execution plans.

---

## 6. Testing & Verification

The test suite in [`test/triage.test.mjs`](test/triage.test.mjs) runs against PostgreSQL inside a transaction that unconditionally executes `ROLLBACK`:
- Validates novel incident creation and automatic service status cascade to `OUTAGE`.
- Validates 64-bit advisory locked deduplication on duplicate telemetry.
- Validates HNSW vector cosine similarity matching the best historical post-mortem (`1.0000`) rather than the lowest incident ID.
- Leaves zero synthetic test rows or sequence drift in the demonstration database.

```bash
npm test
```
