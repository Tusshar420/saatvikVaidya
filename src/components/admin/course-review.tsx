"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { courses as coursesCopy } from "@/content/courses";
import type { CourseStatusKey } from "@/lib/courses";
import { idleForm, type FormState } from "@/server/admin/form";
import { TextAreaField, useFormValues } from "./form-fields";

const text = coursesCopy.review;
const statusLabel = coursesCopy.doctor.status;
const statusBadge = { pending: "orange", published: "success", rejected: "gold" } as const;

/**
 * Staff review of a doctor's course (B2): approve lists it; sending it back
 * needs a note, which the doctor sees in their course area.
 */
export function CourseReview({
  action,
  status,
  authorName,
  reviewNote,
  enrolments,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  status: CourseStatusKey;
  authorName: string;
  reviewNote: string | null;
  enrolments: number;
}) {
  const [state, formAction, pending] = useActionState(action, idleForm);
  const values = useFormValues({ note: reviewNote ?? "" }, state);
  return (
    <section
      aria-labelledby="course-review-title"
      className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="course-review-title" className="font-heading text-h4 text-ink">
            {text.title}
          </h2>
          <p className="text-small text-muted">
            {text.by(authorName)} · {text.enrolments(enrolments)}
          </p>
        </div>
        <Badge variant={statusBadge[status]}>{statusLabel[status]}</Badge>
      </div>
      {state.status === "success" && (
        <FormAlert tone="success" className="mt-4">
          {status === "published" ? text.approved : text.rejected}
        </FormAlert>
      )}
      <form action={formAction} noValidate className="mt-4 flex flex-col gap-4">
        <TextAreaField
          name="note"
          label={text.note}
          values={values}
          maxLength={500}
          optional
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" name="decision" value="approve" loading={pending} className="max-sm:w-full">
            {text.approve}
          </Button>
          <Button
            type="submit"
            name="decision"
            value="reject"
            variant="secondary"
            disabled={pending}
            className="max-sm:w-full"
          >
            {text.reject}
          </Button>
        </div>
      </form>
    </section>
  );
}
