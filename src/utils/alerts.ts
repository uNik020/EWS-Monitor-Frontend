import { type EwsRule } from "../utils/types";

export type AlertAction =
  | "approve"
  | "stop"
  | "request_info"
  | "close";

export type AlertHistoryEntry = {
  id: string;
  action: AlertAction;
  timestamp: string;
  comment?: string;
};

export type AlertItem = {
  id: string;
  company: string;
  event_name: string;
  severity: string;
  tat_days: number | null;
  matched_rule: EwsRule | null;
  event_raw: any;
  status: "Pending" | "Approved" | "Stopped" | "Info Requested" | "Closed";
  created_at: string;
  history: AlertHistoryEntry[];
};

export const loadAlerts = (): AlertItem[] => {
  return JSON.parse(localStorage.getItem("ews_alerts") || "[]");
};

export const saveAlerts = (alerts: AlertItem[]) => {
  localStorage.setItem("ews_alerts", JSON.stringify(alerts));
};

export const updateAlert = (updated: AlertItem) => {
  const alerts = loadAlerts();
  const idx = alerts.findIndex((a) => a.id === updated.id);
  if (idx !== -1) {
    alerts[idx] = updated;
    saveAlerts(alerts);
  }
};
