import EmployeeLayout from "../components/layout/EmployeeLayout";

const modules = [
  {
    id: "intro",
    title: "Introduction to MGR Capital Assistance",
    status: "Completed",
    description: "What we do, how we speak to clients, and how your role fits into the bigger picture.",
  },
  {
    id: "calls",
    title: "Client Call Basics",
    status: "In Progress",
    description: "How to introduce yourself, explain the opportunity, and keep it human and simple.",
  },
  {
    id: "compliance",
    title: "Compliance & Boundaries",
    status: "Locked",
    description: "What you can say, what you cannot say, and how to protect the company and the client.",
  },
];

export default function EmployeeTraining() {
  const mockEmployee = {
    name: "Jordan Carter",
    rank: "Tier 3 — Senior Specialist",
    displayedRate: "60%",
    lifetimeEarnings: "$18,420",
    monthEarnings: "$2,140",
  };

  return (
    <EmployeeLayout employee={mockEmployee}>
      <h1 className="text-xl font-semibold mb-4">Training</h1>
      <div className="space-y-3">
        {modules.map((m) => (
          <div
            key={m.id}
            className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-start justify-between"
          >
            <div>
              <div className="font-semibold text-sm mb-1">{m.title}</div>
              <div className="text-xs text-slate-400 mb-2">{m.description}</div>
              <button className="px-3 py-1 rounded bg-slate-800 text-xs text-slate-100">
                {m.status === "Completed"
                  ? "Review"
                  : m.status === "In Progress"
                  ? "Continue"
                  : "Locked"}
              </button>
            </div>
            <div className="text-xs text-slate-400">{m.status}</div>
          </div>
        ))}
      </div>
    </EmployeeLayout>
  );
}
