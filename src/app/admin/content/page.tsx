import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/auth/session";

/** "Content" is a nav group, not a page: start at reels. */
export default async function AdminContentPage() {
  await requireAdmin();
  redirect("/admin/content/reels");
}
