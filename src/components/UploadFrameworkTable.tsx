// UploadFrameworkTable.tsx
import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import * as XLSX from "xlsx";
import Fuse from "fuse.js";
import FileDropzone from "../components/FileDropZone";
import API from "../utils/axios";
import type { EwsRule } from "../utils/types";
import { ArrowDownTrayIcon, TrashIcon } from "@heroicons/react/24/outline";

/* Editable fields (rule_code is auto, but for backend-loaded rows we display it) */
const EDITABLE_FIELDS: { key: Extract<keyof EwsRule, string>; label: string; type?: string }[] = [
  { key: "change_reported", label: "Change Reported", type: "text" },
  { key: "condition", label: "Condition", type: "text" },
  { key: "severity", label: "Severity", type: "select" },
  { key: "primary_action", label: "Primary Action", type: "text" },
  { key: "secondary_action", label: "Secondary Action", type: "text" },
  { key: "tat_days", label: "TAT (days)", type: "number" },
  { key: "assigned_team", label: "Assigned Team", type: "text" },
  { key: "tags", label: "Tags", type: "tags" },
];

const SEVERITY_OPTIONS = ["High", "Medium", "Low"];

type EditableRow = Partial<EwsRule> & {
  __localId: string;
  _errors?: Record<string, string>;
  // backend id (if exists) - many backends use _id; keep flexible
  _id?: string | number;
};

function genLocalId() {
  return `loc_${Math.random().toString(36).slice(2, 9)}`;
}

function cleanHeader(h: any) {
  return String(h || "").trim();
}

function normalizeSeverity(v: any) {
  if (typeof v !== "string") return v;
  const s = v.trim().toLowerCase();
  if (s.startsWith("h")) return "High";
  if (s.startsWith("m")) return "Medium";
  if (s.startsWith("l")) return "Low";
  if (s === "3" || s === "high") return "High";
  if (s === "2" || s === "medium") return "Medium";
  if (s === "1" || s === "low") return "Low";
  return v;
}

/* generate rule_code: R-<num>; use numeric suffix from existing rows if present, otherwise counterRef */
function generateRuleCode(existingRowsAny: any[] = [], counterRef: { current: number }) {
  const nums: number[] = [];
  existingRowsAny.forEach((r: any) => {
    try {
      const rc = r?.rule_code ?? "";
      const m = String(rc).match(/(\d+)$/);
      if (m) nums.push(Number(m[1]));
    } catch (e) {}
  });
  if (nums.length > 0) {
    const max = Math.max(...nums);
    if (max >= counterRef.current) counterRef.current = max + 1;
  }
  const val = counterRef.current++;
  return `R-${val}`;
}

/* Main component */
export default function UploadFrameworkTable(): JSX.Element {
  // raw headers/rows from recent Excel
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [_rawRows, setRawRows] = useState<any[]>([]);

  // editable table rows
  const [rows, setRows] = useState<EditableRow[]>([]);

  // mapping inferred from upload (kept but not shown in UI now)
  const [_mapping, setMapping] = useState<Record<string, string>>({});

  // backend loaded rules (used as suggestion source)
  const [backendRules, setBackendRules] = useState<EwsRule[] | any[]>([]);
  const [loadingBackend, setLoadingBackend] = useState(false);

  // status
  const [_importedCount, setImportedCount] = useState<number | null>(null);
  const [loadingImport, setLoadingImport] = useState(false);
  const [savedDraftExists, setSavedDraftExists] = useState(false);

  // fuse (for suggestions) and per-row suggestion state
  const fuseRef = useRef<any | null>(null);
  const [suggestionsByRow, setSuggestionsByRow] = useState<Record<string, any[]>>({});

  // rule code counter
  const counterRef = useRef<number>(1001);

    // ui state (add to component body)
    const [isUploadModalOpen, setUploadModalOpen] = useState(false);

    // pagination state
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // derived pagination data
    const totalRows = rows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    useEffect(() => {
    // clamp page if rows/pageSize change
    if (page > totalPages) setPage(totalPages);
    }, [pageSize, totalRows, totalPages]);

    const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);

    // wrapper so FileDropzone can call same handler and close modal
    const handleFilesFromModal = async (file: File | File[]) => {
    // your existing handleFile may accept a single file or array; adapt:
    await handleFile(file as any);
    setUploadModalOpen(false);
    };

  useEffect(() => {
    // check saved draft presence
    const d = localStorage.getItem("upload_framework_draft");
    setSavedDraftExists(!!d);

    // Load backend rules (C1)
    loadBackendRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // keep fuse updated whenever backendRules changes
    if (Array.isArray(backendRules) && backendRules.length > 0) {
      try {
        fuseRef.current = new Fuse(backendRules, {
          keys: ["change_reported"],
          threshold: 0.35,
          distance: 100,
          includeScore: true,
        });
      } catch (e) {
        fuseRef.current = null;
      }
    } else {
      fuseRef.current = null;
    }
  }, [backendRules]);

  /* -----------------------
   * Backend interactions (B2)
   * ----------------------- */
  async function loadBackendRules() {
    setLoadingBackend(true);
    try {
      const res = await API.get("/rules");
      const data = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      setBackendRules(data || []);

      // convert to editable rows and preserve backend ids
      const ed: EditableRow[] = (data || []).map((r: any, idx: number) => {
        // normalize fields for inputs
        const out: EditableRow = {
          __localId: genLocalId(),
          _id: r._id ?? r.id ?? (r as any).id ?? undefined,
          rule_code: r.rule_code ?? r.ruleCode ?? r.code ?? `R-${1000 + idx}`,
        };
        EDITABLE_FIELDS.forEach((f) => {
          let v = (r as any)[f.key];
          if (f.key === "tags" && typeof v === "string") {
            v = v.split(",").map((s: string) => s.trim()).filter(Boolean);
          }
          if (f.key === "tat_days") {
            const n = Number(v);
            v = Number.isFinite(n) ? n : "";
          }
          if (f.key === "severity") v = normalizeSeverity(v);
          (out as any)[f.key] = v ?? "";
        });
        return out;
      });

      setRows(ed);
      // ensure counter starts past highest numeric suffix
      try {
        const existingNums: number[] = [];
        (data || []).forEach((r: any) => {
          const rc = r.rule_code ?? "";
          const m = String(rc).match(/(\d+)$/);
          if (m) existingNums.push(Number(m[1]));
        });
        if (existingNums.length) {
          const max = Math.max(...existingNums);
          if (max >= counterRef.current) counterRef.current = max + 1;
        }
      } catch (e) {}
    } catch (err) {
      console.error("Failed to load rules", err);
      alert("Failed to fetch rules from backend.");
    } finally {
      setLoadingBackend(false);
    }
  }

  /* -----------------------
   * File Upload (toolbar button uses FileDropzone as small modal-like)
   * ----------------------- */
  async function handleFile(file: File) {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const first = workbook.SheetNames[0];
      const sheet = workbook.Sheets[first];
      const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });

      // collect headers
      const headersSet = new Set<string>();
      if (Array.isArray(json) && json.length > 0) {
        Object.keys(json[0] || {}).forEach((h) => headersSet.add(cleanHeader(h)));
      }
      if (headersSet.size === 0 && sheet["!ref"]) {
        const firstRow = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, range: 0, defval: "" })[0] || [];
        if (Array.isArray(firstRow)) firstRow.forEach((h: any) => headersSet.add(cleanHeader(h)));
      }

      const headers = Array.from(headersSet);
      const cleaned = (json || []).map((row: any) => {
        const out: Record<string, any> = {};
        Object.entries(row || {}).forEach(([k, v]) => (out[cleanHeader(k)] = v));
        return out;
      });

      setRawHeaders(headers.length ? headers : Object.keys(cleaned[0] ?? {}));
      setRawRows(cleaned);

      // auto-map reasonably
      const lowerMap: Record<string, string> = {};
      headers.forEach((h) => (lowerMap[h.toLowerCase()] = h));

      const initialMap: Record<string, string> = {};
      EDITABLE_FIELDS.forEach((f) => {
        const key = f.key.toLowerCase();
        const labelLower = f.label.toLowerCase();
        const possible = Object.keys(lowerMap).find((lh) => {
          const lhLower = lh.toLowerCase();
          return (
            lhLower === key ||
            lhLower.includes(key) ||
            labelLower.includes(lhLower) ||
            key.includes(lhLower) ||
            lhLower.includes(labelLower)
          );
        });
        if (possible) initialMap[f.key] = lowerMap[possible];
      });

      if (!initialMap["severity"]) {
        const candidate = Object.keys(lowerMap).find((h) => /severity|level|risk/i.test(h));
        if (candidate) initialMap["severity"] = lowerMap[candidate];
      }

      setMapping(initialMap);

      // build editable rows and append to existing table (so user can edit+merge)
      const built: EditableRow[] = (cleaned || []).map((r: any) => {
        const out: EditableRow = { __localId: genLocalId() };
        EDITABLE_FIELDS.forEach((f) => {
          const col = initialMap[f.key];
          let val: any = col ? r[col] : undefined;
          if (f.key === "severity") val = normalizeSeverity(val);
          if (f.key === "tags" && typeof val === "string") {
            val = val.split(",").map((s: string) => s.trim()).filter(Boolean);
          }
          if (f.key === "tat_days") {
            const n = Number(val);
            val = Number.isFinite(n) ? n : "";
          }
          (out as any)[f.key] = val ?? "";
        });
        // rule_code auto-generate for uploaded rows until user imports to backend (server may assign real codes)
        out.rule_code = generateRuleCode(rows as any, counterRef);
        return out;
      });

      setRows((prev) => {
        const combined = [...prev, ...built];
        // save draft quickly
        try {
          localStorage.setItem("upload_framework_draft", JSON.stringify({ headers, rows: combined }));
          setSavedDraftExists(true);
        } catch (e) {}
        return combined;
      });
    } catch (err) {
      console.error(err);
      alert("Failed to parse uploaded file. Ensure XLS/XLSX/CSV.");
    }
  }

  /* -----------------------
   * Row helpers
   * ----------------------- */
  const normalizedPreview = useMemo(() => {
    return rows.map((r) => {
      const copy: any = { ...r };
      delete copy.__localId;
      delete copy._errors;
      return copy as EwsRule;
    });
  }, [rows]);

  function updateRow(localId: string, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((r) => (r.__localId === localId ? { ...r, ...patch } : r)));
  }

  function addEmptyRow(atIndex?: number) {
    const newRow: EditableRow = { __localId: genLocalId() } as any;
    newRow.rule_code = generateRuleCode(rows as any, counterRef);
    EDITABLE_FIELDS.forEach((f) => (newRow as any)[f.key] = f.key === "tags" ? [] : "");
    setRows((prev) => {
      if (typeof atIndex === "number") {
        const copy = [...prev];
        copy.splice(atIndex + 1, 0, newRow);
        return copy;
      }
      return [...prev, newRow];
    });
  }

  async function deleteRow(localId: string) {
    const target = rows.find((r) => r.__localId === localId);
    if (!target) return;
    if (target._id) {
      // existing backend row: call DELETE
      if (!confirm("Delete this rule from database?")) return;
      try {
        await API.delete(`/rules/${target._id}`);
        setRows((prev) => prev.filter((r) => r.__localId !== localId));
        // refresh backend list
        await loadBackendRules();
      } catch (err) {
        console.error(err);
        alert("Failed to delete rule on server.");
      }
    } else {
      // local-only row
      if (!confirm("Delete this local row?")) return;
      setRows((prev) => prev.filter((r) => r.__localId !== localId));
    }
  }

  function moveRow(localId: string, dir: "up" | "down") {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.__localId === localId);
      if (idx === -1) return prev;
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[swapIdx];
      copy[swapIdx] = copy[idx];
      copy[idx] = tmp;
      return copy;
    });
  }

  /* -----------------------
   * Validation
   * ----------------------- */
  function validateAll(): boolean {
    const validated = rows.map((r) => {
      const errors: Record<string, string> = {};
      const cr = (r.change_reported ?? "").toString();
      if (!cr || cr.trim() === "") errors.change_reported = "Required";
      const td = (r.tat_days ?? "");
      if (td !== "" && td !== null && td !== undefined && isNaN(Number(td))) {
        errors.tat_days = "Must be a number";
      }
      if (r.severity) {
        const norm = normalizeSeverity(r.severity);
        if (["High", "Medium", "Low"].includes(String(norm))) {
          (r as any).severity = norm;
        } else {
          errors.severity = "Invalid";
        }
      }
      return { ...r, _errors: errors };
    });
    setRows(validated);
    return validated.every((rr) => !rr._errors || Object.keys(rr._errors).length === 0);
  }

  /* -----------------------
   * Draft/export/import actions
   * ----------------------- */
  function saveDraft() {
    try {
      localStorage.setItem("upload_framework_draft", JSON.stringify({ headers: rawHeaders, rows }));
      setSavedDraftExists(true);
      alert("Draft saved locally.");
    } catch (e) {
      console.error(e);
      alert("Failed to save draft.");
    }
  }

  function loadDraft() {
    try {
      const d = localStorage.getItem("upload_framework_draft");
      if (!d) {
        alert("No draft found.");
        return;
      }
      const parsed = JSON.parse(d);
      setRawHeaders(parsed.headers || []);
      const loadedRows: EditableRow[] = (parsed.rows || []).map((r: any) => ({ ...r, __localId: genLocalId() }));
      setRows(loadedRows);
      setSavedDraftExists(true);
      alert("Draft loaded.");
    } catch (e) {
      console.error(e);
      alert("Failed to load draft.");
    }
  }

  function clearAll() {
    if (!confirm("Clear all rows and uploaded data?")) return;
    setRawHeaders([]);
    setRawRows([]);
    setRows([]);
    setMapping({});
    setImportedCount(null);
    localStorage.removeItem("upload_framework_draft");
    setSavedDraftExists(false);
  }

  function exportJson() {
    try {
      const blob = new Blob([JSON.stringify(normalizedPreview, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      el.href = url;
      el.download = "ews_rules_table.json";
      el.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  }

  /* -----------------------
   * Upsert all rows to backend (B2)
   * - For rows with _id => PUT /rules/:id
   * - For rows without _id => POST /rules
   * This is a batch upsert.
   * ----------------------- */
  async function upsertAll() {
    if (!validateAll()) {
      alert("Fix validation errors before saving.");
      return;
    }
    setLoadingImport(true);
    try {
      const results = [];
      for (const r of rows) {
        const payload: any = { ...r } as any;
        delete payload.__localId;
        delete payload._errors;
        // normalize tags to array/string as backend expects (keep array)
        if (Array.isArray(payload.tags)) {
          // keep as array; server should accept array or join if needed
        }
        if (r._id) {
          // update
          try {
            const res = await API.put(`/rules/${r._id}`, payload);
            results.push(res.data);
          } catch (e) {
            console.error("Failed updating rule", e);
          }
        } else {
          // create
          try {
            const res = await API.post("/rules", payload);
            results.push(res.data);
          } catch (e) {
            console.error("Failed creating rule", e);
          }
        }
      }
      // after upsert, reload backend rules
      await loadBackendRules();
      setImportedCount(results.length);
      localStorage.removeItem("upload_framework_draft");
      setSavedDraftExists(false);
      alert("Saved rules to server.");
    } catch (err) {
      console.error(err);
      alert("Failed to save rules.");
    } finally {
      setLoadingImport(false);
    }
  }

  /* -----------------------
   * Fuse autosuggest handler (option A: use backendRules)
   * - when user types in change_reported cell, compute suggestions and show
   * - picking suggestion autofills severity/primary_action/secondary_action/tat_days
   * ----------------------- */
  function handleChangeReportedInput(localId: string, value: string) {
    updateRow(localId, { change_reported: value });

    // run fuzzy search
    const fuse = fuseRef.current;
    if (!fuse || !value || value.trim().length < 2) {
      setSuggestionsByRow((prev) => ({ ...prev, [localId]: [] }));
      return;
    }
    const res = fuse.search(value, { limit: 6 });
    const suggestions = (Array.isArray(res) ? res : []).map((r: any) => r.item ?? r);
    setSuggestionsByRow((prev) => ({ ...prev, [localId]: suggestions }));
  }

  function applySuggestionToRow(localId: string, suggestion: any) {
    // suggestion is a backend rule object
    const patch: any = {};
    EDITABLE_FIELDS.forEach((f) => {
      const v = suggestion[f.key];
      if (v !== undefined) {
        if (f.key === "tags" && typeof v === "string") {
          patch[f.key] = v.split(",").map((s: string) => s.trim()).filter(Boolean);
        } else if (f.key === "tat_days") {
          const n = Number(v);
          patch[f.key] = Number.isFinite(n) ? n : "";
        } else if (f.key === "severity") {
          patch[f.key] = normalizeSeverity(v);
        } else {
          patch[f.key] = v;
        }
      }
    });
    // set change_reported too (canonical)
    patch.change_reported = suggestion.change_reported ?? (suggestion as any).change_reported ?? patch.change_reported;
    updateRow(localId, patch);
    // clear suggestions for that row
    setSuggestionsByRow((prev) => ({ ...prev, [localId]: [] }));
  }

  /* -----------------------
   * Render
   * ----------------------- */
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
  <div className="p-6 rounded-xl border shadow-sm bg-white dark:bg-[#0d243a] dark:border-slate-700 border-slate-200">

    {/* Header */}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex-1 min-w-0">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-200 truncate">
          Rules Definition — Table Builder
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
          Upload rules or create them manually. Edit cells inline, use fuzzy suggestions for Change Reported, then save to the database.
        </p>
      </div>

      {/* Toolbar: horizontally scrollable on small screens */}
      <div className="mt-3 sm:mt-0 sm:ml-6 w-full sm:w-auto">
        <div className="flex gap-2 items-center overflow-x-auto pb-1">
          {/* Upload button opens modal */}
          <button
            onClick={() => setUploadModalOpen(true)}
            className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm whitespace-nowrap"
            type="button"
          >
            Upload EWS
          </button>

          <button
            onClick={() => addEmptyRow()}
            className="px-3 py-2 rounded-md bg-slate-100 dark:bg-slate-800/30 text-sm whitespace-nowrap"
            type="button"
          >
            Add Row
          </button>

          <button
            onClick={exportJson}
            disabled={rows.length === 0}
            className="px-3 py-2 rounded-md bg-transparent border border-slate-200 dark:border-slate-700 text-sm whitespace-nowrap disabled:opacity-50"
            type="button"
          >
            <ArrowDownTrayIcon className="inline-block w-4 h-4 mr-1 -mt-0.5" /> Export JSON
          </button>

          <button
            onClick={saveDraft}
            disabled={rows.length === 0}
            className="px-3 py-2 rounded-md bg-transparent border border-slate-200 dark:border-slate-700 text-sm whitespace-nowrap disabled:opacity-50"
            type="button"
          >
            Save Draft
          </button>

          <button
            onClick={loadDraft}
            disabled={!savedDraftExists}
            className="px-3 py-2 rounded-md bg-transparent border border-slate-200 dark:border-slate-700 text-sm whitespace-nowrap disabled:opacity-50"
            type="button"
          >
            Load Draft
          </button>

          <button
            onClick={clearAll}
            className="px-3 py-2 rounded-md bg-transparent border border-slate-200 dark:border-slate-700 text-sm whitespace-nowrap"
            type="button"
          >
            <TrashIcon className="inline-block w-4 h-4 mr-1 -mt-0.5" /> Clear
          </button>

          <button
            onClick={upsertAll}
            disabled={rows.length === 0 || loadingImport}
            className="px-3 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm whitespace-nowrap ml-1 disabled:opacity-50"
            type="button"
          >
            {loadingImport ? "Saving..." : `Save (${rows.length})`}
          </button>
        </div>
      </div>
    </div>

    {/* Table with sticky header + scrollable body to limit page height */}
    <div className="mt-6 rounded-lg border bg-white dark:bg-[#0b2034] dark:border-slate-700">
      <div className="w-full overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800/40 sticky top-0 z-10">
            <tr className="text-left">
              <th className="px-2 py-2 text-xs font-semibold min-w-[110px]">Rule Code</th>
              {EDITABLE_FIELDS.map((f) => (
                <th key={f.key} className="px-2 py-3 text-xs font-semibold">{f.label}</th>
              ))}
              <th className="px-3 py-2 text-xs font-semibold text-right w-40">Actions</th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Scrollable body with fixed max height (adjust to taste) */}
      <div className="max-h-[55vh] overflow-auto">
        <table className="min-w-full text-sm">
          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={EDITABLE_FIELDS.length + 3} className="p-8 text-center text-slate-500">
                  {loadingBackend ? "Loading rules..." : "No rules yet — add a row or upload a file."}
                  <div className="mt-4 flex justify-center">
                    <button onClick={() => addEmptyRow()} className="px-3 py-2 rounded-md bg-blue-600 text-white" type="button">
                      Add new rule
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRows.map((r, idx) => {
                const realIndex = (page - 1) * pageSize + idx;
                return (
                  <tr key={r.__localId} className="border-b last:border-b-0 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">

                    <td className="px-3 py-3 min-w-[110px] align-top">
                      <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        {String((r as any).rule_code ?? "")}
                      </div>
                    </td>

                    {EDITABLE_FIELDS.map((f) => (
                      <td key={f.key} className="px-2 py-2 align-top relative">
                        {f.key === "change_reported" ? (
                          <>
                            <input
                              value={String((r as any)[f.key] ?? "")}
                              onChange={(e) => handleChangeReportedInput(r.__localId, e.target.value)}
                              placeholder={f.label}
                              className="px-2 py-1 rounded-md border text-sm w-full bg-white dark:bg-[#0d243a] dark:border-slate-600 dark:text-slate-200"
                            />
                            {Array.isArray(suggestionsByRow[r.__localId]) && suggestionsByRow[r.__localId].length > 0 && (
                              <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-[#082033] border border-slate-200 dark:border-slate-700 rounded-md shadow-lg max-h-52 overflow-auto">
                                {suggestionsByRow[r.__localId].map((sug: any, i: number) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => applySuggestionToRow(r.__localId, sug)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between"
                                  >
                                    <div>
                                      <div className="font-medium">{sug.change_reported}</div>
                                      <div className="text-xs text-slate-500 dark:text-slate-400">{sug.severity ?? ""} {sug.primary_action ? `• ${sug.primary_action}` : ""}</div>
                                    </div>
                                    <div className="text-xs text-slate-400">Select</div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        ) : f.type === "select" ? (
                          <select
                            value={typeof (r as any)[f.key] === "string" ? (r as any)[f.key] : ""}
                            onChange={(e) => updateRow(r.__localId, { [f.key]: e.target.value })}
                            className="px-2 py-1 rounded-md border text-sm w-full bg-white dark:bg-[#0d243a] dark:border-slate-600 dark:text-slate-200"
                          >
                            <option value="">-- choose --</option>
                            {SEVERITY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : f.type === "tags" ? (
                          <input
                            value={Array.isArray((r as any).tags) ? (r as any).tags.join(", ") : (typeof (r as any).tags === "string" ? (r as any).tags : "")}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const tags = raw.split(",").map((s) => s.trim()).filter(Boolean);
                              updateRow(r.__localId, { tags });
                            }}
                            placeholder="tag1, tag2"
                            className="px-2 py-1 rounded-md border text-sm w-full bg-white dark:bg-[#0d243a] dark:border-slate-600 dark:text-slate-200"
                          />
                        ) : (
                          <input
                            value={(r as any)[f.key] ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const next = f.type === "number" ? (raw === "" ? "" : Number(raw)) : raw;
                              updateRow(r.__localId, { [f.key]: next });
                            }}
                            placeholder={f.label}
                            className="px-2 py-1 rounded-md border text-sm w-full bg-white dark:bg-[#0d243a] dark:border-slate-600 dark:text-slate-200"
                          />
                        )}
                      </td>
                    ))}

                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2 text-xs">
                        <button title="Add row below" onClick={() => addEmptyRow(realIndex)} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800/30">+Row</button>
                        <button title="Move up" onClick={() => moveRow(r.__localId, "up")} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800/30">↑</button>
                        <button title="Move down" onClick={() => moveRow(r.__localId, "down")} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800/30">↓</button>
                        <button title="Delete" onClick={() => deleteRow(r.__localId)} className="px-2 py-1 rounded bg-red-50 text-red-700">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer (Pagination + actions) */}
      <div className="mt-4 px-4 py-3 border-t bg-slate-50 dark:bg-transparent flex items-center gap-3">
        {/* Pagination controls */}
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="px-2 py-1 rounded border text-sm bg-white dark:bg-[#0d243a] dark:border-slate-600"
          >
            {[5,10,20,50].map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>

          <div className="text-sm text-slate-600 dark:text-slate-400">
            Page {page} of {totalPages}
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded border text-sm disabled:opacity-50">Prev</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 rounded border text-sm disabled:opacity-50">Next</button>
          </div>
        </div>

        {/* action buttons aligned right */}
        <div className="ml-auto flex items-center gap-3">
          <button onClick={() => addEmptyRow()} className="px-3 py-2 rounded-md bg-blue-600 text-white">Add new rule</button>

          <button onClick={exportJson} disabled={rows.length === 0} className="px-3 py-2 rounded-md border text-sm disabled:opacity-50">
            Export JSON
          </button>

          <button onClick={() => { const ok = validateAll(); if (ok) alert('No validation errors.'); }} className="px-3 py-2 rounded-md border text-sm">
            Validate
          </button>

          <button onClick={upsertAll} disabled={rows.length === 0 || loadingImport} className="px-3 py-2 rounded-md bg-green-600 text-white disabled:opacity-50">
            {loadingImport ? "Saving..." : `Save (${rows.length})`}
          </button>
        </div>
      </div>
    </div>

    {/* Upload Modal */}
    {isUploadModalOpen && (
      <>
        {/* backdrop */}
        <div
          onClick={() => setUploadModalOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        />
        {/* modal panel */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-[#082033] rounded-lg shadow-xl overflow-hidden transform transition-all scale-100 animate-fade-in">
            <div className="p-4 border-b dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Upload EWS File</h3>
                <button onClick={() => setUploadModalOpen(false)} className="text-slate-600 dark:text-slate-300">✕</button>
              </div>
            </div>

            <div className="p-6">
              {/* Use the existing FileDropzone here - it only needs onFiles & accept */}
              <FileDropzone onFiles={handleFilesFromModal} accept=".xls,.xlsx,.csv" />
              <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">Supported: .xlsx, .xls, .csv — first sheet will be parsed</div>
            </div>

            <div className="p-4 border-t dark:border-slate-700 flex justify-end gap-2">
              <button onClick={() => setUploadModalOpen(false)} className="px-3 py-2 rounded border">Cancel</button>
            </div>
          </div>
        </div>
      </>
    )}
  </div>
</div>

  );
}
