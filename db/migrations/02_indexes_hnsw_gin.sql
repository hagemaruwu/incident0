-- ============================================================================
-- INCIDENTZERO: 02_indexes_hnsw_gin.sql
-- High-Performance B-Tree, GIN, and HNSW Vector Indexing
-- ============================================================================

-- 1. B-TREE INDEXES ON FOREIGN KEYS & FILTER COLUMNS
-- Speeds up JOIN operations between incidents, services, and users
CREATE INDEX IF NOT EXISTS idx_incidents_service ON incidents(service_id);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned ON incidents(assigned_to);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_incident ON error_logs(incident_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_fingerprint ON error_logs(fingerprint);
CREATE INDEX IF NOT EXISTS idx_status_history_incident ON incident_status_history(incident_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_upstream ON service_dependencies(upstream_service_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_downstream ON service_dependencies(downstream_service_id);

-- 2. GIN INDEXES ON JSONB DOCUMENTS
-- Allows fast searching inside JSON payloads without scanning table rows
CREATE INDEX IF NOT EXISTS idx_error_logs_metadata_gin ON error_logs USING gin (payload_metadata);
CREATE INDEX IF NOT EXISTS idx_audit_logs_newvalues_gin ON audit_logs USING gin (new_values);
CREATE INDEX IF NOT EXISTS idx_root_causes_prevention_gin ON root_causes USING gin (prevention_action_items);

-- 3. HNSW (Hierarchical Navigable Small World) VECTOR INDEX
-- m = 16: number of bidirectional connections per vector node in the graph
-- ef_construction = 64: size of dynamic candidate list evaluated during index build
-- vector_cosine_ops: tells pgvector to optimize for cosine distance (<=>)
CREATE INDEX IF NOT EXISTS idx_error_logs_embedding_hnsw 
ON error_logs USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);