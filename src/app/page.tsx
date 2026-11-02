'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Incident {
  incident_id: number;
  incident_number: string;
  title: string;
  description: string;
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  status: 'OPEN' | 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED' | 'CLOSED';
  priority: string;
  service_name: string;
  service_tier: string;
  assigned_engineer: string;
  declared_at: string;
  impact_radius_users: number;
}

type Filter = 'ALL' | 'ACTIVE' | 'P1' | 'P2' | 'RESOLVED';

const STATUS_OPTS = ['OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED'] as const;

const SEV_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  P1: { color: '#FCA5A5', bg: 'var(--accent-red-dim)',   border: 'var(--accent-red)' },
  P2: { color: '#FCD34D', bg: 'var(--accent-amber-dim)', border: 'var(--accent-amber)' },
  P3: { color: '#93C5FD', bg: '#1E3A5F',                 border: '#2563EB' },
  P4: { color: 'var(--text-secondary)', bg: 'var(--bg-raised)', border: 'var(--border-strong)' },
};

const STATUS_COLOR: Record<string, string> = {
  OPEN:          'var(--accent-red)',
  INVESTIGATING: 'var(--accent-amber)',
  MITIGATED:     '#38BDF8',
  RESOLVED:      'var(--accent-emerald)',
  CLOSED:        'var(--text-muted)',
};

function kpiSub(label: string, color?: string) {
  return (
    <span className="font-mono text-xs" style={{ color: color ?? 'var(--text-muted)' }}>
      {label}
    </span>
  );
}

export default function WarRoomDashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<Filter>('ALL');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function fetchIncidents() {
    try {
      const res  = await fetch('/api/incidents');
      const data = await res.json();
      if (data.status === 'SUCCESS') setIncidents(data.incidents);
    } catch (err) {
      console.error('Failed to load incidents', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchIncidents(); }, []);

  async function handleStatusChange(id: number, newStatus: string) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/incidents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) await fetchIncidents();
    } catch (err) {
      console.error('Status transition failed', err);
    } finally {
      setUpdatingId(null);
    }
  }

  const active   = incidents.filter(i => ['OPEN', 'INVESTIGATING'].includes(i.status));
  const p1Active = incidents.filter(i => i.severity === 'P1' && ['OPEN', 'INVESTIGATING'].includes(i.status));
  const resolved = incidents.filter(i => ['RESOLVED', 'CLOSED'].includes(i.status));

  const displayed = incidents.filter(i => {
    if (filter === 'P1')      return i.severity === 'P1';
    if (filter === 'P2')      return i.severity === 'P2';
    if (filter === 'ACTIVE')  return ['OPEN', 'INVESTIGATING'].includes(i.status);
    if (filter === 'RESOLVED') return ['RESOLVED', 'CLOSED'].includes(i.status);
    return true;
  });

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'ALL',      label: 'ALL' },
    { key: 'ACTIVE',   label: 'ACTIVE' },
    { key: 'P1',       label: 'P1' },
    { key: 'P2',       label: 'P2' },
    { key: 'RESOLVED', label: 'RESOLVED' },
  ];

  return (
    <main className="max-w-[1280px] mx-auto px-6 py-8">

      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
            Live SRE War Room{' '}
            <span
              className="align-middle font-mono text-[11px] font-medium px-2 py-0.5 ml-2"
              style={{
                color: 'var(--accent-red)',
                backgroundColor: 'var(--accent-red-dim)',
                border: '1px solid var(--accent-red)',
                borderRadius: '2px',
                letterSpacing: '0.08em',
              }}
            >
              PRODUCTION
            </span>
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)', maxWidth: '65ch' }}>
            Incident state machine and root-cause correlation stream.
          </p>
        </div>
        <button
          onClick={fetchIncidents}
          className="text-xs font-medium px-3 py-1.5 rounded transition"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          Refresh Feed
        </button>
      </div>

      {/* KPI strip */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 mb-8"
        style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}
      >
        {[
          {
            label: 'ACTIVE INCIDENTS',
            value: active.length,
            sub: kpiSub('Under Triage', active.length > 0 ? 'var(--accent-amber)' : 'var(--text-muted)'),
          },
          {
            label: 'P1 CRITICAL OUTAGES',
            value: p1Active.length,
            sub: kpiSub(p1Active.length > 0 ? 'Severe Impact' : 'All Clear', p1Active.length > 0 ? 'var(--accent-red)' : 'var(--accent-emerald)'),
          },
          {
            label: 'MEAN TIME TO RESOLVE',
            value: '45m',
            sub: kpiSub(`${resolved.length} Post-Mortems`),
          },
          {
            label: 'OVERALL PLATFORM SLA',
            value: '99.94%',
            sub: kpiSub('Target 99.90%', 'var(--accent-emerald)'),
          },
        ].map((kpi, i, arr) => (
          <div
            key={kpi.label}
            className="p-5"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <div
              className="text-[11px] font-medium mb-3"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
            >
              {kpi.label}
            </div>
            <div className="text-[28px] font-bold leading-none mb-1" style={{ color: 'var(--text-primary)' }}>
              {kpi.value}
            </div>
            {kpi.sub}
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div
        className="flex items-center gap-0 mb-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="relative px-4 py-2.5 text-xs font-medium transition-colors"
            style={{
              color: filter === f.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {f.label}
            {filter === f.key && (
              <span
                className="absolute bottom-0 left-0 right-0"
                style={{ height: '2px', backgroundColor: 'var(--accent-blue)' }}
              />
            )}
          </button>
        ))}
        <span
          className="ml-auto font-mono text-xs pr-4"
          style={{ color: 'var(--text-muted)' }}
        >
          {displayed.length} of {incidents.length} incidents
        </span>
      </div>

      {/* Incident feed */}
      {loading ? (
        <div className="py-16 text-center font-mono text-sm" style={{ color: 'var(--text-muted)' }}>
          Loading from PostgreSQL...
        </div>
      ) : displayed.length === 0 ? (
        <div className="py-16 text-center font-mono text-sm" style={{ color: 'var(--text-muted)' }}>
          No incidents match this filter.
        </div>
      ) : (
        <div>
          {displayed.map(inc => {
            const sev  = SEV_STYLE[inc.severity] ?? SEV_STYLE.P4;
            const isResolved = ['RESOLVED', 'CLOSED'].includes(inc.status);

            return (
              <div
                key={inc.incident_id}
                className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-4 px-0 transition-colors"
                style={{
                  borderBottom: '1px solid var(--border)',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-raised)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {/* Left: meta + title */}
                <div className="flex-1 min-w-0 px-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {/* Severity badge */}
                    <span
                      className="font-mono text-[9px] font-bold px-1.5 py-0.5"
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

                    {/* INC number */}
                    <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                      {inc.incident_number}
                    </span>

                    {/* Service tag */}
                    <span
                      className="text-[11px] font-medium px-1.5 py-0.5"
                      style={{
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '2px',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {inc.service_name}
                    </span>

                    {/* Tier */}
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      {inc.service_tier}
                    </span>

                    {/* Impact */}
                    <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {inc.impact_radius_users.toLocaleString()} users
                    </span>
                  </div>

                  <p
                    className="text-sm font-semibold leading-snug mb-0.5"
                    style={{
                      color: isResolved ? 'var(--text-secondary)' : 'var(--text-primary)',
                      maxWidth: '65ch',
                    }}
                  >
                    {inc.title}
                  </p>
                  <p className="text-xs leading-snug" style={{ color: 'var(--text-secondary)', maxWidth: '65ch' }}>
                    {inc.description}
                  </p>
                </div>

                {/* Right: commander + status + arrow */}
                <div className="flex items-center gap-5 shrink-0 px-1">
                  <div className="hidden sm:block text-right">
                    <div className="text-[11px] uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                      Commander
                    </div>
                    <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {inc.assigned_engineer}
                    </div>
                  </div>

                  {/* Status dropdown */}
                  <select
                    value={inc.status}
                    disabled={updatingId === inc.incident_id}
                    onChange={e => handleStatusChange(inc.incident_id, e.target.value)}
                    className="text-xs font-mono font-semibold px-2 py-1.5 appearance-none cursor-pointer outline-none transition"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '2px',
                      color: STATUS_COLOR[inc.status] ?? 'var(--text-primary)',
                    }}
                  >
                    {STATUS_OPTS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>

                  {/* Arrow glyph link */}
                  <Link
                    href={`/incidents/${inc.incident_id}`}
                    className="text-sm transition"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => ((e.target as HTMLElement).style.color = 'var(--text-primary)')}
                    onMouseLeave={e => ((e.target as HTMLElement).style.color = 'var(--text-muted)')}
                    title="Inspect post-mortem"
                  >
                    &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
