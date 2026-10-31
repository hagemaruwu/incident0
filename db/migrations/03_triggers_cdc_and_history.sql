-- ============================================================================
-- INCIDENTZERO: 03_triggers_cdc_and_history.sql
-- Advanced Database Feature: Automated State Machine & CDC Triggers
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TRIGGER 1: Incident Status Timeline & Automatic Timestamping
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_incident_status_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_actor_id INT;
BEGIN
    -- Extract actor from transaction session context (if set via API), fallback to assigned_to
    v_actor_id := COALESCE(
        NULLIF(current_setting('incidentzero.current_user_id', true), '')::INT,
        NEW.assigned_to
    );

    NEW.updated_at := NOW();

    -- CASE 1: New incident declaration
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO incident_status_history (
            incident_id, previous_status, new_status, changed_by, changed_at, notes
        ) VALUES (
            NEW.incident_id, NULL, NEW.status, v_actor_id, NOW(), 'Incident declared in system.'
        );

    -- CASE 2: Status transition on existing incident
    ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        -- Auto-stamp timestamps based on lifecycle stage
        IF (NEW.status = 'MITIGATED' AND OLD.mitigated_at IS NULL) THEN
            NEW.mitigated_at := NOW();
        END IF;

        IF (NEW.status IN ('RESOLVED', 'CLOSED') AND OLD.resolved_at IS NULL) THEN
            NEW.resolved_at := NOW();
        END IF;

        -- Record the transition in history table
        INSERT INTO incident_status_history (
            incident_id, previous_status, new_status, changed_by, changed_at, notes
        ) VALUES (
            NEW.incident_id, OLD.status, NEW.status, v_actor_id, NOW(),
            FORMAT('State transition: %s -> %s', OLD.status, NEW.status)
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incident_status_update ON incidents;
CREATE TRIGGER trg_incident_status_update
BEFORE INSERT OR UPDATE ON incidents
FOR EACH ROW
EXECUTE FUNCTION fn_trg_incident_status_update();

-- ----------------------------------------------------------------------------
-- TRIGGER 2: Generic Change Data Capture (CDC) Audit Trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_generic_audit_trail()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_actor_id INT;
    v_record_id BIGINT;
BEGIN
    v_actor_id := NULLIF(current_setting('incidentzero.current_user_id', true), '')::INT;

    IF (TG_OP = 'DELETE') THEN
        v_record_id := COALESCE(
            (to_jsonb(OLD)->>'incident_id')::BIGINT,
            (to_jsonb(OLD)->>'service_id')::BIGINT,
            0
        );
        INSERT INTO audit_logs (table_name, record_id, action, changed_by, changed_at, old_values, new_values)
        VALUES (TG_TABLE_NAME, v_record_id, 'DELETE', v_actor_id, NOW(), to_jsonb(OLD), NULL);
        RETURN OLD;

    ELSIF (TG_OP = 'UPDATE') THEN
        v_record_id := COALESCE(
            (to_jsonb(NEW)->>'incident_id')::BIGINT,
            (to_jsonb(NEW)->>'service_id')::BIGINT,
            0
        );
        -- Only record audit log if actual data payload changed
        IF to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
            INSERT INTO audit_logs (table_name, record_id, action, changed_by, changed_at, old_values, new_values)
            VALUES (TG_TABLE_NAME, v_record_id, 'UPDATE', v_actor_id, NOW(), to_jsonb(OLD), to_jsonb(NEW));
        END IF;
        RETURN NEW;

    ELSIF (TG_OP = 'INSERT') THEN
        v_record_id := COALESCE(
            (to_jsonb(NEW)->>'incident_id')::BIGINT,
            (to_jsonb(NEW)->>'service_id')::BIGINT,
            0
        );
        INSERT INTO audit_logs (table_name, record_id, action, changed_by, changed_at, old_values, new_values)
        VALUES (TG_TABLE_NAME, v_record_id, 'INSERT', v_actor_id, NOW(), NULL, to_jsonb(NEW));
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$;

-- Attach CDC Audit Trigger to core tables
DROP TRIGGER IF EXISTS trg_audit_incidents ON incidents;
CREATE TRIGGER trg_audit_incidents
AFTER INSERT OR UPDATE OR DELETE ON incidents
FOR EACH ROW
EXECUTE FUNCTION fn_trg_generic_audit_trail();

DROP TRIGGER IF EXISTS trg_audit_services ON services;
CREATE TRIGGER trg_audit_services
AFTER INSERT OR UPDATE OR DELETE ON services
FOR EACH ROW
EXECUTE FUNCTION fn_trg_generic_audit_trail();