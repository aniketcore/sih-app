"use client";

export function FirstYearWarningBanner({ email }: { email?: string | null }) {
  if (!email) return null;

  const normalized = email.trim().toLowerCase();
  const isFirstYear = normalized.startsWith("2026");

  if (isFirstYear) return null;

  return (
    <div className="border border-red-300 bg-red-50 p-3.5 text-xs text-red-900 flex items-start gap-2.5 rounded-none shadow-sm">
      <span className="text-base leading-none">🚨</span>
      <div>
        <p className="font-extrabold uppercase text-red-950 tracking-wide text-xs">THIS PORTAL IS NOT FOR SENIORS!!</p>
        <p className="mt-0.5 text-red-800">
          This portal is strictly for <strong className="font-semibold text-red-950">1st Year Students (2026 Batch) only</strong>. Senior batches are not eligible for this registration process.
        </p>
      </div>
    </div>
  );
}
