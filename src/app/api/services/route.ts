import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';

export async function GET() {
  try {
    const result = await query(`
      SELECT 
        s.service_id,
        s.service_name,
        s.description,
        s.tier,
        s.owner_team,
        s.sla_target_pct,
        s.status,
        COUNT(CASE WHEN i.status IN ('OPEN', 'INVESTIGATING') THEN 1 END) AS active_incidents_count
      FROM services s
      LEFT JOIN incidents i ON s.service_id = i.service_id
      GROUP BY s.service_id
      ORDER BY s.tier ASC, s.service_name ASC
    `);

    return NextResponse.json({
      status: 'SUCCESS',
      services: result.rows,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}