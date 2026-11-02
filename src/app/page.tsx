'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Activity, 
  Server, 
  ArrowUpRight, 
  ShieldAlert, 
  Users,
  RefreshCw
} from 'lucide-react';

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

export default function WarRoomDashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'P1' | 'P2' | 'ACTIVE' | 'RESOLVED'>('ALL');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Fetch incidents from our Day 8 API
  async function fetchIncidents() {
    try {
      const res = await fetch('/api/incidents');
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setIncidents(data.incidents);
      }
    } catch (err) {
      console.error('Failed to load incidents', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchIncidents();
  }, []);

  // Quick Status Transition (Calls PATCH /api/incidents/[id] and fires triggers!)
  async function handleStatusChange(incidentId: number, newStatus: string) {
    setUpdatingId(incidentId);
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchIncidents(); // Refresh state immediately
      }
    } catch (err) {
      console.error('Status transition failed', err);
    } finally {
      setUpdatingId(null);
    }
  }

  // SRE KPI Calculations
  const activeIncidents = incidents.filter(i => ['OPEN', 'INVESTIGATING'].includes(i.status));
  const p1Outages = incidents.filter(i => i.severity === 'P1' && ['OPEN', 'INVESTIGATING'].includes(i.status));
  const resolvedCount = incidents.filter(i => ['RESOLVED', 'CLOSED'].includes(i.status)).length;

  // Filtered incidents for display
  const displayedIncidents = incidents.filter(i => {
    if (filter === 'P1') return i.severity === 'P1';
    if (filter === 'P2') return i.severity === 'P2';
    if (filter === 'ACTIVE') return ['OPEN', 'INVESTIGATING'].includes(i.status);
    if (filter === 'RESOLVED') return ['RESOLVED', 'CLOSED'].includes(i.status);
    return true;
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Page Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
            <span>Live SRE War Room</span>
            <span className="px-2 py-0.5 rounded text-xs font-mono bg-red-500/10 text-red-400 border border-red-500/20">
              PRODUCTION
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time incident state machine & root-cause correlation stream.
          </p>
        </div>
        <button
          onClick={fetchIncidents}
          className="inline-flex items-center space-x-2 px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* SRE Telemetry KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Active Incidents */}
        <div className="bg-[#0B0F19] border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase font-medium tracking-wider">Active Incidents</span>
            <Activity className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white">{activeIncidents.length}</span>
            <span className="text-xs text-amber-400 font-medium">Under Triage</span>
          </div>
        </div>

        {/* KPI 2: P1 Outages */}
        <div className="bg-[#0B0F19] border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase font-medium tracking-wider">P1 Critical Outages</span>
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-red-400">{p1Outages.length}</span>
            <span className="text-xs text-red-400 font-medium">Severe Impact</span>
          </div>
        </div>

        {/* KPI 3: MTTR Benchmark */}
        <div className="bg-[#0B0F19] border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase font-medium tracking-wider">Mean Time to Resolve</span>
            <Clock className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white">45m</span>
            <span className="text-xs text-emerald-400 font-medium">{resolvedCount} Post-Mortems</span>
          </div>
        </div>

        {/* KPI 4: Infrastructure SLA Target */}
        <div className="bg-[#0B0F19] border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs uppercase font-medium tracking-wider">Overall Platform SLA</span>
            <Server className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white">99.94%</span>
            <span className="text-xs text-sky-400 font-medium">Target 99.90%</span>
          </div>
        </div>

      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        {(['ALL', 'ACTIVE', 'P1', 'P2', 'RESOLVED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              filter === tab
                ? 'bg-slate-700 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
        <span className="text-xs text-slate-500 ml-auto font-mono">
          Showing {displayedIncidents.length} of {incidents.length} incidents
        </span>
      </div>

      {/* Incident Cards Feed */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 font-mono text-sm">
          Loading live telemetry feed from PostgreSQL...
        </div>
      ) : displayedIncidents.length === 0 ? (
        <div className="text-center py-16 text-slate-500 font-mono text-sm bg-slate-900/40 rounded-lg border border-slate-800">
          No incidents matching filter "{filter}".
        </div>
      ) : (
        <div className="space-y-3">
          {displayedIncidents.map((inc) => {
            const isP1 = inc.severity === 'P1';
            const isResolved = ['RESOLVED', 'CLOSED'].includes(inc.status);

            return (
              <div
                key={inc.incident_id}
                className={`bg-[#0B0F19] border rounded-lg p-5 transition hover:border-slate-700 ${
                  isP1 && !isResolved
                    ? 'border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Left: Metadata & Title */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center space-x-3 text-xs">
                      {/* Incident Number */}
                      <span className="font-mono font-bold text-slate-300">
                        {inc.incident_number}
                      </span>

                      {/* Severity Badge */}
                      <span
                        className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                          inc.severity === 'P1'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : inc.severity === 'P2'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}
                      >
                        {inc.severity}
                      </span>

                      {/* Service & Tier */}
                      <span className="text-slate-400 flex items-center space-x-1">
                        <Server className="h-3 w-3 inline text-slate-500" />
                        <span className="text-slate-300">{inc.service_name}</span>
                        <span className="text-slate-500 text-[10px]">({inc.service_tier})</span>
                      </span>

                      {/* Users Impacted */}
                      <span className="text-slate-500 flex items-center space-x-1">
                        <Users className="h-3 w-3 inline" />
                        <span>{inc.impact_radius_users.toLocaleString()} users</span>
                      </span>
                    </div>

                    {/* Incident Title */}
                    <h3 className="text-base font-semibold text-white">
                      {inc.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-1">
                      {inc.description}
                    </p>
                  </div>

                  {/* Right: Assigned Engineer & Trigger Status Action */}
                  <div className="flex items-center space-x-4 self-end lg:self-center">
                    
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-slate-400">Commander</div>
                      <div className="text-xs font-medium text-slate-200">
                        {inc.assigned_engineer}
                      </div>
                    </div>

                    {/* Real-time Status Dropdown that fires Triggers */}
                    <select
                      value={inc.status}
                      disabled={updatingId === inc.incident_id}
                      onChange={(e) => handleStatusChange(inc.incident_id, e.target.value)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded border bg-slate-900 cursor-pointer focus:outline-none focus:ring-1 focus:ring-red-500 ${
                        inc.status === 'OPEN'
                          ? 'text-red-400 border-red-500/40'
                          : inc.status === 'INVESTIGATING'
                          ? 'text-amber-400 border-amber-500/40'
                          : inc.status === 'MITIGATED'
                          ? 'text-sky-400 border-sky-500/40'
                          : 'text-emerald-400 border-emerald-500/40'
                      }`}
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="INVESTIGATING">INVESTIGATING</option>
                      <option value="MITIGATED">MITIGATED</option>
                      <option value="RESOLVED">RESOLVED</option>
                    </select>

                    <Link
                      href={`/incidents/${inc.incident_id}`}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                      title="Inspect Incident Post-Mortem"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>

                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

    </main>
  );
}