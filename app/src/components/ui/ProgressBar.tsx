interface ProgressBarProps {
  progress: number; // 0-100
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  color?: "emerald" | "blue" | "amber" | "red";
}

export default function ProgressBar({
  progress,
  showLabel = false,
  size = "md",
  color = "emerald",
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const sizeStyles = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  };

  const colorStyles = {
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  };

  return (
    <div className="w-full">
      <div className={`w-full bg-slate-700 rounded-full overflow-hidden ${sizeStyles[size]}`}>
        <div
          className={`h-full transition-all duration-300 ${colorStyles[color]}`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-xs text-slate-400 text-right">{Math.round(clampedProgress)}%</div>
      )}
    </div>
  );
}
