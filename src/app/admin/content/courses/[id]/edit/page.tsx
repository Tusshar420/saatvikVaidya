import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseForm } from "@/components/admin/course-form";
import { CourseReview } from "@/components/admin/course-review";
import { AdminPageHeader } from "@/components/admin/page-header";
import { admin as copy } from "@/content/admin";
import { courses as coursesCopy } from "@/content/courses";
import { courseHref } from "@/lib/courses";
import { paiseToRupeeInput } from "@/lib/format";
import { getCourse } from "@/server/admin/content";
import { fieldValuesOf, intId } from "@/server/admin/form";
import { requireAdmin } from "@/server/auth/session";
import { enrolmentCounts } from "@/server/courses/courses";
import { reviewCourseAction, updateCourseAction } from "../../../actions";

export const metadata: Metadata = { title: copy.courses.metaTitle };

export default async function EditCoursePage({
  params,
}: PageProps<"/admin/content/courses/[id]/edit">) {
  await requireAdmin("content");
  const id = intId.safeParse((await params).id);
  const course = id.success ? await getCourse(id.data) : null;
  if (!course) notFound();
  const enrolments = (await enrolmentCounts([course.id])).get(course.id) ?? 0;
  const { author, ...row } = course;
  return (
    <>
      <AdminPageHeader
        eyebrow={copy.courses.eyebrow}
        title={copy.courses.editTitle(course.title)}
        action={
          <Link
            href={courseHref(course.key)}
            className="inline-flex min-h-11 items-center text-sm font-extrabold text-brand hover:underline"
          >
            {coursesCopy.doctor.view}
          </Link>
        }
      />
      {/* Doctors' courses (B2) wait for this review before they're listed. */}
      {author && (
        <CourseReview
          action={reviewCourseAction.bind(null, course.id)}
          status={course.status}
          authorName={author.name}
          reviewNote={course.reviewNote}
          enrolments={enrolments}
        />
      )}
      <CourseForm
        mode="edit"
        action={updateCourseAction.bind(null, course.id)}
        initial={{
          ...fieldValuesOf(row),
          price: course.pricePaise === null ? "" : paiseToRupeeInput(course.pricePaise),
          gstRate: String(course.gstRate),
        }}
      />
    </>
  );
}
