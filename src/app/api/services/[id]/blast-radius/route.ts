import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';

// GET /api/services/[id]/blast-radius - Runs our Recursive CTE function!
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await query(
      `SELECT * FROM fn_compute_blast_radius($1::int)`,
      [id]
    );

    return NextResponse.json({
      status: 'SUCCESS',
      root_service_id: Number(id),
      downstream_impact_count: result.rows.length,
      latency_ms: result.duration,
      blast_radius_dag: result.rows,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}