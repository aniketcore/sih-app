export const allowedEmailDomain = "poornima.org";

export function getDevAllowedEmails() {
  return (import.meta.env.VITE_TEST_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  const normalized = email.trim().toLowerCase();

  if (import.meta.env.VITE_ENABLE_TEST_MODE === "true") {
    return normalized.endsWith(`@${allowedEmailDomain}`) || getDevAllowedEmails().includes(normalized);
  }

  return normalized.endsWith(`@${allowedEmailDomain}`);
}
