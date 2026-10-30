import "server-only";
import { errorLog as copy } from "@/content/errors";
import { roleCanAccess } from "@/lib/admin-permissions";
import { rateLimitRules } from "@/server/auth/policy";
import { isPlaceholderEmail } from "@/server/auth/placeholder-email";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { db } from "@/server/db";
import { composeEmail, siteLink } from "./compose";
import { getNotifier } from "./index";

/**
 * Tells every admin who can see the error log about a new or reopened error.
 * The once-an-hour-per-error limit is applied by the caller (notifyAdmins);
 * a site-wide cap here stops a burst of different errors from flooding inboxes.
 * Returns true if emails were sent.
 */
export async function sendNewErrorEmail(groupId: number): Promise<boolean> {
  const group = await db.errorGroup.findUnique({
    where: { id: groupId },
    select: { id: true, message: true, source: true, route: true },
  });
  if (!group) return false;
  if (!(await hitRateLimit(rateLimitRules.errorEmailsPerHour, "all")).allowed) return false;

  const admins = await db.user.findMany({
    where: { role: "admin" },
    select: { email: true, adminRole: true },
  });
  const text = copy.email;
  const email = await composeEmail({
    subject: text.subject(group.message, group.route),
    heading: text.heading,
    footer: "staff",
    blocks: [
      {
        kind: "details",
        rows: [
          { label: text.where, value: copy.sources[group.source] },
          { label: text.route, value: group.route },
          { label: text.message, value: group.message },
        ],
      },
      { kind: "button", label: text.button, href: siteLink(`/admin/errors/${group.id}`) },
      { kind: "text", text: text.limit },
    ],
  });
  let sent = false;
  for (const admin of admins) {
    if (!roleCanAccess(admin.adminRole, "errors") || isPlaceholderEmail(admin.email)) continue;
    await getNotifier().send({ channel: "email", to: admin.email, ...email });
    sent = true;
  }
  return sent;
}
