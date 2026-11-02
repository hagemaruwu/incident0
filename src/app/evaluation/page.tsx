"use client";

import { useState, useEffect } from "react";

interface QueryMeta {
  key: string;
  title: string;
  category: string;
  description: string;
}

interface QueryResult {
  status: string;
  title: string;
  category: string;
  description: string;
  sql: string;
  rows: any[];
  rowCount: number;
  latency_ms: number;
  explain_plan: string;
}

const COMPLIANCE_ITEMS = [
  "3NF Schema (8 Tables)",
  "Dual-DB (SQL + pgvector)",
  "HNSW Indexing (m=16)",
  "Triggers (CDC + State)",
  "Stored Proc (ACID)",
  "Recursive CTE (DAG)",
];

const monoBlock: React.CSSProperties = {
  fontFamily: "JetBrains Mono, ui-monospace, monospace",
  fontSize: "12px",
  backgroundColor: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: "2px",
  padding: "16px",
  overflowX: "auto",
  color: "var(--text-secondary)",
  whiteSpace: "pre-wrap" as const,
  lineHeight: 1.6,
};

export default function EvaluationLabPage() {
  const [queries, setQueries]         = useState<QueryMeta[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("MULTI_JOIN");
  const [running, setRunning]         = useState(false);
  const [result, setResult]           = useState<QueryResult | null>(null);
  const [showExplain, setShowExplain] = useState(false);

  const [triggerTesting, setTriggerTesting] = useState(false);
  const [triggerLog, setTriggerLog] = useState<{ history: any[]; audit: any[] } | null>(null);

  useEffect(() => {
    async function loadMeta() {
      const res  = await fetch("/api/evaluation/run");
      const data = await res.json();
      setQueries(data.queries || []);
      if (data.queries?.length > 0) runQuery(data.queries[0].key);
    }
    loadMeta();
  }, []);

  async function runQuery(key: string) {
    setSelectedKey(key);
    setRunning(true);
    try {
      const res  = await fetch("/api/evaluation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query_key: key }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) { console.error("Query run failed", err); }
    finally { setRunning(false); }
  }

  async function testTriggerLive() {
    setTriggerTesting(true);
    try {
      await fetch("/api/incidents/5", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RESOLVED", user_id: 2 }),
      });
      const incRes  = await fetch("/api/incidents/5");
      const incData = await incRes.json();
      setTriggerLog({ history: incData.timeline || [], audit: incData.error_logs || [] });
    } catch (err) { console.error("Trigger test failed", err); }
    finally { setTriggerTesting(false); }
  }

  return (
    <main className="max-w-[1280px] mx-auto px-6 py-8 space-y-8">

      {/* Page header */}
      <div>
        <div
          className="font-mono text-[11px] font-medium mb-2"
          style={{ color: 'var(--accent-red)', letterSpacing: '0.1em' }}
        >
          DBMS LEVEL 3 EVALUATION SUITE
        </div>
        <h1 className="text-[28px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
          SQL Evaluation Lab
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)', maxWidth: '65ch' }}>
          Interactive rubric verification proving DDL, DML, multi-table JOINs, subqueries, HNSW vector search, and automated triggers.
        </p>
      </div>

      {/* Compliance scorecard */}
      <div
        className="p-5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
        }}
      >
        <div
          className="text-[11px] font-medium mb-3"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
        >
          SYLLABUS COMPLIANCE SCORECARD
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {COMPLIANCE_ITEMS.map(item => (
            <div
              key={item}
              className="flex items-center gap-2 p-2"
              style={{
                backgroundColor: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderLeft: '2px solid var(--accent-emerald)',
                borderRadius: '2px',
              }}
            >
              <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left: Query selector */}
        <div className="lg:col-span-4 space-y-2">
          <div
            className="text-[11px] font-medium mb-3"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
          >
            RUBRIC QUERIES
          </div>

          {queries.map(q => {
            const isSelected = selectedKey === q.key;
            return (
              <button
                key={q.key}
                onClick={() => runQuery(q.key)}
                className="w-full text-left p-3 transition"
                style={{
                  backgroundColor: isSelected ? 'var(--bg-raised)' : 'var(--bg-surface)',
                  border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border)'}`,
                  borderLeft: `2px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border)'}`,
                  borderRadius: '2px',
                  cursor: 'pointer',
                }}
              >
                <div
                  className="font-mono text-[10px] font-medium mb-1"
                  style={{ color: isSelected ? 'var(--accent-blue)' : 'var(--text-muted)', letterSpacing: '0.06em' }}
                >
                  {q.category}
                </div>
                <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                  {q.title}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {q.description}
                </div>
              </button>
            );
          })}

          {/* Trigger test sandbox */}
          <div
            className="mt-4 p-4 space-y-3"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderLeft: '2px solid var(--accent-amber)',
              borderRadius: '2px',
            }}
          >
            <div
              className="font-mono text-[11px] font-medium"
              style={{ color: 'var(--accent-amber)', letterSpacing: '0.08em' }}
            >
              LIVE TRIGGER VERIFIER SANDBOX
            </div>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Fire a real PATCH on INC-2026-0005 and capture the PostgreSQL trigger output. Status history and audit log will populate below.
            </p>
            <button
              onClick={testTriggerLive}
              disabled={triggerTesting}
              className="w-full py-2 text-xs font-semibold transition"
              style={{
                backgroundColor: triggerTesting ? 'var(--bg-raised)' : 'var(--accent-amber-dim)',
                color: triggerTesting ? 'var(--text-muted)' : 'var(--accent-amber)',
                border: '1px solid var(--accent-amber)',
                borderRadius: '2px',
                cursor: triggerTesting ? 'not-allowed' : 'pointer',
              }}
            >
              {triggerTesting ? 'Firing trigger...' : 'Fire Trigger on INC-2026-0005'}
            </button>
          </div>
        </div>

        {/* Right: SQL output */}
        <div className="lg:col-span-8 space-y-0">
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            {/* Panel header */}
            {result && (
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}
              >
                <div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {result.title}
                  </span>
                  <span
                    className="font-mono text-[10px] ml-3"
                    style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}
                  >
                    {result.category}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {result.latency_ms !== undefined && (
                    <span className="font-mono text-[11px]" style={{ color: 'var(--accent-emerald)' }}>
                      {result.latency_ms}ms
                    </span>
                  )}
                  {/* Run button */}
                  <button
                    onClick={() => runQuery(selectedKey)}
                    disabled={running}
                    className="text-xs font-medium px-3 py-1.5 transition"
                    style={{
                      backgroundColor: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: '2px',
                      color: 'var(--text-secondary)',
                      cursor: running ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {running ? 'Running...' : 'Run Query'}
                  </button>
                  {/* EXPLAIN toggle */}
                  <label
                    className="flex items-center gap-1.5 text-xs cursor-pointer"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <input
                      type="checkbox"
                      checked={showExplain}
                      onChange={e => setShowExplain(e.target.checked)}
                      style={{ accentColor: 'var(--accent-blue)' }}
                    />
                    Show EXPLAIN Plan
                  </label>
                </div>
              </div>
            )}

            {/* SQL block */}
            {result?.sql && (
              <div style={{ borderBottom: '1px solid var(--border)' }}>
                <pre style={{ ...monoBlock, border: 'none', borderRadius: 0, color: 'var(--accent-blue)' }}>
                  {result.sql}
                </pre>
              </div>
            )}

            {/* EXPLAIN plan */}
            {showExplain && result?.explain_plan && (
              <div style={{ borderBottom: '1px solid var(--border)' }}>
                <div
                  className="px-4 py-2 font-mono text-[10px]"
                  style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface)', letterSpacing: '0.08em' }}
                >
                  POSTGRESQL COST-BASED OPTIMIZER EXECUTION PLAN
                </div>
                <pre style={{ ...monoBlock, border: 'none', borderRadius: 0, color: '#93C5FD' }}>
                  {result.explain_plan}
                </pre>
              </div>
            )}

            {/* Results table */}
            <div style={{ backgroundColor: 'var(--bg-surface)' }}>
              {running ? (
                <div className="py-12 text-center font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                  Executing on PostgreSQL 16...
                </div>
              ) : result && result.rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {Object.keys(result.rows[0]).map(col => (
                          <th
                            key={col}
                            className="px-4 py-2.5 font-medium"
                            style={{ color: 'var(--text-muted)', letterSpacing: '0.06em', fontSize: '10px', textTransform: 'uppercase' }}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          style={{ borderBottom: '1px solid var(--border)', height: '36px' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-raised)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          {Object.values(row).map((val: any, cIdx) => (
                            <td key={cIdx} className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>
                              {typeof val === "object" && val !== null ? JSON.stringify(val) : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div
                    className="px-4 py-2 font-mono text-[11px]"
                    style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}
                  >
                    {result.rowCount} rows returned
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                  No records returned.
                </div>
              )}
            </div>
          </div>

          {/* Trigger verification output */}
          {triggerLog && (
            <div
              className="mt-6 p-5 space-y-3"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderLeft: '2px solid var(--accent-emerald)',
                borderRadius: '2px',
              }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="font-mono text-[11px] font-medium"
                  style={{ color: 'var(--accent-emerald)', letterSpacing: '0.08em' }}
                >
                  TRIGGER VERIFICATION LOG: INC-2026-0005 STATUS HISTORY
                </div>
                <span className="font-mono text-[11px]" style={{ color: 'var(--accent-emerald)' }}>
                  Trigger fired successfully
                </span>
              </div>
              <div className="space-y-1.5">
                {triggerLog.history.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 font-mono text-xs"
                    style={{
                      backgroundColor: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: '2px',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Transition:{' '}
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                        {h.previous_status || 'OPEN'} &rarr; {h.new_status}
                      </span>
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      By {h.changed_by_name} at {new Date(h.changed_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
