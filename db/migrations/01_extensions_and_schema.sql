-- ============================================================================
-- INCIDENTZERO: 01_extensions_and_schema.sql
-- SRE Telemetry & Root-Cause Correlation Engine
-- 3NF Relational Schema with Strict Constraints
-- ============================================================================

-- 1. EXTENSIONS
-- vector: for 768-dimensional AI embeddings
-- uuid-ossp: for generating unique system UUIDs
-- pg_trgm: for trigram-based fuzzy string search (combines with vector search)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Clean slate if re-running migrations (Drops in reverse dependency order)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS root_causes CASCADE;
DROP TABLE IF EXISTS error_logs CASCADE;
DROP TABLE IF EXISTS incident_status_history CASCADE;
DROP TABLE IF EXISTS incidents CASCADE;
DROP TABLE IF EXISTS service_dependencies CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================================
-- TABLE 1: USERS & RBAC (Role-Based Access Control)
-- ============================================================================
-- Satisfies syllabus requirement for >= 2 roles (we have 3).
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('COMMANDER', 'SRE_LEAD', 'OBSERVER')),
    department VARCHAR(100) NOT NULL DEFAULT 'Core Infrastructure',
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLE 2: SERVICES (Microservice Topology)
-- ============================================================================
-- Defines each microservice (e.g., auth-service, payment-gateway).
CREATE TABLE services (
    service_id SERIAL PRIMARY KEY,
    service_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    tier VARCHAR(10) NOT NULL CHECK (tier IN ('TIER_0', 'TIER_1', 'TIER_2', 'TIER_3')),
    owner_team VARCHAR(100) NOT NULL,
    sla_target_pct NUMERIC(5,2) NOT NULL DEFAULT 99.90 
        CHECK (sla_target_pct > 0 AND sla_target_pct <= 100.00),
    status VARCHAR(20) NOT NULL DEFAULT 'OPERATIONAL' 
        CHECK (status IN ('OPERATIONAL', 'DEGRADED', 'OUTAGE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLE 3: SERVICE DEPENDENCIES (The Directed Acyclic Graph - DAG)
-- ============================================================================
-- Enables recursive CTE (WITH RECURSIVE) to calculate cascading failure risk.
CREATE TABLE service_dependencies (
    dependency_id SERIAL PRIMARY KEY,
    upstream_service_id INT NOT NULL REFERENCES services(service_id) ON DELETE CASCADE,
    downstream_service_id INT NOT NULL REFERENCES services(service_id) ON DELETE CASCADE,
    coupling_type VARCHAR(20) NOT NULL CHECK (coupling_type IN ('HARD_SYNC', 'SOFT_ASYNC', 'FALLBACK_CACHED')),
    propagation_prob NUMERIC(4,3) NOT NULL CHECK (propagation_prob BETWEEN 0.000 AND 1.000),
    CONSTRAINT uq_service_edge UNIQUE (upstream_service_id, downstream_service_id),
    CONSTRAINT chk_no_self_loop CHECK (upstream_service_id <> downstream_service_id)
);

-- ============================================================================
-- TABLE 4: INCIDENTS (Core Incident Lifecycle)
-- ============================================================================
CREATE TABLE incidents (
    incident_id SERIAL PRIMARY KEY,
    incident_number VARCHAR(20) UNIQUE NOT NULL, -- e.g., 'INC-2026-0001'
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('P1', 'P2', 'P3', 'P4')),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' 
        CHECK (status IN ('OPEN', 'INVESTIGATING', 'IDENTIFIED', 'MITIGATED', 'RESOLVED', 'CLOSED')),
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    service_id INT NOT NULL REFERENCES services(service_id) ON DELETE RESTRICT,
    assigned_to INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    declared_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mitigated_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    impact_radius_users INT NOT NULL DEFAULT 0 CHECK (impact_radius_users >= 0)
);

-- ============================================================================
-- TABLE 5: INCIDENT STATUS HISTORY (Timeline State Machine)
-- ============================================================================
-- Automatically populated by our database triggers whenever status updates.
CREATE TABLE incident_status_history (
    history_id BIGSERIAL PRIMARY KEY,
    incident_id INT NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    previous_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_by INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- ============================================================================
-- TABLE 6: ERROR LOGS (Telemetry & Vector Space)
-- ============================================================================
-- Stores raw stack traces AND the 768-dimensional pgvector embedding.
CREATE TABLE error_logs (
    log_id BIGSERIAL PRIMARY KEY,
    incident_id INT NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    log_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    log_level VARCHAR(10) NOT NULL CHECK (log_level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')),
    source_service VARCHAR(100) NOT NULL,
    environment VARCHAR(20) NOT NULL DEFAULT 'production' 
        CHECK (environment IN ('production', 'staging', 'canary')),
    fingerprint VARCHAR(64) NOT NULL, -- MD5 hash of normalized stack trace
    message TEXT NOT NULL,
    stack_trace TEXT,
    payload_metadata JSONB DEFAULT '{}'::JSONB,
    embedding VECTOR(768) NOT NULL -- 768 dimensions for Gemini / LSH fallback
);

-- ============================================================================
-- TABLE 7: ROOT CAUSES (Post-Mortems & Resolutions)
-- ============================================================================
-- 1:1 relationship with incidents (UNIQUE constraint on incident_id).
CREATE TABLE root_causes (
    root_cause_id SERIAL PRIMARY KEY,
    incident_id INT NOT NULL UNIQUE REFERENCES incidents(incident_id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'DATABASE_DEADLOCK', 'MEMORY_LEAK', 'NETWORK_TIMEOUT', 
        'BAD_DEPLOYMENT', 'CONFIG_DRIFT', 'DEPENDENCY_OUTAGE', 'SECURITY_ANOMALY'
    )),
    summary TEXT NOT NULL,
    root_cause_details TEXT NOT NULL,
    prevention_action_items JSONB NOT NULL DEFAULT '[]'::JSONB,
    resolved_by INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    resolved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    time_to_detect_minutes INT CHECK (time_to_detect_minutes >= 0),
    time_to_resolve_minutes INT CHECK (time_to_resolve_minutes >= 0)
);

-- ============================================================================
-- TABLE 8: AUDIT LOGS (Change Data Capture - CDC)
-- ============================================================================
-- Stores before/after JSONB snapshots populated automatically by audit triggers.
CREATE TABLE audit_logs (
    audit_id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id BIGINT NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    changed_by INT REFERENCES users(user_id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    old_values JSONB,
    new_values JSONB
);