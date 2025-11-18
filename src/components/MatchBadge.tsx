type Props = { status: "matched" | "unmatched" | "low" };

export default function MatchBadge({ status }: Props) {
  const styles = {
    matched: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    low: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    unmatched: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  }[status];

  return (
    <span className={`px-2 py-1 rounded-md text-[10px] font-medium ${styles}`}>
      {status === "matched" && "Matched"}
      {status === "low" && "Low Confidence"}
      {status === "unmatched" && "Unmatched"}
    </span>
  );
}
