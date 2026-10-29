export type PasswordStrength = "empty" | "weak" | "fair" | "strong";

/**
 * A rough strength hint for the sign-up form. It only guides the user; the
 * server applies its own rules (minimum length) when the account is created.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return "empty";
  if (password.length < 8) return "weak";

  let score = 0;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score >= 3) return "strong";
  if (score >= 1) return "fair";
  return "weak";
}
