"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent, ModalTrigger } from "@/components/ui/modal";
import { admin as copy } from "@/content/admin";
import { cn } from "@/lib/cn";

/** Outline button in the danger colour, for destructive actions. */
export const dangerButtonClasses =
  "border-danger/40 text-danger hover:border-danger hover:bg-danger-soft";

export type ConfirmDeleteProps = {
  /** Server action that deletes the item (it redirects when done). */
  action: (formData: FormData) => Promise<void>;
  id: number | string;
  /** Name of the item, used in the dialog title and button label. */
  name: string;
  size?: "sm" | "md";
  className?: string;
};

/** "Delete" that asks first, in a dialog, before calling the action. */
export function ConfirmDelete({
  action,
  id,
  name,
  size = "sm",
  className,
}: ConfirmDeleteProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button
          variant="secondary"
          size={size}
          icon={<Trash2 aria-hidden className="size-4" />}
          aria-label={`${copy.common.delete} ${name}`}
          className={cn(dangerButtonClasses, className)}
        >
          {copy.common.delete}
        </Button>
      </ModalTrigger>
      <ModalContent
        title={copy.common.confirmDelete.title(name)}
        description={copy.common.confirmDelete.body}
      >
        <form
          action={(formData) =>
            startTransition(async () => {
              await action(formData);
            })
          }
          className="flex flex-wrap gap-3 max-sm:*:w-full"
        >
          <input type="hidden" name="id" value={id} />
          <Button
            type="submit"
            variant="secondary"
            loading={pending}
            className={dangerButtonClasses}
          >
            {copy.common.confirmDelete.confirm}
          </Button>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            {copy.common.cancel}
          </Button>
        </form>
      </ModalContent>
    </Modal>
  );
}
