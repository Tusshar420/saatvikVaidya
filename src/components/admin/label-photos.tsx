"use client";

import { useActionState } from "react";
import { Images } from "lucide-react";
import { loadLabelPhotosAction } from "@/app/admin/catalogue/photos/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { labelPhotos as text } from "@/content/label-photos";
import { idleForm } from "@/server/admin/form";

/**
 * "Client label photos" on /admin/catalogue/photos: loads the client's label
 * photos onto the products that have none yet. Hidden once nothing is left
 * to load, apart from the result of the last press.
 */
export function LabelPhotos({ products, photos }: { products: number; photos: number }) {
  const [state, action, pending] = useActionState(loadLabelPhotosAction, idleForm);
  if (products === 0 && state.status === "idle") return null;
  return (
    <form
      action={action}
      aria-labelledby="label-photos-title"
      className="mt-6 flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5"
    >
      <h2 id="label-photos-title" className="text-base font-extrabold text-ink">
        {text.title}
      </h2>
      <p className="text-sm text-muted">
        {products > 0 ? text.ready(products, photos) : text.none}
      </p>
      {products > 0 && (
        <Button
          type="submit"
          loading={pending}
          icon={<Images aria-hidden className="size-4" />}
          className="self-start max-sm:w-full"
        >
          {pending ? text.pending : text.button}
        </Button>
      )}
      {state.message && (
        <FormAlert tone={state.status === "error" ? "error" : "success"}>{state.message}</FormAlert>
      )}
    </form>
  );
}
