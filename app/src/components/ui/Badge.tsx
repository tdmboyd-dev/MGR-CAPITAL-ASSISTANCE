import { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

export default function Badge({ children, variant = "default" }: BadgeProps) {
  const variantStyles = {
    default: "bg-slate-700 text-slate-200",
    success: "bg-emerald-900 text-emerald-300",
    warning: "bg-amber-900 text-amber-300",
    danger: "bg-red-900 text-red-300",
    info: "bg-blue-900 text-blue-300",
  };

  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${variantStyles[variant]}`}>
      {children}
    </span>
  );
}
