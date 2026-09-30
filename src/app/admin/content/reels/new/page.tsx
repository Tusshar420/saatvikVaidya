import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ReelForm } from "@/components/admin/reel-form";
import { admin as copy } from "@/content/admin";
import { requireAdmin } from "@/server/auth/session";
import { createReelAction } from "../../actions";

export const metadata: Metadata = { title: copy.reels.newTitle };

export default async function NewReelPage() {
  await requireAdmin();
  return (
    <>
      <AdminPageHeader eyebrow={copy.reels.eyebrow} title={copy.reels.newTitle} />
      <ReelForm
        mode="new"
        action={createReelAction}
        initial={{
          key: "",
          title: "",
          mediaKind: "IMAGE",
          type: "PRODUCT",
          badgeTone: "",
          linkLabel: "",
          sortOrder: 100,
          active: false,
        }}
      />
    </>
  );
}
