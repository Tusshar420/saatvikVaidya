import type { Metadata } from "next";
import Link from "next/link";
import { InventoryTabs } from "@/components/admin/inventory-tabs";
import { NewComponentForm } from "@/components/admin/inventory-forms";
import { AdminPageHeader } from "@/components/admin/page-header";
import { buttonClasses } from "@/components/ui/button";
import { inventory as copy } from "@/content/inventory";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.newComponent.title };

export default async function NewComponentPage() {
  await requireAdmin("inventory");
  return (
    <>
      <AdminPageHeader
        eyebrow={copy.eyebrow}
        title={copy.newComponent.title}
        action={
          <Link href="/admin/inventory/b2b" className={buttonClasses({ variant: "secondary" })}>
            {copy.newComponent.back}
          </Link>
        }
      />
      <InventoryTabs active="b2b" />
      <div className="mt-6">
        <NewComponentForm />
      </div>
    </>
  );
}
