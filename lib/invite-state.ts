export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function shouldShowPendingInvite(
  invite: { status: string; toEmail: string },
  userEmail: string,
) {
  return invite.status === "pending" && normalizeEmail(invite.toEmail) === normalizeEmail(userEmail);
}
