import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';
import { getEmbedding } from '@/lib/vector/embedder';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { error_message, threshold = 0.50, limit = 5 } = body;

    if (!error_message || typeof error_message !== 'string') {
      return NextResponse.json(
        { error: 'Field "error_message" is required and must be a string' },
        { status: 400 }
      );
    }

    // 1. Generate 768-dimensional vector embedding
    const { vector, mode } = await getEmbedding(error_message);

    // Format vector as PostgreSQL string literal: '[0.021, -0.045, ...]'
    const vectorString = `[${vector.join(',')}]`;

    // 2. Query our PostgreSQL function fn_find_correlated_root_causes
    const result = await query(
      `SELECT * FROM fn_find_correlated_root_causes($1::vector, $2, $3)`,
      [vectorString, threshold, limit]
    );

    return NextResponse.json({
      status: 'SUCCESS',
      embedding_mode: mode,
      query_error: error_message,
      matches_found: result.rows.length,
      latency_ms: result.duration,
      correlated_incidents: result.rows,
    });
  } catch (error: any) {
    console.error('Vector correlation failed:', error);
    return NextResponse.json(
      { status: 'ERROR', error: error.message },
      { status: 500 }
    );
  }
}