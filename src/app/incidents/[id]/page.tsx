'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';

interface IncidentData {
  incident: {
    incident_id: number;
    incident_number: string;
    title: string;
    description: string;
    severity: 'P1' | 'P2' | 'P3' | 'P4';
    status: 'OPEN' | 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED' | 'CLOSED';
    priority: string;
    service_id: number;
    assigned_to: number;
    declared_at: string;
    updated_at: string;
    mitigated_at: string | null;
    resolved_at: string | null;
    impact_radius_users: number;
    service_name: string;
    assigned_engineer: string;
  };
  timeline: Array<{
    history_id: string;
    incident_id: number;
    previous_status: string | null;
    new_status: string;
    changed_by: number;
    changed_at: string;
    notes: string;
    changed_by_name: string;
  }>;
  error_logs: Array<{
    log_id: string;
    log_timestamp: string;
    log_level: string;
    source_service: string;
    fingerprint: string;
    message: string;
    payload_metadata: any;
  }>;
  root_cause: {
    root_cause_id: number;
    category: string;
    summary: string;
    prevention_action_items: string[];
  } | null;
}

const SEV_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  P1: { color: '#FCA5A5', bg: 'var(--accent-red-dim)',   border: 'var(--accent-red)' },
  P2: { color: '#FCD34D', bg: 'var(--accent-amber-dim)', border: 'var(--accent-amber)' },
  P3: { color: '#93C5FD', bg: '#1E3A5F',                 border: '#2563EB' },
  P4: { color: 'var(--text-secondary)', bg: 'var(--bg-raised)', border: 'var(--border-strong)' },
};

const STATUS_OPTS = ['OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED'] as const;

export default function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const incidentId = resolvedParams.id;

  const [data, setData] = useState<IncidentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  async function loadIncident() {
    try {
      const res = await fetch(`/api/incidents/${incidentId}`);
      const json = await res.json();
      if (json.status === 'SUCCESS') {
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load incident detail', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIncident();
  }, [incidentId]);

  async function updateStatus(newStatus: string) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await loadIncident();
      }
    } catch (err) {
      console.error('Status transition failed', err);
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-[1280px] mx-auto px-6 py-12 text-center font-mono text-sm" style={{ color: 'var(--text-muted)' }}>
        Loading incident record from PostgreSQL...
      </main>
    );
  }

  if (!data || !data.incident) {
    return (
      <main className="max-w-[1280px] mx-auto px-6 py-12 text-center">
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Incident Record Not Found
        </h1>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          No row exists in table `incidents` matching id: {incidentId}
        </p>
        <Link
          href="/"
          className="text-xs font-semibold px-3 py-1.5 rounded"
          style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          &larr; Return to War Room
        </Link>
      </main>
    );
  }

  const inc = data.incident;
  const sev = SEV_STYLE[inc.severity] ?? SEV_STYLE.P4;

  return (
    <main className="max-w-[1280px] mx-auto px-6 py-8 space-y-8">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-xs font-medium transition"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'var(--text-muted)')}
        >
          &larr; Return to War Room
        </Link>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
            DATABASE ID: {inc.incident_id}
          </span>
        </div>
      </div>

      {/* Main Incident Dossier Header */}
      <div
        className="p-6"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
        }}
      >
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span
            className="font-mono text-[11px] font-bold px-2 py-0.5"
            style={{
              color: sev.color,
              backgroundColor: sev.bg,
              border: `1px solid ${sev.border}`,
              borderRadius: '2px',
              letterSpacing: '0.06em',
            }}
          >
            {inc.severity}
          </span>

          <span className="font-mono text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {inc.incident_number}
          </span>

          <span
            className="text-[11px] font-medium px-2 py-0.5"
            style={{
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-strong)',
              borderRadius: '2px',
            }}
          >
            {inc.service_name}
          </span>

          <span
            className="font-mono text-[11px] font-semibold px-2 py-0.5"
            style={{
              color: inc.status === 'OPEN' ? 'var(--accent-red)' : inc.status === 'RESOLVED' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
              backgroundColor: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: '2px',
            }}
          >
            {inc.status}
          </span>
        </div>

        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          {inc.title}
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', maxWidth: '75ch' }}>
          {inc.description}
        </p>

        {/* State Machine Transition Action Strip */}
        <div className="mt-6 pt-5 flex flex-wrap items-center gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            TRANSITION STATE:
          </span>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTS.map((st) => {
              const isCurrent = inc.status === st;
              return (
                <button
                  key={st}
                  disabled={updating || isCurrent}
                  onClick={() => updateStatus(st)}
                  className="px-3 py-1 text-xs font-mono font-semibold transition"
                  style={{
                    backgroundColor: isCurrent ? 'var(--bg-raised)' : 'var(--bg-base)',
                    color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: `1px solid ${isCurrent ? 'var(--accent-blue)' : 'var(--border)'}`,
                    borderRadius: '2px',
                    cursor: isCurrent || updating ? 'default' : 'pointer',
                  }}
                >
                  {isCurrent ? `● ${st}` : st}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SRE Metadata Grid */}
      <div
        className="grid grid-cols-2 md:grid-cols-4"
        style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}
      >
        <div className="p-4" style={{ backgroundColor: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
          <div className="font-mono text-[10px] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
            Assigned Commander
          </div>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {inc.assigned_engineer}
          </div>
        </div>

        <div className="p-4" style={{ backgroundColor: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
          <div className="font-mono text-[10px] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
            Impact Radius
          </div>
          <div className="text-sm font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
            {inc.impact_radius_users.toLocaleString()} users
          </div>
        </div>

        <div className="p-4" style={{ backgroundColor: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
          <div className="font-mono text-[10px] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
            Declared At
          </div>
          <div className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
            {new Date(inc.declared_at).toLocaleString()}
          </div>
        </div>

        <div className="p-4" style={{ backgroundColor: 'var(--bg-surface)' }}>
          <div className="font-mono text-[10px] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
            Resolution State
          </div>
          <div className="text-xs font-mono" style={{ color: inc.resolved_at ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
            {inc.resolved_at ? new Date(inc.resolved_at).toLocaleString() : 'Unresolved'}
          </div>
        </div>
      </div>

      {/* 2-Column Split: Error Telemetry (Left) & PostgreSQL Audit Timeline (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Correlated Error Logs */}
        <div className="lg:col-span-6 space-y-4">
          <div className="font-mono text-[11px] font-medium" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            SRE ERROR TELEMETRY & LOG CORRELATION ({data.error_logs.length})
          </div>

          {data.error_logs.length === 0 ? (
            <div className="p-6 text-center font-mono text-xs" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              No error log rows linked in `error_logs` table.
            </div>
          ) : (
            data.error_logs.map((log) => (
              <div
                key={log.log_id}
                className="p-4 space-y-3"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="font-mono text-[10px] font-bold px-1.5 py-0.5"
                    style={{
                      color: log.log_level === 'FATAL' ? 'var(--accent-red)' : 'var(--accent-amber)',
                      backgroundColor: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: '2px',
                    }}
                  >
                    {log.log_level}
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {new Date(log.log_timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="font-mono text-xs p-3" style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '2px', color: '#FCA5A5' }}>
                  {log.message}
                </div>

                <div className="text-[11px] font-mono flex items-center justify-between" style={{ color: 'var(--text-muted)' }}>
                  <span>Source: {log.source_service}</span>
                  <span>MD5: {log.fingerprint ? log.fingerprint.substring(0, 12) : 'N/A'}...</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Automated PostgreSQL Trigger Audit Trail */}
        <div className="lg:col-span-6 space-y-4">
          <div className="font-mono text-[11px] font-medium" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            POSTGRESQL TRIGGER AUDIT TRAIL (`incident_status_history`)
          </div>

          <div
            className="p-5 space-y-3"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
            }}
          >
            {data.timeline.length === 0 ? (
              <p className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                No state transitions logged yet.
              </p>
            ) : (
              data.timeline.map((entry, idx) => (
                <div
                  key={entry.history_id || idx}
                  className="p-3 space-y-1 font-mono text-xs"
                  style={{
                    backgroundColor: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                    borderLeft: '2px solid var(--accent-blue)',
                    borderRadius: '2px',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                      {entry.previous_status || 'INIT'} &rarr; {entry.new_status}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {new Date(entry.changed_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    Recorded by: {entry.changed_by_name || 'System'}
                  </div>
                  {entry.notes && (
                    <div className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>
                      &quot;{entry.notes}&quot;
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
