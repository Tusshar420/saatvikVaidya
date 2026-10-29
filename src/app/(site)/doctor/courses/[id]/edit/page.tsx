import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/site/page-hero";
import { DoctorCourseForm } from "@/components/site/courses/doctor-course-form";
import { Card } from "@/components/ui/card";
import { courses as copy } from "@/content/courses";
import { doctorCoursesPath } from "@/lib/courses";
import { requireUser } from "@/server/auth/session";
import { doctorCourseValues, userCanTeach } from "@/server/courses/courses";
import { NotADoctor } from "../../doctor-gate";

const text = copy.doctor;

export const metadata: Metadata = { title: text.editTitle, robots: { index: false, follow: false } };

/** A doctor edits one of their courses (B2); saving sends it back for review. */
export default async function EditDoctorCoursePage({ params }: PageProps<"/doctor/courses/[id]/edit">) {
  const raw = (await params).id;
  const { user } = await requireUser(`${doctorCoursesPath}/${raw}/edit`);
  if (!(await userCanTeach(user.id))) return <NotADoctor />;
  const id = /^\d{1,9}$/.test(raw) ? Number(raw) : null;
  const values = id === null ? null : await doctorCourseValues(user.id, id);
  if (id === null || !values) notFound();
  return (
    <>
      <PageHero eyebrow={text.eyebrow} title={text.editTitle} description={text.description} />
      <div className="shell pt-7 pb-24 md:pt-13.5">
        <Card className="max-w-3xl">
          <DoctorCourseForm id={id} initial={values} />
        </Card>
      </div>
    </>
  );
}
