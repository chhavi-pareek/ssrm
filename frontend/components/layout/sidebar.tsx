"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Brain,
  ChevronLeft,
  ChevronRight,
  ScanSearch,
  Table2,
  Ticket,
  Upload
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
};

const NAV: NavItem[] = [
  { href: "/overview", label: "Executive Overview", Icon: BarChart3 },
  { href: "/supplier-risk-master", label: "Suppliers", Icon: Table2 },
  { href: "/predictions", label: "Predictions", Icon: Brain },
  { href: "/shap", label: "SHAP Explainability", Icon: ScanSearch },
  { href: "/upload", label: "Upload & Pipeline", Icon: Upload },
  { href: "/workflow-events", label: "Workflow Events", Icon: Ticket }
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const v = window.localStorage.getItem("srrm.sidebar.collapsed");
    if (v === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("srrm.sidebar.collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const widthClass = collapsed ? "w-16" : "w-72";

  const activeHref = useMemo(() => {
    // Keep simple: exact match or prefix match for nested routes.
    const exact = NAV.find((n) => n.href === pathname)?.href;
    if (exact) return exact;
    const prefix = NAV.find((n) => pathname?.startsWith(n.href + "/"))?.href;
    return prefix ?? "";
  }, [pathname]);

  return (
    <aside className={`${widthClass} shrink-0 border-r border-border/40 bg-card/50 backdrop-blur-sm`}>
      <div className="flex h-16 items-center justify-between px-3 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20">
            <span className="text-sm font-bold text-white">SR</span>
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-base font-bold tracking-wide text-foreground">SRRM</div>
              <div className="text-xs text-muted-foreground/70">Risk Analytics</div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted/60 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="px-3 py-4">
        <div className="space-y-1.5">
          {NAV.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  active 
                    ? "bg-gradient-to-r from-primary/20 to-accent/20 text-foreground shadow-md shadow-primary/5 border border-primary/30" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                ].join(" ")}
              >
                <item.Icon size={18} className={active ? "text-primary" : ""} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}

