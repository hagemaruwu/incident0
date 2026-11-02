-- ============================================================================
-- INCIDENTZERO: 03_triggers_cdc_and_history.sql (FIXED & REFINED)
-- Advanced Database Feature: Automated State Machine & CDC Triggers
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BEFORE TRIGGER: Automatically stamp timestamps on incidents
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_incident_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();

    -- Automatically stamp mitigated_at / resolved_at on status changes
    IF (TG_OP = 'UPDATE') THEN
        -- Reopening clears stale resolution timestamps
        IF (NEW.status = 'OPEN') THEN
            NEW.mitigated_at := NULL;
            NEW.resolved_at := NULL;
        ELSIF (NEW.status = 'INVESTIGATING') THEN
            NEW.resolved_at := NULL;
        ELSIF (NEW.status = 'MITIGATED') THEN
            NEW.resolved_at := NULL;
            IF (OLD.mitigated_at IS NULL) THEN
                NEW.mitigated_at := NOW();
            END IF;
        ELSIF (NEW.status IN ('RESOLVED', 'CLOSED')) THEN
            IF (OLD.resolved_at IS NULL) THEN
                NEW.resolved_at := NOW();
            END IF;
            IF (OLD.mitigated_at IS NULL) THEN
                NEW.mitigated_at := NOW();
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incident_timestamps ON incidents;
CREATE TRIGGER trg_incident_timestamps
BEFORE INSERT OR UPDATE ON incidents
FOR EACH ROW
EXECUTE FUNCTION fn_trg_incident_timestamps();

-- ----------------------------------------------------------------------------
-- 2. AFTER TRIGGER: Insert into incident_status_history (Parent exists!)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_incident_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_actor_id INT;
BEGIN
    v_actor_id := COALESCE(
        NULLIF(current_setting('incidentzero.current_user_id', true), '')::INT,
        NEW.assigned_to
    );

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO incident_status_history (
            incident_id, previous_status, new_status, changed_by, changed_at, notes
        ) VALUES (
            NEW.incident_id, NULL, NEW.status, v_actor_id, NOW(), 'Incident declared in system.'
        );

    ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO incident_status_history (
            incident_id, previous_status, new_status, changed_by, changed_at, notes
        ) VALUES (
            NEW.incident_id, OLD.status, NEW.status, v_actor_id, NOW(),
            FORMAT('State transition: %s -> %s', OLD.status, NEW.status)
        );

        -- Autonomous Service Reconciliation: if all active outages cleared, restore OPERATIONAL
        IF (NEW.status IN ('RESOLVED', 'CLOSED')) THEN
            IF NOT EXISTS (
                SELECT 1 FROM incidents 
                WHERE service_id = NEW.service_id 
                  AND status IN ('OPEN', 'INVESTIGATING', 'MITIGATED')
                  AND incident_id <> NEW.incident_id
            ) THEN
                UPDATE services SET status = 'OPERATIONAL' WHERE service_id = NEW.service_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incident_status_update ON incidents;
DROP TRIGGER IF EXISTS trg_incident_status_history ON incidents;
CREATE TRIGGER trg_incident_status_history
AFTER INSERT OR UPDATE ON incidents
FOR EACH ROW
EXECUTE FUNCTION fn_trg_incident_status_history();

-- ----------------------------------------------------------------------------
-- 3. AFTER TRIGGER: Generic Change Data Capture (CDC) Audit Trigger
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