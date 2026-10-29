import type { Metadata } from "next";
import { CourseForm } from "@/components/admin/course-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { admin as copy } from "@/content/admin";
import { requireAdmin } from "@/server/auth/session";
import { createCourseAction } from "../../actions";

export const metadata: Metadata = { title: copy.courses.newTitle };

export default async function NewCoursePage() {
  await requireAdmin("content");
  return (
    <>
      <AdminPageHeader
        eyebrow={copy.courses.eyebrow}
        title={copy.courses.newTitle}
      />
      <CourseForm
        mode="new"
        action={createCourseAction}
        initial={{ sortOrder: 100, active: false, gstRate: "18" }}
      />
    </>
  );
}
