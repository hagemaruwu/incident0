'use client';

import { useState, useEffect } from 'react';

interface Service {
  service_id: number;
  service_name: string;
  description: string;
  tier: string;
  owner_team: string;
  sla_target_pct: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';
  active_incidents_count: string;
}

interface BlastRadiusNode {
  service_id: number;
  service_name: string;
  tier: string;
  hop_depth: number;
  cascade_risk_score: string;
  traversal_path: number[];
}

const STATUS_COLOR: Record<string, string> = {
  OPERATIONAL: 'var(--accent-emerald)',
  DEGRADED:    'var(--accent-amber)',
  OUTAGE:      'var(--accent-red)',
};

function riskColor(score: number): string {
  if (score >= 0.8) return 'var(--accent-red)';
  if (score >= 0.4) return 'var(--accent-amber)';
  return 'var(--text-muted)';
}

export default function ServicesTopologyPage() {
  const [services, setServices]           = useState<Service[]>([]);
  const [loading, setLoading]             = useState(true);
  const [selected, setSelected]           = useState<Service | null>(null);
  const [blastRadius, setBlastRadius]     = useState<BlastRadiusNode[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [latency, setLatency]             = useState<number | null>(null);

  async function fetchServices() {
    try {
      const res  = await fetch('/api/services');
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setServices(data.services);
        if (!selected && data.services.length > 0) {
          loadBlast(data.services[0]);
        }
      }
    } catch (err) { console.error('Failed to load services', err); }
    finally { setLoading(false); }
  }

  async function loadBlast(svc: Service) {
    setSelected(svc);
    setIsCalculating(true);
    try {
      const res  = await fetch(`/api/services/${svc.service_id}/blast-radius`);
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setBlastRadius(data.blast_radius_dag);
        setLatency(data.latency_ms);
      }
    } catch (err) { console.error('Blast radius query failed', err); }
    finally { setIsCalculating(false); }
  }

  useEffect(() => { fetchServices(); }, []);

  return (
    <main className="max-w-[1280px] mx-auto px-6 py-8">

      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
            Service Topology
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)', maxWidth: '65ch' }}>
            Directed Acyclic Graph dependencies evaluated via PostgreSQL{' '}
            <code className="font-mono" style={{ color: 'var(--text-primary)' }}>WITH RECURSIVE</code>.
            Select a service to compute cascade blast radius.
          </p>
        </div>
        <button
          onClick={fetchServices}
          className="text-xs font-medium px-3 py-1.5 rounded transition"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Sidebar + main */}
      <div
        className="flex flex-col lg:flex-row min-h-[540px]"
        style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}
      >

        {/* Left sidebar — service list */}
        <div
          className="lg:w-[280px] shrink-0 flex flex-col"
          style={{ borderRight: '1px solid var(--border)' }}
        >
          <div
            className="px-4 py-3 font-mono text-[11px] font-medium"
            style={{
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--border)',
              letterSpacing: '0.08em',
            }}
          >
            MANAGED SERVICES ({services.length})
          </div>

          {loading ? (
            <div className="p-4 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
              Loading from PostgreSQL...
            </div>
          ) : (
            services.map(svc => {
              const isSelected = selected?.service_id === svc.service_id;
              return (
                <button
                  key={svc.service_id}
                  onClick={() => loadBlast(svc)}
                  className="w-full text-left transition"
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: isSelected ? 'var(--bg-raised)' : 'transparent',
                    borderLeft: isSelected ? '2px solid var(--accent-blue)' : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div className="text-sm font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>
                    {svc.service_name}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {svc.tier}
                    </span>
                    <span
                      className="font-mono text-[10px] font-semibold"
                      style={{ color: STATUS_COLOR[svc.status] ?? 'var(--text-muted)' }}
                    >
                      {svc.status}
                    </span>
                    {Number(svc.active_incidents_count) > 0 && (
                      <span
                        className="font-mono text-[10px] font-bold px-1"
                        style={{
                          color: 'var(--accent-red)',
                          backgroundColor: 'var(--accent-red-dim)',
                          border: '1px solid var(--accent-red)',
                          borderRadius: '2px',
                        }}
                      >
                        {svc.active_incidents_count} active
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Main area — blast radius */}
        <div className="flex-1 flex flex-col" style={{ backgroundColor: 'var(--bg-surface)' }}>
          {/* Panel header */}
          <div
            className="flex items-center justify-between px-6 py-3"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span
              className="font-mono text-[11px] font-medium"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
            >
              CASCADING FAILURE BLAST RADIUS
            </span>
            {latency !== null && (
              <span className="font-mono text-[11px]" style={{ color: 'var(--accent-emerald)' }}>
                Recursive CTE in {latency}ms
              </span>
            )}
          </div>

          {selected && (
            <div
              className="mx-6 mt-4 px-4 py-2.5 text-xs"
              style={{
                backgroundColor: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: '2px',
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Simulating failure at root: </span>
              <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                {selected.service_name}
              </span>
              <span className="font-mono ml-2" style={{ color: 'var(--text-muted)' }}>
                ({selected.tier})
              </span>
            </div>
          )}

          <div className="flex-1 p-6">
            {isCalculating ? (
              <p className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                Traversing DAG in PostgreSQL...
              </p>
            ) : blastRadius.length === 0 ? (
              <p className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                No downstream dependencies registered.
              </p>
            ) : (
              <div className="space-y-1.5">
                {blastRadius.map((node, idx) => {
                  const risk    = Number(node.cascade_risk_score);
                  const riskPct = (risk * 100).toFixed(1);
                  const isRoot  = node.hop_depth === 0;
                  const indent  = node.hop_depth * 20;

                  return (
                    <div
                      key={`${node.service_id}-${node.hop_depth}-${idx}`}
                      className="flex items-center justify-between px-3 py-2"
                      style={{
                        marginLeft: `${indent}px`,
                        backgroundColor: isRoot ? 'var(--accent-red-dim)' : 'var(--bg-base)',
                        border: `1px solid ${isRoot ? 'var(--accent-red)' : 'var(--border)'}`,
                        borderRadius: '2px',
                        borderLeft: !isRoot ? `2px solid var(--border-strong)` : undefined,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {!isRoot && (
                          <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            Hop {node.hop_depth}
                          </span>
                        )}
                        <span
                          className="font-mono text-xs font-semibold"
                          style={{ color: isRoot ? '#FCA5A5' : 'var(--text-primary)' }}
                        >
                          {node.service_name}
                        </span>
                        <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {node.tier}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-mono text-[10px] hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
                          Path: {node.traversal_path.join(' → ')}
                        </span>
                        <span
                          className="font-mono text-[11px] font-bold px-2 py-0.5"
                          style={{
                            color: riskColor(risk),
                            border: `1px solid ${riskColor(risk)}`,
                            borderRadius: '2px',
                          }}
                        >
                          {riskPct}% Risk
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {blastRadius.length > 0 && (
              <p
                className="mt-6 text-[11px]"
                style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}
              >
                Graph traversal executed in PostgreSQL using recursive self-joins with cycle detection.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
