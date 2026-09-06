import { AuthPanel } from "../../components/auth-panel";

export default function TeamPage() {
  return (
    <main className="bg-white p-6 text-slate-900">
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-2xl font-bold">Team Requests</h1>
        <AuthPanel />
      </div>
    </main>
  );
}
