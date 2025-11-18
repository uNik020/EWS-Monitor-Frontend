import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../utils/axios";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import SeverityBadge from "../components/SeverityBadge";

type Alert = {
  _id: string;
  company: string;
  event_name: string;
  severity?: string;
  status?: string;
  tat_days?: number;
  createdAt?: string;
};

export default function AlertsList() {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState("all");
  const [loading, setLoading] = useState(false);

  const fetchAlerts = async () => {
    setLoading(true);

    try {
      const params: any = { limit: 200 };
      if (q) params.q = q;
      if (severity !== "all") params.severity = severity;

      const res = await API.get("/alerts", { params });
      setAlerts(res.data.data || []);
    } catch {
      alert("Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchAlerts();
  }, [token]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

      <div
        className="
          p-6 rounded-xl border shadow-md 
          bg-white border-slate-200 
          dark:bg-[#0d243a] dark:border-slate-700
        "
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">
              Alerts — Review
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Review incoming alerts and take actions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search company/event"
              className="
                px-3 py-2 rounded-lg text-sm
                bg-white border border-slate-300 
                dark:bg-[#0b2034] dark:border-slate-700 dark:text-slate-200
                focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500
              "
            />

            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="
                px-3 py-2 rounded-lg text-sm
                bg-white border border-slate-300
                dark:bg-[#0b2034] dark:border-slate-700 dark:text-slate-200
                focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500
              "
            >
              <option value="all">All</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <Button variant="ghost" onClick={fetchAlerts}>Refresh</Button>
          </div>
        </div>

        {/* Table */}
        <div
          className="
            mt-6 overflow-auto rounded-xl border 
            border-slate-200 dark:border-slate-700
          "
        >
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/40">
              <tr>
                {["Company", "Event", "Severity", "Status", "Actions"].map((th) => (
                  <th
                    key={th}
                    className="px-4 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase"
                  >
                    {th}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-500 dark:text-slate-400">
                    Loading...
                  </td>
                </tr>
              )}

              {!loading && alerts.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-500 dark:text-slate-400">
                    No alerts found
                  </td>
                </tr>
              )}

              {!loading &&
                alerts.map((a) => (
                  <tr
                    key={a._id}
                    className="
                      border-b border-slate-100 dark:border-slate-800
                      hover:bg-blue-50 dark:hover:bg-blue-900/20
                      transition
                    "
                  >
                    <td className="px-4 py-2 text-slate-900 dark:text-slate-200">{a.company}</td>
                    <td className="px-4 py-2 text-slate-900 dark:text-slate-200">{a.event_name}</td>

                    <td className="px-4 py-2">
                      <SeverityBadge severity={a.severity || "Low"} />
                    </td>

                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                      {a.status}
                    </td>

                    <td className="px-4 py-2 text-right">
                      <Link
                        to={`/alerts/${a._id}`}
                        className="
                          text-xs font-medium text-blue-700 dark:text-blue-300
                          hover:underline
                        "
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
