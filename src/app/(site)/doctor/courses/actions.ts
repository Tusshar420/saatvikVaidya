"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { courses as copy } from "@/content/courses";
import { doctorCoursesPath } from "@/lib/courses";
import { formValues, type FormState } from "@/server/admin/form";
import { requireUser } from "@/server/auth/session";
import { contentTags } from "@/server/content/cache";
import { deleteDoctorCourse, saveDoctorCourse } from "@/server/courses/courses";

// Server actions for the doctor's course area (B2). Each one takes the user
// from the session; saveDoctorCourse and deleteDoctorCourse check that they
// are an approved doctor and that the course is theirs.

const idSchema = z.coerce.number().int().positive().max(2_147_483_647);

function refresh() {
  // A save unlists the course until staff approve it again.
  updateTag(contentTags.home);
  revalidatePath(doctorCoursesPath);
  revalidatePath("/courses");
}

export async function saveDoctorCourseAction(
  id: number | null,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireUser(doctorCoursesPath);
  const values = formValues(formData);
  const courseId = id === null ? null : idSchema.safeParse(id).data;
  if (courseId === undefined) return { status: "error", message: copy.doctor.errors.notFound, values };
  const result = await saveDoctorCourse({ id: user.id, name: user.name }, courseId, values);
  if (!result.ok) {
    return { status: "error", message: result.error, fieldErrors: result.fieldErrors, values };
  }
  refresh();
  redirect(`${doctorCoursesPath}?notice=saved`);
}

export async function deleteDoctorCourseAction(formData: FormData): Promise<void> {
  const { user } = await requireUser(doctorCoursesPath);
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) redirect(`${doctorCoursesPath}?error=notFound`);
  const result = await deleteDoctorCourse(user.id, id.data);
  refresh();
  if (result.ok) redirect(`${doctorCoursesPath}?notice=deleted`);
  redirect(
    `${doctorCoursesPath}?error=${result.error === copy.doctor.errors.notFound ? "notFound" : "hasEnrolments"}`,
  );
}
