"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { brand as copy } from "@/content/brand";
import { brandStages, stageNoteMax } from "@/lib/brand-stage";
import { orderIdPattern } from "@/lib/orders";
import type { FormState } from "@/server/admin/form";
import { requireAdmin } from "@/server/auth/session";
import { advanceProduction, type StageError } from "@/server/brand/stages";
import { ShippingProviderUnavailableError } from "@/server/shipping";

// Server action for /admin/brand-orders/[id]: move the order through
// production (In production, Quality check, Dispatched, Delivered). Checks
// the admin session itself, validates its input with Zod and returns only a
// message. Uploading a proof is /api/brand-orders/[id]/proofs; cancelling is
// cancelOrderAction on /admin/orders.

const text = copy.admin.detail;

const schema = z.object({
  orderId: z.string().regex(orderIdPattern),
  from: z.enum(brandStages),
  to: z.enum(["in_production", "quality_check", "dispatched", "delivered"]),
  note: z.string().trim().max(stageNoteMax).optional(),
});

export async function advanceStageAction(_: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin("orders");
  const parsed = schema.safeParse({
    orderId: formData.get("orderId"),
    from: formData.get("from"),
    to: formData.get("to"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) return { status: "error", message: text.results.not_allowed };
  const { orderId, from, to, note } = parsed.data;
  let result;
  try {
    result = await advanceProduction({ actorId: user.id, orderId, from, to, note: note || null });
  } catch (error) {
    if (error instanceof ShippingProviderUnavailableError) {
      return { status: "error", message: text.results.shipping_off };
    }
    throw error;
  }
  revalidatePath("/admin", "layout");
  if (!result.ok) {
    const code: StageError = result.error;
    return { status: "error", message: text.results[code] };
  }
  if (!result.changed) return { status: "success", message: text.results.unchanged };
  return { status: "success", message: text.results.moved(copy.detail.stageLabels[to]) };
}
