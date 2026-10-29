import Link from "next/link";
import { Pencil } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { admin as copy } from "@/content/admin";
import { ConfirmDelete } from "./confirm-delete";

/** Edit link and delete button for one row of a content list. */
export function RowActions({
  editHref,
  deleteAction,
  id,
  name,
}: {
  editHref: string;
  deleteAction: (formData: FormData) => Promise<void>;
  id: number;
  name: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 max-md:mt-2 max-md:*:flex-1 md:justify-end">
      <Link
        href={editHref}
        aria-label={`${copy.common.edit} ${name}`}
        className={buttonClasses({ variant: "secondary", size: "sm" })}
      >
        <Pencil aria-hidden className="size-4" />
        {copy.common.edit}
      </Link>
      <ConfirmDelete action={deleteAction} id={id} name={name} />
    </div>
  );
}
