import EmployeeLayout from "../components/layout/EmployeeLayout";

export default function EmployeeOffice() {
  // In real build, fetch employee, rank, cases, earnings from API
  const mockEmployee = {
    name: "Jordan Carter",
    rank: "Tier 3 — Senior Specialist",
    displayedRate: "60%",
    lifetimeEarnings: "$18,420",
    monthEarnings: "$2,140",
  };

  return (
    <EmployeeLayout employee={mockEmployee}>
      <section className="mb-6">
        <h1 className="text-xl font-semibold mb-2">My Cases</h1>
        <p className="text-sm text-slate-400 mb-4">
          These are the clients currently assigned to you. Follow the scripts, update notes, and move them through the steps.
        </p>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-sm text-slate-300">
          <p>No cases loaded yet. In production, this will list active cases with status.</p>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Scripts & Tools</h2>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-sm text-slate-300 space-y-2">
          <p className="font-semibold">Initial Call Script (Human, Simple):</p>
          <p>
            “Hey, is this [Name]? My name is [Your Name], I’m with MGR Capital Assistance. I’m reaching out because your property at [address] was recently sold by the county, and in some cases there’s money left over that the owner can still claim.
          </p>
          <p>
            I’m not here to sell you anything — I just help people understand what’s available and handle the paperwork if they decide to move forward. If you’d like, I can check your case and let you know what it looks like. There’s no upfront cost.”
          </p>
        </div>
      </section>
    </EmployeeLayout>
  );
}