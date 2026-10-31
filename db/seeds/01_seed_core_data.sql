-- ============================================================================
-- INCIDENTZERO: 01_seed_core_data.sql
-- Seed Data for SRE Infrastructure, Incidents, Post-Mortems, and Telemetry
-- ============================================================================

-- 1. SEED USERS (Passwords hashed: 'password123')
INSERT INTO users (full_name, email, role, department, password_hash) VALUES
('Aditya Raj', 'aditya.raj@incidentzero.internal', 'COMMANDER', 'Core SRE', '$2a$10$X8m1c4d2e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6'),
('Alakh Gupta', 'alakh.gupta@incidentzero.internal', 'SRE_LEAD', 'Platform Reliability', '$2a$10$X8m1c4d2e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6'),
('Sarah Chen', 'sarah.chen@incidentzero.internal', 'SRE_LEAD', 'Database Infrastructure', '$2a$10$X8m1c4d2e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6'),
('Marcus Vance', 'marcus.vance@incidentzero.internal', 'COMMANDER', 'Core SRE', '$2a$10$X8m1c4d2e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6'),
('Elena Rostova', 'elena.rostova@incidentzero.internal', 'OBSERVER', 'Security & Compliance', '$2a$10$X8m1c4d2e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6'),
('Devin Thorne', 'devin.thorne@incidentzero.internal', 'OBSERVER', 'DevOps Observer', '$2a$10$X8m1c4d2e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6')
ON CONFLICT (email) DO NOTHING;

-- 2. SEED SERVICES
INSERT INTO services (service_name, description, tier, owner_team, sla_target_pct, status) VALUES
('auth-service', 'OAuth2 & JWT Token verification service', 'TIER_0', 'Identity Team', 99.99, 'OPERATIONAL'),
('payment-gateway', 'Stripe & PayPal financial transaction processor', 'TIER_0', 'Billing Core', 99.99, 'OPERATIONAL'),
('order-processor', 'E-commerce checkout and cart state machine', 'TIER_1', 'Commerce Team', 99.90, 'OPERATIONAL'),
('inventory-api', 'Real-time warehouse stock tracking and lock manager', 'TIER_1', 'Supply Chain', 99.90, 'OPERATIONAL'),
('notification-worker', 'Asynchronous push notifications, SMS, and email dispatcher', 'TIER_2', 'Engagement Team', 99.50, 'OPERATIONAL'),
('analytics-pipeline', 'Kafka-to-Clickhouse telemetry aggregation stream', 'TIER_2', 'Data Platform', 99.00, 'OPERATIONAL')
ON CONFLICT (service_name) DO NOTHING;

-- 3. SEED SERVICE DEPENDENCY GRAPH (For Recursive Blast-Radius CTE)
-- Upstream -> Downstream: If auth-service fails, payment-gateway has 95% outage risk!
INSERT INTO service_dependencies (upstream_service_id, downstream_service_id, coupling_type, propagation_prob) VALUES
(1, 2, 'HARD_SYNC', 0.950), -- auth-service -> payment-gateway
(1, 3, 'HARD_SYNC', 0.900), -- auth-service -> order-processor
(2, 3, 'HARD_SYNC', 0.850), -- payment-gateway -> order-processor
(3, 4, 'SOFT_ASYNC', 0.600), -- order-processor -> inventory-api
(3, 5, 'SOFT_ASYNC', 0.400), -- order-processor -> notification-worker
(4, 6, 'FALLBACK_CACHED', 0.200) -- inventory-api -> analytics-pipeline
ON CONFLICT DO NOTHING;

-- 4. SEED HISTORICAL RESOLVED INCIDENTS (For AI Vector Matching)
INSERT INTO incidents (incident_number, title, description, severity, status, priority, service_id, assigned_to, declared_at, mitigated_at, resolved_at, impact_radius_users) VALUES
('INC-2026-0001', 'PostgreSQL Max Connection Pool Exhaustion under Black Friday Load', 'Backend connection pool starved, throwing 500 Internal Server Errors to client apps', 'P1', 'RESOLVED', 'CRITICAL', 1, 1, NOW() - INTERVAL '30 days', NOW() - INTERVAL '29 days 23 hours', NOW() - INTERVAL '29 days 22 hours', 15000),
('INC-2026-0002', 'Deadlock detected in inventory reservation lock table during flash sale', 'Concurrent transactions locked stock_items rows in reverse order', 'P2', 'RESOLVED', 'HIGH', 4, 3, NOW() - INTERVAL '20 days', NOW() - INTERVAL '19 days 23 hours', NOW() - INTERVAL '19 days 21 hours', 4200),
('INC-2026-0003', 'Stripe Webhook HMAC Signature Mismatch after Secret Key Rotation', 'Customer payments processed externally but webhook callbacks failing verification', 'P2', 'RESOLVED', 'HIGH', 2, 2, NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days 23 hours', NOW() - INTERVAL '9 days 22 hours', 1200),
('INC-2026-0004', 'Active P1: JWT Public Key Discovery Endpoint Timeout', 'Auth gateway cannot fetch jwks.json keys causing all login requests to fail 504', 'P1', 'OPEN', 'CRITICAL', 1, 1, NOW() - INTERVAL '25 minutes', NULL, NULL, 28000)
ON CONFLICT (incident_number) DO NOTHING;

-- 5. SEED ROOT CAUSES (Post-Mortem Playbooks)
INSERT INTO root_causes (incident_id, category, summary, root_cause_details, prevention_action_items, resolved_by, resolved_at, time_to_detect_minutes, time_to_resolve_minutes) VALUES
(1, 'DATABASE_DEADLOCK', 'Connection leak in idle client release inside Express middleware', 'Clients disconnecting during HTTP 499 aborted requests left open PostgreSQL connections until pool max 100 was reached.', '["Add connection leak telemetry to Prometheus", "Tune idle_in_transaction_session_timeout to 10s", "Increase pool size to 250"]'::JSONB, 2, NOW() - INTERVAL '29 days 22 hours', 8, 45),
(2, 'DATABASE_DEADLOCK', 'Inconsistent row acquisition lock order across cart checkout and order verification', 'Tx1 acquired item A then B; Tx2 acquired item B then A. Classic cycle deadlock (SQLSTATE 40P01).', '["Enforce deterministic order by product_id ASC before SELECT FOR UPDATE", "Add unit test simulating concurrent checkout"]'::JSONB, 3, NOW() - INTERVAL '19 days 21 hours', 15, 60),
(3, 'SECURITY_ANOMALY', 'Stale webhook signing secret cached in Redis replica', 'Secret key rotation script updated primary Redis node but replica had 15-minute sync delay.', '["Add cache bust on secret rotation", "Grace period allowing dual-secret signature validation"]'::JSONB, 2, NOW() - INTERVAL '9 days 22 hours', 5, 30)
ON CONFLICT (incident_id) DO NOTHING;

-- 6. SEED ERROR LOGS WITH 768-DIMENSIONAL VECTORS
-- Notice: Vector 1 has high weight on indices 0-5 (representing connection pool tokens)
-- Vector 2 has high weight on indices 10-15 (representing deadlock tokens)
-- Vector 3 has high weight on indices 20-25 (representing auth/crypto tokens)
INSERT INTO error_logs (incident_id, log_level, source_service, environment, fingerprint, message, stack_trace, payload_metadata, embedding) VALUES
(
    1, 'FATAL', 'auth-service', 'production', 'md5_pool_exhausted_001',
    'ConnectionPoolExhaustedException: Timeout waiting for connection from pool (10000ms)',
    'at Pool.acquire (/node_modules/pg-pool/index.js:312:11)\nat Client.query (/src/db/client.ts:45:19)\nat AuthMiddleware.verifyToken (/src/middleware/auth.ts:18:24)',
    '{"pool_size": 100, "active_clients": 100, "waiting_clients": 42}'::JSONB,
    -- 768-d unit-normalized vector with pool-signature features:
    (SELECT ('[' || string_agg(CASE WHEN i BETWEEN 1 AND 5 THEN '0.447' ELSE '0.001' END, ',') || ']')::vector(768) FROM generate_series(1, 768) i)
),
(
    2, 'ERROR', 'inventory-api', 'production', 'md5_deadlock_002',
    'PostgresError: deadlock detected (SQLSTATE 40P01). Process 18422 waits for ExclusiveLock on tuple (42, 19)',
    'at parseErrorMessage (/node_modules/pg-protocol/dist/parser.js:287:98)\nat checkDeadlock (/src/inventory/stock.ts:89:12)',
    '{"blocked_pid": 18422, "blocking_pid": 18430, "table": "stock_items"}'::JSONB,
    -- 768-d unit-normalized vector with deadlock-signature features:
    (SELECT ('[' || string_agg(CASE WHEN i BETWEEN 10 AND 15 THEN '0.408' ELSE '0.001' END, ',') || ']')::vector(768) FROM generate_series(1, 768) i)
),
(
    3, 'WARN', 'payment-gateway', 'production', 'md5_stripe_sig_003',
    'WebhookSignatureVerificationFailed: No signatures found matching the expected signature for payload',
    'at Webhook.constructEvent (/node_modules/stripe/lib/Webhooks.js:65:15)\nat PaymentCallback (/src/routes/webhooks.ts:32:18)',
    '{"provider": "stripe", "status_code": 400}'::JSONB,
    -- 768-d unit-normalized vector with webhook-signature features:
    (SELECT ('[' || string_agg(CASE WHEN i BETWEEN 20 AND 25 THEN '0.408' ELSE '0.001' END, ',') || ']')::vector(768) FROM generate_series(1, 768) i)
);