import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';

// GET /api/incidents/[id] - Complete incident details + timeline + telemetry
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const incRes = await query(
      `SELECT i.*, s.service_name, u.full_name AS assigned_engineer
       FROM incidents i
       JOIN services s ON i.service_id = s.service_id
       JOIN users u ON i.assigned_to = u.user_id
       WHERE i.incident_id = $1`,
      [id]
    );

    if (incRes.rows.length === 0) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    const historyRes = await query(
      `SELECT h.*, u.full_name AS changed_by_name
       FROM incident_status_history h
       JOIN users u ON h.changed_by = u.user_id
       WHERE h.incident_id = $1
       ORDER BY h.changed_at ASC`,
      [id]
    );

    const logsRes = await query(
      `SELECT log_id, log_timestamp, log_level, source_service, fingerprint, message, payload_metadata
       FROM error_logs
       WHERE incident_id = $1
       ORDER BY log_timestamp DESC`,
      [id]
    );

    const rootCauseRes = await query(
      `SELECT rc.*, u.full_name AS resolved_by_name
       FROM root_causes rc
       JOIN users u ON rc.resolved_by = u.user_id
       WHERE rc.incident_id = $1`,
      [id]
    );

    return NextResponse.json({
      status: 'SUCCESS',
      incident: incRes.rows[0],
      timeline: historyRes.rows,
      error_logs: logsRes.rows,
      root_cause: rootCauseRes.rows[0] || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/incidents/[id] - Update status (Fires our PL/pgSQL triggers)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, user_id = 1 } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const result = await query(
      `WITH actor_ctx AS (
         SELECT set_config('incidentzero.current_user_id', $1::text, true)
       )
       UPDATE incidents 
       SET status = $2, updated_at = NOW() 
       FROM actor_ctx
       WHERE incident_id = $3 
       RETURNING incidents.*`,
      [String(user_id), status, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    return NextResponse.json({
      status: 'SUCCESS',
      message: `Incident status updated to ${status}. Triggers fired.`,
      incident: result.rows[0],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}