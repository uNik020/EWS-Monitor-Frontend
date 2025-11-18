type PreviewRow = Record<string, any>;

type Props = {
  headers: string[];
  rows: PreviewRow[];
  limit?: number;
  className?: string;
};

export default function PreviewTable({ headers, rows, limit = 10, className }: Props) {
  const showRows = rows.slice(0, limit);

  return (
    <div
      className={`overflow-auto rounded-xl bg-white dark:bg-[#0d243a] border border-slate-200 dark:border-slate-700 shadow ${className}`}
    >
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        
        <thead className="bg-slate-50 dark:bg-slate-800/40">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="text-sm">
          {showRows.map((row, idx) => (
            <tr
              key={idx}
              className={
                idx % 2 === 0
                  ? "bg-white dark:bg-[#0b2034]"
                  : "bg-slate-50 dark:bg-slate-800/20"
              }
            >
              {headers.map((h) => (
                <td key={h} className="px-3 py-2 text-slate-700 dark:text-slate-200 align-top">
                  <div className="whitespace-pre-wrap max-w-xs wrap-break-word">
                    {String(row[h] ?? "")}
                  </div>
                </td>
              ))}
            </tr>
          ))}

          {showRows.length === 0 && (
            <tr>
              <td
                colSpan={headers.length}
                className="px-3 py-6 text-center text-slate-500 dark:text-slate-400"
              >
                No rows to preview
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {rows.length > limit && (
        <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 text-right">
          Showing {limit} of {rows.length} rows
        </div>
      )}
    </div>
  );
}
