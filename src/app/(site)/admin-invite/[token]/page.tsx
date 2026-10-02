import type { Metadata } from "next";
import { AcceptInviteForm } from "@/components/admin/accept-invite-form";
import { Eyebrow } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { adminSecurity } from "@/content/admin-security";
import { findLiveInvite } from "@/server/admin/admins";

const copy = adminSecurity.invite.page;

export const metadata: Metadata = {
  title: copy.metaTitle,
  robots: { index: false, follow: false },
  // The token is in the address; don't pass it on to other sites.
  referrer: "no-referrer",
};

/** The page an admin invitation email links to. */
export default async function AdminInvitePage({
  params,
}: PageProps<"/admin-invite/[token]">) {
  const { token } = await params;
  const invite = await findLiveInvite(token);

  return (
    <div className="shell section-y">
      <Card className="mx-auto max-w-lg">
        <Eyebrow>{copy.metaTitle}</Eyebrow>
        {invite ? (
          <>
            <h1 className="mt-2 text-h3 text-ink">{copy.title}</h1>
            <p className="mt-2 text-sm text-muted">
              {copy.intro(adminSecurity.roles[invite.adminRole])}
            </p>
            <div className="mt-6">
              <AcceptInviteForm token={token} />
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-2 text-h3 text-ink">{copy.invalidTitle}</h1>
            <p className="mt-2 text-sm text-muted">{copy.invalidBody}</p>
          </>
        )}
      </Card>
    </div>
  );
}
