import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password123@localhost:5432/incidentzero',
});

test('sp_triage_incident: creates incident and deduplicates identical telemetry inside ROLLBACK', async () => {
  const client = await pool.connect();
  try {
    // 1. Start transaction to isolate test mutations
    await client.query('BEGIN');

    const testVector = `[${new Array(768).fill('0.001').join(',')}]`;

    // 2. First call: novel incident declaration
    const firstCall = await client.query(
      `SELECT * FROM sp_triage_incident(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::vector
      )`,
      [
        'Test Synthetic Outage',
        'Automated smoke test description',
        'P1',
        'CRITICAL',
        1,
        1,
        500,
        'FATAL',
        'staging',
        'SyntheticConnectionTimeoutException: Test failure',
        'at TestRunner.execute (test/triage.test.mjs:25)',
        JSON.stringify({ test_run: true }),
        testVector,
      ]
    );

    const firstTriage = firstCall.rows[0];
    assert.equal(firstTriage.is_deduplicated, false, 'First declaration must create a new incident');
    assert.ok(firstTriage.incident_id > 0, 'Incident ID must be positive integer');
    assert.equal(firstTriage.service_status_updated, 'OUTAGE', 'P1 must set service status to OUTAGE');

    // 3. Second call: identical error trace (should deduplicate!)
    const secondCall = await client.query(
      `SELECT * FROM sp_triage_incident(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::vector
      )`,
      [
        'Test Synthetic Outage',
        'Automated smoke test description',
        'P1',
        'CRITICAL',
        1,
        1,
        500,
        'FATAL',
        'staging',
        'SyntheticConnectionTimeoutException: Test failure',
        'at TestRunner.execute (test/triage.test.mjs:25)',
        JSON.stringify({ test_run: true }),
        testVector,
      ]
    );

    const secondTriage = secondCall.rows[0];
    assert.equal(secondTriage.is_deduplicated, true, 'Second declaration with identical error must deduplicate');
    assert.equal(secondTriage.incident_id, firstTriage.incident_id, 'Deduplicated incident ID must match first incident');

    // 4. Test vector similarity function
    const vectorSearch = await client.query(
      `SELECT * FROM fn_find_correlated_root_causes($1::vector, 0.1, 3)`,
      [testVector]
    );
    assert.ok(Array.isArray(vectorSearch.rows), 'Vector correlation must return array of matches');

  } finally {
    // 5. Always rollback to keep demo database 100% clean
    await client.query('ROLLBACK');
    client.release();
  }
});

test.after(async () => {
  await pool.end();
});
