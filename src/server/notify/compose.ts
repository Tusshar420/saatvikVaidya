import "server-only";
import { settingDefaults } from "@/content/settings";
import { getSetting } from "@/server/content/settings";
import { authEnv } from "@/server/env";
import { renderEmail, type EmailContent, type EmailContext, type RenderedEmail } from "./email";
import { getNotifier } from "./index";

// Turns an email's blocks into the finished message (with the site address
// and our phone number in the footer) and sends it.

export async function emailContext(): Promise<EmailContext> {
  const phone = await getSetting("contact.phone").catch(() => settingDefaults["contact.phone"]);
  return { baseUrl: authEnv().BETTER_AUTH_URL, phone };
}

export async function composeEmail(content: EmailContent): Promise<RenderedEmail> {
  return renderEmail(content, await emailContext());
}

export async function sendEmail(to: string, content: EmailContent): Promise<void> {
  await getNotifier().send({ channel: "email", to, ...(await composeEmail(content)) });
}

/** An absolute link to a page of the site. */
export function siteLink(path: string): string {
  return new URL(path, authEnv().BETTER_AUTH_URL).toString();
}
