"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { name: "War Room",          href: "/" },
  { name: "AI Triage Studio",  href: "/incidents/new" },
  { name: "Service Topology",  href: "/services" },
  { name: "SQL Evaluation Lab", href: "/evaluation" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        backgroundColor: 'var(--bg-base)',
        borderBottom: '1px solid var(--border)',
        height: '48px',
      }}
    >
      <div
        className="max-w-[1280px] mx-auto px-6 h-full flex items-center justify-between"
      >
        {/* Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span
              className="inline-block w-2 h-2"
              style={{ backgroundColor: 'var(--accent-red)' }}
            />
            <span
              className="text-sm font-bold tracking-widest"
              style={{ color: 'var(--text-primary)', letterSpacing: '0.12em' }}
            >
              INCIDENT<span style={{ color: 'var(--accent-red)' }}>ZERO</span>
            </span>
          </Link>

          {/* Nav tabs */}
          <nav className="hidden md:flex items-end h-full gap-0">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="relative flex items-center px-3 text-xs font-medium transition-colors"
                  style={{
                    height: '48px',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {link.name}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0"
                      style={{ height: '2px', backgroundColor: 'var(--accent-blue)' }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Role tag + CTA */}
        <div className="flex items-center gap-4">
          {/* RBAC tag — left border, no pill */}
          <div
            className="hidden sm:flex items-center gap-2 pl-3 text-xs"
            style={{ borderLeft: '2px solid var(--accent-emerald)' }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Role</span>
            <span
              className="font-mono font-semibold"
              style={{ color: 'var(--accent-emerald)' }}
            >
              COMMANDER
            </span>
          </div>

          {/* Declare Incident — flat rect, no pill */}
          <Link
            href="/incidents/new"
            className="text-xs font-semibold px-3 py-1.5 rounded transition"
            style={{
              backgroundColor: 'var(--accent-red)',
              color: '#fff',
            }}
          >
            Declare Incident
          </Link>
        </div>
      </div>
    </header>
  );
}
