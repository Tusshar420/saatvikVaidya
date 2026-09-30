import "server-only";
import { verification as copy } from "@/content/verification";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { authEnv } from "@/server/env";
import { db } from "@/server/db";
import { getNotifier } from "./index";

// Messages about professional verification. Text lives in
// src/content/verification.ts. Phone-only accounts (placeholder email) get
// an SMS instead of an email.

export type Recipient = {
  name: string;
  email: string;
  phoneNumber: string | null;
};

async function tell(
  user: Recipient,
  email: { subject: string; text: string },
  sms: string,
): Promise<void> {
  if (!isPlaceholderEmail(user.email)) {
    await getNotifier().send({ channel: "email", to: user.email, ...email });
  } else if (user.phoneNumber) {
    await getNotifier().send({ channel: "sms", to: user.phoneNumber, text: sms });
  }
}

/** To the professional: their upload arrived. */
export async function sendDocumentReceived(
  user: Recipient,
  documentLabel: string,
  complete: boolean,
): Promise<void> {
  const { subject, body, sms } = copy.messages.received;
  await tell(
    user,
    { subject, text: body(user.name, documentLabel, complete) },
    sms(documentLabel),
  );
}

/** To every admin with an email address: a professional uploaded a document. */
export async function notifyAdminsOfUpload(
  user: Recipient & { id: string; userTypeLabel: string },
  documentLabel: string,
  complete: boolean,
): Promise<void> {
  const admins = await db.user.findMany({
    where: { role: "admin" },
    select: { email: true },
  });
  const link = new URL(
    `/admin/approvals/detail/${encodeURIComponent(user.id)}`,
    authEnv().BETTER_AUTH_URL,
  ).toString();
  const { subject, body } = copy.messages.adminUploaded;
  for (const admin of admins) {
    if (isPlaceholderEmail(admin.email)) continue;
    await getNotifier().send({
      channel: "email",
      to: admin.email,
      subject: subject(user.name),
      text: body(user.name, user.userTypeLabel, documentLabel, complete, link),
    });
  }
}

/** To the professional: the admin's decision (and the reason, if rejected). */
export async function sendVerificationDecision(
  user: Recipient,
  decision: "approved" | "rejected",
  comment: string | null,
): Promise<void> {
  if (decision === "approved") {
    const { subject, body, sms } = copy.messages.approved;
    await tell(user, { subject, text: body(user.name) }, sms);
  } else {
    const { subject, body, sms } = copy.messages.rejected;
    await tell(user, { subject, text: body(user.name, comment) }, sms);
  }
}
