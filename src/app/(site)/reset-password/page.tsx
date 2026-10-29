import type { Metadata } from "next";
import { z } from "zod";
import { ResetPasswordForm } from "@/components/site/auth/reset-password-form";
import { Eyebrow } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { signIn } from "@/content/sign-in";

const copy = signIn.resetPage;

export const metadata: Metadata = {
  title: copy.title,
  robots: { index: false, follow: false },
  // The token is in the address; don't pass it on to other sites.
  referrer: "no-referrer",
};

// The emailed link (/api/auth/reset-password/<token>) sends people here with
// ?token=…, or with ?error=INVALID_TOKEN when the link has expired or was used.
const querySchema = z.object({
  token: z.string().min(1).max(512).optional().catch(undefined),
  error: z.string().max(64).optional().catch(undefined),
});

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = querySchema.parse(await searchParams);
  const token = query.error ? null : (query.token ?? null);

  return (
    <div className="shell section-y">
      <Card className="mx-auto max-w-lg">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <h1 className="mt-2 text-h3 text-ink">{copy.title}</h1>
        {token && <p className="mt-2 text-sm text-muted">{copy.lead}</p>}
        <div className="mt-6">
          <ResetPasswordForm token={token} />
        </div>
      </Card>
    </div>
  );
}
