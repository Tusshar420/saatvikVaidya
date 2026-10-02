import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/auth/session";

/** "Content" is a nav group, not a page: start at the homepage sections. */
export default async function AdminContentPage() {
  await requireAdmin("content");
  redirect("/admin/content/sections");
}
