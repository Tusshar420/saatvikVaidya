import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { FormAlert } from "@/components/site/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { courses as copy } from "@/content/courses";
import { courseHref, doctorCoursesPath } from "@/lib/courses";
import { formatPaise } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { listDoctorCourses, userCanTeach } from "@/server/courses/courses";
import { deleteDoctorCourseAction } from "./actions";
import { NotADoctor } from "./doctor-gate";

const text = copy.doctor;

export const metadata: Metadata = { title: text.metaTitle, robots: { index: false, follow: false } };

const statusBadge = { pending: "orange", published: "success", rejected: "gold" } as const;

/** The doctor's course area (B2): their courses, review status and enrolments. */
export default async function DoctorCoursesPage({ searchParams }: PageProps<"/doctor/courses">) {
  const { user } = await requireUser(doctorCoursesPath);
  if (!(await userCanTeach(user.id))) return <NotADoctor />;
  const [rows, params] = await Promise.all([listDoctorCourses(user.id), searchParams]);
  const notice = params.notice === "saved" ? text.saved : params.notice === "deleted" ? text.deleted : null;
  const error =
    params.error === "hasEnrolments" ? text.errors.hasEnrolments : params.error === "notFound" ? text.errors.notFound : null;

  return (
    <>
      <PageHero eyebrow={text.eyebrow} title={text.title} description={text.description}>
        <Link href={`${doctorCoursesPath}/new`} className={buttonClasses({ className: "mt-2 max-sm:w-full" })}>
          <Plus aria-hidden className="size-4" />
          {text.newCourse}
        </Link>
      </PageHero>
      <div className="shell flex flex-col gap-4 pt-7 pb-24 md:pt-13.5">
        {notice && <FormAlert tone="success">{notice}</FormAlert>}
        {error && <FormAlert>{error}</FormAlert>}
        {rows.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">{text.empty}</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-4">
            {rows.map((course) => (
              <li key={course.id}>
                <Card as="article" aria-labelledby={`course-${course.id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 id={`course-${course.id}`} className="text-h4 break-words text-ink">
                        {course.title}
                      </h2>
                      <p className="mt-1 text-small text-muted">
                        {course.pricePaise === null ? text.notPriced : formatPaise(course.pricePaise)}
                        {" · "}
                        {text.enrolments(course.enrolments)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={statusBadge[course.status]}>{text.status[course.status]}</Badge>
                      {!course.active && <Badge variant="soon">{text.hidden}</Badge>}
                    </div>
                  </div>
                  {course.status === "rejected" && course.reviewNote && (
                    <p className="mt-3 rounded-md bg-gold-soft px-3.5 py-2.5 text-sm text-gold-ink">
                      {text.reviewNote(course.reviewNote)}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3">
                    <Link
                      href={`${doctorCoursesPath}/${course.id}/edit`}
                      className="inline-flex min-h-11 items-center text-sm font-extrabold text-brand hover:underline"
                    >
                      {text.edit}
                    </Link>
                    <Link
                      href={courseHref(course.key)}
                      className="inline-flex min-h-11 items-center text-sm font-bold text-brand hover:underline"
                    >
                      {text.view}
                    </Link>
                    {course.enrolments === 0 && (
                      <form action={deleteDoctorCourseAction}>
                        <input type="hidden" name="id" value={course.id} />
                        <button
                          type="submit"
                          className="inline-flex min-h-11 cursor-pointer items-center text-sm font-bold text-danger hover:underline"
                        >
                          {text.delete}
                        </button>
                      </form>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
