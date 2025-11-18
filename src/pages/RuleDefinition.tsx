import { useMemo, useState } from "react";
import PreviewTable from "../components/PreviewTable";
import * as XLSX from "xlsx";
import Button from "../components/ui/Button";
import { ArrowDownTrayIcon, TrashIcon } from "@heroicons/react/24/outline";
import FileDropzone from "../components/FileDropZone";
import API from "../utils/axios";
import type { EwsRule } from "../utils/types";

const KNOWN_FIELDS: { key: Extract<keyof EwsRule, string>; label: string }[] = [
  { key: "rule_code", label: "Rule Code" },
  { key: "change_reported", label: "Change Reported" },
  { key: "condition", label: "Condition" },
  { key: "severity", label: "Severity" },
  { key: "primary_action", label: "Primary Action" },
  { key: "secondary_action", label: "Secondary Action" },
  { key: "tat_days", label: "TAT (days)" },
  { key: "assigned_team", label: "Assigned Team" },
  { key: "tags", label: "Tags" },
];

function cleanHeader(h: string) {
  return String(h || "").trim();
}

export default function UploadFramework() {
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importedRulesCount, setImportedRulesCount] = useState<number | null>(null);

  // -----------------------
  // FILE HANDLING
  // -----------------------
  const handleFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

      const headersSet = new Set<string>();
      if (json.length > 0) Object.keys(json[0]).forEach((h) => headersSet.add(cleanHeader(h)));

      const headers = Array.from(headersSet);

      if (headers.length === 0) {
        const range = XLSX.utils.decode_range(sheet["!ref"] || "");
        if (range.e.r >= range.s.r) {
          const row = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, defval: "" })[0] as any[];
          if (Array.isArray(row)) row.forEach((h) => headersSet.add(cleanHeader(String(h || ""))));
        }
      }

      const cleanedRows = json.map((row) => {
        const out: Record<string, any> = {};
        Object.entries(row).forEach(([k, v]) => (out[cleanHeader(k)] = v));
        return out;
      });

      setRawHeaders(headers.length ? headers : Object.keys(cleanedRows[0] ?? {}));
      setRawRows(cleanedRows);
      setImportedRulesCount(null);

      // AUTO-MAPPING
      const initial: Record<string, string> = {};
      const lowerMap = headers.reduce<Record<string, string>>((acc, h) => {
        acc[h.toLowerCase()] = h;
        return acc;
      }, {});

      KNOWN_FIELDS.forEach((f) => {
        const keyStr = f.key.toLowerCase();
        const labelStr = f.label.toLowerCase();

        const possible = Object.keys(lowerMap).find((lh) => {
          const lhLower = lh.toLowerCase();
          return (
            lhLower === keyStr ||
            lhLower.includes(keyStr) ||
            labelStr.includes(lhLower) ||
            keyStr.includes(lhLower)
          );
        });

        if (possible) initial[f.key] = lowerMap[possible];
      });

      // Severity synonyms
      if (!initial["severity"]) {
        const candidate = Object.keys(lowerMap).find((h) =>
          /severity|level|risk/i.test(h)
        );
        if (candidate) initial["severity"] = lowerMap[candidate];
      }

      setMapping(initial);
    } catch (err) {
      alert("Failed to parse file. Ensure XLS/XLSX/CSV is valid.");
    }
  };

  const headerOptions = useMemo(() => ["-- none --", ...rawHeaders], [rawHeaders]);

  // -----------------------
  // MAPPING
  // -----------------------
  const setMap = (fieldKey: string, colName: string) => {
    setMapping((prev) => ({
      ...prev,
      [fieldKey]: colName === "-- none --" ? undefined! : colName,
    }));
  };

  // -----------------------
  // NORMALIZE ROW
  // -----------------------
  const normalizeRow = (row: Record<string, any>): EwsRule => {
    const rule: EwsRule = {};

    KNOWN_FIELDS.forEach((f) => {
      const col = mapping[f.key];
      if (!col) return;

      let val = row[col];

      if (f.key === "tat_days") {
        const n = Number(val);
        rule[f.key] = Number.isFinite(n) ? Math.trunc(n) : null;
      } else if (f.key === "tags") {
        rule[f.key] =
          typeof val === "string"
            ? val.split(",").map((s) => s.trim()).filter(Boolean)
            : val;
      } else if (f.key === "severity") {
        if (typeof val === "string") {
          const v = val.trim().toLowerCase();
          rule.severity =
            v.startsWith("h") ? "High" : v.startsWith("m") ? "Medium" : v.startsWith("l") ? "Low" : val;
        }
      } else {
        rule[f.key] = val;
      }
    });

    // Store all unused columns in metadata
    const metadata: Record<string, any> = {};
    Object.keys(row).forEach((col) => {
      if (!Object.values(mapping).includes(col)) metadata[col] = row[col];
    });
    if (Object.keys(metadata).length > 0) rule["metadata"] = metadata;

    return rule;
  };

  const normalizedPreview = useMemo(
    () => rawRows.map((row) => normalizeRow(row)),
    [rawRows, mapping]
  );

  // -----------------------
  // IMPORT RULES BACKEND
  // -----------------------
  const importToBackend = async () => {
    try {
      const res = await API.post("/rules", normalizedPreview);
      setImportedRulesCount(res.data.length);
      alert("Rules imported successfully!");
    } catch (err) {
      alert("Failed to import rules.");
    }
  };

  const clearAll = () => {
    setRawHeaders([]);
    setRawRows([]);
    setMapping({});
    setImportedRulesCount(null);
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(normalizedPreview, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ews_rules_preview.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // -----------------------
  // UI RENDER
  // -----------------------
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div
        className="
          p-6 rounded-xl border shadow-md
          bg-white border-slate-200
          dark:bg-[#0d243a] dark:border-slate-700
        "
      >
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">
              Upload EWS Framework
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-lg">
              Upload your rules Excel file, map columns, and preview EWS rules before importing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={downloadJson}>
              <ArrowDownTrayIcon className="w-4 h-4" /> Export Preview
            </Button>

            <Button variant="ghost" onClick={clearAll}>
              <TrashIcon className="w-4 h-4" /> Clear
            </Button>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT SIDE: FILE DROPZONE + Info */}
          <div className="flex flex-col gap-4">
            <FileDropzone onFiles={handleFile} />

            <div
              className="
                p-4 rounded-lg border text-xs
                bg-slate-100 border-slate-300
                dark:bg-slate-800/40 dark:border-slate-700
                text-slate-700 dark:text-slate-300
              "
            >
              <strong className="block mb-1">Tips:</strong>
              <ul className="list-disc pl-4 space-y-1">
                <li>Ensure the first row contains column headings.</li>
                <li>Map Excel columns to rule fields using the panel.</li>
                <li>Unmapped columns are added under metadata.</li>
              </ul>
            </div>
          </div>

          {/* RIGHT SIDE: MAPPING + PREVIEW */}
          <div className="lg:col-span-2 p-5 rounded-xl border bg-white shadow-sm dark:bg-[#0b2034] dark:border-slate-700">

            {/* MAPPING */}
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200">
              Column Mapping
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Link Excel columns to EWS rule fields. Unmapped fields will remain empty.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {KNOWN_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {f.label}
                  </label>
                  <select
                    value={mapping[f.key] ?? "-- none --"}
                    onChange={(e) => setMap(f.key, e.target.value)}
                    className="
                      px-3 py-2 rounded-md text-sm w-full
                      bg-white border border-slate-300
                      dark:bg-[#0b2034] dark:border-slate-600 dark:text-slate-200
                      focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500
                    "
                  >
                    {headerOptions.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* HEADER CHIPS */}
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                Detected Headers
              </h4>

              <div className="flex flex-wrap gap-2 mt-2">
                {rawHeaders.length === 0 ? (
                  <span className="text-xs text-slate-500">Upload a file to begin.</span>
                ) : (
                  rawHeaders.map((h) => (
                    <span
                      key={h}
                      className="
                        px-2 py-1 rounded text-xs
                        bg-blue-600/10 text-blue-700 border border-blue-300/40
                        dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700
                      "
                    >
                      {h}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* PREVIEW TABLE */}
            {rawRows.length > 0 && (
              <>
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2">
                    Preview (first 8 rows)
                  </h4>

                  <PreviewTable headers={rawHeaders} rows={rawRows} limit={8} />
                </div>

                {/* BUTTONS */}
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Button onClick={importToBackend}>
                    Import Rules ({rawRows.length})
                  </Button>

                  <Button variant="ghost" onClick={downloadJson}>
                    Download JSON
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() =>
                      window.scrollTo({ top: 0, behavior: "smooth" })
                    }
                  >
                    Scroll Top
                  </Button>
                </div>

                {importedRulesCount !== null && (
                  <div className="mt-2 text-sm text-green-600 dark:text-green-400 font-medium">
                    Successfully imported {importedRulesCount} rule(s).
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
