import { AuthPanel } from "../components/auth-panel";

export const dynamic = "force-static";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-950">
      <section className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
            Firebase auth
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            Sign in and manage problem requests.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-700">
            A minimal home page for the auth-first flow.
          </p>
        </div>

        <AuthPanel />
      </section>
    </main>
  );
}
