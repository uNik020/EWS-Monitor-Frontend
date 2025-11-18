import { useEffect, useState } from "react";
import Button from "./ui/Button";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { type EwsRule } from "../utils/types";

type Props = {
  open: boolean;
  onClose: () => void;
  eventName: string;
  rules: EwsRule[];
  onSelect: (rule: EwsRule | null) => void;
};

export default function FuzzyMatchModal({ open, onClose, eventName, rules, onSelect }: Props) {
  const [filtered, setFiltered] = useState<EwsRule[]>([]);

  useEffect(() => {
    const e = eventName.toLowerCase();
    setFiltered(rules.filter((r) => r.change_reported?.toLowerCase().includes(e)));
  }, [eventName, rules]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-999 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0d243a] w-full max-w-md rounded-xl p-6 shadow-xl relative border border-slate-200 dark:border-slate-700">
        
        {/* Close Button */}
        <button
          className="absolute top-3 right-3 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={onClose}
        >
          <XMarkIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </button>

        <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-2">
          Manual Matching
        </h2>

        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Select a rule that matches:
        </p>

        <div className="text-sm font-medium mb-3 text-slate-700 dark:text-slate-300">
          Event: <span className="text-blue-600 dark:text-blue-300">{eventName}</span>
        </div>

        <div className="max-h-60 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
          {filtered.length === 0 && (
            <div className="p-3 text-sm text-slate-500 dark:text-slate-400 text-center">
              No rules found.
            </div>
          )}

          {filtered.map((r, i) => (
            <button
              key={i}
              className="
                w-full text-left px-3 py-3 border-b last:border-b-0
                border-slate-200 dark:border-slate-700
                hover:bg-blue-50 dark:hover:bg-blue-900/20
                transition
              "
              onClick={() => {
                onSelect(r);
                onClose();
              }}
            >
              <div className="font-medium text-sm text-slate-800 dark:text-slate-200">
                {r.change_reported}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {r.severity} • TAT {r.tat_days}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <Button
            fullWidth
            variant="ghost"
            onClick={() => {
              onSelect(null);
              onClose();
            }}
          >
            Clear Match
          </Button>
        </div>
      </div>
    </div>
  );
}
