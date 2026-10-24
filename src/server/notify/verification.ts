import "server-only";
import { notifications as inApp } from "@/content/notifications";
import { verification as copy } from "@/content/verification";
import { roleCanAccess } from "@/lib/admin-permissions";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { authEnv } from "@/server/env";
import { db } from "@/server/db";
import { createNotifications } from "@/server/notifications/notifications";
import { getNotifier } from "./index";

// Messages about professional verification. Text lives in
// src/content/verification.ts. Phone-only accounts (placeholder email) get
// an SMS instead of an email. Each message also saves an in-app
// notification (the header's bell); the admins' ones go to admins whose role
// covers approvals.

export type Recipient = {
  id: string;
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
  await createNotifications([
    {
      userId: user.id,
      kind: "verification",
      title: inApp.messages.documentReceived.title(documentLabel),
      body: inApp.messages.documentReceived.body(complete),
      href: "/account",
    },
  ]);
  await tell(
    user,
    { subject, text: body(user.name, documentLabel, complete) },
    sms(documentLabel),
  );
}

/** To every admin with an email address: a professional uploaded a document. */
export async function notifyAdminsOfUpload(
  user: Recipient & { userTypeLabel: string },
  documentLabel: string,
  complete: boolean,
): Promise<void> {
  const admins = await db.user.findMany({
    where: { role: "admin" },
    select: { id: true, email: true, adminRole: true },
  });
  const path = `/admin/approvals/detail/${encodeURIComponent(user.id)}`;
  await createNotifications(
    admins
      .filter((admin) => roleCanAccess(admin.adminRole, "approvals"))
      .map((admin) => ({
        userId: admin.id,
        kind: "admin" as const,
        title: inApp.messages.adminUploaded.title(user.name),
        body: inApp.messages.adminUploaded.body(documentLabel, user.userTypeLabel, complete),
        href: path,
      })),
  );
  const link = new URL(path, authEnv().BETTER_AUTH_URL).toString();
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
  const message = decision === "approved" ? inApp.messages.approved : null;
  await createNotifications([
    {
      userId: user.id,
      kind: "verification",
      title: message ? message.title : inApp.messages.rejected.title,
      body: message ? message.body : inApp.messages.rejected.body(comment),
      href: "/account",
    },
  ]);
  if (decision === "approved") {
    const { subject, body, sms } = copy.messages.approved;
    await tell(user, { subject, text: body(user.name) }, sms);
  } else {
    const { subject, body, sms } = copy.messages.rejected;
    await tell(user, { subject, text: body(user.name, comment) }, sms);
  }
}
