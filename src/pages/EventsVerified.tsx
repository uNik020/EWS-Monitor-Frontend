// src/pages/UploadEvents.tsx
import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import * as XLSX from "xlsx";
import Fuse from "fuse.js";
import FileDropzone from "../components/FileDropZone";

import MatchBadge from "../components/MatchBadge";
import FuzzyMatchModal from "../components/FuzzyMatchModal";
import API from "../utils/axios";

import type { EwsRule } from "../utils/types";

/**
 * UploadEvents (v2)
 *
 * - Two sections/tabs: New Events (sheet 0) and Old Events (sheet 1)
 * - Parse Excel into normalized rows
 * - Fuzzy-match "change_reported" against backend rules (GET /rules)
 * - Save (POST /events) and optionally create alerts (POST /alerts)
 * - Pagination, search + filters, sticky header, draft/save/export
 */

// Generic event row shape used in UI (keeps original raw row in `event_raw`)
type EventRow = {
  __localId?: string; // local-only
  _saved?: boolean; // whether this row was saved to backend (best-effort)
  _errors?: Record<string, string>;
  // normalized fields
  sheetType: "new" | "old";
  sr_no?: string | number;
  company?: string;
  company_pan?: string;
  change_reported?: string;
  description?: string;
  event_date?: string | null; // ISO or empty
  identification_date?: string | null; // ISO or empty
  flag?: string;
  rbi_trigger?: string;
  // fuzzy match
  matchedRule?: EwsRule | null;
  matchStatus?: "unmatched" | "low" | "matched";
  score?: number | null;
  // original raw
  event_raw?: Record<string, any>;
};

const DEFAULT_PAGE_SIZE = 12;

export default function UploadEvents(): JSX.Element {
  // parsed rows per sheet
  const [newRows, setNewRows] = useState<EventRow[]>([]);
  const [oldRows, setOldRows] = useState<EventRow[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<"new" | "old">("new");
  const [_loadingRules, setLoadingRules] = useState(false);
  const [rules, setRules] = useState<EwsRule[]>([]);
  const fuseRef = useRef<any | null>(null);

  // suggestions/modal
  const [selectedForManualMatch, setSelectedForManualMatch] = useState<EventRow | null>(null);
  const [matchModalOpen, setMatchModalOpen] = useState(false);

  // import/save state
  const [saving, setSaving] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  // search & filters & pagination per tab
  const [searchQ, setSearchQ] = useState("");
  const [filterFlag, setFilterFlag] = useState<string>("all");
  const [filterRbi, setFilterRbi] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Keep rawHeaders for display/export if needed
  const [_rawHeadersNew, setRawHeadersNew] = useState<string[]>([]);
  const [_rawHeadersOld, setRawHeadersOld] = useState<string[]>([]);

  // refs to hold original rules loaded once
  const rulesLoadedRef = useRef(false);

  const [isUploadModalOpen, setUploadModalOpen] = useState(false);

  const handleFilesFromModal = async (files: File | File[]) => {
    await handleFile(files as any);
    setUploadModalOpen(false);
  };


  // Load rules from backend (Fuse dataset for suggestions)
  useEffect(() => {
    async function loadRules() {
      setLoadingRules(true);
      try {
        const res = await API.get("/rules");
        const data: EwsRule[] = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
        setRules(data || []);
        rulesLoadedRef.current = true;
      } catch (err) {
        console.error("Failed to load rules", err);
      } finally {
        setLoadingRules(false);
      }
    }
    loadRules();
  }, []);

  // setup fuse when rules change
  useEffect(() => {
    if (rules && rules.length > 0) {
      try {
        fuseRef.current = new Fuse(rules, {
          keys: ["change_reported"],
          threshold: 0.35,
          includeScore: true,
        });
      } catch (e) {
        fuseRef.current = null;
      }
    } else {
      fuseRef.current = null;
    }
  }, [rules]);

  // Utility: generate local id
  const genLocalId = () => `e_${Math.random().toString(36).slice(2, 9)}`;

  // --------------------------
  // Excel parsing & normalization
  // --------------------------
  function normalizeDate(v: any): string | null {
    if (!v && v !== 0) return null;
    // If it's already a Date
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
    // If Excel numeric date (JS number)
    if (typeof v === "number") {
      const date = XLSX.SSF.parse_date_code(v);
      if (date) {
        const d = new Date(Date.UTC(date.y, date.m - 1, date.d));
        return d.toISOString();
      }
    }
    // Try parse string
    const s = String(v).trim();
    const parsed = Date.parse(s);
    if (!isNaN(parsed)) return new Date(parsed).toISOString();
    // Try common dd/mm/yyyy -> convert manually
    const parts = s.split(/[\/\-\.]/).map((p) => p.trim());
    if (parts.length === 3) {
      const [a, b, c] = parts;
      // if first part length 4 -> yyyy-mm-dd
      if (a.length === 4) {
        const iso = `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
        const p = Date.parse(iso);
        if (!isNaN(p)) return new Date(p).toISOString();
      } else {
        // assume dd/mm/yyyy
        const iso = `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
        const p = Date.parse(iso);
        if (!isNaN(p)) return new Date(p).toISOString();
      }
    }
    return null;
  }

  function mapRowToEvent(row: Record<string, any>, sheetType: "new" | "old"): EventRow {
    // heuristics for column names (case-insensitive)
    const lookup = (keys: string[]) => {
      for (const k of keys) {
        const found = Object.keys(row).find((h) => h.toLowerCase().replace(/\s+/g, "") === k.toLowerCase().replace(/\s+/g, ""));
        if (found) return row[found];
      }
      return undefined;
    };

    const sr = lookup(["srno", "sno", "srno.", "sr no", "sr no."]) ?? lookup(["sr", "no", "s.no"]);
    const company = lookup(["nameofcompany", "company", "nameofcompany"]) ?? lookup(["companyname"]);
    const pan = lookup(["companypan", "pan"]) ?? "";
    const changeReported = lookup(["changereported", "change", "event", "eventname"]) ?? "";
    const description = lookup(["description", "details", "desc"]) ?? "";
    const eventDateRaw = lookup(["eventdate", "eventdate " , "event date", "date"]) ?? "";
    const identDateRaw = lookup(["eventidentificationdate", "identificationdate", "event identification date", "identdate"]) ?? "";
    const flag = lookup(["flag", "status", "rfi", "color"]) ?? "";
    const rbiTrigger = lookup(["rbitrigger", "rbi trigger", "rbi", "trigger"]) ?? "";

    const ev: EventRow = {
      __localId: genLocalId(),
      sheetType,
      sr_no: sr ?? "",
      company: company ?? "",
      company_pan: pan ?? "",
      change_reported: changeReported ?? "",
      description: description ?? "",
      event_date: normalizeDate(eventDateRaw),
      identification_date: normalizeDate(identDateRaw),
      flag: (flag ?? "") ? String(flag).trim() : "",
      rbi_trigger: rbiTrigger ?? "",
      matchedRule: null,
      matchStatus: "unmatched",
      score: null,
      event_raw: row,
    };

    // run fuse match immediately if rules available
    if (fuseRef.current && ev.change_reported && String(ev.change_reported).trim().length > 1) {
      try {
        const res = fuseRef.current.search(String(ev.change_reported));
        if (Array.isArray(res) && res.length > 0) {
          const top = res[0];
          const item = top.item ?? top;
          const sc = top.score ?? null;
          if (sc !== null) {
            if (sc < 0.15) {
              ev.matchedRule = item;
              ev.matchStatus = "matched";
              ev.score = sc;
            } else if (sc < 0.35) {
              ev.matchedRule = item;
              ev.matchStatus = "low";
              ev.score = sc;
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }

    return ev;
  }

  // handle file uploaded
  async function handleFile(file: File) {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      // sheet 0 -> new, sheet 1 -> old (if present)
      const sheetNames = workbook.SheetNames || [];
      const sheetNew = workbook.Sheets[sheetNames[0]];
      const jsonNew = sheetNew ? XLSX.utils.sheet_to_json<any>(sheetNew, { defval: "" }) : [];
      const headersNew = jsonNew.length > 0 ? Object.keys(jsonNew[0]) : [];

      const newMapped = (jsonNew || []).map((r: any) => mapRowToEvent(r, "new"));
      setRawHeadersNew(headersNew);
      setNewRows((prev) => {
        const merged = [...prev, ...newMapped];
        try { localStorage.setItem("events_upload_draft", JSON.stringify({ new: merged })); } catch (e) {}
        return merged;
      });

      if (sheetNames.length > 1) {
        const sheetOld = workbook.Sheets[sheetNames[1]];
        const jsonOld = sheetOld ? XLSX.utils.sheet_to_json<any>(sheetOld, { defval: "" }) : [];
        const headersOld = jsonOld.length > 0 ? Object.keys(jsonOld[0]) : [];
        const oldMapped = (jsonOld || []).map((r: any) => mapRowToEvent(r, "old"));
        setRawHeadersOld(headersOld);
        setOldRows((prev) => {
          const mergedOld = [...prev, ...oldMapped];
          try { localStorage.setItem("events_upload_draft", JSON.stringify({ new: newMapped, old: mergedOld })); } catch (e) {}
          return mergedOld;
        });
      }
      // reset paging + filters
      setPage(1);
      setImportResult(null);
    } catch (err) {
      console.error(err);
      alert("Failed to parse uploaded file. Ensure XLS/XLSX/CSV.");
    }
  }

  // --------------------------
  // Filters / search / pagination
  // --------------------------
  function applySearchAndFilters(rows: EventRow[]) {
    let data = rows.slice();

    // search on company, change_reported, description
    const q = String(searchQ ?? "").trim().toLowerCase();
    if (q) {
      data = data.filter((r) => {
        return (
          String(r.company ?? "").toLowerCase().includes(q) ||
          String(r.change_reported ?? "").toLowerCase().includes(q) ||
          String(r.description ?? "").toLowerCase().includes(q)
        );
      });
    }

    // flag filter
    if (filterFlag && filterFlag !== "all") {
      data = data.filter((r) => (r.flag ?? "").toLowerCase() === filterFlag.toLowerCase());
    }

    // rbi filter
    if (filterRbi && filterRbi !== "all") {
      data = data.filter((r) => (String(r.rbi_trigger ?? "").toLowerCase().includes(filterRbi.toLowerCase())));
    }

    return data;
  }

  // pagination helpers
  const getPageCount = (total: number) => Math.max(1, Math.ceil(total / pageSize));
  const ensurePageInRange = (total: number) => {
    const pages = getPageCount(total);
    if (page > pages) setPage(pages);
    if (page < 1) setPage(1);
  };

  // Derived view for active tab
  const activeRows = activeTab === "new" ? newRows : oldRows;
  const filteredRows = useMemo(() => applySearchAndFilters(activeRows), [activeRows, searchQ, filterFlag, filterRbi]);
  const totalFiltered = filteredRows.length;
  useEffect(() => { ensurePageInRange(totalFiltered); }, [totalFiltered]); // adjust page if pageSize changes or filters change

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredRows.slice(start, end);
  }, [filteredRows, page, pageSize]);

  // --------------------------
  // Row-level helpers
  // --------------------------
  function updateRow(localId: string, patch: Partial<EventRow>, sheetType?: "new" | "old") {
    const updater = (prev: EventRow[]) => prev.map((r) => (r.__localId === localId ? { ...r, ...patch } : r));
    if ((sheetType ?? activeTab) === "new") setNewRows((p) => updater(p));
    else setOldRows((p) => updater(p));
  }

  function addEmptyRow(sheet: "new" | "old") {
    const empty: EventRow = {
      __localId: genLocalId(),
      sheetType: sheet,
      sr_no: "",
      company: "",
      company_pan: "",
      change_reported: "",
      description: "",
      event_date: null,
      identification_date: null,
      flag: "",
      rbi_trigger: "",
      matchedRule: null,
      matchStatus: "unmatched",
      score: null,
      event_raw: {},
    };
    if (sheet === "new") setNewRows((p) => [empty, ...p]);
    else setOldRows((p) => [empty, ...p]);
  }

  function deleteLocalRow(localId: string, sheet: "new" | "old") {
    if (!confirm("Delete this row?")) return;
    if (sheet === "new") setNewRows((p) => p.filter((r) => r.__localId !== localId));
    else setOldRows((p) => p.filter((r) => r.__localId !== localId));
  }

  // Manual match (open modal)
  function openManualMatch(row: EventRow) {
    setSelectedForManualMatch(row);
    setMatchModalOpen(true);
  }

  function handleManualMatchPicked(rule: EwsRule | null) {
    if (!selectedForManualMatch) return;
    const localId = selectedForManualMatch.__localId!;
    if (!rule) {
      updateRow(localId, { matchedRule: null, matchStatus: "unmatched", score: null }, selectedForManualMatch.sheetType);
    } else {
      updateRow(localId, {
        matchedRule: rule,
        matchStatus: "matched",
        score: 0,
      }, selectedForManualMatch.sheetType);
    }
    setMatchModalOpen(false);
    setSelectedForManualMatch(null);
  }

  // apply suggestion from Fuse (row suggestions stored in matchedRule when parsing; allow replace)
  // function applySuggestion(localId: string, suggestion: EwsRule) {
  //   updateRow(localId, {
  //     matchedRule: suggestion,
  //     matchStatus: "matched",
  //     score: 0,
  //     change_reported: suggestion.change_reported ?? ("" as any),
  //     // optionally fill severity / tat etc into raw event (left in matchedRule)
  //   }, activeTab);
  // }

  // --------------------------
  // Save All => POST /events and create alerts for matched new rows
  // --------------------------
  async function saveAllToServer() {
    // validate basic required (company & change_reported)
    const allRows = [...newRows, ...oldRows];
    // basic validation
    const bad = allRows.some((r) => !r.company || !r.change_reported);
    if (bad && !confirm("Some rows are missing company or change_reported. Continue and save anyway?")) return;

    setSaving(true);
    setImportResult(null);
    try {
      // Build payload: convert EventRow -> backend schema
      const payload = allRows.map((r) => ({
        event_type: r.sheetType,
        company: r.company || "",
        event_name: r.change_reported || "",
        company_pan: r.company_pan || "",
        flag: r.flag || "",
        rbi_trigger: r.rbi_trigger || "",
        event_date: r.event_date || null,
        identification_date: r.identification_date || null,
        event_raw: r.event_raw || {},
      }));

      // POST all (Mongoose create handles array)
      const res = await API.post("/events", payload);
      const created = Array.isArray(res.data) ? res.data : [res.data];

      // mark as saved in UI (best-effort)
      const markSaved = (arr: EventRow[]) => arr.map((r) => ({ ...r, _saved: true }));
      setNewRows((p) => markSaved(p));
      setOldRows((p) => markSaved(p));

      // Now create alerts for matched new events
      const matchedAlerts = newRows
        .filter((r) => r.matchedRule)
        .map((r) => ({
          company: r.company || "",
          event_name: r.change_reported || "",
          event_raw: r.event_raw || {},
          matched_rule: r.matchedRule,
          severity: r.matchedRule?.severity,
          tat_days: r.matchedRule?.tat_days,
          status: "Pending",
          created_at: new Date().toISOString(),
        }));

      let createdAlertsCount = 0;
      if (matchedAlerts.length > 0) {
        try {
          const aRes = await API.post("/alerts", matchedAlerts);
          const createdAlerts = Array.isArray(aRes.data) ? aRes.data : [aRes.data];
          createdAlertsCount = createdAlerts.length;
        } catch (alertErr) {
          console.error("Failed to create alerts:", alertErr);
        }
      }

      setImportResult(`Saved ${created.length} events. Created ${createdAlertsCount} alerts from matched rules.`);
      alert("Save complete.");
    } catch (err) {
      console.error(err);
      alert("Failed to save events to server.");
    } finally {
      setSaving(false);
    }
  }

  // load existing events from backend to view (non-destructive)
  async function loadExistingEventsFromServer() {
    try {
      const res = await API.get("/events");
      const data = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      // map to EventRow
      const mapped: EventRow[] = (data || []).map((d: any) => ({
        __localId: genLocalId(),
        _saved: true,
        sheetType: (d.event_type === "old") ? "old" : "new",
        company: d.company || "",
        company_pan: d.company_pan || "",
        change_reported: d.event_name || "",
        description: d.event_raw?.description ?? d.description ?? "",
        event_date: d.event_date ? new Date(d.event_date).toISOString() : null,
        identification_date: d.identification_date ? new Date(d.identification_date).toISOString() : null,
        flag: d.flag ?? "",
        rbi_trigger: d.rbi_trigger ?? "",
        matchedRule: null,
        matchStatus: "unmatched",
        score: null,
        event_raw: d.event_raw ?? d,
      }));
      // split by sheetType
      setNewRows(mapped.filter((r) => r.sheetType === "new"));
      setOldRows(mapped.filter((r) => r.sheetType === "old"));
      setImportResult("Loaded existing events from server.");
    } catch (e) {
      console.error(e);
      alert("Failed to load existing events.");
    }
  }

  // load draft from localStorage
  function loadDraft() {
    try {
      const d = localStorage.getItem("events_upload_draft");
      if (!d) {
        alert("No draft present.");
        return;
      }
      const parsed = JSON.parse(d);
      const n: EventRow[] = (parsed.new || []).map((r: any) => ({ ...r, __localId: genLocalId() }));
      const o: EventRow[] = (parsed.old || []).map((r: any) => ({ ...r, __localId: genLocalId() }));
      setNewRows(n);
      setOldRows(o);
      setImportResult("Draft loaded.");
    } catch (err) {
      console.error(err);
      alert("Failed to load draft.");
    }
  }

  function saveDraftLocal() {
    try {
      localStorage.setItem("events_upload_draft", JSON.stringify({ new: newRows, old: oldRows }));
      alert("Draft saved locally.");
    } catch (err) {
      console.error(err);
      alert("Failed to save draft.");
    }
  }

  // export current tab rows as JSON
  function exportCurrentTabJson() {
    const data = activeTab === "new" ? newRows : oldRows;
    try {
      const blob = new Blob([JSON.stringify(data.map((r) => ({ ...(r as any) })), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeTab}_events_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  }

  // helper for rendering date nicely
  function formatDate(iso?: string | null) {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "-";
      return d.toLocaleDateString();
    } catch {
      return "-";
    }
  }

  // sticky header style is via tailwind class on the th elements
  // render table row
  function renderTableRows(rowsToRender: EventRow[]) {
    return rowsToRender.map((r) => (
      <tr key={r.__localId} className="border-b last:border-b-0 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
        <td className="px-3 py-2 align-top text-xs text-slate-500">{r.sr_no ?? "-"}</td>

        <td className="px-3 py-2 align-top">
          <div className="text-sm font-medium text-slate-900 dark:text-slate-200">{r.company || "-"}</div>
          {r.company_pan && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{r.company_pan}</div>}
        </td>

        <td className="px-3 py-2 align-top">
          <div className="text-sm text-slate-800 dark:text-slate-300">{r.change_reported || "-"}</div>
        </td>

        <td className="px-3 py-2 align-top">
          <div className="text-xs text-slate-700 dark:text-slate-400 whitespace-pre-wrap max-w-[600px]">{r.description || "-"}</div>
        </td>

        <td className="px-3 py-2 align-top">{formatDate(r.event_date)}</td>
        <td className="px-3 py-2 align-top">{formatDate(r.identification_date)}</td>

        <td className="px-3 py-2 align-top">
          <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium
            ${r.flag?.toLowerCase()==="red" ? "bg-red-600/10 text-red-600 dark:bg-red-900/20 dark:text-red-300" :
              r.flag?.toLowerCase()==="green" ? "bg-green-600/10 text-green-700 dark:bg-green-900/20 dark:text-green-300" :
              r.flag?.toLowerCase()==="yellow" ? "bg-amber-200 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300" :
              "bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-300"}`}>
            {r.flag || "-"}
          </div>
        </td>

        <td className="px-3 py-2 align-top text-xs">{r.rbi_trigger || "-"}</td>

        {/* Match status & rule */}
        <td className="px-3 py-2 align-top">
          <MatchBadge status={r.matchStatus ?? "unmatched"} />
        </td>

        <td className="px-3 py-2 align-top">
          {r.matchedRule ? (
            <div className="text-xs text-slate-700 dark:text-slate-300 max-w-60">
              {r.matchedRule.change_reported} <span className="text-slate-400">({r.matchedRule.severity})</span>
            </div>
          ) : <div className="text-xs text-slate-400">None</div>}
        </td>

        <td className="px-3 py-2 align-top text-right">
          <div className="flex items-center justify-end gap-2">
            <button className="text-xs text-blue-600 dark:text-blue-300 hover:underline" onClick={() => openManualMatch(r)}>Match</button>
            <button className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800/30" onClick={() => addEmptyRow(r.sheetType)}>+Row</button>
            <button className="text-xs px-2 py-1 rounded bg-red-50 text-red-700" onClick={() => deleteLocalRow(r.__localId!, r.sheetType)}>Delete</button>
          </div>
        </td>
      </tr>
    ));
  }

  // --------------------------
  // Render
  // --------------------------
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="p-6 rounded-xl border shadow-md bg-white dark:bg-[#0d243a] dark:border-slate-700 border-slate-200">

        {/* --- TOP HEADER WRAPPER --- */}
<div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

  {/* ---------- LEFT: Title + Description ---------- */}
  <div className="flex-1 min-w-0">
    <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-200">
      Upload Company Events
    </h2>
    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
      Upload an events Excel file with two sheets (New events, Old events).
      Preview, match to rules, edit and save.
    </p>
  </div>

  {/* ---------- RIGHT: ACTION TOOLBAR (scrollable on small screens) ---------- */}
  <div className="w-full lg:w-auto overflow-x-auto">
    <div className="flex items-center gap-2 min-w-max pb-1">

      {/* Replace giant dropzone with a clean Upload button */}
      <button
        type="button"
        onClick={() => setUploadModalOpen(true)}
        className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm whitespace-nowrap"
      >
        Upload Excel
      </button>

      <button
        className="px-3 py-2 rounded-md bg-slate-100 dark:bg-slate-800/30 text-sm whitespace-nowrap"
        onClick={() => { addEmptyRow('new'); setActiveTab('new'); }}
        type="button"
      >
        Add New Event
      </button>

      <button
        className="px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 text-sm whitespace-nowrap"
        onClick={exportCurrentTabJson}
        type="button"
      >
        Export JSON
      </button>

      <button
        className="px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 text-sm whitespace-nowrap disabled:opacity-40"
        onClick={saveDraftLocal}
        disabled={newRows.length===0 && oldRows.length===0}
        type="button"
      >
        Save Draft
      </button>

      <button
        className="px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 text-sm whitespace-nowrap"
        onClick={loadDraft}
        type="button"
      >
        Load Draft
      </button>

      <button
        className="px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 text-sm whitespace-nowrap"
        onClick={() => { 
          setNewRows([]); 
          setOldRows([]); 
          localStorage.removeItem('events_upload_draft'); 
        }}
        type="button"
      >
        Clear
      </button>

      {/* Save All */}
      <button
        className="px-4 py-2 ml-2 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm whitespace-nowrap disabled:opacity-40"
        disabled={saving || (newRows.length===0 && oldRows.length===0)}
        onClick={saveAllToServer}
        type="button"
      >
        {saving ? "Saving..." : "Save All"}
      </button>

    </div>
  </div>
</div>


        {/* Tab selector */}
        <div className="mt-6">
          <div className="flex items-center gap-3">
            <button onClick={() => { setActiveTab("new"); setPage(1); }} className={`px-4 py-2 rounded-full ${activeTab==="new" ? "bg-blue-700 text-white" : "bg-slate-100 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300"}`}>New Events ({newRows.length})</button>
            <button onClick={() => { setActiveTab("old"); setPage(1); }} className={`px-4 py-2 rounded-full ${activeTab==="old" ? "bg-blue-700 text-white" : "bg-slate-100 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300"}`}>Old Events ({oldRows.length})</button>

            {/* quick loader */}
            <button className="ml-auto text-xs text-slate-500 hover:underline" onClick={() => loadExistingEventsFromServer()}>Load existing events from DB</button>
          </div>
        </div>

        {/* Filters / search */}
        <div className="mt-4 flex flex-col md:flex-row md:items-center md:gap-3 gap-2">
          <div className="flex items-center gap-2">
            <input value={searchQ} onChange={(e) => { setSearchQ(e.target.value); setPage(1); }} placeholder="Search company, event, description" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm w-80 bg-white dark:bg-[#0d243a] dark:text-slate-200" />
            <select value={filterFlag} onChange={(e) => { setFilterFlag(e.target.value); setPage(1); }} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-[#0d243a] dark:text-slate-200">
              <option value="all">Flag: All</option>
              <option value="red">Red</option>
              <option value="yellow">Yellow</option>
              <option value="green">Green</option>
            </select>

            <select value={filterRbi} onChange={(e) => { setFilterRbi(e.target.value); setPage(1); }} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-[#0d243a] dark:text-slate-200">
              <option value="all">RBI Trigger: All</option>
              <option value="others">Others</option>
              <option value="rfa">RFA</option>
              <option value="rfi">RFI</option>
            </select>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="text-xs text-slate-500">Rows per page</div>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="px-2 py-1 rounded border bg-white dark:bg-[#0d243a]">
              {[8, 12, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* Table card */}
        <div className="mt-4 overflow-auto rounded-lg border bg-white dark:bg-[#0b2034] dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/40">
              <tr>
                <th className="sticky top-0 px-3 py-2 text-left text-xs font-semibold">Sr No</th>
                <th className="sticky top-0 px-3 py-2 text-left text-xs font-semibold">Name of Company</th>
                <th className="sticky top-0 px-3 py-2 text-left text-xs font-semibold">Change Reported</th>
                <th className="sticky top-0 px-3 py-2 text-left text-xs font-semibold">Description</th>
                <th className="sticky top-0 px-3 py-2 text-left text-xs font-semibold">Event Date</th>
                <th className="sticky top-0 px-3 py-2 text-left text-xs font-semibold">Event Identification Date</th>
                <th className="sticky top-0 px-3 py-2 text-left text-xs font-semibold">Flag</th>
                <th className="sticky top-0 px-3 py-2 text-left text-xs font-semibold">RBI Trigger</th>
                <th className="sticky top-0 px-3 py-2 text-left text-xs font-semibold">Match</th>
                <th className="sticky top-0 px-3 py-2 text-left text-xs font-semibold">Rule</th>
                <th className="sticky top-0 px-3 py-2 text-xs font-semibold text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-500">
                    {activeRows.length === 0 ? "No events — upload a file or load from server." : "No rows match filters."}
                  </td>
                </tr>
              ) : (
                renderTableRows(pagedRows)
              )}
            </tbody>
          </table>
        </div>

        {/* pagination & status */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalFiltered)} of {totalFiltered} entries
          </div>

          <div className="flex items-center gap-2">
            <button className="px-3 py-1 rounded border bg-white dark:bg-[#0d2434]" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
            <div className="px-3 py-1">{page} / {getPageCount(totalFiltered)}</div>
            <button className="px-3 py-1 rounded border bg-white dark:bg-[#0d2434]" onClick={() => setPage((p) => Math.min(getPageCount(totalFiltered), p + 1))} disabled={page >= getPageCount(totalFiltered)}>Next</button>
          </div>
        </div>

        {importResult && <div className="mt-3 text-sm text-green-600 dark:text-green-400">{importResult}</div>}
      </div>

      {isUploadModalOpen && (
  <>
    {/* Backdrop */}
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
      onClick={() => setUploadModalOpen(false)}
    />

    {/* Modal */}
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white dark:bg-[#082033] rounded-lg shadow-xl animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Upload Events Excel File
          </h3>
          <button onClick={() => setUploadModalOpen(false)} className="text-slate-600 dark:text-slate-300">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <FileDropzone onFiles={handleFilesFromModal} accept=".xls,.xlsx,.csv" />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
            Supported: .xlsx, .xls, .csv — First sheet will be parsed
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t dark:border-slate-700 text-right">
          <button
            onClick={() => setUploadModalOpen(false)}
            className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </>
)}


      {/* Manual match modal */}
      <FuzzyMatchModal
        open={matchModalOpen}
        onClose={() => setMatchModalOpen(false)}
        eventName={selectedForManualMatch?.change_reported || ""}
        rules={rules}
        onSelect={(r) => handleManualMatchPicked(r)}
      />
    </div>
  );
}
