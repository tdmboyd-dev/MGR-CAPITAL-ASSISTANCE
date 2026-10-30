import { CaseIntakeForm } from '@/components/CaseIntakeForm';

export default function NewCasePage() {
  return <main className="mx-auto max-w-3xl space-y-6 rounded-xl border bg-card p-5 sm:p-8">
    <h1 className="text-2xl font-semibold">New case</h1>
    <p className="text-muted-foreground">Select the client and review the source information before saving.</p>
    <CaseIntakeForm />
  </main>;
}
