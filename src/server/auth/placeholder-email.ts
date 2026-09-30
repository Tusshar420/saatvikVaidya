// Better Auth needs an email on every user. Accounts created by phone OTP get
// a placeholder on the reserved ".invalid" top-level domain (RFC 2606), which
// can never receive mail. It is never shown to the user or sent anything, and
// nobody can register an email on this domain.

const PLACEHOLDER_DOMAIN = "phone.saatvikvaidya.invalid";

/** "+919876543210" -> "919876543210@phone.saatvikvaidya.invalid" */
export function placeholderEmailFor(phoneNumber: string): string {
  return `${phoneNumber.replace(/\D/g, "")}@${PLACEHOLDER_DOMAIN}`;
}

export function isPlaceholderEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${PLACEHOLDER_DOMAIN}`);
}
