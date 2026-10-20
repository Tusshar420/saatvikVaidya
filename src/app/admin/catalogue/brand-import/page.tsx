import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BrandImportForm } from "@/components/admin/brand-import-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { brand as copy } from "@/content/brand";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.import.metaTitle };

const text = copy.import;

/** Launch Your Brand terms from a CSV (P2.1), with a preview before applying. */
export default async function BrandImportPage() {
  await requireAdmin("catalogue", "/admin/catalogue/brand-import");
  return (
    <>
      <Link
        href="/admin/catalogue"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-brand hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {text.back}
      </Link>
      <AdminPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} />
      <BrandImportForm />
    </>
  );
}
