import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../utils/axios";
import Button from "../components/ui/Button";
import AlertTimeline from "../components/AlertTimeline";
import SeverityBadge from "../components/SeverityBadge";

type AlertType = {
  _id: string;
  company: string;
  event_name: string;
  matched_rule?: any;
  severity?: string;
  tat_days?: number;
  status?: string;
  event_raw?: any;
  history?: Array<any>;
  createdAt?: string;
};

export default function AlertDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [alertData, setAlert] = useState<AlertType | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAlert = async () => {
    if (!id) return;
    setLoading(true);

    try {
      const res = await API.get(`/alerts/${id}`);
      setAlert(res.data);
    } catch (err) {
      alert("Failed to load alert");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlert();
  }, [id]);

  const takeAction = async (action: "approve" | "stop" | "request_info" | "close") => {
    if (!id) return;
    setActionLoading(true);

    try {
      const res = await API.patch(`/alerts/${id}`, { action, comment });
      setAlert(res.data);
      setComment("");
      alert("Action recorded");
    } catch (err) {
      alert("Failed to record action");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !alertData) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center text-slate-500 dark:text-slate-400">Loading alert...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div
        className="
          p-6 rounded-xl shadow-md border 
          bg-gray-300 text-blue-950 border-slate-200
          dark:bg-[#0d243a] dark:border-slate-700
        "
      >

        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Alert Details</h2>
            <div className="text-xs text-slate-500 dark:text-slate-400">ID: {alertData._id}</div>
          </div>

          <div className="text-right">
            <SeverityBadge severity={alertData.severity || "Low"} />
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Status:{" "}
              <span className="font-medium text-slate-900 dark:text-slate-200">
                {alertData.status}
              </span>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InfoItem label="Company" value={alertData.company} />
          <InfoItem label="Event" value={alertData.event_name} />
          <InfoItem label="TAT" value={`${alertData.tat_days ?? "-"} days`} />
          <InfoItem label="Created" value={new Date(alertData.createdAt || "").toLocaleString()} />
        </div>

        {/* Matched Rule */}
        <div className="mt-8">
          <h3 className="section-title">Matched Rule</h3>

          {alertData.matched_rule ? (
            <div
              className="
                mt-3 p-4 rounded-lg border 
                bg-slate-50 border-slate-200 
                dark:bg-slate-800/30 dark:border-slate-700
              "
            >
              <div className="font-medium text-sm dark:text-slate-200">
                {alertData.matched_rule.change_reported}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {alertData.matched_rule.primary_action}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">No matched rule</p>
          )}
        </div>

        {/* Raw Event Data */}
        <div className="mt-8">
          <h3 className="section-title">Raw Event Data</h3>
          <pre
            className="
              bg-slate-100 dark:bg-slate-800/40 
              p-4 rounded-lg text-xs overflow-auto max-h-64
              border border-slate-200 dark:border-slate-700
            "
          >
            {JSON.stringify(alertData.event_raw || {}, null, 2)}
          </pre>
        </div>

        {/* Take Action */}
        <div className="mt-8">
          <h3 className="section-title">Take Action</h3>

          <textarea
            className="
              w-full mt-2 rounded-lg p-3 text-sm
              bg-white border border-slate-300 
              dark:bg-[#0b2034] dark:border-slate-700 dark:text-slate-200 
              focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500 
            "
            placeholder="Add comment (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Button onClick={() => takeAction("approve")} disabled={actionLoading}>Approve</Button>
            <Button variant="danger" onClick={() => takeAction("stop")} disabled={actionLoading}>Reject</Button>
            <Button variant="ghost" onClick={() => takeAction("request_info")} disabled={actionLoading}>Request Info</Button>
            <Button variant="ghost" onClick={() => takeAction("close")} disabled={actionLoading}>Close</Button>
          </div>
        </div>

        {/* History */}
        <div className="mt-8">
          <h3 className="section-title mb-2">Action History</h3>
          <AlertTimeline history={alertData.history || []} />
        </div>

        <div className="mt-8 text-right">
          <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-sm font-medium text-slate-900 dark:text-slate-200 mt-0.5">{value}</div>
    </div>
  );
}
