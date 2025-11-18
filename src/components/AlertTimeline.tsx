import { type AlertHistoryEntry } from "../utils/alerts";

type Props = { history: AlertHistoryEntry[] };

export default function AlertTimeline({ history }: Props) {
  if (history.length === 0)
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400">
        No actions recorded yet.
      </div>
    );

  return (
    <div className="space-y-3">
      {history.map((h) => (
        <div
          key={h.id}
          className="
            p-4 rounded-xl 
            bg-slate-50 border border-slate-200 
            dark:bg-[#0d243a] dark:border-slate-800 
            shadow-sm
          "
        >
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
              {h.action.replace("_", " ")}
            </span>

            <span className="text-xs text-slate-500 dark:text-slate-400">
              {new Date(h.timestamp).toLocaleString()}
            </span>
          </div>

          {h.comment && (
            <div className="mt-2 text-xs text-slate-700 dark:text-slate-300">
              {h.comment}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
