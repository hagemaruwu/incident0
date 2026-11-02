"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Radio,
  PlusCircle,
  Server,
  Terminal,
  Shield,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { name: "War Room", href: "/", icon: Activity },
    { name: "AI Triage Studio", href: "/incidents/new", icon: PlusCircle },
    { name: "Service Topology", href: "/services", icon: Server },
    { name: "SQL Evaluation Lab", href: "/evaluation", icon: Terminal },
  ];

  return (
    <header className="border-b border-slate-800 bg-[#0B0F19]/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Status Indicator */}
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center space-x-2">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="font-extrabold text-xl tracking-wider text-white">
                INCIDENT<span className="text-red-500">ZERO</span>
              </span>
            </Link>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex space-x-1">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition ${
                      isActive
                        ? "bg-slate-800 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* SRE Role Badge (Demonstrating RBAC to Evaluators) */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs">
              <Shield className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-slate-400">Role:</span>
              <span className="font-semibold text-emerald-400">COMMANDER</span>
            </div>

            <Link
              href="/incidents/new"
              className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition shadow-sm"
            >
              <Radio className="h-3.5 w-3.5" />
              <span>Declare Incident</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
