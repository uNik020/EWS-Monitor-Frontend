// src/pages/Dashboard.tsx
import React, { type JSX } from "react";
import { Link } from "react-router-dom";
import {
  DocumentArrowUpIcon,
  ExclamationCircleIcon,
  ClockIcon,
  ArchiveBoxIcon,
} from "@heroicons/react/24/outline";

type KPI = {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  tone?: "neutral" | "alert";
};

const KPIS: KPI[] = [
  {
    label: "Total Alerts",
    value: 128,
    sub: "High: 12 • Medium: 34 • Low: 82",
    icon: <DocumentArrowUpIcon className="w-6 h-6" />,
  },
  {
    label: "Overdue",
    value: 6,
    sub: "Alerts past TAT",
    icon: <ExclamationCircleIcon className="w-6 h-6" />,
    tone: "alert",
  },
  {
    label: "Pending Reviews",
    value: 19,
    sub: "Assigned to Credit",
    icon: <ClockIcon className="w-6 h-6" />,
  },
  {
    label: "Files Uploaded",
    value: 8,
    sub: "Last upload: 2 days ago",
    icon: <ArchiveBoxIcon className="w-6 h-6" />,
  },
];

const RECENT = [
  { company: "ABC Ltd", event: "Resignation of Auditor", severity: "High" },
  { company: "XYZ Pvt", event: "Rating Downgrade", severity: "Medium" },
  { company: "JKL Corp", event: "Credit Bureau Default", severity: "High" },
];

function SeverityItem({ severity }: { severity: string }) {
  const s = severity.toLowerCase();
  const style =
    s === "high"
      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      : s === "medium"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
      : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";

  return (
    <span className={`px-2 py-1 rounded-md text-[11px] font-medium ${style}`}>
      {severity}
    </span>
  );
}

export default function Dashboard(): JSX.Element {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((kpi) => (
          <div
            key={kpi.label}
            className="
              p-5 rounded-xl 
              bg-white border border-slate-200 shadow-sm 
              dark:bg-[#0d243a] dark:border-slate-700
              transition hover:shadow-md
            "
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium uppercase text-slate-600 dark:text-slate-400 tracking-wide">
                  {kpi.label}
                </div>
                <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">
                  {kpi.value}
                </div>
                {kpi.sub && (
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {kpi.sub}
                  </div>
                )}
              </div>

              <div
                className="
                  flex items-center justify-center h-12 w-12 rounded-lg
                  bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300
                "
              >
                {kpi.icon}
              </div>
            </div>

            <div className="mt-4 text-xs text-slate-400 dark:text-slate-500">
              Updated just now
            </div>
          </div>
        ))}
      </div>

      {/* 2-Column Section */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recent Alerts */}
        <div
          className="
            p-5 rounded-xl bg-white border border-slate-200 shadow-sm 
            dark:bg-[#0d243a] dark:border-slate-700
          "
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              Recent Alerts
            </h3>
            <Link to="/alerts" className="text-xs text-blue-600 dark:text-blue-300 hover:underline">
              View all
            </Link>
          </div>

          <ul className="mt-4 space-y-4">
            {RECENT.map((r, i) => (
              <li key={i} className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className="
                      h-10 w-10 rounded-md 
                      bg-blue-600/10 dark:bg-blue-500/20
                      flex items-center justify-center
                      font-semibold text-blue-700 dark:text-blue-300
                    "
                  >
                    {r.company
                      .split(" ")
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join("")}
                  </div>

                  <div>
                    <div className="text-sm font-medium dark:text-slate-200">{r.company}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{r.event}</div>
                  </div>
                </div>

                <SeverityItem severity={r.severity} />
              </li>
            ))}
          </ul>
        </div>

        {/* Quick Actions */}
        <div
          className="
            p-5 rounded-xl bg-white border border-slate-200 shadow-sm
            dark:bg-[#0d243a] dark:border-slate-700
          "
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              Quick Actions
            </h3>
            <div className="text-xs text-slate-500 dark:text-slate-400">Shortcuts</div>
          </div>

          <div className="mt-4 space-y-3">
            <DashboardAction to="/upload/framework" title="Upload Rules" subtitle="Excel" />
            <DashboardAction to="/upload/events" title="Upload Events" subtitle="Excel" />
            <DashboardAction to="/alerts" title="View Alerts" subtitle="Manage" />
          </div>

          <div className="mt-6 text-xs text-slate-500 dark:text-slate-400">
            Tip: Upload the EWS framework first, then upload events.  
            Use manual match for low-confidence events.
          </div>
        </div>
      </div>

      <div className="h-8" />
    </div>
  );
}

function DashboardAction({ to, title, subtitle }: any) {
  return (
    <Link
      to={to}
      className="
        flex items-center justify-between px-4 py-3 rounded-lg 
        border border-slate-200 bg-slate-50 
        hover:bg-blue-50 dark:bg-slate-800/20 dark:border-slate-700 
        dark:hover:bg-blue-900/20
        transition
      "
    >
      <div className="text-sm font-medium text-slate-900 dark:text-slate-200">
        {title}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {subtitle}
      </div>
    </Link>
  );
}
