"use client";

import { useActionState } from "react";
import { Images, RefreshCw } from "lucide-react";
import { loadLabelPhotosAction } from "@/app/admin/catalogue/photos/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { labelPhotos as text } from "@/content/label-photos";
import { idleForm } from "@/server/admin/form";

/**
 * "Client label photos" on /admin/catalogue/photos: loads the client's label
 * photos onto the products that have none yet, and replaces older copies
 * (with the wide white margin) with the trimmed ones. Hidden once there is
 * nothing to do, apart from the result of the last press.
 */
export function LabelPhotos({
  products,
  photos,
  outdated,
}: {
  products: number;
  photos: number;
  outdated: number;
}) {
  const [state, action, pending] = useActionState(loadLabelPhotosAction, idleForm);
  if (products === 0 && outdated === 0 && state.status === "idle") return null;
  return (
    <form
      action={action}
      aria-labelledby="label-photos-title"
      className="mt-6 flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5"
    >
      <h2 id="label-photos-title" className="text-base font-extrabold text-ink">
        {text.title}
      </h2>
      {products > 0 && <p className="text-sm text-muted">{text.ready(products, photos)}</p>}
      {outdated > 0 && <p className="text-sm text-muted">{text.outdated(outdated)}</p>}
      {products === 0 && outdated === 0 && <p className="text-sm text-muted">{text.none}</p>}
      {(products > 0 || outdated > 0) && (
        <div className="flex flex-wrap gap-3">
          {products > 0 && (
            <Button
              type="submit"
              name="intent"
              value="load"
              loading={pending}
              icon={<Images aria-hidden className="size-4" />}
              className="max-sm:w-full"
            >
              {pending ? text.pending : text.button}
            </Button>
          )}
          {outdated > 0 && (
            <Button
              type="submit"
              name="intent"
              value="update"
              variant={products > 0 ? "secondary" : "primary"}
              loading={pending}
              icon={<RefreshCw aria-hidden className="size-4" />}
              className="max-sm:w-full"
            >
              {pending ? text.pending : text.update}
            </Button>
          )}
        </div>
      )}
      {state.message && (
        <FormAlert tone={state.status === "error" ? "error" : "success"}>{state.message}</FormAlert>
      )}
    </form>
  );
}
