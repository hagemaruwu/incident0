-- ============================================================================
-- INCIDENTZERO: 04_sp_triage_and_vector_fn.sql
-- Advanced Database Feature: Atomic Triage Stored Procedure & Recursive DAG
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ATOMIC STORED PROCEDURE: Incident Triage with Thundering-Herd Lock
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_triage_incident(
    p_title VARCHAR(255),
    p_description TEXT,
    p_severity VARCHAR(10),
    p_priority VARCHAR(10),
    p_service_id INT,
    p_assigned_to INT,
    p_impact_radius INT,
    p_log_level VARCHAR(10),
    p_environment VARCHAR(20),
    p_message TEXT,
    p_stack_trace TEXT,
    p_payload_metadata JSONB,
    p_embedding VECTOR(768)
)
RETURNS TABLE (
    incident_id INT,
    incident_number VARCHAR(20),
    is_deduplicated BOOLEAN,
    service_status_updated VARCHAR(20)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_fingerprint VARCHAR(64);
    v_service_name VARCHAR(100);
    v_seq_num INT;
    v_inc_id INT;
    v_inc_num VARCHAR(20);
    v_is_dup BOOLEAN := FALSE;
    v_new_service_status VARCHAR(20);
BEGIN
    -- 1. Set session context for audit trigger
    PERFORM set_config('incidentzero.current_user_id', p_assigned_to::TEXT, true);

    -- 2. Fetch service name
    SELECT s.service_name INTO STRICT v_service_name
    FROM services s WHERE s.service_id = p_service_id;

    -- 3. Normalize stack trace (strip memory hex addresses like 0x7fff and line numbers)
    v_fingerprint := md5(
        p_service_id::TEXT || ':' || 
        regexp_replace(COALESCE(p_stack_trace, p_message), '0x[0-9a-fA-F]+|:[0-9]+', '', 'g')
    );

    -- 4. ACQUIRE TRANSACTION ADVISORY LOCK (Prevents race condition duplicate incidents)
    PERFORM pg_advisory_xact_lock(hashtextextended(v_fingerprint, 0));

    -- 5. Check if an active incident already exists for this exact error fingerprint
    SELECT i.incident_id, i.incident_number
    INTO v_inc_id, v_inc_num
    FROM incidents i
    INNER JOIN error_logs el ON el.incident_id = i.incident_id
    WHERE el.fingerprint = v_fingerprint
      AND i.status IN ('OPEN', 'INVESTIGATING')
    LIMIT 1;

    -- 6. If no active incident exists, create a new incident atomically
    IF v_inc_id IS NULL THEN
        SELECT COALESCE(MAX(i.incident_id), 0) + 1 INTO v_seq_num FROM incidents i;
        v_inc_num := FORMAT('INC-%s-%s', EXTRACT(YEAR FROM NOW())::INT, LPAD(v_seq_num::TEXT, 4, '0'));

        INSERT INTO incidents (
            incident_id, incident_number, title, description, severity, status, priority,
            service_id, assigned_to, declared_at, updated_at, impact_radius_users
        ) VALUES (
            v_seq_num, v_inc_num, p_title, p_description, p_severity, 'OPEN', p_priority,
            p_service_id, p_assigned_to, NOW(), NOW(), p_impact_radius
        )
        RETURNING incidents.incident_id INTO v_inc_id;

        v_is_dup := FALSE;
    ELSE
        -- Existing incident found: deduplicate!
        v_is_dup := TRUE;
    END IF;

    -- 7. Insert the error telemetry log with vector embedding linked to the incident
    INSERT INTO error_logs (
        incident_id, log_timestamp, log_level, source_service, environment,
        fingerprint, message, stack_trace, payload_metadata, embedding
    ) VALUES (
        v_inc_id, NOW(), p_log_level, v_service_name, p_environment,
        v_fingerprint, p_message, p_stack_trace, p_payload_metadata, p_embedding
    );

    -- 8. Cascade service status degradation based on severity
    IF p_severity = 'P1' THEN
        UPDATE services SET status = 'OUTAGE' WHERE services.service_id = p_service_id;
        v_new_service_status := 'OUTAGE';
    ELSIF p_severity = 'P2' THEN
        UPDATE services SET status = 'DEGRADED' 
        WHERE services.service_id = p_service_id AND services.status = 'OPERATIONAL';
        v_new_service_status := 'DEGRADED';
    ELSE
        SELECT s.status INTO v_new_service_status FROM services s WHERE s.service_id = p_service_id;
    END IF;

    -- 9. Return the result record
    RETURN QUERY SELECT v_inc_id, v_inc_num, v_is_dup, v_new_service_status;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. RECURSIVE CTE FUNCTION: Service Blast-Radius & Cascading Failure Risk
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_compute_blast_radius(p_root_service_id INT)
RETURNS TABLE (
    service_id INT,
    service_name VARCHAR(100),
    tier VARCHAR(10),
    hop_depth INT,
    cascade_risk_score NUMERIC(5,3),
    traversal_path INT[]
)
LANGUAGE sql
STABLE
AS $$
WITH RECURSIVE blast_radius_dag AS (
    -- Anchor Member: The root service experiencing the outage
    SELECT 
        s.service_id,
        s.service_name,
        s.tier,
        0 AS hop_depth,
        1.000::NUMERIC(5,3) AS cascade_risk_score,
        ARRAY[s.service_id] AS traversal_path
    FROM services s
    WHERE s.service_id = p_root_service_id

    UNION ALL

    -- Recursive Member: Traverse downstream dependencies
    SELECT 
        ds.service_id,
        ds.service_name,
        ds.tier,
        dag.hop_depth + 1,
        ROUND((dag.cascade_risk_score * sd.propagation_prob), 3)::NUMERIC(5,3),
        dag.traversal_path || ds.service_id
    FROM blast_radius_dag dag
    INNER JOIN service_dependencies sd ON dag.service_id = sd.upstream_service_id
    INNER JOIN services ds ON sd.downstream_service_id = ds.service_id
    WHERE NOT (ds.service_id = ANY(dag.traversal_path)) -- Cycle prevention guard
      AND dag.hop_depth < 5
)
SELECT 
    d.service_id,
    d.service_name,
    d.tier,
    d.hop_depth,
    d.cascade_risk_score,
    d.traversal_path
FROM blast_radius_dag d
ORDER BY d.cascade_risk_score DESC, d.hop_depth ASC;
$$;

-- ----------------------------------------------------------------------------
-- 3. STORED FUNCTION: Clean HNSW Vector Search Wrapper
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_find_correlated_root_causes(
    p_query_embedding VECTOR(768),
    p_similarity_threshold FLOAT DEFAULT 0.65,
    p_limit INT DEFAULT 5
)
RETURNS TABLE (
    matched_incident_id INT,
    incident_number VARCHAR(20),
    incident_title VARCHAR(255),
    severity VARCHAR(10),
    service_name VARCHAR(100),
    root_cause_category VARCHAR(50),
    root_cause_summary TEXT,
    prevention_action_items JSONB,
    resolved_by_engineer VARCHAR(100),
    time_to_resolve_minutes INT,
    cosine_similarity NUMERIC(5,4)
)
LANGUAGE sql
STABLE
AS $$
    SELECT DISTINCT ON (i.incident_id)
        i.incident_id AS matched_incident_id,
        i.incident_number,
        i.title AS incident_title,
        i.severity,
        s.service_name,
        rc.category AS root_cause_category,
        rc.summary AS root_cause_summary,
        rc.prevention_action_items,
        u.full_name AS resolved_by_engineer,
        rc.time_to_resolve_minutes,
        ROUND((1 - (el.embedding <=> p_query_embedding))::NUMERIC, 4) AS cosine_similarity
    FROM error_logs el
    INNER JOIN incidents i ON el.incident_id = i.incident_id
    INNER JOIN services s ON i.service_id = s.service_id
    INNER JOIN root_causes rc ON i.incident_id = rc.incident_id
    INNER JOIN users u ON rc.resolved_by = u.user_id
    WHERE el.embedding IS NOT NULL
      AND (1 - (el.embedding <=> p_query_embedding)) >= p_similarity_threshold
    ORDER BY i.incident_id, (el.embedding <=> p_query_embedding) ASC
    LIMIT p_limit;
$$;