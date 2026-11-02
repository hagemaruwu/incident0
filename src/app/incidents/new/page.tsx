'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, 
  Radio, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Zap, 
  ShieldAlert, 
  Database,
  FileText
} from 'lucide-react';

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

export default function IncidentTriageStudio() {
  const router = useRouter();

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [serviceId, setServiceId] = useState<number>(1);
  const [severity, setSeverity] = useState<'P1' | 'P2' | 'P3' | 'P4'>('P1');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('CRITICAL');
  const [impactRadius, setImpactRadius] = useState<number>(1000);
  const [errorMessage, setErrorMessage] = useState('');
  const [stackTrace, setStackTrace] = useState('');

  // UI & Live Matching State
  const [services, setServices] = useState<Service[]>([]);
  const [matches, setMatches] = useState<CorrelatedIncident[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appliedPlaybook, setAppliedPlaybook] = useState<string | null>(null);

  // Load microservices dropdown from /api/services
  useEffect(() => {
    async function loadServices() {
      try {
        const res = await fetch('/api/services');
        const data = await res.json();
        if (data.status === 'SUCCESS') {
          setServices(data.services);
        }
      } catch (err) {
        console.error('Failed to load services', err);
      }
    }
    loadServices();
  }, []);

  // Debounced Real-Time Vector Similarity Search
  useEffect(() => {
    if (!errorMessage.trim()) {
      setMatches([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch('/api/vector/correlate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error_message: `${errorMessage}\n${stackTrace}`,
            threshold: 0.50,
            limit: 3,
          }),
        });
        const data = await res.json();
        if (data.status === 'SUCCESS') {
          setMatches(data.correlated_incidents || []);
        }
      } catch (err) {
        console.error('Vector search error', err);
      } finally {
        setIsSearching(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [errorMessage, stackTrace]);

  // Apply Playbook 1-Click Action
  function applyPlaybook(match: CorrelatedIncident) {
    setAppliedPlaybook(match.incident_number);
    setDescription((prev) => 
      prev 
        ? `${prev}\n\n[Applied Playbook from ${match.incident_number}]: ${match.root_cause_summary}`
        : `[Applied Playbook from ${match.incident_number}]: ${match.root_cause_summary}`
    );
  }

  // Submit & Triage Incident via sp_triage_incident
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !errorMessage) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || title,
          severity,
          priority,
          service_id: Number(serviceId),
          assigned_to: 1, // Aditya Raj
          impact_radius: Number(impactRadius),
          log_level: severity === 'P1' ? 'FATAL' : 'ERROR',
          message: errorMessage,
          stack_trace: stackTrace,
        }),
      });

      if (res.ok) {
        router.push('/'); // Redirect to War Room!
      }
    } catch (err) {
      console.error('Submission failed', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
          <Zap className="h-6 w-6 text-red-500" />
          <span>AI Triage & Telemetry Correlation Studio</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Paste error stack traces to declare an incident while PostgreSQL matches historical root-causes in real time.
        </p>
      </div>

      {/* Split-Screen Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: The Incident Declaration Form (7 Cols) */}
        <div className="lg:col-span-7 bg-[#0B0F19] border border-slate-800 rounded-xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Incident Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Upstream connection pool starvation during checkout"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            {/* Service & Impact Radius */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Affected Service *
                </label>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  {services.map((s) => (
                    <option key={s.service_id} value={s.service_id}>
                      {s.service_name} ({s.tier})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Impact Radius (Estimated Users)
                </label>
                <input
                  type="number"
                  min="0"
                  value={impactRadius}
                  onChange={(e) => setImpactRadius(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Severity Radio Buttons */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Severity Level (P1 triggers automatic service Outage status)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['P1', 'P2', 'P3', 'P4'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => {
                      setSeverity(lvl);
                      setPriority(lvl === 'P1' ? 'CRITICAL' : lvl === 'P2' ? 'HIGH' : 'MEDIUM');
                    }}
                    className={`py-2 text-xs font-bold rounded-lg border transition ${
                      severity === lvl
                        ? lvl === 'P1'
                          ? 'bg-red-500/20 text-red-400 border-red-500 shadow-sm'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-sm'
                        : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message (The Vector Search Trigger) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Raw Error Message * (Vector Search Trigger)
                </label>
                <span className="text-[11px] text-red-400 font-mono">
                  Real-time embedding active
                </span>
              </div>
              <input
                type="text"
                required
                value={errorMessage}
                onChange={(e) => setErrorMessage(e.target.value)}
                placeholder="e.g. ConnectionPoolExhaustedException: Timeout waiting for connection from pool"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            {/* Stack Trace */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Stack Trace (Optional)
              </label>
              <textarea
                rows={3}
                value={stackTrace}
                onChange={(e) => setStackTrace(e.target.value)}
                placeholder="at Pool.acquire (/node_modules/pg-pool/index.js:312:11)..."
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center space-x-2 py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition shadow-md disabled:opacity-50"
            >
              <Radio className="h-4 w-4" />
              <span>{isSubmitting ? 'Triaging with PostgreSQL...' : 'Triage & Declare Incident'}</span>
            </button>

          </form>
        </div>

        {/* RIGHT COLUMN: The Real-Time AI Vector Matcher (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          <div className="bg-[#0B0F19] border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Live Root-Cause Correlation
                </h2>
              </div>
              {isSearching && (
                <span className="text-xs font-mono text-amber-400 animate-pulse">
                  Searching pgvector...
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 mt-2 mb-4">
              Matches raw error tokens against 768-d historical embeddings using HNSW cosine distance (<code className="text-slate-300 font-mono">&lt;=&gt;</code>).
            </p>

            {/* State A: Waiting for input */}
            {!errorMessage.trim() && (
              <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-lg bg-slate-900/20">
                <Database className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">
                  Type an error message on the left to activate real-time vector correlation.
                </p>
              </div>
            )}

            {/* State B: No matches found */}
            {errorMessage.trim() && !isSearching && matches.length === 0 && (
              <div className="text-center py-10 px-4 border border-slate-800 rounded-lg bg-slate-900/40">
                <AlertTriangle className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                <p className="text-xs text-slate-300 font-semibold">No Historical Matches Found</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  This error signature appears to be novel (similarity &lt; 50%).
                </p>
              </div>
            )}

            {/* State C: Matched Historical Incidents */}
            {matches.length > 0 && (
              <div className="space-y-3">
                {matches.map((m) => {
                  const similarityPct = (Number(m.cosine_similarity) * 100).toFixed(1);
                  const isApplied = appliedPlaybook === m.incident_number;

                  return (
                    <div
                      key={m.matched_incident_id}
                      className="bg-slate-900/80 border border-slate-700/80 rounded-lg p-4 space-y-3 transition hover:border-amber-500/50"
                    >
                      {/* Top Match Bar */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-white flex items-center space-x-1.5">
                          <span>{m.incident_number}</span>
                          <span className="text-slate-500 text-[10px]">({m.service_name})</span>
                        </span>
                        
                        {/* Similarity Score Badge */}
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {similarityPct}% Match
                        </span>
                      </div>

                      {/* Incident Title */}
                      <p className="text-xs font-semibold text-slate-200">
                        {m.incident_title}
                      </p>

                      {/* Verified Root-Cause Resolution */}
                      <div className="bg-[#0B0F19] p-3 rounded border border-slate-800 space-y-1.5">
                        <div className="text-[10px] font-mono uppercase text-amber-400 font-semibold">
                          Historical Post-Mortem Fix:
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {m.root_cause_summary}
                        </p>
                      </div>

                      {/* 1-Click Apply Playbook Action */}
                      <button
                        type="button"
                        onClick={() => applyPlaybook(m)}
                        className={`w-full py-2 px-3 rounded text-xs font-medium flex items-center justify-center space-x-2 transition ${
                          isApplied
                            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        }`}
                      >
                        {isApplied ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Playbook Attached to Triage</span>
                          </>
                        ) : (
                          <>
                            <Zap className="h-3.5 w-3.5 text-amber-400" />
                            <span>1-Click Apply Verified Resolution</span>
                          </>
                        )}
                      </button>

                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>

      </div>

    </main>
  );
}