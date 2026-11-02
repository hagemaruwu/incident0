import './globals.css';

export const metadata = {
  title: 'IncidentZero — SRE Telemetry & Root-Cause Correlation Engine',
  description: 'Enterprise SRE Incident Response powered by PostgreSQL 16 & pgvector',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#090D16] text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}