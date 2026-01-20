interface SimpleStatCardProps {
  label: string;
  value: string;
}

export default function SimpleStatCard({ label, value }: SimpleStatCardProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
