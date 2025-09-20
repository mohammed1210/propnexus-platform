import clsx from "clsx";

export default function Badge({
  children,
  color = "slate",
  className,
}: {
  children: React.ReactNode;
  color?: "green" | "blue" | "indigo" | "slate" | "amber";
  className?: string;
}) {
  const map: Record<string, string> = {
    slate:  "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
    green:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    blue:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
    amber:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  };
  return (
    <span className={clsx("text-xs px-2 py-0.5 rounded", map[color], className)}>
      {children}
    </span>
  );
}