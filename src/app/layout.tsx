import './globals.css';
import Navbar from '@/components/Navbar';

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
      <body className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <Navbar />
        <div className="flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}
