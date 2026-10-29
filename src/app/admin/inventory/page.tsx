import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/auth/session";

/** Inventory opens on the B2C page; B2B is the other tab. */
export default async function InventoryPage() {
  await requireAdmin("inventory");
  redirect("/admin/inventory/b2c");
}
