'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface CorrelatedIncident {
  matched_incident_id: number;
  incident_number: string;
  incident_title: string;
  severity: string;
  service_name: string;
  root_cause_category: string;
  root_cause_summary: string;
  prevention_action_items: string[];
  resolved_by_engineer: string;
  time_to_resolve_minutes: number;
  cosine_similarity: string;
}

interface Service {
  service_id: number;
  service_name: string;
  tier: string;
}

const SEV_OPTS = ['P1', 'P2', 'P3', 'P4'] as const;
type Severity = typeof SEV_OPTS[number];

const SEV_ACTIVE: Record<Severity, { bg: string; color: string; border: string }> = {
  P1: { bg: 'var(--accent-red)',    color: '#fff',                    border: 'var(--accent-red)' },
  P2: { bg: 'var(--accent-amber)',  color: '#fff',                    border: 'var(--accent-amber)' },
  P3: { bg: '#2563EB',             color: '#fff',                    border: '#2563EB' },
  P4: { bg: 'var(--bg-raised)',     color: 'var(--text-primary)',     border: 'var(--border-strong)' },
};

const PRIORITY_MAP: Record<Severity, string> = {
  P1: 'CRITICAL', P2: 'HIGH', P3: 'MEDIUM', P4: 'LOW',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: '13px',
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontFamily: 'JetBrains Mono, monospace',
  letterSpacing: '0.08em',
  color: 'var(--text-muted)',
  marginBottom: '6px',
  textTransform: 'uppercase' as const,
};

export default function IncidentTriageStudio() {
  const router = useRouter();

  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [serviceId, setServiceId]       = useState<number>(1);
  const [severity, setSeverity]         = useState<Severity>('P1');
  const [impactRadius, setImpactRadius] = useState<number>(1000);
  const [errorMessage, setErrorMessage] = useState('');
  const [stackTrace, setStackTrace]     = useState('');

  const [services, setServices]         = useState<Service[]>([]);
  const [matches, setMatches]           = useState<CorrelatedIncident[]>([]);
  const [isSearching, setIsSearching]   = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appliedPlaybook, setAppliedPlaybook] = useState<string | null>(null);

  useEffect(() => {
    async function loadServices() {
      try {
        const res = await fetch('/api/services');
        const data = await res.json();
        if (data.status === 'SUCCESS') setServices(data.services);
      } catch (err) { console.error('Failed to load services', err); }
    }
    loadServices();
  }, []);

  // Debounced vector search
  useEffect(() => {
    if (!errorMessage.trim()) { setMatches([]); return; }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch('/api/vector/correlate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error_message: `${errorMessage}\n${stackTrace}`, threshold: 0.50, limit: 3 }),
        });
        const data = await res.json();
        if (data.status === 'SUCCESS') setMatches(data.correlated_incidents || []);
      } catch (err) { console.error('Vector search error', err); }
      finally { setIsSearching(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [errorMessage, stackTrace]);

  function applyPlaybook(match: CorrelatedIncident) {
    setAppliedPlaybook(match.incident_number);
    setDescription(prev =>
      prev
        ? `${prev}\n\n[Applied Playbook from ${match.incident_number}]: ${match.root_cause_summary}`
        : `[Applied Playbook from ${match.incident_number}]: ${match.root_cause_summary}`
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !errorMessage) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description: description || title, severity,
          priority: PRIORITY_MAP[severity], service_id: Number(serviceId),
          assigned_to: 1, impact_radius: Number(impactRadius),
          log_level: severity === 'P1' ? 'FATAL' : 'ERROR',
          message: errorMessage, stack_trace: stackTrace,
        }),
      });
      if (res.ok) router.push('/');
    } catch (err) { console.error('Submission failed', err); }
    finally { setIsSubmitting(false); }
  }

  return (
    <main className="max-w-[1280px] mx-auto px-6 py-8">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-[28px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
          AI Triage Studio
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)', maxWidth: '65ch' }}>
          Paste error stack traces to declare an incident. PostgreSQL matches historical root-causes in real time via HNSW cosine distance.
        </p>
      </div>

      {/* 60/40 split */}
      <form onSubmit={handleSubmit}>
        <div
          className="flex flex-col lg:flex-row min-h-[520px]"
          style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}
        >

          {/* Left panel — 60% */}
          <div
            className="flex-[3] p-6 flex flex-col gap-5"
            style={{ borderRight: '1px solid var(--border)' }}
          >
            {/* Title */}
            <div>
              <label style={labelStyle}>Incident Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Upstream connection pool starvation during checkout"
                required
                style={inputStyle}
              />
            </div>

            {/* Service + Impact radius */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label style={labelStyle}>Affected Service *</label>
                <select
                  value={serviceId}
                  onChange={e => setServiceId(Number(e.target.value))}
                  style={{ ...inputStyle }}
                >
                  {services.map(s => (
                    <option key={s.service_id} value={s.service_id}>
                      {s.service_name} ({s.tier})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label style={labelStyle}>Impact Radius (estimated users)</label>
                <input
                  type="number"
                  value={impactRadius}
                  onChange={e => setImpactRadius(Number(e.target.value))}
                  min={0}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Severity selector */}
            <div>
              <label style={labelStyle}>Severity Level (P1 triggers automatic service outage status)</label>
              <div className="flex gap-2">
                {SEV_OPTS.map(s => {
                  const active = severity === s;
                  const styles = SEV_ACTIVE[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeverity(s)}
                      className="flex-1 py-2 text-xs font-bold transition"
                      style={{
                        backgroundColor: active ? styles.bg : 'var(--bg-surface)',
                        color: active ? styles.color : 'var(--text-secondary)',
                        border: `1px solid ${active ? styles.border : 'var(--border)'}`,
                        borderRadius: '2px',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Raw error message */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label style={{ ...labelStyle, marginBottom: 0 }}>Raw Error Message * (vector search trigger)</label>
                {errorMessage.trim() && (
                  <span className="font-mono text-[11px]" style={{ color: 'var(--accent-emerald)' }}>
                    Real-time embedding active
                  </span>
                )}
              </div>
              <input
                type="text"
                value={errorMessage}
                onChange={e => setErrorMessage(e.target.value)}
                placeholder="e.g. ConnectionPoolExhaustedError: Timeout waiting for connection from pool"
                required
                style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}
              />
            </div>

            {/* Stack trace */}
            <div>
              <label style={labelStyle}>Stack Trace (optional)</label>
              <textarea
                value={stackTrace}
                onChange={e => setStackTrace(e.target.value)}
                rows={4}
                placeholder="at Pool.acquire (/node_modules/pg-pool/index.js:312:11)..."
                style={{
                  ...inputStyle,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '12px',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !title || !errorMessage}
              className="w-full py-3 text-sm font-semibold transition"
              style={{
                backgroundColor: isSubmitting ? 'var(--bg-raised)' : 'var(--accent-red)',
                color: isSubmitting ? 'var(--text-muted)' : '#fff',
                border: 'none',
                borderRadius: '2px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              {isSubmitting ? 'Triaging...' : 'Triage and Declare Incident'}
            </button>
          </div>

          {/* Right panel — 40% */}
          <div className="flex-[2] p-6 flex flex-col gap-4" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <div>
              <div
                className="font-mono text-[11px] font-medium mb-2"
                style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
              >
                LIVE ROOT-CAUSE CORRELATION
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)', maxWidth: '65ch' }}>
                Matches raw error tokens against 768-d historical embeddings using HNSW cosine distance (
                <code className="font-mono" style={{ color: 'var(--text-primary)' }}>&lt;=&gt;</code>).
              </p>
            </div>

            {/* Empty state */}
            {!errorMessage.trim() && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--text-muted)' }}>
                <p className="text-xs text-center">
                  Type an error message on the left to activate real-time vector correlation.
                </p>
              </div>
            )}

            {/* Searching */}
            {isSearching && (
              <div className="flex-1 flex items-center justify-center">
                <p className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                  Searching HNSW index...
                </p>
              </div>
            )}

            {/* No matches */}
            {errorMessage.trim() && !isSearching && matches.length === 0 && (
              <div
                className="p-4"
                style={{ border: '1px solid var(--border)', borderRadius: '2px', backgroundColor: 'var(--bg-base)' }}
              >
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  No Historical Matches
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Error signature appears novel. Cosine similarity below 50% threshold.
                </p>
              </div>
            )}

            {/* Match cards */}
            {matches.length > 0 && (
              <div className="space-y-3">
                {matches.map(m => {
                  const pct = (Number(m.cosine_similarity) * 100).toFixed(1);
                  const isApplied = appliedPlaybook === m.incident_number;

                  return (
                    <div
                      key={m.matched_incident_id}
                      className="p-4 space-y-3"
                      style={{
                        backgroundColor: 'var(--bg-base)',
                        border: '1px solid var(--border)',
                        borderRadius: '2px',
                      }}
                    >
                      {/* Top row */}
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                          {m.incident_number}{' '}
                          <span className="font-normal" style={{ color: 'var(--text-muted)' }}>
                            ({m.service_name})
                          </span>
                        </span>
                        <span
                          className="font-mono text-[11px] font-bold px-2 py-0.5"
                          style={{
                            color: 'var(--accent-emerald)',
                            backgroundColor: 'var(--accent-emerald-dim)',
                            border: '1px solid var(--accent-emerald)',
                            borderRadius: '2px',
                          }}
                        >
                          {pct}% Match
                        </span>
                      </div>

                      {/* Matched title */}
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        {m.incident_title}
                      </p>

                      {/* Post-mortem fix */}
                      <div
                        className="p-3 space-y-1.5"
                        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '2px' }}
                      >
                        <div
                          className="font-mono text-[10px] font-semibold uppercase"
                          style={{ color: 'var(--accent-amber)', letterSpacing: '0.08em' }}
                        >
                          Historical Post-Mortem Fix:
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {m.root_cause_summary}
                        </p>
                      </div>

                      {/* Apply button */}
                      <button
                        type="button"
                        onClick={() => applyPlaybook(m)}
                        className="w-full py-2 px-3 text-xs font-medium transition"
                        style={{
                          backgroundColor: isApplied ? 'var(--accent-emerald-dim)' : 'var(--bg-raised)',
                          color: isApplied ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                          border: `1px solid ${isApplied ? 'var(--accent-emerald)' : 'var(--border)'}`,
                          borderRadius: '2px',
                          cursor: 'pointer',
                        }}
                      >
                        {isApplied ? 'Playbook Attached to Triage' : 'Apply Verified Resolution'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </form>
    </main>
  );
}
