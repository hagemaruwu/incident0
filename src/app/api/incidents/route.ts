import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/pool";
import { getEmbedding } from "@/lib/vector/embedder";

// GET /api/incidents - Lists all incidents with multi-table JOIN
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const severity = searchParams.get("severity");

    let sql = `
      SELECT 
        i.incident_id,
        i.incident_number,
        i.title,
        i.description,
        i.severity,
        i.status,
        i.priority,
        s.service_name,
        s.tier AS service_tier,
        u.full_name AS assigned_engineer,
        i.declared_at,
        i.mitigated_at,
        i.resolved_at,
        i.impact_radius_users
      FROM incidents i
      JOIN services s ON i.service_id = s.service_id
      JOIN users u ON i.assigned_to = u.user_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      params.push(status);
      sql += ` AND i.status = $${params.length}`;
    }
    if (severity) {
      params.push(severity);
      sql += ` AND i.severity = $${params.length}`;
    }

    sql += ` ORDER BY i.declared_at DESC`;

    const result = await query(sql, params);

    return NextResponse.json({
      status: "SUCCESS",
      count: result.rows.length,
      incidents: result.rows,
    });
  } catch (error: any) {
    console.error("Failed to fetch incidents:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/incidents - Triage new incident via sp_triage_incident
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      severity = "P2",
      priority = "HIGH",
      service_id = 1,
      assigned_to = 1,
      impact_radius = 500,
      log_level = "ERROR",
      environment = "production",
      message,
      stack_trace = "",
      payload_metadata = {},
    } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Fields "title" and "message" are required.' },
        { status: 400 },
      );
    }

    // 1. Generate 768-d vector embedding
    const { vector } = await getEmbedding(`${message}\n${stack_trace}`);
    const vectorString = `[${vector.join(",")}]`;

    // 2. Invoke our atomic stored procedure sp_triage_incident!
    const result = await query(
      `SELECT * FROM sp_triage_incident(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::vector
      )`,
      [
        title,
        description || title,
        severity,
        priority,
        service_id,
        assigned_to,
        impact_radius,
        log_level,
        environment,
        message,
        stack_trace,
        JSON.stringify(payload_metadata),
        vectorString,
      ],
    );

    const triageResult = result.rows[0];

    return NextResponse.json(
      {
        status: "SUCCESS",
        triage: triageResult,
        message: triageResult.is_deduplicated
          ? "Duplicate error detected. Telemetry attached to active incident."
          : "New incident declared and service status updated.",
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("Failed to triage incident:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
