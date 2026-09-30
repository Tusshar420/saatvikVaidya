import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CourseForm } from "@/components/admin/course-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { admin as copy } from "@/content/admin";
import { getCourse } from "@/server/admin/content";
import { fieldValuesOf, intId } from "@/server/admin/form";
import { requireAdmin } from "@/server/auth/session";
import { updateCourseAction } from "../../../actions";

export const metadata: Metadata = { title: copy.courses.metaTitle };

export default async function EditCoursePage({
  params,
}: PageProps<"/admin/content/courses/[id]/edit">) {
  await requireAdmin();
  const id = intId.safeParse((await params).id);
  const course = id.success ? await getCourse(id.data) : null;
  if (!course) notFound();
  return (
    <>
      <AdminPageHeader
        eyebrow={copy.courses.eyebrow}
        title={copy.courses.editTitle(course.title)}
      />
      <CourseForm
        mode="edit"
        action={updateCourseAction.bind(null, course.id)}
        initial={fieldValuesOf(course)}
      />
    </>
  );
}
