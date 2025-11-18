// src/types/ews.ts
export type EwsRule = {
  rule_code?: string;
  change_reported?: string;
  condition?: string;
  severity?: "High" | "Medium" | "Low" | string;
  primary_action?: string;
  secondary_action?: string;
  tat_days?: number | null;
  assigned_team?: string;
  tags?: string[] | string;
  metadata?: Record<string, any>;
};
