export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-4">
        <span className="text-xs font-mono uppercase tracking-widest px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full">
          Telemetry & AIOps Platform
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          INCIDENT<span className="text-red-500">ZERO</span>
        </h1>
        <p className="text-slate-400">
          Intelligent SRE Telemetry & Root-Cause Correlation Engine. 
          Powered by PostgreSQL 16, pgvector, and Next.js 15.
        </p>
        <div className="pt-4">
          <a
            href="/api/health"
            target="_blank"
            className="inline-flex items-center px-4 py-2 border border-slate-700 rounded-md shadow-sm text-sm font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 transition"
          >
            Check Live DB Health Endpoint (/api/health) &rarr;
          </a>
        </div>
      </div>
    </main>
  );
}