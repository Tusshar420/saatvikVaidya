import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ReelForm } from "@/components/admin/reel-form";
import { admin as copy } from "@/content/admin";
import { getReel } from "@/server/admin/content";
import { fieldValuesOf, intId } from "@/server/admin/form";
import { requireAdmin } from "@/server/auth/session";
import { updateReelAction } from "../../../actions";

export const metadata: Metadata = { title: copy.reels.metaTitle };

export default async function EditReelPage({
  params,
}: PageProps<"/admin/content/reels/[id]/edit">) {
  await requireAdmin();
  const id = intId.safeParse((await params).id);
  const reel = id.success ? await getReel(id.data) : null;
  if (!reel) notFound();
  return (
    <>
      <AdminPageHeader
        eyebrow={copy.reels.eyebrow}
        title={copy.reels.editTitle(reel.title)}
      />
      <ReelForm
        mode="edit"
        action={updateReelAction.bind(null, reel.id)}
        initial={{ ...fieldValuesOf(reel), badgeTone: reel.badgeTone ?? "" }}
      />
    </>
  );
}
