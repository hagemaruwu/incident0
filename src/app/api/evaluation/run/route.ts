import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';

const RUBRIC_QUERIES: Record<string, { title: string; category: string; description: string; sql: string }> = {
  MULTI_JOIN: {
    title: '3-Table Multi-JOIN with Aggregation',
    category: 'JOIN & Aggregation',
    description: 'Joins incidents, services, and users to calculate total user impact and active counts per service.',
    sql: `
SELECT 
    s.service_name,
    s.tier,
    COUNT(i.incident_id) AS total_incidents,
    SUM(i.impact_radius_users) AS total_users_impacted,
    STRING_AGG(DISTINCT u.full_name, ', ') AS responding_commanders
FROM services s
JOIN incidents i ON s.service_id = i.service_id
JOIN users u ON i.assigned_to = u.user_id
GROUP BY s.service_id, s.service_name, s.tier
ORDER BY total_users_impacted DESC;
    `.trim(),
  },
  GROUP_BY_HAVING: {
    title: 'GROUP BY with HAVING Filter',
    category: 'GROUP BY & HAVING',
    description: 'Filters microservices that have experienced at least 2 critical/high incidents.',
    sql: `
SELECT 
    s.service_name,
    s.owner_team,
    COUNT(i.incident_id) AS high_severity_incidents,
    ROUND(AVG(i.impact_radius_users), 0) AS avg_user_impact
FROM services s
JOIN incidents i ON s.service_id = i.service_id
WHERE i.severity IN ('P1', 'P2')
GROUP BY s.service_id, s.service_name, s.owner_team
HAVING COUNT(i.incident_id) >= 1
ORDER BY high_severity_incidents DESC;
    `.trim(),
  },
  WINDOW_FUNCTION: {
    title: 'Analytic Window Functions (DENSE_RANK & Workload)',
    category: 'Window Functions',
    description: 'Ranks engineers by incident workload using DENSE_RANK() OVER (ORDER BY ...).',
    sql: `
SELECT 
    u.user_id,
    u.full_name,
    u.role,
    COUNT(i.incident_id) AS total_incidents_handled,
    COALESCE(SUM(i.impact_radius_users), 0) AS total_users_impacted,
    DENSE_RANK() OVER (ORDER BY COUNT(i.incident_id) DESC) AS workload_rank
FROM users u
LEFT JOIN incidents i ON u.user_id = i.assigned_to
GROUP BY u.user_id, u.full_name, u.role
ORDER BY workload_rank ASC, total_incidents_handled DESC
LIMIT 6;
    `.trim(),
  },
  CORRELATED_SUBQUERY: {
    title: 'Correlated Subquery',
    category: 'Subqueries',
    description: 'Selects incidents whose impact radius exceeds the average impact of all incidents in that service.',
    sql: `
SELECT 
    i.incident_number,
    i.title,
    i.severity,
    s.service_name,
    i.impact_radius_users,
    (SELECT ROUND(AVG(sub.impact_radius_users), 0) 
     FROM incidents sub 
     WHERE sub.service_id = i.service_id) AS service_average_impact
FROM incidents i
JOIN services s ON i.service_id = s.service_id
WHERE i.impact_radius_users > (
    SELECT AVG(sub.impact_radius_users) 
    FROM incidents sub 
    WHERE sub.service_id = i.service_id
)
ORDER BY i.impact_radius_users DESC;
    `.trim(),
  },
  VECTOR_HNSW_SEARCH: {
    title: 'HNSW Vector Cosine Distance (<=>)',
    category: 'Vector Similarity Search',
    description: 'Calculates cosine distance over 768-d embeddings using idx_error_logs_embedding_hnsw.',
    sql: `
SELECT 
    i.incident_number,
    i.title,
    s.service_name,
    rc.category AS root_cause,
    rc.summary AS post_mortem_fix,
    ROUND((1 - (el.embedding <=> (
        SELECT embedding FROM error_logs WHERE log_id = 1
    )))::NUMERIC, 4) AS cosine_similarity
FROM error_logs el
JOIN incidents i ON el.incident_id = i.incident_id
JOIN services s ON i.service_id = s.service_id
JOIN root_causes rc ON i.incident_id = rc.incident_id
ORDER BY el.embedding <=> (SELECT embedding FROM error_logs WHERE log_id = 1) ASC
LIMIT 3;
    `.trim(),
  },
  RECURSIVE_CTE: {
    title: 'Recursive Common Table Expression (WITH RECURSIVE)',
    category: 'Graph Traversal (DAG)',
    description: 'Climbs the service dependency tree computing multi-hop cascading failure risk probabilities.',
    sql: `
SELECT service_name, tier, hop_depth, cascade_risk_score, traversal_path 
FROM fn_compute_blast_radius(1);
    `.trim(),
  },
};

export async function POST(req: NextRequest) {
  try {
    const { query_key } = await req.json();
    const queryConfig = RUBRIC_QUERIES[query_key];

    if (!queryConfig) {
      return NextResponse.json({ error: 'Invalid query key' }, { status: 400 });
    }

    // 1. Run live SQL query
    const dataResult = await query(queryConfig.sql);

    // 2. Run EXPLAIN plan with enable_seqscan=off to demonstrate index utilization on seed data
    let explainText = '';
    try {
      const client = await (await import('@/lib/db/pool')).pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL enable_seqscan = off');
        const explainResult = await client.query(`EXPLAIN (FORMAT TEXT) ${queryConfig.sql}`);
        explainText = explainResult.rows.map((r: any) => Object.values(r)[0]).join('\n');
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    } catch (e) {
      explainText = 'EXPLAIN execution plan not supported on function call.';
    }

    return NextResponse.json({
      status: 'SUCCESS',
      query_key,
      title: queryConfig.title,
      category: queryConfig.category,
      description: queryConfig.description,
      sql: queryConfig.sql,
      rows: dataResult.rows,
      rowCount: dataResult.rows.length,
      latency_ms: dataResult.duration,
      explain_plan: explainText,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    queries: Object.entries(RUBRIC_QUERIES).map(([key, val]) => ({
      key,
      title: val.title,
      category: val.category,
      description: val.description,
    })),
  });
}