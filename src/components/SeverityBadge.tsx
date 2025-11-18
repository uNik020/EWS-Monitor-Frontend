type Props = { severity: string };

export default function SeverityBadge({ severity }: Props) {
  const s = severity.toLowerCase();

  const style =
    s === "high"
      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      : s === "medium"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
      : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";

  return (
    <span className={`px-2 py-1 rounded-md text-[10px] font-medium ${style}`}>
      {severity}
    </span>
  );
}
