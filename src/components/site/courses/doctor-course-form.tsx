"use client";

import { useActionState, type ComponentProps } from "react";
import Link from "next/link";
import { saveDoctorCourseAction } from "@/app/(site)/doctor/courses/actions";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Field, inputClasses, useFieldIds } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { courses as copy } from "@/content/courses";
import { cn } from "@/lib/cn";
import { courseLimits, doctorCoursesPath } from "@/lib/courses";
import { idleForm, type FormState } from "@/server/admin/form";

const text = copy.doctor.fields;

type Values = Record<string, string>;

/** A doctor's course: create (id null) or edit. Every save goes to staff review. */
export function DoctorCourseForm({ id, initial }: { id: number | null; initial?: Values }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveDoctorCourseAction.bind(null, id),
    idleForm,
  );
  const values: Values = { ...initial, ...state.values };
  const errors = state.fieldErrors ?? {};
  const field = (name: string) => ({
    name,
    defaultValue: values[name] ?? "",
    error: errors[name],
  });

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.status === "error" && state.message && <FormAlert>{state.message}</FormAlert>}
      <Input label={text.title} maxLength={courseLimits.title} required {...field("title")} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Input label={text.tag} help={text.tagHelp} maxLength={courseLimits.tag} required {...field("tag")} />
        <Input label={text.format} help={text.formatHelp} maxLength={courseLimits.format} required {...field("format")} />
      </div>
      <TextArea label={text.body} help={text.bodyHelp} rows={3} maxLength={courseLimits.body} required {...field("body")} />
      <TextArea label={text.details} help={text.detailsHelp} rows={8} maxLength={courseLimits.details} optional {...field("details")} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Input label={text.duration} help={text.durationHelp} maxLength={courseLimits.duration} optional {...field("duration")} />
        <Input
          label={text.price}
          help={text.priceHelp}
          inputMode="decimal"
          optional
          {...field("price")}
        />
      </div>
      <Input label={text.videoUrl} type="url" maxLength={300} optional {...field("videoUrl")} />
      <TextArea
        label={text.accessDetails}
        help={text.accessDetailsHelp}
        rows={5}
        maxLength={courseLimits.accessDetails}
        optional
        {...field("accessDetails")}
      />
      <p className="rounded-md bg-surface-alt p-4 text-small text-muted">{copy.doctor.payoutNote}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" loading={pending} className="max-sm:w-full">
          {text.submit}
        </Button>
        <Link
          href={doctorCoursesPath}
          className="inline-flex min-h-11 items-center justify-center px-3 text-sm font-bold text-brand hover:underline"
        >
          {text.cancel}
        </Link>
      </div>
    </form>
  );
}

function TextArea({
  label,
  help,
  error,
  optional,
  className,
  ...props
}: ComponentProps<"textarea"> & {
  label: string;
  help?: string;
  error?: string;
  optional?: boolean;
}) {
  const ids = useFieldIds(undefined, { help, error });
  return (
    <Field ids={ids} label={label} help={help} error={error} optional={optional}>
      <textarea
        id={ids.inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cn(inputClasses, "h-auto py-3 leading-relaxed", className)}
        {...props}
      />
    </Field>
  );
}
