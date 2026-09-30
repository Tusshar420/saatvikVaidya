import "server-only";
import { db } from "@/server/db";
import { isPlaceholderEmail } from "./placeholder-email";

export type AccountView = {
  name: string;
  /** E.164 ("+919876543210"), or null for email-only accounts. */
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  /** Null when the account only has the phone placeholder email. */
  email: string | null;
  emailVerified: boolean;
  userTypeLabel: string;
  isProfessional: boolean;
  verificationStatus: "none" | "pending" | "approved" | "rejected";
};

/**
 * What the /account page shows, read fresh from the database. The phone
 * placeholder email (see placeholder-email.ts) is never shown.
 */
export async function readAccount(userId: string): Promise<AccountView | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      phoneNumber: true,
      phoneNumberVerified: true,
      email: true,
      emailVerified: true,
      verificationStatus: true,
      userType: { select: { label: true, isProfessional: true } },
    },
  });
  if (!user) return null;
  const placeholder = isPlaceholderEmail(user.email);
  return {
    name: user.name,
    phoneNumber: user.phoneNumber,
    phoneNumberVerified: user.phoneNumberVerified,
    email: placeholder ? null : user.email,
    emailVerified: placeholder ? false : user.emailVerified,
    userTypeLabel: user.userType.label,
    isProfessional: user.userType.isProfessional,
    verificationStatus: user.verificationStatus,
  };
}
