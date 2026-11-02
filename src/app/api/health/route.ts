import { NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';

export async function GET() {
  try {
    // Run live test queries across PostgreSQL
    const dbInfo = await query(`
      SELECT 
        version(),
        NOW() as server_time,
        (SELECT count(*) FROM services) as services_count,
        (SELECT count(*) FROM incidents) as incidents_count,
        (SELECT count(*) FROM error_logs) as telemetry_logs_count
    `);

    return NextResponse.json({
      status: 'HEALTHY',
      service: 'IncidentZero Core API',
      database: 'PostgreSQL 16 + pgvector',
      metrics: dbInfo.rows[0],
      query_latency_ms: dbInfo.duration,
    });
  } catch (error: any) {
    console.error('Database connection failed:', error);
    return NextResponse.json(
      {
        status: 'UNHEALTHY',
        error: error.message,
      },
      { status: 500 }
    );
  }
}