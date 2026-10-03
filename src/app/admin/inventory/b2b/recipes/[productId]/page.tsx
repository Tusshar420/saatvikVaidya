import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecipeForm } from "@/components/admin/inventory-forms";
import { InventoryTabs } from "@/components/admin/inventory-tabs";
import { AdminPageHeader } from "@/components/admin/page-header";
import { buttonClasses } from "@/components/ui/button";
import { inventory as copy } from "@/content/inventory";
import { readRecipeEditor } from "@/server/admin/inventory";
import { intId } from "@/server/admin/form";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: copy.recipe.metaTitle };

const text = copy.recipe;

export default async function RecipePage({ params }: PageProps<"/admin/inventory/b2b/recipes/[productId]">) {
  await requireAdmin("inventory");
  const id = intId.safeParse((await params).productId);
  const found = id.success ? await readRecipeEditor(id.data) : null;
  if (!found) notFound();
  const { product, components, makeable } = found;

  return (
    <>
      <AdminPageHeader
        eyebrow={copy.eyebrow}
        title={text.title(product.name)}
        description={text.intro}
        action={
          <Link href="/admin/inventory/b2b" className={buttonClasses({ variant: "secondary" })}>
            {text.back}
          </Link>
        }
      />
      <InventoryTabs active="b2b" />
      <p className="mt-4 text-sm font-bold text-ink">{text.makeable(makeable, "units")}</p>
      {!product.brandEligible && <p className="mt-1 text-sm text-muted">{text.notLaunch}</p>}
      <div className="mt-6 max-w-3xl">
        <RecipeForm
          productId={product.id}
          lines={product.recipeLines.map((line) => ({
            componentId: line.componentId,
            name: line.component.name,
            unit: line.component.unit,
            quantity: line.quantity,
          }))}
          components={components}
        />
      </div>
    </>
  );
}
