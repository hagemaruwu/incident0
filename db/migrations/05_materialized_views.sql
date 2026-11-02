-- ============================================================================
-- INCIDENTZERO: 05_materialized_views.sql
-- Materialized View: 30-Day Service Reliability, MTTR & SLA Availability Summary
-- Advanced Database Feature: Concurrent OLAP Aggregation off Hot OLTP Path
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_service_incident_summary CASCADE;

CREATE MATERIALIZED VIEW mv_service_incident_summary AS
SELECT
    s.service_id,
    s.service_name,
    s.tier AS service_tier,
    s.sla_target_pct,

    -- Volume Metrics (30-Day Rolling Window)
    COUNT(i.incident_id) AS total_incidents_30d,
    COUNT(i.incident_id) FILTER (
        WHERE i.severity IN ('P1', 'P2')
    ) AS critical_incidents_30d,
    COUNT(i.incident_id) FILTER (
        WHERE i.status IN ('OPEN', 'INVESTIGATING', 'MITIGATED')
    ) AS active_incidents_30d,

    -- Resolution Latency Metrics (MTTR & P95 in Minutes)
    ROUND(
        COALESCE(
            AVG(EXTRACT(EPOCH FROM (i.resolved_at - i.declared_at)) / 60.0)
            FILTER (WHERE i.resolved_at IS NOT NULL),
            0.0
        )::NUMERIC,
        2
    ) AS avg_mttr_minutes_30d,

    ROUND(
        COALESCE(
            PERCENTILE_CONT(0.95) WITHIN GROUP (
                ORDER BY EXTRACT(EPOCH FROM (i.resolved_at - i.declared_at)) / 60.0
            ) FILTER (WHERE i.resolved_at IS NOT NULL),
            0.0
        )::NUMERIC,
        2
    ) AS p95_mttr_minutes_30d,

    -- 30-Day SLA Availability Percentage (30 days = 43,200 minutes)
    ROUND(
        GREATEST(
            0.0,
            100.0 - (
                COALESCE(
                    SUM(
                        EXTRACT(EPOCH FROM (
                            COALESCE(i.resolved_at, NOW()) - 
                            GREATEST(i.declared_at, NOW() - INTERVAL '30 days')
                        )) / 60.0
                    ),
                    0.0
                ) / 43200.0 * 100.0
            )
        )::NUMERIC,
        4
    ) AS availability_pct_30d,

    MAX(i.declared_at) AS last_incident_at,
    NOW() AS refreshed_at

FROM services s
LEFT JOIN incidents i
    ON s.service_id = i.service_id
    AND i.declared_at >= NOW() - INTERVAL '30 days'
GROUP BY s.service_id, s.service_name, s.tier, s.sla_target_pct
WITH DATA;

-- Mandatory UNIQUE index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_service_incident_summary_pk
    ON mv_service_incident_summary (service_id);

-- Secondary covering index for fast SLA leaderboard / worst-offender sorting
CREATE INDEX idx_mv_service_incident_summary_sla
    ON mv_service_incident_summary (availability_pct_30d ASC, critical_incidents_30d DESC);
